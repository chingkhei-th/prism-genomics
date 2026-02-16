"""
Dataset Preparation Pipeline — orchestrates the full data preparation workflow.

Runs all steps end-to-end:
  1. Fetch/load GWAS SNPs
  2. Process VCF → genotype matrix
  3. Compute PRS for all individuals
  4. Simulate disease labels
  5. Train ML model
  6. Save all artifacts

Usage:
    python -m src.data_preparation.prepare_dataset
"""

import logging
import sys
import time

import pandas as pd

from src.config import (
    GENOTYPE_MATRIX_FILE,
    GWAS_SNP_FILE,
    LABELED_DATASET_FILE,
    MODEL_METRICS_FILE,
    MODELS_DIR,
    POPULATION_STATS_FILE,
    PRS_SCORES_FILE,
    RISK_MODEL_FILE,
    SNP_WEIGHTS_FILE,
    VCF_INPUT_PATH,
)

# Set up logging before importing modules that use it
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def main() -> None:
    """Run the complete data preparation pipeline."""
    logger.info("=" * 70)
    logger.info("PRISM-Genomics — Data Preparation Pipeline")
    logger.info("=" * 70)
    pipeline_start = time.time()

    # ─── Step 1: Fetch GWAS SNPs ──────────────────────────────────────
    logger.info("")
    logger.info("━" * 50)
    logger.info("Step 1/6: Fetching GWAS SNPs")
    logger.info("━" * 50)

    from src.data_preparation.gwas_fetcher import fetch_gwas_snps

    step_start = time.time()
    gwas_snps_list = fetch_gwas_snps(output_path=GWAS_SNP_FILE, use_api=False)
    gwas_snps_df = pd.read_csv(GWAS_SNP_FILE)
    logger.info(f"Step 1 complete — {len(gwas_snps_list)} SNPs ({time.time() - step_start:.1f}s)")

    # ─── Step 2: Process VCF → Genotype Matrix ───────────────────────
    logger.info("")
    logger.info("━" * 50)
    logger.info("Step 2/6: Processing VCF → Genotype Matrix")
    logger.info("━" * 50)

    from src.data_preparation.vcf_processor import process_vcf

    step_start = time.time()

    if not VCF_INPUT_PATH.exists():
        logger.error(f"VCF file not found: {VCF_INPUT_PATH}")
        logger.error("Please ensure the 1000 Genomes VCF is at the configured path.")
        sys.exit(1)

    genotype_matrix = process_vcf(
        vcf_path=VCF_INPUT_PATH,
        gwas_csv_path=GWAS_SNP_FILE,
        output_path=GENOTYPE_MATRIX_FILE,
    )

    if genotype_matrix.empty:
        logger.error("Genotype matrix is empty — no SNPs matched. Aborting.")
        sys.exit(1)

    logger.info(f"Step 2 complete — matrix shape {genotype_matrix.shape} ({time.time() - step_start:.1f}s)")

    # ─── Step 3: Compute PRS ─────────────────────────────────────────
    logger.info("")
    logger.info("━" * 50)
    logger.info("Step 3/6: Computing Polygenic Risk Scores")
    logger.info("━" * 50)

    from src.prs_engine.calculator import compute_prs, save_snp_weights

    step_start = time.time()
    prs_raw = compute_prs(genotype_matrix, gwas_snps_df)

    # Save SNP weights
    save_snp_weights(gwas_snps_df, genotype_matrix.columns.tolist(), SNP_WEIGHTS_FILE)
    logger.info(f"Step 3 complete ({time.time() - step_start:.1f}s)")

    # ─── Step 4: Normalize PRS & Save Population Stats ───────────────
    logger.info("")
    logger.info("━" * 50)
    logger.info("Step 4/6: Normalizing PRS & Risk Categorization")
    logger.info("━" * 50)

    from src.prs_engine.normalizer import normalize_prs, save_population_stats

    step_start = time.time()
    prs_df = normalize_prs(prs_raw)

    # Save PRS scores
    prs_df.to_csv(PRS_SCORES_FILE)
    logger.info(f"Saved PRS scores to {PRS_SCORES_FILE}")

    # Save population statistics for inference
    save_population_stats(prs_raw, len(genotype_matrix.columns), POPULATION_STATS_FILE)
    logger.info(f"Step 4 complete ({time.time() - step_start:.1f}s)")

    # ─── Step 5: Simulate Disease Labels ─────────────────────────────
    logger.info("")
    logger.info("━" * 50)
    logger.info("Step 5/6: Simulating Disease Labels (Liability Threshold)")
    logger.info("━" * 50)

    from src.ml.label_simulator import simulate_disease_labels

    step_start = time.time()
    labeled_df = simulate_disease_labels(prs_df)

    # Save labeled dataset
    labeled_df.to_csv(LABELED_DATASET_FILE)
    logger.info(f"Saved labeled dataset to {LABELED_DATASET_FILE}")
    logger.info(f"Step 5 complete ({time.time() - step_start:.1f}s)")

    # ─── Step 6: Train ML Model ──────────────────────────────────────
    logger.info("")
    logger.info("━" * 50)
    logger.info("Step 6/6: Training XGBoost Risk Classifier")
    logger.info("━" * 50)

    from src.ml.trainer import prepare_features, train_risk_model

    step_start = time.time()
    features, labels = prepare_features(genotype_matrix, labeled_df)
    metrics = train_risk_model(
        features=features,
        labels=labels,
        model_output_path=RISK_MODEL_FILE,
        metrics_output_path=MODEL_METRICS_FILE,
    )
    logger.info(f"Step 6 complete ({time.time() - step_start:.1f}s)")

    # ─── Summary ─────────────────────────────────────────────────────
    total_time = time.time() - pipeline_start
    logger.info("")
    logger.info("=" * 70)
    logger.info("Pipeline Complete!")
    logger.info("=" * 70)
    logger.info(f"Total time: {total_time:.1f}s")
    logger.info("")
    logger.info("Output artifacts:")
    logger.info(f"  GWAS SNPs:        {GWAS_SNP_FILE}")
    logger.info(f"  Genotype Matrix:  {GENOTYPE_MATRIX_FILE}")
    logger.info(f"  PRS Scores:       {PRS_SCORES_FILE}")
    logger.info(f"  Labeled Dataset:  {LABELED_DATASET_FILE}")
    logger.info(f"  Population Stats: {POPULATION_STATS_FILE}")
    logger.info(f"  SNP Weights:      {SNP_WEIGHTS_FILE}")
    logger.info(f"  Trained Model:    {RISK_MODEL_FILE}")
    logger.info(f"  Model Metrics:    {MODEL_METRICS_FILE}")
    logger.info("")
    logger.info(f"ML Model ROC-AUC:   {metrics['test_roc_auc']:.4f}")
    logger.info(f"ML Model Accuracy:  {metrics['test_accuracy']:.4f}")
    logger.info("=" * 70)


if __name__ == "__main__":
    main()

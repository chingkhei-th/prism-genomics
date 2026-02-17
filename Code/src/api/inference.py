"""
Inference Engine — loads trained artifacts and processes user VCF uploads.

Handles the full inference pipeline:
  User VCF → Extract GWAS SNPs → Encode genotypes → Compute PRS
  → Normalize against population → ML prediction → Risk report
"""

import gzip
import json
import logging
import tempfile
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy import stats
from scipy.special import expit

from src.config import (
    GWAS_SNP_FILE,
    MODEL_METRICS_FILE,
    POPULATION_STATS_FILE,
    RISK_MODEL_FILE,
    SNP_WEIGHTS_FILE,
)

logger = logging.getLogger(__name__)


class RiskInferenceEngine:
    """
    Loads pre-computed artifacts and runs PRS inference on new VCF uploads.

    Usage:
        engine = RiskInferenceEngine()
        engine.load_artifacts()
        report = engine.analyze_vcf(vcf_bytes, filename)
    """

    def __init__(self) -> None:
        self.population_stats: dict | None = None
        self.snp_weights: dict | None = None
        self.model = None
        self.model_metrics: dict | None = None
        self._loaded = False

    def load_artifacts(self) -> None:
        """Load all pre-computed model artifacts from disk."""
        logger.info("Loading inference artifacts...")

        with open(POPULATION_STATS_FILE) as f:
            self.population_stats = json.load(f)

        with open(SNP_WEIGHTS_FILE) as f:
            self.snp_weights = json.load(f)

        self.model = joblib.load(RISK_MODEL_FILE)

        with open(MODEL_METRICS_FILE) as f:
            self.model_metrics = json.load(f)

        n_snps = self.snp_weights["snps_used"]
        logger.info(f"Loaded artifacts: {n_snps} SNPs, model ROC-AUC={self.model_metrics['test_roc_auc']:.3f}")
        self._loaded = True

    def _get_snp_position_map(self) -> dict[int, dict]:
        """Build a position → SNP info lookup from the loaded weights."""
        pos_map: dict[int, dict] = {}
        for snp in self.snp_weights["weights"]:
            pos_map[snp["pos"]] = {
                "rsid": snp["rsid"],
                "beta": snp["beta"],
                "trait": snp["trait"],
            }
        return pos_map

    def _parse_vcf_bytes(self, vcf_bytes: bytes, filename: str) -> dict[str, float]:
        """
        Parse a VCF from bytes and extract genotypes at GWAS positions.

        Args:
            vcf_bytes: Raw bytes of the uploaded VCF file.
            filename: Original filename (used to detect .gz).

        Returns:
            Dict mapping rsid → encoded genotype value.
        """
        snp_positions = self._get_snp_position_map()
        target_positions = set(snp_positions.keys())
        genotypes: dict[str, float] = {}

        # Write to temp file so we can handle gzip properly
        suffix = ".vcf.gz" if filename.endswith(".gz") else ".vcf"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(vcf_bytes)
            tmp_path = Path(tmp.name)

        try:
            is_gzipped = filename.endswith(".gz")
            open_fn = gzip.open if is_gzipped else open

            sample_idx = 0  # default to first sample if multi-sample
            total_variants = 0

            with open_fn(tmp_path, "rt", encoding="utf-8", errors="replace") as f:
                for line in f:
                    if line.startswith("##"):
                        continue
                    if line.startswith("#CHROM"):
                        fields = line.strip().split("\t")
                        n_samples = len(fields) - 9
                        logger.info(f"User VCF contains {n_samples} sample(s)")
                        continue

                    fields = line.strip().split("\t")
                    if len(fields) < 10:
                        continue

                    total_variants += 1
                    pos = int(fields[1])

                    if pos not in target_positions:
                        continue

                    snp_info = snp_positions[pos]
                    gt_str = fields[9 + sample_idx].split(":")[0].replace("|", "/")

                    # Encode genotype
                    if gt_str == "0/0":
                        gt_val = 0.0
                    elif gt_str in ("0/1", "1/0"):
                        gt_val = 1.0
                    elif gt_str == "1/1":
                        gt_val = 2.0
                    else:
                        gt_val = np.nan

                    genotypes[snp_info["rsid"]] = gt_val

                    target_positions.discard(pos)
                    if not target_positions:
                        break

            logger.info(f"Scanned {total_variants:,} user variants, matched {len(genotypes)} SNPs")
        finally:
            tmp_path.unlink(missing_ok=True)

        return genotypes

    def analyze_vcf(self, vcf_bytes: bytes, filename: str) -> dict:
        """
        Full inference pipeline: VCF bytes → risk report.

        Args:
            vcf_bytes: Raw bytes of the uploaded VCF file.
            filename: Original filename.

        Returns:
            Risk report dictionary.
        """
        if not self._loaded:
            self.load_artifacts()

        # Step 1: Parse VCF and extract genotypes
        genotypes = self._parse_vcf_bytes(vcf_bytes, filename)

        if not genotypes:
            return {
                "status": "error",
                "message": "No matching GWAS SNPs found in uploaded VCF. "
                           "Ensure the file contains chromosome 1 variants.",
            }

        # Step 2: Compute PRS = Σ(β × genotype)
        snp_details: list[dict] = []
        prs_raw = 0.0
        snp_weights_map = {s["rsid"]: s for s in self.snp_weights["weights"]}

        for rsid, gt_val in genotypes.items():
            if np.isnan(gt_val):
                continue
            snp = snp_weights_map[rsid]
            contribution = snp["beta"] * gt_val
            prs_raw += contribution
            snp_details.append({
                "rsid": rsid,
                "position": snp["pos"],
                "genotype": int(gt_val),
                "beta": snp["beta"],
                "contribution": round(contribution, 4),
                "trait": snp["trait"],
            })

        # Sort by contribution (descending) to show top contributing SNPs
        snp_details.sort(key=lambda x: abs(x["contribution"]), reverse=True)

        # Step 3: Normalize against population
        mean_prs = self.population_stats["mean_prs"]
        std_prs = self.population_stats["std_prs"]
        z_score = (prs_raw - mean_prs) / std_prs
        percentile = float(stats.norm.cdf(z_score) * 100)

        # Step 4: Risk category
        if percentile < 40:
            risk_category = "Low"
        elif percentile < 75:
            risk_category = "Moderate"
        else:
            risk_category = "High"

        # Step 5: ML model prediction
        # Use the model's own feature names to ensure correct alignment
        model_feature_names = self.model.get_booster().feature_names
        feature_vector = []
        for fname in model_feature_names:
            if fname == "prs_raw":
                feature_vector.append(prs_raw)
            else:
                gt_val = genotypes.get(fname, np.nan)
                # Impute missing with 0 (reference genotype)
                feature_vector.append(gt_val if not np.isnan(gt_val) else 0.0)

        features_df = pd.DataFrame([feature_vector], columns=model_feature_names)
        ml_prediction = int(self.model.predict(features_df)[0])
        ml_probability = float(self.model.predict_proba(features_df)[0][1])

        # Build the report
        report = {
            "status": "success",
            "risk_assessment": {
                "prs_raw": round(prs_raw, 4),
                "prs_normalized_percent": round(percentile, 1),
                "z_score": round(z_score, 4),
                "percentile": round(percentile, 1),
                "risk_category": risk_category,
            },
            "ml_prediction": {
                "disease_risk_label": "At Risk" if ml_prediction == 1 else "Normal",
                "disease_probability": round(ml_probability, 4),
            },
            "snp_analysis": {
                "total_gwas_snps": self.snp_weights["snps_used"],
                "matched_in_upload": len(genotypes),
                "top_contributing_snps": snp_details[:10],
            },
            "population_reference": {
                "reference_dataset": "1000 Genomes Phase 3 (chr1)",
                "reference_samples": self.population_stats["n_samples"],
                "population_mean_prs": round(mean_prs, 4),
                "population_std_prs": round(std_prs, 4),
            },
            "model_info": {
                "model_type": "XGBoost Classifier",
                "model_roc_auc": self.model_metrics.get("test_roc_auc"),
                "model_accuracy": self.model_metrics.get("test_accuracy"),
            },
            "disclaimer": (
                "This report is for research and educational purposes only. "
                "It is NOT a medical diagnosis. Genetic counseling is recommended "
                "before making any health decisions based on these results."
            ),
        }

        logger.info(
            f"Analysis complete: PRS={prs_raw:.4f}, percentile={percentile:.1f}%, "
            f"risk={risk_category}, ML_prob={ml_probability:.3f}"
        )

        return report

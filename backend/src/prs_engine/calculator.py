"""
PRS Calculator — computes Polygenic Risk Scores for all individuals.

PRS = Σ(beta × genotype) for each individual across all matched SNPs.
"""

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def compute_prs(
    genotype_matrix: pd.DataFrame,
    gwas_snps: pd.DataFrame,
) -> pd.Series:
    """
    Compute PRS for all individuals in the genotype matrix.

    PRS_i = Σ_j (beta_j × genotype_ij)

    Missing genotypes are imputed with the population mean for that SNP
    before computing the weighted sum.

    Args:
        genotype_matrix: DataFrame (samples × SNPs) with encoded genotypes.
        gwas_snps: DataFrame with columns [rsid, beta, ...].

    Returns:
        Series of PRS values indexed by sample_id.
    """
    # Build a beta weight vector aligned to the genotype matrix columns
    snp_betas = gwas_snps.set_index("rsid")["beta"]

    # Only keep SNPs that are in both the matrix and the GWAS list
    common_snps = genotype_matrix.columns.intersection(snp_betas.index)
    if len(common_snps) == 0:
        logger.error("No overlapping SNPs between genotype matrix and GWAS weights!")
        return pd.Series(dtype=float)

    logger.info(f"Computing PRS using {len(common_snps)} SNPs")

    matrix = genotype_matrix[common_snps].copy()
    betas = snp_betas[common_snps]

    # Impute missing genotypes with the column (SNP) mean
    # This is standard practice — assumes population average for missing data
    missing_before = matrix.isna().sum().sum()
    if missing_before > 0:
        snp_means = matrix.mean()
        matrix = matrix.fillna(snp_means)
        logger.info(f"Imputed {missing_before:,} missing values with SNP population means")

    # PRS = genotype_matrix @ beta_vector
    prs = matrix.dot(betas)
    prs.name = "prs_raw"

    logger.info(f"PRS computed for {len(prs)} individuals")
    logger.info(f"  Mean PRS: {prs.mean():.4f}")
    logger.info(f"  Std PRS:  {prs.std():.4f}")
    logger.info(f"  Min PRS:  {prs.min():.4f}")
    logger.info(f"  Max PRS:  {prs.max():.4f}")

    return prs


def save_snp_weights(
    gwas_snps: pd.DataFrame,
    genotype_columns: list[str],
    output_path: Path,
) -> None:
    """
    Save the SNP weight vector used for PRS computation.

    Args:
        gwas_snps: Full GWAS SNP DataFrame.
        genotype_columns: SNP IDs that were actually matched in the VCF.
        output_path: Path to save the JSON file.
    """
    matched = gwas_snps[gwas_snps["rsid"].isin(genotype_columns)]
    weights = {
        "snps_used": len(matched),
        "weights": [
            {
                "rsid": row["rsid"],
                "chr": str(row["chr"]),
                "pos": int(row["pos"]),
                "beta": float(row["beta"]),
                "trait": row["trait"],
            }
            for _, row in matched.iterrows()
        ],
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(weights, f, indent=2)

    logger.info(f"Saved SNP weights ({len(matched)} SNPs) to {output_path}")

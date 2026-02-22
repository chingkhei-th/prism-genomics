"""
PRS Normalizer — z-score computation, percentile mapping, and risk categorization.

Uses the 1000 Genomes reference population to establish baseline statistics,
then normalizes individual PRS values to percentiles.
"""

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)

# Risk thresholds based on percentile rank
RISK_THRESHOLDS = {
    "low": 40,       # < 40th percentile
    "moderate": 75,   # 40-75th percentile
    "high": 100,      # > 75th percentile
}


def normalize_prs(
    prs_scores: pd.Series,
) -> pd.DataFrame:
    """
    Normalize PRS scores to z-scores, percentiles, and risk categories.

    z = (PRS_individual − mean) / std
    percentile = Φ(z) × 100  (using normal CDF)

    Args:
        prs_scores: Series of raw PRS values indexed by sample_id.

    Returns:
        DataFrame with columns [prs_raw, z_score, percentile, risk_category].
    """
    mean_prs = prs_scores.mean()
    std_prs = prs_scores.std()

    logger.info(f"Population PRS — Mean: {mean_prs:.4f}, Std: {std_prs:.4f}")

    # Compute z-scores
    z_scores = (prs_scores - mean_prs) / std_prs

    # Convert z-scores to percentiles using the normal CDF
    percentiles = stats.norm.cdf(z_scores) * 100

    # Assign risk categories
    risk_categories = pd.cut(
        percentiles,
        bins=[0, RISK_THRESHOLDS["low"], RISK_THRESHOLDS["moderate"], 100],
        labels=["Low", "Moderate", "High"],
        include_lowest=True,
    )

    result = pd.DataFrame({
        "prs_raw": prs_scores,
        "z_score": z_scores,
        "percentile": percentiles,
        "risk_category": risk_categories,
    })
    result.index.name = "sample_id"

    # Log distribution summary
    category_counts = result["risk_category"].value_counts()
    logger.info("Risk distribution:")
    for cat in ["Low", "Moderate", "High"]:
        count = category_counts.get(cat, 0)
        pct = (count / len(result)) * 100
        logger.info(f"  {cat}: {count} ({pct:.1f}%)")

    return result


def save_population_stats(
    prs_scores: pd.Series,
    n_snps_used: int,
    output_path: Path,
) -> dict:
    """
    Save population-level PRS statistics for use during inference.

    These values are the "trained model" for PRS normalization — when a
    new user uploads their VCF, we compare their PRS against these stats.

    Args:
        prs_scores: Series of raw PRS values from the reference population.
        n_snps_used: Number of SNPs used in the PRS computation.
        output_path: Path to save the JSON file.

    Returns:
        Dictionary of population statistics.
    """
    pop_stats = {
        "mean_prs": float(prs_scores.mean()),
        "std_prs": float(prs_scores.std()),
        "median_prs": float(prs_scores.median()),
        "min_prs": float(prs_scores.min()),
        "max_prs": float(prs_scores.max()),
        "n_samples": int(len(prs_scores)),
        "n_snps_used": n_snps_used,
        "risk_thresholds": RISK_THRESHOLDS,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(pop_stats, f, indent=2)

    logger.info(f"Saved population stats to {output_path}")
    return pop_stats

"""
Disease Label Simulator — generates realistic binary disease labels using liability threshold model.

The liability threshold model is a standard genetics concept where disease
risk is modeled as a latent continuous variable (liability) that combines
genetic predisposition (PRS) with environmental factors. Individuals whose
liability exceeds a threshold are labeled as "affected".
"""

import logging

import numpy as np
import pandas as pd

from src.config import DISEASE_PREVALENCE, HERITABILITY, RANDOM_SEED

logger = logging.getLogger(__name__)


def simulate_disease_labels(
    prs_scores: pd.DataFrame,
    heritability: float | None = None,
    prevalence: float | None = None,
    seed: int | None = None,
) -> pd.DataFrame:
    """
    Generate binary disease labels using a liability threshold model.

    liability_i = sqrt(h²) × PRS_normalized_i + sqrt(1 - h²) × ε_i
    where ε ~ N(0, 1) is environmental noise

    Disease label = 1 if P(disease | liability) > threshold derived from prevalence

    Args:
        prs_scores: DataFrame with at least a 'prs_raw' or 'z_score' column.
        heritability: Fraction of liability explained by genetics (0-1).
        prevalence: Expected disease prevalence in the population (0-1).
        seed: Random seed for reproducibility.

    Returns:
        DataFrame with original columns plus 'liability', 'disease_prob', 'disease_label'.
    """
    h2 = heritability if heritability is not None else HERITABILITY
    prev = prevalence if prevalence is not None else DISEASE_PREVALENCE
    rng_seed = seed if seed is not None else RANDOM_SEED

    logger.info(f"Simulating disease labels (h²={h2}, prevalence={prev})")

    rng = np.random.default_rng(rng_seed)
    n = len(prs_scores)

    # Normalize PRS to zero mean, unit variance
    if "z_score" in prs_scores.columns:
        prs_normalized = prs_scores["z_score"].values
    else:
        prs_raw = prs_scores["prs_raw"].values
        prs_normalized = (prs_raw - prs_raw.mean()) / prs_raw.std()

    # Liability = genetic component + environmental noise
    genetic_component = np.sqrt(h2) * prs_normalized
    environmental_noise = np.sqrt(1 - h2) * rng.standard_normal(n)
    liability = genetic_component + environmental_noise

    # Convert liability to disease probability using logistic function
    # Scale to get approximate target prevalence
    from scipy.special import expit
    # Shift the liability so that sigmoid(liability) averages to ~prevalence
    # logit(prevalence) gives us the offset
    offset = np.log(prev / (1 - prev))
    disease_prob = expit(liability + offset)

    # Sample binary labels from probabilities
    disease_label = rng.binomial(1, disease_prob)

    # Add to the dataframe
    result = prs_scores.copy()
    result["liability"] = liability
    result["disease_prob"] = disease_prob
    result["disease_label"] = disease_label

    # Report stats
    actual_prev = disease_label.mean()
    logger.info(f"Generated {disease_label.sum()} positive cases out of {n} samples")
    logger.info(f"Actual prevalence: {actual_prev:.3f} (target: {prev})")

    # Verify that PRS correlates with disease labels
    from scipy.stats import pointbiserialr
    corr, p_val = pointbiserialr(disease_label, prs_normalized)
    logger.info(f"PRS–disease correlation: r={corr:.3f} (p={p_val:.2e})")

    return result

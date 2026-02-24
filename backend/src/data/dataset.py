"""
PyTorch Dataset for genomic genotype data.

Loads pre-extracted feature tensors (genotype matrix) and labels
produced by the feature_extractor module.
"""

import logging
from pathlib import Path

import torch
from torch.utils.data import Dataset

from src.config import FEATURES_FILE, LABELS_FILE

logger = logging.getLogger(__name__)


class GenomicDataset(Dataset):
    """
    Dataset of genotype vectors and binary Pathogenic/Benign labels.

    Each sample is one row from the 1000 Genomes genotype matrix,
    representing a person's genotype across clinically significant SNPs.
    Labels indicate the clinical significance of the corresponding variant pattern.
    """

    def __init__(
        self,
        features_path: Path | None = None,
        labels_path: Path | None = None,
    ) -> None:
        features_path = features_path or FEATURES_FILE
        labels_path = labels_path or LABELS_FILE

        if not features_path.exists():
            raise FileNotFoundError(
                f"Features file not found: {features_path}. "
                f"Run the feature extraction pipeline first."
            )
        if not labels_path.exists():
            raise FileNotFoundError(
                f"Labels file not found: {labels_path}. "
                f"Run the feature extraction pipeline first."
            )

        self.features: torch.Tensor = torch.load(features_path, weights_only=True)
        self.labels: torch.Tensor = torch.load(labels_path, weights_only=True)

        # features shape: (n_samples, n_snps)
        # labels shape: (n_snps,) — one label per SNP column
        # For training: each sample gets ALL the genotypes as input,
        # and we treat it as a multi-label or we need to reshape.

        # The model predicts disease risk per sample, so we need per-sample labels.
        # Strategy: each sample's label = proportion of pathogenic alleles they carry
        # weighted by genotype value. A sample carrying more pathogenic alleles
        # has higher risk.
        self._build_sample_labels()

        logger.info(
            f"Loaded dataset: {len(self)} samples, "
            f"{self.features.shape[1]} SNP features"
        )

    def _build_sample_labels(self) -> None:
        """
        Create per-sample binary labels from genotype × SNP-label interaction.

        A sample is labeled 'high risk' (1) if their weighted pathogenic burden
        is above the median, otherwise 'low risk' (0). This simulates a
        realistic disease susceptibility signal from genotype data.
        """
        # Weight each SNP by its clinical label (1=pathogenic, 0=benign)
        # and count how many pathogenic alt alleles each sample carries
        pathogenic_mask = self.labels.float()  # (n_snps,)
        burden = (self.features * pathogenic_mask.unsqueeze(0)).sum(dim=1)  # (n_samples,)

        # Binary split at the median burden
        median_burden = burden.median()
        self.sample_labels = (burden > median_burden).float()  # (n_samples,)

        n_high = int(self.sample_labels.sum().item())
        n_low = len(self.sample_labels) - n_high
        logger.info(
            f"Sample labels: {n_high} high-risk, {n_low} low-risk "
            f"(median burden: {median_burden:.2f})"
        )

    def __len__(self) -> int:
        return self.features.shape[0]

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        return self.features[idx], self.sample_labels[idx]

    @property
    def n_features(self) -> int:
        """Number of SNP features (input dimension for the model)."""
        return self.features.shape[1]

"""
Inference Engine — loads trained PyTorch model and processes patient VCFs.

Workflow:
    1. Load model weights + SNP metadata at startup
    2. Accept patient VCF bytes → parse genotypes at trained SNP positions
    3. Pass genotype vector through the model → disease probability
    4. Return structured risk report with high-impact variants
"""

import gzip
import json
import logging
from io import BytesIO
from pathlib import Path

import numpy as np
import torch

from src.config import DEVICE, MODEL_WEIGHTS_PATH, SNP_METADATA_FILE
from src.model.architecture import GenomicMLP

logger = logging.getLogger(__name__)


class InferenceEngine:
    """Loads a trained GenomicMLP and analyzes patient VCF uploads."""

    def __init__(self) -> None:
        self.model: GenomicMLP | None = None
        self.snp_metadata: dict | None = None
        self.snp_positions: dict[int, dict] = {}  # pos → snp info
        self.device = torch.device(DEVICE)
        self._loaded = False

    def load_artifacts(
        self,
        weights_path: Path | None = None,
        metadata_path: Path | None = None,
    ) -> None:
        """Load trained model and SNP metadata."""
        weights_path = weights_path or MODEL_WEIGHTS_PATH
        metadata_path = metadata_path or SNP_METADATA_FILE

        if not weights_path.exists():
            raise FileNotFoundError(
                f"Model weights not found: {weights_path}. Train the model first."
            )
        if not metadata_path.exists():
            raise FileNotFoundError(
                f"SNP metadata not found: {metadata_path}. Run feature extraction first."
            )

        # Load metadata
        with open(metadata_path) as f:
            self.snp_metadata = json.load(f)

        # Build position → snp lookup for fast matching
        for snp in self.snp_metadata["snps"]:
            self.snp_positions[snp["pos"]] = snp

        # Load model
        checkpoint = torch.load(weights_path, map_location=self.device, weights_only=True)
        input_size = checkpoint["input_size"]
        hidden_sizes = tuple(checkpoint.get("hidden_sizes", (512, 256)))
        dropout = checkpoint.get("dropout", 0.3)

        self.model = GenomicMLP(
            input_size=input_size,
            hidden_sizes=hidden_sizes,
            dropout=dropout,
        )
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()

        self._loaded = True
        logger.info(
            f"Inference engine loaded: {input_size} features, "
            f"{len(self.snp_positions)} SNP positions"
        )

    def _parse_patient_vcf(self, vcf_bytes: bytes, filename: str) -> dict[int, int]:
        """
        Parse a patient VCF and extract genotypes at trained SNP positions.

        Returns:
            Dict mapping position → alt-allele count (0, 1, or 2).
        """
        genotypes: dict[int, int] = {}

        # Handle gzipped files
        if filename.endswith(".gz"):
            text = gzip.decompress(vcf_bytes).decode("utf-8", errors="replace")
        else:
            text = vcf_bytes.decode("utf-8", errors="replace")

        for line in text.splitlines():
            if line.startswith("#"):
                continue

            fields = line.strip().split("\t")
            if len(fields) < 10:
                continue

            pos = int(fields[1])

            # Only process positions we trained on
            if pos not in self.snp_positions:
                continue

            # Parse genotype from sample column (first sample — patient VCFs
            # typically have a single sample)
            gt_field = fields[9]
            gt = gt_field.split(":")[0]  # take only GT subfield
            alleles = gt.replace("|", "/").split("/")

            if "." in alleles:
                continue

            try:
                alt_count = sum(int(a) > 0 for a in alleles)
                genotypes[pos] = alt_count
            except ValueError:
                continue

        logger.info(
            f"Patient VCF: matched {len(genotypes)} / "
            f"{len(self.snp_positions)} trained positions"
        )

        return genotypes

    def analyze_vcf(self, vcf_bytes: bytes, filename: str) -> dict:
        """
        Analyze a patient VCF and return a risk assessment.

        Args:
            vcf_bytes: Raw bytes of the uploaded VCF file.
            filename: Original filename (to detect .gz compression).

        Returns:
            Risk assessment dict with probability, risk level, and variant details.
        """
        if not self._loaded:
            return {"status": "error", "message": "Model not loaded"}

        # Parse patient genotypes
        genotypes = self._parse_patient_vcf(vcf_bytes, filename)

        if not genotypes:
            return {
                "status": "error",
                "message": "No matching variants found in uploaded VCF",
                "matched_variants": 0,
                "total_model_variants": len(self.snp_positions),
            }

        # Build input tensor in the same column order as training.
        # Initialize with population mean genotypes so unmatched positions
        # don't bias the prediction toward zero risk.
        n_features = self.snp_metadata["n_snps"]
        input_vector = np.zeros(n_features, dtype=np.float32)

        # Pre-fill with population averages from training data
        for snp in self.snp_metadata["snps"]:
            idx = snp["index"]
            input_vector[idx] = snp.get("pop_mean", 0.0)

        matched_count = 0
        high_impact_variants: list[dict] = []

        for snp in self.snp_metadata["snps"]:
            idx = snp["index"]
            pos = snp["pos"]

            if pos in genotypes:
                alt_count = genotypes[pos]
                input_vector[idx] = alt_count  # override pop_mean with actual
                matched_count += 1

                # Flag pathogenic variants where patient carries alt alleles
                if snp["label"] == 1 and alt_count > 0:
                    high_impact_variants.append({
                        "rsid": snp["rsid"],
                        "chromosome": snp.get("chrom", "unknown"),
                        "position": pos,
                        "genotype": f"{alt_count}/2",
                        "clinical_significance": snp["clnsig"],
                        "disease": snp["disease"],
                    })

        # Run inference
        input_tensor = torch.from_numpy(input_vector).unsqueeze(0).to(self.device)

        with torch.no_grad():
            probability = self.model(input_tensor).item()

        # Determine risk level
        if probability >= 0.7:
            risk_level = "High"
        elif probability >= 0.4:
            risk_level = "Moderate"
        else:
            risk_level = "Low"

        # Sort high-impact variants by genotype (homozygous alt first)
        high_impact_variants.sort(key=lambda v: v["genotype"], reverse=True)

        coverage = matched_count / len(self.snp_positions) * 100

        return {
            "status": "success",
            "risk_assessment": {
                "disease_probability": round(probability, 4),
                "risk_level": risk_level,
                "confidence_note": (
                    "High confidence" if coverage > 50
                    else "Low confidence — limited variant coverage"
                ),
            },
            "variant_analysis": {
                "total_model_variants": len(self.snp_positions),
                "matched_in_upload": matched_count,
                "coverage_percent": round(coverage, 1),
                "high_impact_variants": high_impact_variants[:20],
                "n_pathogenic_with_alt": len(high_impact_variants),
            },
            "model_info": {
                "architecture": "GenomicMLP",
                "n_features": n_features,
                "chromosomes": self.snp_metadata.get("chromosomes", []),
                "n_training_samples": self.snp_metadata.get("n_samples", "unknown"),
            },
        }


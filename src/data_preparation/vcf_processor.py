"""
VCF Processor — parses 1000 Genomes VCF, filters to GWAS SNPs, and builds genotype matrix.

Uses Python's built-in gzip module to stream the VCF for full Windows
compatibility. Encodes genotype values: 0/0→0, 0/1→1, 1/1→2, missing→NaN.
"""

import gzip
import logging
from pathlib import Path

import numpy as np
import pandas as pd
from tqdm import tqdm

logger = logging.getLogger(__name__)


def load_gwas_positions(gwas_csv_path: Path) -> dict[int, dict]:
    """
    Load GWAS SNP positions from the curated CSV.

    Args:
        gwas_csv_path: Path to the GWAS SNP CSV file.

    Returns:
        Dictionary mapping position → SNP info dict.
    """
    df = pd.read_csv(gwas_csv_path)
    positions: dict[int, dict] = {}
    for _, row in df.iterrows():
        pos = int(row["pos"])
        positions[pos] = {
            "rsid": row["rsid"],
            "chr": str(row["chr"]),
            "effect_allele": row["effect_allele"],
            "other_allele": row.get("other_allele", "N"),
            "beta": float(row["beta"]),
            "trait": row["trait"],
        }
    logger.info(f"Loaded {len(positions)} GWAS SNP positions from {gwas_csv_path}")
    return positions


def encode_genotype(gt_str: str) -> float:
    """
    Convert a VCF genotype string to numeric dosage.

    Args:
        gt_str: Genotype string like '0/0', '0|0', '0/1', '1/1', './.', etc.

    Returns:
        Float dosage value (0, 1, 2, or NaN for missing).
    """
    # Normalize phased separator to unphased
    gt = gt_str.replace("|", "/").split(":")[0]  # take only GT, ignore other FORMAT fields

    if gt in ("0/0",):
        return 0.0
    elif gt in ("0/1", "1/0"):
        return 1.0
    elif gt in ("1/1",):
        return 2.0
    else:
        # Missing, multi-allelic, or other exotic genotypes
        return np.nan


def process_vcf(
    vcf_path: Path,
    gwas_csv_path: Path,
    output_path: Path,
) -> pd.DataFrame:
    """
    Parse the VCF file, filter to GWAS SNP positions, and build genotype matrix.

    Streams through the VCF line-by-line using gzip, matching variant
    positions against the GWAS target set. For matched variants, extracts
    and encodes genotypes for all samples.

    Args:
        vcf_path: Path to the input VCF (.vcf or .vcf.gz).
        gwas_csv_path: Path to the GWAS SNP CSV.
        output_path: Path to save the genotype matrix (parquet).

    Returns:
        DataFrame with shape (n_samples, n_matched_snps).
    """
    # Load target positions
    gwas_positions = load_gwas_positions(gwas_csv_path)
    target_positions = set(gwas_positions.keys())

    logger.info(f"Opening VCF: {vcf_path}")
    logger.info(f"Searching for {len(target_positions)} GWAS SNP positions...")

    # Determine if gzipped
    is_gzipped = str(vcf_path).endswith(".gz")
    open_fn = gzip.open if is_gzipped else open

    sample_names: list[str] = []
    matched_snps: dict[str, list[float]] = {}
    matched_info: list[dict] = []
    total_variants = 0
    matched_count = 0

    with open_fn(vcf_path, "rt", encoding="utf-8", errors="replace") as f:
        for line in tqdm(f, desc="Scanning VCF", unit=" lines"):
            # Skip meta-information lines
            if line.startswith("##"):
                continue

            # Parse header line to get sample names
            if line.startswith("#CHROM"):
                fields = line.strip().split("\t")
                # Columns: CHROM, POS, ID, REF, ALT, QUAL, FILTER, INFO, FORMAT, samples...
                sample_names = fields[9:]
                logger.info(f"VCF contains {len(sample_names)} samples")
                continue

            # Parse variant lines
            fields = line.strip().split("\t")
            if len(fields) < 10:
                continue

            total_variants += 1
            pos = int(fields[1])

            # Check if this position is in our target set
            if pos not in target_positions:
                continue

            matched_count += 1
            snp_info = gwas_positions[pos]
            snp_id = snp_info["rsid"]

            # Extract genotypes for all samples (columns 9+)
            genotypes = [encode_genotype(gt) for gt in fields[9:]]
            matched_snps[snp_id] = genotypes
            matched_info.append(snp_info)

            logger.info(
                f"  ✓ Matched: {snp_id} at pos {pos:,} "
                f"(trait: {snp_info['trait']}, β={snp_info['beta']})"
            )

            # Remove matched position so we can exit early if all are found
            target_positions.discard(pos)
            if not target_positions:
                logger.info("All target SNPs found — stopping early!")
                break

    logger.info(
        f"Scanned {total_variants:,} variants, matched {matched_count}/{len(gwas_positions)} GWAS SNPs"
    )

    if not matched_snps:
        logger.error("No GWAS SNPs found in VCF! Check position alignment.")
        return pd.DataFrame()

    if not sample_names:
        logger.error("No sample names found in VCF header!")
        return pd.DataFrame()

    # Build the genotype matrix: rows=samples, columns=SNPs
    genotype_matrix = pd.DataFrame(
        matched_snps,
        index=sample_names,
    )
    genotype_matrix.index.name = "sample_id"

    # Save as parquet for efficient storage
    output_path.parent.mkdir(parents=True, exist_ok=True)
    genotype_matrix.to_parquet(output_path)

    # Summary stats
    n_missing = genotype_matrix.isna().sum().sum()
    total_vals = genotype_matrix.shape[0] * genotype_matrix.shape[1]
    missing_pct = (n_missing / total_vals * 100) if total_vals > 0 else 0

    logger.info(f"Genotype matrix shape: {genotype_matrix.shape}")
    logger.info(f"Missing values: {n_missing:,} ({missing_pct:.2f}%)")
    logger.info(f"Saved genotype matrix to {output_path}")

    return genotype_matrix

"""
Feature Extractor — intersects ClinVar labels with 1000 Genomes genotypes.

Pipeline:
    1. Parse ClinVar VCF → extract Pathogenic / Benign SNP positions
    2. Auto-discover 1000 Genomes VCF files for each chromosome
    3. Stream each VCF → for each ClinVar SNP, pull genotypes for all samples
    4. Encode genotypes as alt-allele counts (0, 1, 2), impute missing with mode
    5. Concatenate all chromosomes → save features.pt, labels.pt, snp_metadata.json

Supports multi-chromosome processing (e.g. chr1 + chr22) for better model accuracy.
"""

import gzip
import json
import logging
from pathlib import Path

import numpy as np
import torch
from tqdm import tqdm

from src.config import (
    CHROMOSOMES,
    CLINVAR_VCF_PATH,
    FEATURES_FILE,
    LABELS_FILE,
    MAX_CLINVAR_VARIANTS,
    PROCESSED_DIR,
    RAW_DATA_DIR,
    SNP_METADATA_FILE,
)

logger = logging.getLogger(__name__)

# ClinVar CLNSIG values we care about
PATHOGENIC_LABELS = {
    "Pathogenic",
    "Likely_pathogenic",
    "Pathogenic/Likely_pathogenic",
}
BENIGN_LABELS = {
    "Benign",
    "Likely_benign",
    "Benign/Likely_benign",
}


def _parse_info_field(info_str: str) -> dict[str, str]:
    """Parse a VCF INFO column into a key-value dict."""
    result: dict[str, str] = {}
    for entry in info_str.split(";"):
        if "=" in entry:
            key, value = entry.split("=", 1)
            result[key] = value
        else:
            result[entry] = ""
    return result


def _encode_genotype(gt_str: str) -> int | None:
    """
    Convert a VCF genotype string to alt-allele count.

    '0/0' or '0|0' → 0  (homozygous ref)
    '0/1' or '0|1' → 1  (heterozygous)
    '1/1' or '1|1' → 2  (homozygous alt)
    './.' or '.|.' → None (missing)
    """
    gt = gt_str.split(":")[0]  # take only the GT field
    alleles = gt.replace("|", "/").split("/")
    if "." in alleles:
        return None
    try:
        return sum(int(a) > 0 for a in alleles)
    except ValueError:
        return None


def _find_genomes_vcf(chromosome: str, raw_dir: Path | None = None) -> Path | None:
    """
    Auto-discover a 1000 Genomes VCF file for a given chromosome.

    Searches for files matching the pattern: ALL.chr{N}.*.genotypes.vcf.gz
    """
    raw_dir = raw_dir or RAW_DATA_DIR
    pattern = f"ALL.chr{chromosome}.*genotypes.vcf.gz"
    matches = list(raw_dir.glob(pattern))

    if matches:
        return matches[0]
    return None


def parse_clinvar(
    vcf_path: Path | None = None,
    chromosomes: list[str] | None = None,
    max_variants: int | None = None,
) -> list[dict]:
    """
    Parse ClinVar VCF and extract SNPs with Pathogenic or Benign labels.

    Args:
        vcf_path: Path to clinvar.vcf.gz
        chromosomes: List of chromosomes to filter (e.g. ['1', '22']). Empty = all.
        max_variants: Max variants to return. None = no limit.

    Returns:
        List of dicts: {chrom, pos, rsid, ref, alt, label (0 or 1), clnsig, disease}
    """
    vcf_path = vcf_path or CLINVAR_VCF_PATH
    chromosomes = chromosomes if chromosomes is not None else CHROMOSOMES
    max_variants = max_variants or MAX_CLINVAR_VARIANTS

    # Build a set for fast chromosome lookup
    chr_filter = set(chromosomes) if chromosomes else None

    variants: list[dict] = []
    skipped = 0

    logger.info(f"Parsing ClinVar VCF: {vcf_path}")
    logger.info(f"Filtering to chromosomes: {', '.join(chromosomes) if chromosomes else 'all'}")

    opener = gzip.open if str(vcf_path).endswith(".gz") else open

    with opener(vcf_path, "rt", errors="replace") as f:
        for line in tqdm(f, desc="Parsing ClinVar", unit=" lines"):
            if line.startswith("#"):
                continue

            fields = line.strip().split("\t")
            if len(fields) < 8:
                continue

            chrom, pos, rsid, ref, alt = fields[0], fields[1], fields[2], fields[3], fields[4]
            info_str = fields[7]

            # Filter by chromosome — handle both '1' and 'chr1' formats
            chrom_clean = chrom.replace("chr", "")
            if chr_filter and chrom_clean not in chr_filter:
                continue

            # Only keep SNPs (single nucleotide), skip indels
            if len(ref) != 1 or len(alt) != 1:
                skipped += 1
                continue

            info = _parse_info_field(info_str)
            clnsig = info.get("CLNSIG", "")

            # Determine binary label from clinical significance
            if clnsig in PATHOGENIC_LABELS:
                label = 1
            elif clnsig in BENIGN_LABELS:
                label = 0
            else:
                skipped += 1
                continue

            # Extract disease name if available
            disease = info.get("CLNDN", "unknown").replace("_", " ")

            # Use the dbSNP rsID from the INFO field (RS=<number>), not the
            # ClinVar variation ID in the ID column
            rs_number = info.get("RS", "")
            if rs_number:
                actual_rsid = f"rs{rs_number}"
            elif rsid != ".":
                actual_rsid = rsid if rsid.startswith("rs") else f"cv{rsid}"
            else:
                actual_rsid = f"chr{chrom_clean}:{pos}"

            variants.append({
                "chrom": chrom_clean,
                "pos": int(pos),
                "rsid": actual_rsid,
                "ref": ref,
                "alt": alt,
                "label": label,
                "clnsig": clnsig,
                "disease": disease,
            })

            if max_variants and len(variants) >= max_variants:
                logger.info(f"Reached max variant limit: {max_variants}")
                break

    pathogenic_count = sum(1 for v in variants if v["label"] == 1)
    benign_count = sum(1 for v in variants if v["label"] == 0)

    logger.info(
        f"ClinVar extraction complete: {len(variants)} variants "
        f"({pathogenic_count} pathogenic, {benign_count} benign, {skipped} skipped)"
    )

    return variants


def _extract_genotypes_from_vcf(
    genomes_vcf_path: Path,
    target_positions: dict[int, dict],
) -> tuple[np.ndarray, list[str], list[int]]:
    """
    Stream a single 1000 Genomes VCF and extract genotypes at target positions.

    Args:
        genomes_vcf_path: Path to the 1000 Genomes VCF for one chromosome.
        target_positions: Dict mapping position → ClinVar variant info.

    Returns:
        Tuple of (genotype_matrix, sample_ids, matched_position_list).
    """
    logger.info(f"Streaming: {genomes_vcf_path.name}")
    logger.info(f"Looking for {len(target_positions)} ClinVar positions")

    sample_ids: list[str] = []
    matched_genotypes: dict[int, list[int | None]] = {}
    matched_positions: list[int] = []

    opener = gzip.open if str(genomes_vcf_path).endswith(".gz") else open

    with opener(genomes_vcf_path, "rt", errors="replace") as f:
        for line in tqdm(f, desc=f"Scanning {genomes_vcf_path.name}", unit=" lines"):
            if line.startswith("##"):
                continue

            if line.startswith("#CHROM"):
                header_fields = line.strip().split("\t")
                sample_ids = header_fields[9:]
                logger.info(f"Found {len(sample_ids)} samples")
                continue

            fields = line.strip().split("\t")
            if len(fields) < 10:
                continue

            pos = int(fields[1])

            if pos not in target_positions:
                continue

            # Extract genotypes for all samples
            genotypes = [_encode_genotype(gt_field) for gt_field in fields[9:]]
            matched_genotypes[pos] = genotypes
            matched_positions.append(pos)

    logger.info(f"Matched {len(matched_positions)} / {len(target_positions)} positions")

    if not matched_positions:
        # Return empty arrays instead of raising — other chromosomes might match
        return np.empty((0, 0), dtype=np.float32), sample_ids, []

    # Build numpy matrix: samples × matched SNPs
    n_samples = len(sample_ids)
    n_snps = len(matched_positions)
    matrix = np.full((n_samples, n_snps), np.nan, dtype=np.float32)

    for col_idx, pos in enumerate(matched_positions):
        gts = matched_genotypes[pos]
        for row_idx, gt in enumerate(gts):
            if gt is not None:
                matrix[row_idx, col_idx] = gt

    # Impute missing with column mode
    for col in range(n_snps):
        col_data = matrix[:, col]
        valid = col_data[~np.isnan(col_data)]
        if len(valid) > 0:
            values, counts = np.unique(valid.astype(int), return_counts=True)
            mode_val = values[np.argmax(counts)]
            col_data[np.isnan(col_data)] = mode_val

    return matrix, sample_ids, matched_positions


def extract_features(
    clinvar_path: Path | None = None,
    output_dir: Path | None = None,
    chromosomes: list[str] | None = None,
    max_variants: int | None = None,
) -> dict:
    """
    Full feature extraction pipeline: ClinVar parsing → multi-chr 1000G intersection → save.

    Automatically discovers 1000 Genomes VCF files for each chromosome
    in the RAW_DATA_DIR directory.

    Returns:
        Dict with extraction statistics.
    """
    output_dir = output_dir or PROCESSED_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    chromosomes = chromosomes if chromosomes is not None else CHROMOSOMES

    # Step 1: Parse ClinVar for all requested chromosomes
    logger.info("=" * 60)
    logger.info("Step 1/3: Parsing ClinVar variants")
    logger.info("=" * 60)
    clinvar_variants = parse_clinvar(clinvar_path, chromosomes, max_variants)

    if not clinvar_variants:
        raise ValueError(
            f"No Pathogenic/Benign variants found in ClinVar for chromosomes: {chromosomes}"
        )

    # Group ClinVar variants by chromosome
    variants_by_chr: dict[str, dict[int, dict]] = {}
    for v in clinvar_variants:
        chrom = v["chrom"]
        if chrom not in variants_by_chr:
            variants_by_chr[chrom] = {}
        # Position as key (duplicates: last one wins)
        variants_by_chr[chrom][v["pos"]] = v

    logger.info(f"ClinVar variants per chromosome:")
    for chrom in sorted(variants_by_chr, key=lambda x: int(x) if x.isdigit() else 99):
        logger.info(f"  chr{chrom}: {len(variants_by_chr[chrom])} variants")

    # Step 2: Extract genotypes from 1000 Genomes for each chromosome
    logger.info("=" * 60)
    logger.info("Step 2/3: Extracting genotypes from 1000 Genomes")
    logger.info("=" * 60)

    all_matrices: list[np.ndarray] = []
    all_matched_positions: list[int] = []
    all_matched_chroms: list[str] = []
    sample_ids: list[str] = []
    total_matched = 0

    for chrom in sorted(variants_by_chr, key=lambda x: int(x) if x.isdigit() else 99):
        vcf_path = _find_genomes_vcf(chrom)
        if vcf_path is None:
            logger.warning(
                f"No 1000 Genomes VCF found for chr{chrom} in {RAW_DATA_DIR}. "
                f"Skipping. (expected pattern: ALL.chr{chrom}.*genotypes.vcf.gz)"
            )
            continue

        if not vcf_path.exists():
            logger.warning(f"VCF file not found: {vcf_path}. Skipping chr{chrom}.")
            continue

        target_positions = variants_by_chr[chrom]
        matrix, chr_sample_ids, matched_pos = _extract_genotypes_from_vcf(
            vcf_path, target_positions
        )

        if matrix.size == 0:
            logger.warning(f"No matches found in chr{chrom}. Skipping.")
            continue

        # Use sample_ids from the first chromosome (they should be identical across files)
        if not sample_ids:
            sample_ids = chr_sample_ids
        elif len(chr_sample_ids) != len(sample_ids):
            logger.warning(
                f"Sample count mismatch: chr{chrom} has {len(chr_sample_ids)} "
                f"vs expected {len(sample_ids)}. Skipping."
            )
            continue

        all_matrices.append(matrix)
        all_matched_positions.extend(matched_pos)
        all_matched_chroms.extend([chrom] * len(matched_pos))
        total_matched += len(matched_pos)

        logger.info(f"chr{chrom}: {len(matched_pos)} SNPs matched, matrix {matrix.shape}")

    if not all_matrices:
        raise ValueError(
            "No ClinVar variants matched in any 1000 Genomes VCF file. "
            "Ensure the VCF files are in data/raw/ and chromosome filters are correct."
        )

    # Concatenate all chromosome matrices along the SNP (column) axis
    genotype_matrix = np.concatenate(all_matrices, axis=1)
    logger.info(f"Combined genotype matrix: {genotype_matrix.shape} (samples × SNPs)")

    # Build labels in the same column order as the concatenated matrix
    all_target_positions: dict[int, dict] = {}
    for chrom_variants in variants_by_chr.values():
        all_target_positions.update(chrom_variants)

    labels = np.array(
        [all_target_positions[pos]["label"] for pos in all_matched_positions],
        dtype=np.float32,
    )

    n_snps = genotype_matrix.shape[1]
    assert len(labels) == n_snps, f"Label/feature mismatch: {len(labels)} labels for {n_snps} SNPs"

    # Step 3: Save outputs
    logger.info("=" * 60)
    logger.info("Step 3/3: Saving processed data")
    logger.info("=" * 60)

    features_path = output_dir / "features.pt"
    labels_path = output_dir / "labels.pt"
    metadata_path = output_dir / "snp_metadata.json"

    features_tensor = torch.from_numpy(genotype_matrix)
    labels_tensor = torch.from_numpy(labels)

    torch.save(features_tensor, features_path)
    torch.save(labels_tensor, labels_path)

    # Compute population mean genotype per SNP for inference imputation.
    # When a patient VCF is missing a position, the inference engine should
    # use this average instead of 0 to avoid biasing toward low risk.
    pop_means = genotype_matrix.mean(axis=0).tolist()

    # Save SNP metadata for inference (maps column index → variant info)
    snp_metadata = {
        "n_samples": len(sample_ids),
        "n_snps": int(n_snps),
        "n_pathogenic": int((labels == 1).sum()),
        "n_benign": int((labels == 0).sum()),
        "chromosomes": sorted(set(all_matched_chroms), key=lambda x: int(x) if x.isdigit() else 99),
        "snps": [
            {
                "index": i,
                "chrom": all_matched_chroms[i],
                "pos": int(pos),
                "rsid": all_target_positions[pos]["rsid"],
                "ref": all_target_positions[pos]["ref"],
                "alt": all_target_positions[pos]["alt"],
                "label": int(all_target_positions[pos]["label"]),
                "clnsig": all_target_positions[pos]["clnsig"],
                "disease": all_target_positions[pos]["disease"],
                "pop_mean": round(pop_means[i], 4),
            }
            for i, pos in enumerate(all_matched_positions)
        ],
    }

    with open(metadata_path, "w") as f:
        json.dump(snp_metadata, f, indent=2)

    logger.info(f"Saved features:  {features_path} ({features_tensor.shape})")
    logger.info(f"Saved labels:    {labels_path} ({labels_tensor.shape})")
    logger.info(f"Saved metadata:  {metadata_path}")

    stats = {
        "clinvar_variants_parsed": len(clinvar_variants),
        "chromosomes_processed": sorted(set(all_matched_chroms), key=lambda x: int(x) if x.isdigit() else 99),
        "positions_matched": n_snps,
        "n_samples": len(sample_ids),
        "n_pathogenic": int((labels == 1).sum()),
        "n_benign": int((labels == 0).sum()),
    }

    logger.info(f"Extraction stats: {stats}")
    return stats

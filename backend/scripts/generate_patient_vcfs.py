"""
Generate test patient VCFs by extracting individual samples from 1000 Genomes.

Each person in the 1000 Genomes dataset is a real individual with real
genotype data — perfect for testing the inference pipeline.

Usage:
    uv run python scripts/generate_patient_vcfs.py
    uv run python scripts/generate_patient_vcfs.py --count 10
"""

import argparse
import gzip
import logging
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import RAW_DATA_DIR, PROCESSED_DIR, SNP_METADATA_FILE

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

OUTPUT_DIR = RAW_DATA_DIR.parent / "test_patients"


def load_model_positions() -> set[int]:
    """Load the SNP positions the model was trained on."""
    import json
    if not SNP_METADATA_FILE.exists():
        logger.warning("No snp_metadata.json found — extracting ALL positions")
        return set()

    with open(SNP_METADATA_FILE) as f:
        meta = json.load(f)

    positions = {snp["pos"] for snp in meta["snps"]}
    logger.info(f"Loaded {len(positions)} model SNP positions")
    return positions


def generate_patient_vcfs(
    count: int = 5,
    seed: int = 42,
) -> list[Path]:
    """
    Extract individual samples from 1000 Genomes VCFs as patient files.

    Each output VCF contains only the SNP positions the model was trained on,
    mimicking what a real patient upload would look like.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Find all 1000 Genomes VCF files
    genome_vcfs = sorted(RAW_DATA_DIR.glob("ALL.chr*.genotypes.vcf.gz"))
    if not genome_vcfs:
        logger.error(f"No 1000 Genomes VCF files found in {RAW_DATA_DIR}")
        sys.exit(1)

    model_positions = load_model_positions()

    # Pick random sample indices from the first VCF to get sample names
    sample_names: list[str] = []
    first_vcf = genome_vcfs[0]

    logger.info(f"Reading sample names from {first_vcf.name}...")
    opener = gzip.open if str(first_vcf).endswith(".gz") else open

    with opener(first_vcf, "rt", errors="replace") as f:
        for line in f:
            if line.startswith("#CHROM"):
                header = line.strip().split("\t")
                sample_names = header[9:]
                break

    if not sample_names:
        logger.error("Could not find sample names in VCF header")
        sys.exit(1)

    logger.info(f"Found {len(sample_names)} samples in 1000 Genomes")

    # Pick random samples
    rng = random.Random(seed)
    chosen_indices = rng.sample(range(len(sample_names)), min(count, len(sample_names)))
    chosen_names = [sample_names[i] for i in chosen_indices]

    logger.info(f"Selected {len(chosen_names)} samples: {chosen_names}")

    # Open output files
    output_paths: list[Path] = []
    output_files = {}

    for name in chosen_names:
        path = OUTPUT_DIR / f"patient_{name}.vcf"
        output_paths.append(path)
        fh = open(path, "w")
        # Write VCF header
        fh.write("##fileformat=VCFv4.1\n")
        fh.write(f'##source=PRISM-Genomics test patient (1000G sample {name})\n')
        fh.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t" + name + "\n")
        output_files[name] = fh

    from tqdm import tqdm

    # Stream through each VCF and extract the chosen samples
    for vcf_path in genome_vcfs:
        logger.info(f"Scanning {vcf_path.name}...")
        opener = gzip.open if str(vcf_path).endswith(".gz") else open

        with opener(vcf_path, "rt", errors="replace") as f:
            for line in tqdm(f, desc=f"Extracting", unit=" lines"):
                if line.startswith("#"):
                    continue

                # Fast split: only grab the first 3 columns (CHROM, POS, rest)
                # Splitting all 2,500 columns for every single line is exactly
                # what causes the script to take 10+ minutes.
                parts = line.split("\t", 2)
                if len(parts) < 3:
                    continue

                try:
                    pos = int(parts[1])
                except ValueError:
                    continue

                # Only extract positions the model knows about
                if model_positions and pos not in model_positions:
                    continue

                # If position matches, do the full split to get all genotype columns
                fields = line.strip().split("\t")
                chrom = fields[0]
                rsid = fields[2]
                ref = fields[3]
                alt = fields[4]

                # Write each chosen sample's genotype to their file
                for name, idx in zip(chosen_names, chosen_indices):
                    gt_field = fields[9 + idx]
                    output_files[name].write(
                        f"{chrom}\t{pos}\t{rsid}\t{ref}\t{alt}\t.\tPASS\t.\tGT\t{gt_field}\n"
                    )

    # Close files
    for fh in output_files.values():
        fh.close()

    for path in output_paths:
        size_kb = path.stat().st_size / 1024
        logger.info(f"Created: {path.name} ({size_kb:.1f} KB)")

    logger.info(f"\nGenerated {len(output_paths)} patient VCFs in {OUTPUT_DIR}")
    logger.info("Test them with: curl -X POST http://localhost:8000/api/v1/upload -F file=@<path>")

    return output_paths


def main():
    parser = argparse.ArgumentParser(description="Generate test patient VCFs from 1000 Genomes")
    parser.add_argument("--count", type=int, default=5, help="Number of patient VCFs to generate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for sample selection")
    args = parser.parse_args()

    generate_patient_vcfs(count=args.count, seed=args.seed)


if __name__ == "__main__":
    main()

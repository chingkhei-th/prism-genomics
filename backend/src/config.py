"""
Centralized configuration for PRISM-Genomics.
Loads settings from environment variables with sensible defaults.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Base project directory (repo root)
BASE_DIR = Path(__file__).resolve().parent.parent

# --- Data Paths ---
VCF_INPUT_PATH = Path(
    os.getenv("VCF_INPUT_PATH", "data/raw/ALL.chr1.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz")
)
# Resolve relative paths against BASE_DIR
if not VCF_INPUT_PATH.is_absolute():
    VCF_INPUT_PATH = BASE_DIR / VCF_INPUT_PATH

# --- Output Directories ---
GWAS_DIR = BASE_DIR / os.getenv("GWAS_DIR", "data/gwas")
PROCESSED_DIR = BASE_DIR / os.getenv("PROCESSED_DIR", "data/processed")
MODELS_DIR = BASE_DIR / os.getenv("MODELS_DIR", "data/models")

# --- GWAS Configuration ---
GWAS_TRAITS: list[str] = [
    t.strip()
    for t in os.getenv(
        "GWAS_TRAITS", "type 2 diabetes,coronary artery disease,hypertension,breast cancer"
    ).split(",")
]
GWAS_P_VALUE_THRESHOLD: float = float(os.getenv("GWAS_P_VALUE_THRESHOLD", "5e-8"))
GWAS_CHROMOSOME: str = os.getenv("GWAS_CHROMOSOME", "1")

# --- PRS Configuration ---
HERITABILITY: float = float(os.getenv("HERITABILITY", "0.5"))
DISEASE_PREVALENCE: float = float(os.getenv("DISEASE_PREVALENCE", "0.15"))

# --- ML Configuration ---
TEST_SIZE: float = float(os.getenv("TEST_SIZE", "0.2"))
RANDOM_SEED: int = int(os.getenv("RANDOM_SEED", "42"))

# --- Output File Paths ---
GWAS_SNP_FILE = GWAS_DIR / "gwas_snps_chr1.csv"
GENOTYPE_MATRIX_FILE = PROCESSED_DIR / "genotype_matrix.parquet"
PRS_SCORES_FILE = PROCESSED_DIR / "prs_scores.csv"
LABELED_DATASET_FILE = PROCESSED_DIR / "labeled_dataset.csv"
POPULATION_STATS_FILE = MODELS_DIR / "population_stats.json"
SNP_WEIGHTS_FILE = MODELS_DIR / "snp_weights.json"
RISK_MODEL_FILE = MODELS_DIR / "risk_model.joblib"
MODEL_METRICS_FILE = MODELS_DIR / "model_metrics.json"

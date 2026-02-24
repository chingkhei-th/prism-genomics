"""
Centralized configuration for PRISM-Genomics.
Loads settings from environment variables with sensible defaults.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Base project directory (backend/ root)
BASE_DIR = Path(__file__).resolve().parent.parent

# --- Data Paths ---
RAW_DATA_DIR = BASE_DIR / os.getenv("RAW_DATA_DIR", "data/raw")

CLINVAR_VCF_PATH = Path(os.getenv("CLINVAR_VCF_PATH", "data/raw/clinvar.vcf.gz"))
if not CLINVAR_VCF_PATH.is_absolute():
    CLINVAR_VCF_PATH = BASE_DIR / CLINVAR_VCF_PATH

# --- Data Pipeline Settings ---
# Comma-separated chromosomes to process (e.g. "1,22" or "1" or blank for all)
_chr_raw = os.getenv("CHROMOSOMES", "1,22")
CHROMOSOMES: list[str] = [c.strip() for c in _chr_raw.split(",") if c.strip()]

MAX_CLINVAR_VARIANTS: int | None = (
    int(v) if (v := os.getenv("MAX_CLINVAR_VARIANTS")) else None
)

# --- Output Directories ---
PROCESSED_DIR = BASE_DIR / os.getenv("PROCESSED_DIR", "data/processed")
MODELS_DIR = BASE_DIR / os.getenv("MODELS_DIR", "data/models")

# --- Training Hyperparameters ---
BATCH_SIZE: int = int(os.getenv("BATCH_SIZE", "64"))
EPOCHS: int = int(os.getenv("EPOCHS", "50"))
LEARNING_RATE: float = float(os.getenv("LEARNING_RATE", "0.001"))
DROPOUT: float = float(os.getenv("DROPOUT", "0.3"))
TEST_SIZE: float = float(os.getenv("TEST_SIZE", "0.2"))
RANDOM_SEED: int = int(os.getenv("RANDOM_SEED", "42"))

# --- Inference ---
DEVICE: str = os.getenv("DEVICE", "cpu")
MODEL_WEIGHTS_FILE: str = os.getenv("MODEL_WEIGHTS_FILE", "model_weights.pth")

# --- Derived Paths ---
FEATURES_FILE = PROCESSED_DIR / "features.pt"
LABELS_FILE = PROCESSED_DIR / "labels.pt"
SNP_METADATA_FILE = PROCESSED_DIR / "snp_metadata.json"
MODEL_WEIGHTS_PATH = MODELS_DIR / MODEL_WEIGHTS_FILE
TRAINING_METRICS_FILE = MODELS_DIR / "training_metrics.json"

# PRISM-Genomics Backend

**Polygenic Risk Intelligence for Secure Medicine** — AI-driven disease risk prediction from patient DNA data using PyTorch.

## Overview

PRISM-Genomics classifies genetic variants as **Pathogenic** (disease-causing) or **Benign** (harmless) by training a neural network on real human genotype data cross-referenced with clinical annotations.

### How It Works

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐     ┌──────────────┐
│  ClinVar DB │────▶│  Feature Extract  │────▶│  PyTorch    │────▶│  FastAPI      │
│  (Labels)   │     │  (Intersection)   │     │  MLP Model  │     │  /api/v1/    │
└─────────────┘     └──────────────────┘     └─────────────┘     └──────────────┘
                            ▲
┌─────────────┐             │
│ 1000 Genomes│─────────────┘
│ (Genotypes) │
└─────────────┘
```

1. **ClinVar VCF** provides clinical significance labels for known genetic variants (Pathogenic vs Benign)
2. **1000 Genomes VCF** provides actual genotypes (0/0, 0/1, 1/1) from 2,504 human samples
3. **Feature Extraction** intersects the two datasets — for each ClinVar-labeled variant position, the pipeline extracts the genotype of every sample in 1000 Genomes
4. **PyTorch MLP** trains on this genotype matrix to learn patterns that distinguish pathogenic from benign genetic profiles
5. **FastAPI** serves predictions — a patient uploads their VCF and gets a disease risk assessment

## Tech Stack

| Component | Technology |
|:---|:---|
| ML Framework | PyTorch |
| VCF Parsing | Pure-Python (gzip + line parser) |
| Web API | FastAPI + Uvicorn |
| Package Manager | Astral UV |
| Data Format | `.vcf.gz` (Variant Call Format) |
| Encryption | blake3, cryptography |

## Quick Start

### Prerequisites

- Python 3.12+
- [Astral UV](https://docs.astral.sh/uv/) (`pip install uv`)
- **Dataset files** in `data/raw/`:
  - `ALL.chr1.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz` (1000 Genomes chr1)
  - `clinvar.vcf.gz` (ClinVar variant database)

### Setup

```bash
# Clone and navigate to backend
cd backend

# Create virtual environment and install dependencies
uv venv
uv sync
```

### Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Key environment variables:

| Variable | Default | Description |
|:---|:---|:---|
| `GENOMES_VCF_PATH` | `data/raw/ALL.chr1...vcf.gz` | Path to 1000 Genomes VCF |
| `CLINVAR_VCF_PATH` | `data/raw/clinvar.vcf.gz` | Path to ClinVar VCF |
| `CHROMOSOME` | `1` | Chromosome to process |
| `BATCH_SIZE` | `64` | Training batch size |
| `EPOCHS` | `50` | Max training epochs |
| `LEARNING_RATE` | `0.001` | Adam optimizer LR |
| `DROPOUT` | `0.3` | Dropout rate |
| `DEVICE` | `cpu` | PyTorch device (`cpu` or `cuda`) |

### Train the Model

```bash
uv run python scripts/train.py
```

This runs the full pipeline:
1. Parses ClinVar for Pathogenic/Benign variants on chr1
2. Extracts genotypes from 1000 Genomes at those positions
3. Trains a PyTorch MLP with early stopping
4. Saves model weights to `data/models/model_weights.pth`

> **Note:** The first run processes the 1.2 GB 1000 Genomes file and ~189 MB ClinVar file. This may take several minutes.

### Run the API

```bash
uv run python main.py
```

The API starts at `http://localhost:8000`. Interactive docs available at `http://localhost:8000/docs`.

## API Endpoints

### `POST /api/v1/upload`

Upload a patient VCF file for disease risk assessment.

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/upload \
  -F "file=@patient.vcf"
```

**Response:**
```json
{
  "status": "success",
  "risk_assessment": {
    "disease_probability": 0.7234,
    "risk_level": "High",
    "confidence_note": "High confidence"
  },
  "variant_analysis": {
    "total_model_variants": 1500,
    "matched_in_upload": 1200,
    "coverage_percent": 80.0,
    "high_impact_variants": [
      {
        "rsid": "rs12345",
        "position": 123456,
        "genotype": "2/2",
        "clinical_significance": "Pathogenic",
        "disease": "Breast cancer"
      }
    ],
    "n_pathogenic_with_alt": 15
  },
  "processing_time_seconds": 0.42
}
```

### `GET /api/v1/health`

Health check — returns server status and model load state.

### `GET /api/v1/model-info`

Returns model metadata: architecture, SNP count, training sample count.

## Project Structure

```
backend/
├── main.py                          # API entry point
├── pyproject.toml                   # Dependencies (UV)
├── .env.example                     # Environment config template
├── scripts/
│   └── train.py                     # Full training pipeline
├── src/
│   ├── config.py                    # Centralized settings
│   ├── data/
│   │   ├── feature_extractor.py     # ClinVar × 1000G intersection
│   │   └── dataset.py              # PyTorch Dataset
│   ├── model/
│   │   ├── architecture.py          # GenomicMLP definition
│   │   └── trainer.py              # Training loop + metrics
│   └── api/
│       ├── server.py               # FastAPI endpoints
│       └── inference.py            # Patient VCF analysis
├── data/
│   ├── raw/                        # Input VCF files
│   ├── processed/                  # Extracted tensors
│   └── models/                     # Trained weights
├── docs/
│   └── roadmap.md                  # Project roadmap
└── tests/
```

## Datasets

### 1000 Genomes Project (Phase 3)

- **File:** `ALL.chr1.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz`
- **Contents:** Genotypes of ~2,504 individuals across chromosome 1
- **Source:** [1000 Genomes FTP](https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/)

### ClinVar

- **File:** `clinvar.vcf.gz`
- **Contents:** Clinical significance annotations for known genetic variants
- **Labels used:** `Pathogenic`, `Likely_pathogenic` → **1** (disease-causing); `Benign`, `Likely_benign` → **0** (harmless)
- **Source:** [NCBI ClinVar FTP](https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/)

## Model Architecture

```
GenomicMLP:
    Input(n_snps) → Linear(512) → BatchNorm → ReLU → Dropout(0.3)
                   → Linear(256) → BatchNorm → ReLU → Dropout(0.3)
                   → Linear(1)   → Sigmoid
```

- **Loss:** Binary Cross-Entropy (BCELoss)
- **Optimizer:** Adam
- **Regularization:** Dropout + BatchNorm + Early Stopping
- **Output:** Disease probability (0.0 – 1.0)

## Ethics & Compliance

- **De-identification:** No patient identifiers are stored alongside genomic data
- **In-memory processing:** Uploaded VCFs are analyzed in-memory and never written to disk
- **Encryption support:** `blake3` and `cryptography` available for data-at-rest encryption
- **Research use only:** This tool is for research purposes and should not be used for clinical diagnostic decisions without professional medical review

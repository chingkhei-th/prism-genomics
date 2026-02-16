# 🧬 PRISM-Genomics

**Polygenic Risk Intelligence for Secure Medicine**

AI-driven polygenic risk modeling using population-scale genomic data and GWAS-derived effect sizes. Computes scientifically grounded, interpretable genetic risk scores and trains ML models for disease risk prediction.

---

## ✨ Features

- **PRS Computation** — `PRS = Σ(β × genotype)` using GWAS-derived effect sizes
- **Population Normalization** — Z-score and percentile ranking against 1000 Genomes reference
- **Risk Stratification** — Low / Moderate / High categories based on percentile thresholds
- **ML Risk Prediction** — XGBoost classifier trained on genotype features + PRS
- **Disease Label Simulation** — Liability threshold model for realistic label generation
- **Configurable Pipeline** — All parameters tunable via `.env` file
- **Standalone Retraining** — Retrain the ML model in seconds without re-processing VCF

---

## 📁 Project Structure

```
PRISM-Genomics/
├── data/
│   ├── raw/                       # 1000 Genomes VCF input
│   ├── gwas/                      # Curated GWAS SNP effect sizes
│   ├── processed/                 # Genotype matrix, PRS scores, labeled dataset
│   └── models/                    # Population stats, trained model, metrics
├── docs/                          # SRS, architecture, ML pipeline documentation
├── src/
│   ├── config.py                  # Centralized settings (env-backed)
│   ├── data_preparation/
│   │   ├── gwas_fetcher.py        # GWAS SNP curation (26 SNPs, 7 traits)
│   │   ├── vcf_processor.py       # VCF streaming, filtering, genotype encoding
│   │   └── prepare_dataset.py     # Full pipeline orchestrator
│   ├── prs_engine/
│   │   ├── calculator.py          # PRS = Σ(β × genotype)
│   │   └── normalizer.py          # Z-score, percentile, risk categories
│   └── ml/
│       ├── label_simulator.py     # Liability threshold disease labels
│       └── trainer.py             # XGBoost training + evaluation
├── scripts/
│   ├── extract_patient.py         # Extract single patient from population VCF
│   └── retrain_model.py           # Standalone model retraining script
├── .env.example                   # Environment variables template
├── pyproject.toml                 # Dependencies and project config
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- **Python** ≥ 3.12
- **[uv](https://docs.astral.sh/uv/)** — Python package manager

### 1. Clone and Setup

```bash
git clone <repo-url>
cd PRISM-Genomics
cp .env.example .env
uv sync
```

### 2. Download 1000 Genomes Data

Download the chromosome 1 VCF from 1000 Genomes Phase 3:

```bash
wget -P data/raw/ ftp://ftp-trace.ncbi.nih.gov/1000genomes/ftp/release/20130502/ALL.chr1.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz
```

### 3. Run the Full Pipeline

```bash
uv run python -m src.data_preparation.prepare_dataset
```

This runs all 6 steps end-to-end (~14 minutes):

| Step | Description | Output |
|------|------------|--------|
| 1 | Fetch GWAS SNPs | `data/gwas/gwas_snps_chr1.csv` |
| 2 | Process VCF → Genotype Matrix | `data/processed/genotype_matrix.parquet` |
| 3 | Compute PRS | Population mean/std for normalization |
| 4 | Normalize & Categorize | `data/processed/prs_scores.csv` |
| 5 | Simulate Disease Labels | `data/processed/labeled_dataset.csv` |
| 6 | Train XGBoost Model | `data/models/risk_model.joblib` |

---

## 🔁 Retraining the Model

The standalone retrain script skips VCF processing and retrains in seconds:

```bash
# Default settings
uv run python scripts/retrain_model.py

# Experiment with hyperparameters
uv run python scripts/retrain_model.py --n-estimators 200 --max-depth 6

# Adjust disease simulation
uv run python scripts/retrain_model.py --heritability 0.7 --prevalence 0.10

# Lower learning rate for better generalization
uv run python scripts/retrain_model.py --learning-rate 0.01 --n-estimators 500
```

### Retraining Options

| Flag | Default | Description |
|------|---------|-------------|
| `--heritability` | 0.5 | Genetic contribution to disease liability (0–1) |
| `--prevalence` | 0.15 | Simulated disease prevalence |
| `--n-estimators` | 100 | Number of boosting rounds (trees) |
| `--max-depth` | 4 | Maximum depth per tree |
| `--learning-rate` | 0.1 | Step size shrinkage |
| `--test-size` | 0.2 | Test set fraction |
| `--seed` | 42 | Random seed for reproducibility |
| `--no-resimulate-labels` | — | Reuse existing disease labels |

---

## 🌐 API Server

### Start the API

```bash
uv run python -m src.api.server
# Server starts at http://localhost:8000
```

### Endpoints

#### `POST /api/v1/analyze` — Upload VCF for risk assessment

```bash
curl -X POST http://localhost:8000/api/v1/analyze \
  -F "file=@path/to/sample.vcf"
```

**Response:**
```json
{
  "status": "success",
  "risk_assessment": {
    "prs_raw": 0.37,
    "z_score": -2.719,
    "percentile": 0.3,
    "risk_category": "Low"
  },
  "ml_prediction": {
    "disease_risk_label": "Normal",
    "disease_probability": 0.0761
  },
  "snp_analysis": {
    "total_gwas_snps": 16,
    "matched_in_upload": 2,
    "top_contributing_snps": [
      { "rsid": "rs17367504", "genotype": 1, "beta": 0.65, "contribution": 0.65, "trait": "hypertension" }
    ]
  },
  "processing_time_seconds": 0.45
}
```

#### `GET /api/v1/health` — Health check

```bash
curl http://localhost:8000/api/v1/health
```

#### `GET /api/v1/model-info` — Model + SNP metadata

```bash
curl http://localhost:8000/api/v1/model-info
```

Interactive API docs are auto-generated at **http://localhost:8000/docs** (Swagger UI).

---

## 📊 Pipeline Output Summary

After a successful run, the following artifacts are produced:

| File | Description |
|------|-------------|
| `data/gwas/gwas_snps_chr1.csv` | 26 curated GWAS SNPs across 7 disease traits |
| `data/processed/genotype_matrix.parquet` | 2504 × 16 encoded genotype matrix |
| `data/processed/prs_scores.csv` | PRS, z-score, percentile, risk category per sample |
| `data/processed/labeled_dataset.csv` | PRS + simulated disease labels |
| `data/models/population_stats.json` | Population mean/std PRS for inference |
| `data/models/snp_weights.json` | SNP IDs and beta weights used |
| `data/models/risk_model.joblib` | Trained XGBoost classifier |
| `data/models/model_metrics.json` | Accuracy, ROC-AUC, feature importance |

---

## 🧪 How It Works

### Polygenic Risk Score (PRS)

```
PRS = Σ (β_i × genotype_i)
```

Where `β` is the GWAS effect size and `genotype` is the allele dosage (0, 1, or 2). Individual PRS is normalized against the 1000 Genomes reference population using z-scores and percentiles.

### Risk Categories

| Category | Percentile Range |
|----------|-----------------|
| **Low** | < 40th percentile |
| **Moderate** | 40–75th percentile |
| **High** | > 75th percentile |

### ML Model (XGBoost)

Disease labels are generated using a **liability threshold model**:

```
liability = √h² × PRS_normalized + √(1 - h²) × ε
```

Where `h²` is heritability and `ε` is environmental noise ~ N(0,1). An XGBoost classifier is then trained on genotype features + PRS to predict disease risk.

---

## ⚙️ Configuration

All parameters are configurable via `.env` (see `.env.example`):

```env
# Disease simulation
HERITABILITY=0.5
DISEASE_PREVALENCE=0.15

# GWAS settings
GWAS_TRAITS=type 2 diabetes,coronary artery disease,hypertension,breast cancer
GWAS_P_VALUE_THRESHOLD=5e-8

# ML settings
TEST_SIZE=0.2
RANDOM_SEED=42
```

---

## 🔬 Disease Traits Covered

The curated GWAS SNP set includes chr1 variants for:

| Trait | SNPs | Key SNP |
|-------|------|---------|
| Type 2 Diabetes | 5 | rs10923931 (β=0.14) |
| Coronary Artery Disease | 5 | rs12740374 (β=0.17) |
| Hypertension | 5 | rs17367504 (β=0.65) |
| Breast Cancer | 4 | rs11249433 (β=0.12) |
| Alzheimer's Disease | 2 | rs6656401 (β=0.18) |
| Body Mass Index | 3 | rs543874 (β=0.18) |
| Schizophrenia | 2 | rs1625579 (β=0.11) |

---

## ⚠️ Disclaimer

- **Not intended for clinical use** or medical diagnosis
- **For research and educational purposes only**
- Genetic counseling recommended before interpretation
- Results are based on statistical risk modeling, not confirmed disease prediction

---

## 📄 License

This project is for hackathon and educational purposes.

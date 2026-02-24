# PRISM-Genomics Backend

**Polygenic Risk Intelligence for Secure Medicine** — AI-driven disease risk prediction from patient DNA data using a PyTorch Neural Network.

## Overview

PRISM-Genomics classifies genetic variants as **Pathogenic** (disease-causing) or **Benign** (harmless) by training a model on real human genotype data cross-referenced with clinical annotations.

Instead of relying on simple Polygenic Risk Scores (PRS), this system uses a multi-layer neural network to learn complex genetic risk patterns directly from raw VCF data.

### How It Works

```text
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

1. **ClinVar Database:** Provides clinical significance labels for known genetic variants (identifying them as Pathogenic or Benign).
2. **1000 Genomes Genotypes:** Provides real genotype samples (0/0, 0/1, 1/1) from 2,504 human individuals.
3. **Data Intersection:** The pipeline auto-discovers VCF files for multiple chromosomes, matches ClinVar pathogenic/benign positions against 1000 Genomes samples, encodes genotypes as alt-allele counts (0, 1, 2), and completely handles missing data by imputing population averages.
4. **PyTorch Model:** A Deep Learning MLP (Multi-Layer Perceptron) trains on this aggregated genotype matrix to predict disease risk based on the accumulation of pathogenic variants (pathogenic burden).
5. **FastAPI Engine:** At inference time, a patient uploads their VCF. The API maps their variants, handles missing data using the learned population means, queries the model, and returns a detailed risk assessment.

---

## 🚀 Quick Start

### 1. Prerequisites

- Python 3.12+
- [Astral UV](https://docs.astral.sh/uv/) (`pip install uv`)

### 2. Setup Environment

Clone the repository, enter the backend directory, and install dependencies automatically using `uv`:

```bash
cd backend
uv venv
uv sync
```

Copy the environment template:
```bash
cp .env.example .env
```
*(By default, `.env` is configured to process chromosomes 1 and 22).*

### 3. Download the Datasets

The model requires raw genetic data to train. We use **ClinVar** for labels and **1000 Genomes** for patient features.

See [data/raw/README.md](data/raw/README.md) for detailed `wget` download instructions. At minimum, download `clinvar.vcf.gz` and the `ALL.chr1...vcf.gz` / `ALL.chr22...vcf.gz` files into the `data/raw/` directory.

### 4. Train the Model

Once data is downloaded, run the unified training pipeline:

```bash
uv run python scripts/train.py
```

This script will:
1. Parse ClinVar and find all Pathogenic/Benign variants on the active chromosomes.
2. Stream the 1.2+ GB 1000 Genomes files to extract patient genotypes at those exact positions.
3. Train the PyTorch model using early stopping.
4. Save the trained weights to `data/models/model_weights.pth` and create `snp_metadata.json` for inference.

### 5. Generate Test Patient Data

To test the application properly, you need High-Coverage VCF files. Uploading a regular tiny VCF might result in "Low Confidence" because it misses thousands of SNPs the model looks for.

We have a script that extracts real individual samples from the 1000 Genomes dataset to create realistic test VCFs:

```bash
# Generate 5 realistic test patients
uv run python scripts/generate_patient_vcfs.py --count 5
```
This produces files like `data/test_patients/patient_HG00096.vcf` which perfectly simulate a full genomic sequencing test.

### 6. Run the API Server

Start the FastAPI application:

```bash
uv run python main.py
```

The server will load the trained model into memory and bind to `http://localhost:8000`.
Interactive Swagger UI docs are available at `http://localhost:8000/docs`.

---

## 🧬 API Endpoints

### `POST /api/v1/upload`

Upload a patient VCF file (`.vcf` or `.vcf.gz`) to receive a disease risk assessment.

**Example Request:**
```bash
curl -X POST http://localhost:8000/api/v1/upload \
  -F "file=@data/test_patients/patient_HG00096.vcf"
```

**Example Response:**
```json
{
  "status": "success",
  "risk_assessment": {
    "disease_probability": 0.8412,
    "risk_level": "High",
    "confidence_note": "High confidence"
  },
  "variant_analysis": {
    "total_model_variants": 4313,
    "matched_in_upload": 4313,
    "coverage_percent": 100.0,
    "high_impact_variants": [
      {
        "rsid": "rs371313",
        "chromosome": "1",
        "position": 21577499,
        "genotype": "1/2",
        "clinical_significance": "Pathogenic/Likely_pathogenic",
        "disease": "Hypophosphatasia"
      }
    ],
    "n_pathogenic_with_alt": 18
  },
  "processing_time_seconds": 0.42
}
```

*Note on Missing Data:* If a patient's VCF doesn't contain a specific SNP, the inference engine intelligently imputes the **population mean** for that SNP (learned during training) rather than assuming a `0`. This prevents sparse VCF files from artificially driving the risk probability to zero.

### `GET /api/v1/health`
Checks if the API is running and the model is successfully loaded into memory.

### `GET /api/v1/model-info`
Returns statistics on the active model, the dimensions of the input features, the number of processed chromosomes, and pathogenic/benign variant balance counts.

---

## ⚙️ Configuration Reference (`.env`)

| Variable | Default Value | Description |
|:---|:---|:---|
| `CHROMOSOMES` | `1,22` | Comma-separated list of chromosomes to train/predict on. |
| `RAW_DATA_DIR` | `data/raw` | Directory where VCFs are auto-discovered. |
| `BATCH_SIZE` | `64` | PyTorch DataLoader batch size. |
| `EPOCHS` | `50` | Maximum number of training epochs (Early Stopping is active). |
| `LEARNING_RATE`| `0.001` | Adam optimizer learning rate. |
| `DROPOUT` | `0.3` | Dropout regularization to prevent overfitting on small sample sizes. |
| `DEVICE` | `cpu` | Target compute device (`cpu` or `cuda`). Automatically moves models/tensors. |

---
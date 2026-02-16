"""
PRISM-Genomics API — FastAPI server for genomic risk assessment.

Endpoints:
    POST /api/v1/analyze   — Upload VCF, receive risk report
    GET  /api/v1/health    — Health check
    GET  /api/v1/model-info — Model and SNP metadata
"""

import logging
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.inference import RiskInferenceEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Global inference engine (loaded once at startup)
engine = RiskInferenceEngine()

MAX_FILE_SIZE_MB = 500  # configurable max upload size


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model artifacts on startup."""
    logger.info("Starting PRISM-Genomics API...")
    engine.load_artifacts()
    logger.info("API ready — inference engine loaded")
    yield
    logger.info("Shutting down PRISM-Genomics API")


app = FastAPI(
    title="PRISM-Genomics API",
    description=(
        "Polygenic Risk Intelligence for Secure Medicine — "
        "AI-driven genomic risk assessment using PRS computation and ML prediction."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "engine_loaded": engine._loaded,
        "service": "PRISM-Genomics",
    }


@app.get("/api/v1/model-info")
async def model_info():
    """Return model metadata and available SNPs."""
    if not engine._loaded:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    return {
        "model_type": "XGBoost Classifier",
        "n_snps": engine.snp_weights["snps_used"],
        "snps": [
            {
                "rsid": s["rsid"],
                "chr": s["chr"],
                "pos": s["pos"],
                "beta": s["beta"],
                "trait": s["trait"],
            }
            for s in engine.snp_weights["weights"]
        ],
        "population_stats": engine.population_stats,
        "model_metrics": {
            "test_roc_auc": engine.model_metrics.get("test_roc_auc"),
            "test_accuracy": engine.model_metrics.get("test_accuracy"),
            "cv_roc_auc_mean": engine.model_metrics.get("cv_roc_auc_mean"),
        },
    }


@app.post("/api/v1/analyze")
async def analyze_vcf(file: UploadFile = File(...)):
    """
    Upload a VCF file and receive a polygenic risk assessment report.

    Accepts `.vcf` or `.vcf.gz` files. The file is processed in memory —
    no permanent storage of genomic data.
    """
    # Validate file extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    if not (file.filename.endswith(".vcf") or file.filename.endswith(".vcf.gz")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a .vcf or .vcf.gz file.",
        )

    # Read file bytes
    start_time = time.time()
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {e}")

    # Check file size
    file_size_mb = len(contents) / (1024 * 1024)
    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({file_size_mb:.1f} MB). Maximum is {MAX_FILE_SIZE_MB} MB.",
        )

    logger.info(f"Received VCF upload: {file.filename} ({file_size_mb:.1f} MB)")

    # Run inference
    try:
        report = engine.analyze_vcf(contents, file.filename)
    except Exception as e:
        logger.error(f"Inference failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    elapsed = time.time() - start_time
    report["processing_time_seconds"] = round(elapsed, 2)

    logger.info(f"Analysis completed in {elapsed:.2f}s for {file.filename}")

    return JSONResponse(content=report)


def main() -> None:
    """Run the API server."""
    import uvicorn
    uvicorn.run(
        "src.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()

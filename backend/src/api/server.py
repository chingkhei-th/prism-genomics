"""
PRISM-Genomics API — FastAPI server for genomic disease risk prediction.

Endpoints:
    POST /api/v1/upload     — Upload a patient VCF, receive risk assessment
    GET  /api/v1/health     — Health check
    GET  /api/v1/model-info — Model metadata and SNP count
"""

import logging
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.inference import InferenceEngine
from src.api.auth import router as auth_router
from src.api.patient import router as patient_router
from src.db import connect_db, disconnect_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Global inference engine — loaded once at startup
engine = InferenceEngine()

MAX_FILE_SIZE_MB = 500


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model artifacts and connect to DB on startup."""
    logger.info("Starting PRISM-Genomics API...")
    await connect_db()
    try:
        engine.load_artifacts()
        logger.info("Inference engine loaded — API ready")
    except FileNotFoundError as e:
        logger.warning(f"Model not found: {e}")
        logger.warning("API will start but inference won't work until model is trained")
    yield
    await disconnect_db()
    logger.info("Shutting down PRISM-Genomics API")


app = FastAPI(
    title="PRISM-Genomics API",
    description=(
        "Pathogenic/Benign variant classification from patient DNA data. "
        "Upload a VCF file to receive a disease risk assessment based on "
        "clinically significant genetic variants."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

# Include Authentication Router
app.include_router(auth_router, prefix="/api/v1")

# Include Patient Router
app.include_router(patient_router, prefix="/api/v1")

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_loaded": engine._loaded,
        "service": "PRISM-Genomics",
        "version": "0.2.0",
    }


@app.get("/api/v1/model-info")
async def model_info():
    """Return model metadata and SNP statistics."""
    if not engine._loaded:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    meta = engine.snp_metadata
    return {
        "architecture": "GenomicMLP (PyTorch)",
        "n_snps": meta["n_snps"],
        "n_pathogenic": meta["n_pathogenic"],
        "n_benign": meta["n_benign"],
        "chromosomes": meta.get("chromosomes", [meta.get("chromosome", "unknown")]),
        "n_training_samples": meta["n_samples"],
    }


@app.post("/api/v1/upload")
async def upload_vcf(file: UploadFile = File(...)):
    """
    Upload a patient VCF file and receive a disease risk assessment.

    Accepts `.vcf` or `.vcf.gz` files. The file is processed in-memory —
    no patient genomic data is stored on the server.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    if not (file.filename.endswith(".vcf") or file.filename.endswith(".vcf.gz")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a .vcf or .vcf.gz file.",
        )

    if not engine._loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Train the model first with: uv run python scripts/train.py",
        )

    # Read file bytes
    start_time = time.time()
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    # File size check
    file_size_mb = len(contents) / (1024 * 1024)
    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({file_size_mb:.1f} MB). Maximum is {MAX_FILE_SIZE_MB} MB.",
        )

    logger.info(f"Received VCF: {file.filename} ({file_size_mb:.1f} MB)")

    # Run inference
    try:
        report = engine.analyze_vcf(contents, file.filename)
    except Exception as e:
        logger.error(f"Inference failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    elapsed = time.time() - start_time
    report["processing_time_seconds"] = round(elapsed, 2)

    logger.info(f"Analysis complete in {elapsed:.2f}s for {file.filename}")

    return JSONResponse(content=report)


def main() -> None:
    """Run the API server."""
    import uvicorn

    uvicorn.run(
        "src.api.server:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()

"""
Training script — orchestrates the full PRISM-Genomics pipeline.

Usage:
    uv run python scripts/train.py

Steps:
    1. Extract features (ClinVar × 1000 Genomes intersection)
    2. Train the PyTorch MLP model
    3. Report metrics
"""

import logging
import sys
import time

# Ensure project root is on the path
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data.feature_extractor import extract_features
from src.model.trainer import train_model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def main() -> None:
    """Run the full training pipeline."""
    logger.info("=" * 70)
    logger.info("  PRISM-Genomics — Training Pipeline")
    logger.info("=" * 70)

    total_start = time.time()

    # Phase 1: Feature extraction
    logger.info("\n📊 Phase 1: Feature Extraction")
    logger.info("-" * 40)
    try:
        extraction_stats = extract_features()
    except Exception as e:
        logger.error(f"Feature extraction failed: {e}", exc_info=True)
        sys.exit(1)

    logger.info(f"\nExtraction results:")
    for key, value in extraction_stats.items():
        logger.info(f"  {key}: {value}")

    # Phase 2: Model training
    logger.info("\n🧠 Phase 2: Model Training")
    logger.info("-" * 40)
    try:
        training_metrics = train_model()
    except Exception as e:
        logger.error(f"Model training failed: {e}", exc_info=True)
        sys.exit(1)

    elapsed = time.time() - total_start

    # Summary
    logger.info("\n" + "=" * 70)
    logger.info("  Pipeline Complete!")
    logger.info("=" * 70)
    logger.info(f"  Total time:       {elapsed:.1f}s")
    logger.info(f"  Variants matched: {extraction_stats['positions_matched']}")
    logger.info(f"  Samples:          {extraction_stats['n_samples']}")
    logger.info(f"  Best val AUC:     {training_metrics['final_val_auc']:.4f}")
    logger.info(f"  Best val accuracy: {training_metrics['final_val_accuracy']:.4f}")
    logger.info(f"  Model saved to:   data/models/")
    logger.info("=" * 70)


if __name__ == "__main__":
    main()

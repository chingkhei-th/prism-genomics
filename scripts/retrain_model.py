"""
Standalone retrain script — retrains the XGBoost model without re-processing the VCF.

Skips the expensive VCF parsing step (~14 min) and uses the existing processed
data to retrain the ML model in seconds. Useful for experimenting with
hyperparameters, heritability, disease prevalence, etc.

Usage:
    python scripts/retrain_model.py                     # default settings
    python scripts/retrain_model.py --heritability 0.7  # stronger genetic signal
    python scripts/retrain_model.py --prevalence 0.10   # lower disease rate
    python scripts/retrain_model.py --n-estimators 200 --max-depth 6  # more complex model
"""

import argparse
import logging
import sys
import time

import pandas as pd

# Add project root to path for imports
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))

from src.config import (
    DISEASE_PREVALENCE,
    GENOTYPE_MATRIX_FILE,
    HERITABILITY,
    LABELED_DATASET_FILE,
    MODEL_METRICS_FILE,
    POPULATION_STATS_FILE,
    PRS_SCORES_FILE,
    RANDOM_SEED,
    RISK_MODEL_FILE,
    TEST_SIZE,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments for retraining."""
    parser = argparse.ArgumentParser(
        description="Retrain the PRISM-Genomics risk model (without VCF re-processing)",
    )

    # Label simulation params
    parser.add_argument(
        "--heritability", type=float, default=HERITABILITY,
        help=f"Fraction of liability explained by genetics, 0-1 (default: {HERITABILITY})",
    )
    parser.add_argument(
        "--prevalence", type=float, default=DISEASE_PREVALENCE,
        help=f"Disease prevalence for label simulation (default: {DISEASE_PREVALENCE})",
    )

    # XGBoost hyperparameters
    parser.add_argument(
        "--n-estimators", type=int, default=100,
        help="Number of boosting rounds / trees (default: 100)",
    )
    parser.add_argument(
        "--max-depth", type=int, default=4,
        help="Maximum tree depth (default: 4)",
    )
    parser.add_argument(
        "--learning-rate", type=float, default=0.1,
        help="Learning rate / step size shrinkage (default: 0.1)",
    )

    # Training params
    parser.add_argument(
        "--test-size", type=float, default=TEST_SIZE,
        help=f"Test set fraction (default: {TEST_SIZE})",
    )
    parser.add_argument(
        "--seed", type=int, default=RANDOM_SEED,
        help=f"Random seed (default: {RANDOM_SEED})",
    )

    # Flags
    parser.add_argument(
        "--resimulate-labels", action="store_true", default=True,
        help="Re-generate disease labels before training (default: True)",
    )
    parser.add_argument(
        "--no-resimulate-labels", dest="resimulate_labels", action="store_false",
        help="Use existing disease labels without re-simulating",
    )

    return parser.parse_args()


def main() -> None:
    """Retrain the risk model using existing processed data."""
    args = parse_args()
    start = time.time()

    logger.info("=" * 60)
    logger.info("PRISM-Genomics — Model Retraining")
    logger.info("=" * 60)

    # ── Validate that processed data exists ──
    if not GENOTYPE_MATRIX_FILE.exists():
        logger.error(f"Genotype matrix not found: {GENOTYPE_MATRIX_FILE}")
        logger.error("Run the full pipeline first: python -m src.data_preparation.prepare_dataset")
        sys.exit(1)
    if not PRS_SCORES_FILE.exists():
        logger.error(f"PRS scores not found: {PRS_SCORES_FILE}")
        sys.exit(1)

    # ── Load processed data ──
    logger.info("Loading processed data...")
    genotype_matrix = pd.read_parquet(GENOTYPE_MATRIX_FILE)
    prs_df = pd.read_csv(PRS_SCORES_FILE, index_col="sample_id")
    logger.info(f"  Genotype matrix: {genotype_matrix.shape}")
    logger.info(f"  PRS scores: {len(prs_df)} samples")

    # ── Re-simulate disease labels (if requested) ──
    if args.resimulate_labels:
        logger.info("")
        logger.info(f"Re-simulating disease labels (h²={args.heritability}, prevalence={args.prevalence})...")

        from src.ml.label_simulator import simulate_disease_labels

        labeled_df = simulate_disease_labels(
            prs_df,
            heritability=args.heritability,
            prevalence=args.prevalence,
            seed=args.seed,
        )
        labeled_df.to_csv(LABELED_DATASET_FILE)
    else:
        logger.info("Using existing disease labels...")
        labeled_df = pd.read_csv(LABELED_DATASET_FILE, index_col="sample_id")

    # ── Patch XGBoost hyperparameters into trainer ──
    # We inject custom params by monkey-patching the model creation
    from src.ml import trainer as trainer_module

    original_train = trainer_module.train_risk_model

    def patched_train(features, labels, model_output_path, metrics_output_path, **kwargs):
        """Wrapper that injects custom hyperparameters."""
        from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
        from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
        from xgboost import XGBClassifier
        import joblib
        import json

        ts = args.test_size
        rs = args.seed

        X_train, X_test, y_train, y_test = train_test_split(
            features, labels, test_size=ts, random_state=rs, stratify=labels,
        )
        logger.info(f"Train: {len(X_train)}, Test: {len(X_test)}")

        model = XGBClassifier(
            n_estimators=args.n_estimators,
            max_depth=args.max_depth,
            learning_rate=args.learning_rate,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=rs,
            eval_metric="logloss",
        )

        logger.info(f"Training XGBoost (n_estimators={args.n_estimators}, max_depth={args.max_depth}, lr={args.learning_rate})...")
        model.fit(X_train, y_train, verbose=False)

        y_pred = model.predict(X_test)
        y_pred_proba = model.predict_proba(X_test)[:, 1]

        accuracy = accuracy_score(y_test, y_pred)
        roc_auc = roc_auc_score(y_test, y_pred_proba)
        class_report = classification_report(y_test, y_pred, output_dict=True)

        logger.info(f"Test Accuracy: {accuracy:.4f}")
        logger.info(f"Test ROC-AUC:  {roc_auc:.4f}")

        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=rs)
        cv_scores = cross_val_score(model, features, labels, cv=cv, scoring="roc_auc")
        logger.info(f"5-Fold CV ROC-AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

        importance = model.feature_importances_
        feature_names = features.columns.tolist()
        top_features = sorted(zip(feature_names, importance), key=lambda x: x[1], reverse=True)[:10]

        logger.info("Top 10 features:")
        for name, imp in top_features:
            logger.info(f"  {name}: {imp:.4f}")

        model_output_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, model_output_path)
        logger.info(f"Saved model to {model_output_path}")

        metrics = {
            "test_accuracy": float(accuracy),
            "test_roc_auc": float(roc_auc),
            "cv_roc_auc_mean": float(cv_scores.mean()),
            "cv_roc_auc_std": float(cv_scores.std()),
            "n_train_samples": int(len(X_train)),
            "n_test_samples": int(len(X_test)),
            "n_features": int(features.shape[1]),
            "hyperparameters": {
                "n_estimators": args.n_estimators,
                "max_depth": args.max_depth,
                "learning_rate": args.learning_rate,
                "heritability": args.heritability,
                "prevalence": args.prevalence,
            },
            "top_features": [{"name": n, "importance": float(i)} for n, i in top_features],
            "classification_report": class_report,
        }

        with open(metrics_output_path, "w") as f:
            json.dump(metrics, f, indent=2)
        logger.info(f"Saved metrics to {metrics_output_path}")

        return metrics

    # ── Train ──
    logger.info("")
    from src.ml.trainer import prepare_features

    features, labels = prepare_features(genotype_matrix, labeled_df)
    metrics = patched_train(features, labels, RISK_MODEL_FILE, MODEL_METRICS_FILE)

    elapsed = time.time() - start
    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Retraining complete in {elapsed:.1f}s")
    logger.info(f"  ROC-AUC:  {metrics['test_roc_auc']:.4f}")
    logger.info(f"  Accuracy: {metrics['test_accuracy']:.4f}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()

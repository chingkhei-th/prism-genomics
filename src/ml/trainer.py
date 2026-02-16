"""
ML Trainer — trains an XGBoost classifier for genomic risk prediction.

Uses genotype features + PRS score as input, with simulated disease labels
as the target. Performs train/test split, training, and evaluation.
"""

import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from xgboost import XGBClassifier

from src.config import RANDOM_SEED, TEST_SIZE

logger = logging.getLogger(__name__)


def prepare_features(
    genotype_matrix: pd.DataFrame,
    prs_scores: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.Series]:
    """
    Combine genotype matrix with PRS score as features, extract labels.

    Features: all SNP genotype columns + raw PRS score
    Labels: disease_label column from simulated data

    Args:
        genotype_matrix: DataFrame (samples × SNPs) with encoded genotypes.
        prs_scores: DataFrame with 'prs_raw' and 'disease_label' columns.

    Returns:
        Tuple of (feature_df, label_series).
    """
    # Align samples between genotype matrix and PRS scores
    common_samples = genotype_matrix.index.intersection(prs_scores.index)
    logger.info(f"Preparing features for {len(common_samples)} samples")

    features = genotype_matrix.loc[common_samples].copy()

    # Add PRS as an additional feature
    features["prs_raw"] = prs_scores.loc[common_samples, "prs_raw"]

    # Impute any remaining NaN with column means
    if features.isna().any().any():
        features = features.fillna(features.mean())

    labels = prs_scores.loc[common_samples, "disease_label"].astype(int)

    logger.info(f"Feature matrix shape: {features.shape}")
    logger.info(f"Label distribution: {labels.value_counts().to_dict()}")

    return features, labels


def train_risk_model(
    features: pd.DataFrame,
    labels: pd.Series,
    model_output_path: Path,
    metrics_output_path: Path,
    test_size: float | None = None,
    seed: int | None = None,
) -> dict:
    """
    Train an XGBoost classifier and evaluate performance.

    Performs train/test split, trains with reasonable hyperparameters,
    evaluates on the test set, and saves the model + metrics.

    Args:
        features: Feature DataFrame (samples × features).
        labels: Binary label Series.
        model_output_path: Where to save the trained model.
        metrics_output_path: Where to save evaluation metrics.
        test_size: Fraction of data for testing (default from config).
        seed: Random seed (default from config).

    Returns:
        Dictionary of evaluation metrics.
    """
    ts = test_size if test_size is not None else TEST_SIZE
    rs = seed if seed is not None else RANDOM_SEED

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        features, labels, test_size=ts, random_state=rs, stratify=labels,
    )

    logger.info(f"Train set: {len(X_train)} samples, Test set: {len(X_test)} samples")

    # XGBoost with reasonable defaults for genomic data
    model = XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=rs,
        eval_metric="logloss",
        use_label_encoder=False,
    )

    logger.info("Training XGBoost classifier...")
    model.fit(X_train, y_train, verbose=False)

    # Predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]

    # Metrics
    accuracy = accuracy_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    class_report = classification_report(y_test, y_pred, output_dict=True)

    logger.info(f"Test Accuracy: {accuracy:.4f}")
    logger.info(f"Test ROC-AUC:  {roc_auc:.4f}")

    # Cross-validation on full dataset for a more stable estimate
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=rs)
    cv_scores = cross_val_score(model, features, labels, cv=cv, scoring="roc_auc")
    logger.info(f"5-Fold CV ROC-AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # Feature importance (top 10)
    importance = model.feature_importances_
    feature_names = features.columns.tolist()
    top_features = sorted(
        zip(feature_names, importance),
        key=lambda x: x[1],
        reverse=True,
    )[:10]

    logger.info("Top 10 features by importance:")
    for name, imp in top_features:
        logger.info(f"  {name}: {imp:.4f}")

    # Save model
    model_output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_output_path)
    logger.info(f"Saved trained model to {model_output_path}")

    # Save metrics
    metrics = {
        "test_accuracy": float(accuracy),
        "test_roc_auc": float(roc_auc),
        "cv_roc_auc_mean": float(cv_scores.mean()),
        "cv_roc_auc_std": float(cv_scores.std()),
        "n_train_samples": int(len(X_train)),
        "n_test_samples": int(len(X_test)),
        "n_features": int(features.shape[1]),
        "top_features": [
            {"name": name, "importance": float(imp)} for name, imp in top_features
        ],
        "classification_report": class_report,
    }

    metrics_output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(metrics_output_path, "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info(f"Saved metrics to {metrics_output_path}")
    return metrics

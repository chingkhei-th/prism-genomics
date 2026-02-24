"""
Model Trainer — trains the GenomicMLP on extracted genotype features.

Handles:
    - Train/validation split
    - Training loop with BCELoss + Adam
    - Early stopping on validation loss
    - Metric logging (accuracy, ROC-AUC)
    - Model checkpoint saving
"""

import json
import logging
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, roc_auc_score
from torch.utils.data import DataLoader, Subset

from src.config import (
    BATCH_SIZE,
    DEVICE,
    DROPOUT,
    EPOCHS,
    LEARNING_RATE,
    MODEL_WEIGHTS_PATH,
    MODELS_DIR,
    RANDOM_SEED,
    TEST_SIZE,
    TRAINING_METRICS_FILE,
)
from src.data.dataset import GenomicDataset
from src.model.architecture import GenomicMLP

logger = logging.getLogger(__name__)


def _split_dataset(
    dataset: GenomicDataset,
    test_size: float,
    seed: int,
) -> tuple[Subset, Subset]:
    """Split dataset into train and validation subsets."""
    n = len(dataset)
    indices = list(range(n))

    rng = np.random.RandomState(seed)
    rng.shuffle(indices)

    split = int(n * (1 - test_size))
    train_indices = indices[:split]
    val_indices = indices[split:]

    return Subset(dataset, train_indices), Subset(dataset, val_indices)


def train_model(
    dataset: GenomicDataset | None = None,
    output_dir: Path | None = None,
    epochs: int | None = None,
    batch_size: int | None = None,
    lr: float | None = None,
    dropout: float | None = None,
    patience: int = 10,
) -> dict:
    """
    Train the GenomicMLP and save weights + metrics.

    Args:
        dataset: Pre-loaded dataset. If None, loads from default paths.
        output_dir: Directory for model weights and metrics.
        epochs: Training epochs.
        batch_size: Batch size.
        lr: Learning rate.
        dropout: Dropout rate.
        patience: Early stopping patience (epochs without improvement).

    Returns:
        Dict of training results and metrics.
    """
    # Resolve defaults from config
    output_dir = output_dir or MODELS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    epochs = epochs or EPOCHS
    batch_size = batch_size or BATCH_SIZE
    lr = lr or LEARNING_RATE
    dropout = dropout or DROPOUT

    device = torch.device(DEVICE)
    logger.info(f"Training device: {device}")

    # Load dataset
    if dataset is None:
        dataset = GenomicDataset()

    n_features = dataset.n_features
    logger.info(f"Dataset: {len(dataset)} samples, {n_features} features")

    # Train/val split
    train_set, val_set = _split_dataset(dataset, TEST_SIZE, RANDOM_SEED)
    logger.info(f"Train: {len(train_set)} samples, Val: {len(val_set)} samples")

    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=batch_size, shuffle=False)

    # Model, loss, optimizer
    model = GenomicMLP(input_size=n_features, dropout=dropout).to(device)
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    logger.info(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
    logger.info(f"Hyperparams: epochs={epochs}, batch_size={batch_size}, lr={lr}, dropout={dropout}")

    # Training loop
    best_val_loss = float("inf")
    best_epoch = 0
    train_losses: list[float] = []
    val_losses: list[float] = []
    val_aucs: list[float] = []

    start_time = time.time()

    for epoch in range(1, epochs + 1):
        # --- Training ---
        model.train()
        epoch_loss = 0.0
        n_batches = 0

        for features, labels in train_loader:
            features, labels = features.to(device), labels.to(device)

            optimizer.zero_grad()
            predictions = model(features).squeeze(1)
            loss = criterion(predictions, labels)
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            n_batches += 1

        avg_train_loss = epoch_loss / max(n_batches, 1)
        train_losses.append(avg_train_loss)

        # --- Validation ---
        model.eval()
        val_loss = 0.0
        all_preds: list[float] = []
        all_labels: list[float] = []

        with torch.no_grad():
            for features, labels in val_loader:
                features, labels = features.to(device), labels.to(device)

                predictions = model(features).squeeze(1)
                loss = criterion(predictions, labels)
                val_loss += loss.item()

                all_preds.extend(predictions.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())

        avg_val_loss = val_loss / max(len(val_loader), 1)
        val_losses.append(avg_val_loss)

        # ROC-AUC (handle edge case: only one class in batch)
        try:
            val_auc = roc_auc_score(all_labels, all_preds)
        except ValueError:
            val_auc = 0.5
        val_aucs.append(val_auc)

        # Accuracy
        binary_preds = [1 if p > 0.5 else 0 for p in all_preds]
        val_accuracy = accuracy_score(all_labels, binary_preds)

        # Logging
        if epoch % 5 == 0 or epoch == 1:
            logger.info(
                f"Epoch {epoch:3d}/{epochs} | "
                f"Train Loss: {avg_train_loss:.4f} | "
                f"Val Loss: {avg_val_loss:.4f} | "
                f"Val AUC: {val_auc:.4f} | "
                f"Val Acc: {val_accuracy:.4f}"
            )

        # Early stopping check
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            best_epoch = epoch
            # Save best model checkpoint
            weights_path = output_dir / (MODEL_WEIGHTS_PATH.name if MODEL_WEIGHTS_PATH else "model_weights.pth")
            torch.save({
                "model_state_dict": model.state_dict(),
                "input_size": n_features,
                "hidden_sizes": (512, 256),
                "dropout": dropout,
                "epoch": epoch,
            }, weights_path)
        elif epoch - best_epoch >= patience:
            logger.info(f"Early stopping at epoch {epoch} (best was epoch {best_epoch})")
            break

    elapsed = time.time() - start_time

    # Final metrics
    metrics = {
        "total_epochs": epoch,
        "best_epoch": best_epoch,
        "best_val_loss": float(best_val_loss),
        "final_val_auc": float(val_aucs[-1]) if val_aucs else 0.0,
        "final_val_accuracy": float(val_accuracy),
        "training_time_seconds": round(elapsed, 2),
        "n_samples": len(dataset),
        "n_features": n_features,
        "hyperparameters": {
            "epochs": epochs,
            "batch_size": batch_size,
            "learning_rate": lr,
            "dropout": dropout,
            "patience": patience,
        },
        "loss_history": {
            "train": train_losses,
            "val": val_losses,
            "val_auc": val_aucs,
        },
    }

    metrics_path = output_dir / TRAINING_METRICS_FILE.name
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info("=" * 60)
    logger.info(f"Training complete in {elapsed:.1f}s")
    logger.info(f"Best epoch: {best_epoch} (val_loss={best_val_loss:.4f})")
    logger.info(f"Final Val AUC: {val_aucs[-1]:.4f}")
    logger.info(f"Saved weights: {weights_path}")
    logger.info(f"Saved metrics: {metrics_path}")

    return metrics

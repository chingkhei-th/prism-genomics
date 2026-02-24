"""
Genomic MLP — PyTorch model for Pathogenic/Benign variant classification.

Architecture:
    Input(n_snps) → Dense(512) → ReLU → Dropout
                   → Dense(256) → ReLU → Dropout
                   → Dense(1) → Sigmoid

Designed for high-dimensional, low-sample genomic data with dropout
regularization to prevent overfitting.
"""

import torch
import torch.nn as nn


class GenomicMLP(nn.Module):
    """
    Multilayer Perceptron for binary classification of genetic disease risk.

    Input: genotype vector (alt-allele counts at clinically significant SNPs)
    Output: probability of high disease risk (0-1)
    """

    def __init__(
        self,
        input_size: int,
        hidden_sizes: tuple[int, ...] = (512, 256),
        dropout: float = 0.3,
    ) -> None:
        super().__init__()

        layers: list[nn.Module] = []
        prev_size = input_size

        for h_size in hidden_sizes:
            layers.extend([
                nn.Linear(prev_size, h_size),
                nn.BatchNorm1d(h_size),
                nn.ReLU(),
                nn.Dropout(dropout),
            ])
            prev_size = h_size

        # Output layer — single neuron with sigmoid for binary probability
        layers.append(nn.Linear(prev_size, 1))
        layers.append(nn.Sigmoid())

        self.network = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass: genotype vector → disease probability."""
        return self.network(x)

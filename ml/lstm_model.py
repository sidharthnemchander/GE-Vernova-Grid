import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset


class LSTMAutoencoder(nn.Module):
    """
    Encoder compresses a sequence of sensor readings into a tiny vector.
    Decoder reconstructs the original sequence from that vector.

    Key idea: Train ONLY on normal data.
    The model learns what normal looks like.
    When it sees a fault, it can't reconstruct it well → high error = anomaly.
    """

    def __init__(self, n_features: int, latent_dim: int = 16, hidden_dim: int = 64):
        super().__init__()
        self.n_features = n_features

        # Encoder: sequence → single vector
        self.encoder_lstm = nn.LSTM(
            input_size=n_features,
            hidden_size=hidden_dim,
            num_layers=2,
            batch_first=True,      # input shape: (batch, timesteps, features)
            dropout=0.2,
        )
        self.encoder_fc = nn.Linear(hidden_dim, latent_dim)

        # Decoder: single vector → reconstructed sequence
        self.decoder_fc = nn.Linear(latent_dim, hidden_dim)
        self.decoder_lstm = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=2,
            batch_first=True,
            dropout=0.2,
        )
        self.output_layer = nn.Linear(hidden_dim, n_features)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch_size, timesteps, _ = x.shape

        _, (hidden, _) = self.encoder_lstm(x)

        latent = self.encoder_fc(hidden[-1])     # (batch, latent_dim)

        decoded = self.decoder_fc(latent)        # (batch, hidden_dim)
        
        decoded = decoded.unsqueeze(1).repeat(1, timesteps, 1)  # (batch, timesteps, hidden_dim)
        decoded, _ = self.decoder_lstm(decoded)
        output = self.output_layer(decoded)      # (batch, timesteps, n_features)

        return output



def train_lstm(
    X_normal_seq: np.ndarray,
    epochs: int = 40,
    batch_size: int = 64,
    lr: float = 1e-3,
) -> tuple[LSTMAutoencoder, list[float]]:
    """
    Train ONLY on normal (non-fault) sequences.
    Loss = how well can it reconstruct normal data?
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on: {device}")

    X_tensor = torch.tensor(X_normal_seq, dtype=torch.float32)
    dataset = TensorDataset(X_tensor, X_tensor)  # input = target (autoencoder)

    # 90/10 train/val split
    val_size = int(0.1 * len(dataset))
    train_size = len(dataset) - val_size
    train_ds, val_ds = torch.utils.data.random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    n_features = X_normal_seq.shape[2]
    model = LSTMAutoencoder(n_features=n_features).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.L1Loss()  # MAE loss - more robust to outliers than MSE

    # Learning rate scheduler: reduce lr if val loss plateaus
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, patience=5, factor=0.5
    )

    train_losses, val_losses = [], []
    best_val_loss = float("inf")
    patience_counter = 0
    PATIENCE = 10  # early stopping

    for epoch in range(epochs):
        # Training
        model.train()
        epoch_train_loss = 0
        for X_batch, y_batch in train_loader:
            X_batch = X_batch.to(device)
            optimizer.zero_grad()
            output = model(X_batch)
            loss = criterion(output, X_batch)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)  # prevent exploding gradients
            optimizer.step()
            epoch_train_loss += loss.item()

        # Validation
        model.eval()
        epoch_val_loss = 0
        with torch.no_grad():
            for X_batch, _ in val_loader:
                X_batch = X_batch.to(device)
                output = model(X_batch)
                epoch_val_loss += criterion(output, X_batch).item()

        avg_train = epoch_train_loss / len(train_loader)
        avg_val = epoch_val_loss / len(val_loader)
        train_losses.append(avg_train)
        val_losses.append(avg_val)

        scheduler.step(avg_val)

        if epoch % 5 == 0:
            print(f"Epoch {epoch:3d} | Train Loss: {avg_train:.5f} | Val Loss: {avg_val:.5f}")

        # Early stopping
        if avg_val < best_val_loss:
            best_val_loss = avg_val
            torch.save(model.state_dict(), "../models/lstm_best.pt")
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                print(f"Early stopping at epoch {epoch}")
                break

    # Load best weights before returning
    model.load_state_dict(torch.load("../models/lstm_best.pt", weights_only=True))
    return model, train_losses


def get_reconstruction_errors(
    model: LSTMAutoencoder, X_seq: np.ndarray
) -> np.ndarray:
    """
    Run all sequences through the autoencoder.
    Return per-sample MAE (mean absolute error across all timesteps and features).
    Higher error = more anomalous.
    """
    device = next(model.parameters()).device
    model.eval()
    X_tensor = torch.tensor(X_seq, dtype=torch.float32).to(device)

    with torch.no_grad():
        reconstructed = model(X_tensor)

    errors = torch.mean(
        torch.abs(reconstructed - X_tensor), dim=(1, 2)
    ).cpu().numpy()
    return errors


def set_threshold(normal_errors: np.ndarray, percentile: float = 95) -> float:
    """
    Set the anomaly threshold as the 95th percentile of normal reconstruction errors.
    Only use errors from NORMAL samples to set this.
    """
    threshold = float(np.percentile(normal_errors, percentile))
    print(f" Anomaly threshold set at: {threshold:.5f}")
    return threshold


def load_model(n_features: int, path: str = "../models/lstm_best.pt") -> LSTMAutoencoder:
    model = LSTMAutoencoder(n_features=n_features)
    model.load_state_dict(torch.load(path, weights_only=True))
    model.eval()
    return model
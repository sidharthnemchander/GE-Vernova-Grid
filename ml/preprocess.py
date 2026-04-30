import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler


SENSOR_COLS = ["Ia", "Ib", "Ic", "Va", "Vb", "Vc"]

FAULT_TYPE_MAP = {
    (0, 0, 0, 0): "No Fault",
    (0, 1, 1, 0): "Phase BC Fault",
    (0, 1, 1, 1): "Phase ABC Fault",
    (1, 0, 0, 1): "Phase A + Ground",
    (1, 0, 1, 1): "Phase AB + Ground",
    (1, 1, 1, 1): "Three Phase + Ground",
}

#Loading the detect_dataset.csv

def load_detect_dataset(filepath: str) -> tuple[pd.DataFrame, pd.Series]:
    """
    Loads detect_dataset.csv.
    Returns sensor readings (X) and binary fault label (y).
    
    Columns: Output (S), Ia, Ib, Ic, Va, Vb, Vc
    Output (S): 0 = normal, 1 = fault
    """
    df = pd.read_csv(filepath)

    df.columns = [c.strip() for c in df.columns]

    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    df.dropna(how="all", axis=1, inplace=True)

    df.dropna(inplace=True)
    df.reset_index(drop=True, inplace=True)

    # The label column is called "Output (S)"
    label_col = "Output (S)"

    X = df[SENSOR_COLS].copy()
    y = df[label_col].astype(int)

    print(f"   detect_dataset loaded: {len(df)} rows")
    print(f"   Normal: {(y == 0).sum()} | Fault: {(y == 1).sum()}")
    print(f"   Fault rate: {y.mean():.1%}")

    return X, y


#Loading classData.csv

def load_class_dataset(filepath: str) -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    """
    Loads classData.csv.
    Returns sensor readings (X), binary fault flag (y_binary),
    and human-readable fault type label (y_type).

    Columns: G, C, B, A, Ia, Ib, Ic, Va, Vb, Vc
    G = Ground fault flag
    C = Phase C fault flag
    B = Phase B fault flag
    A = Phase A fault flag
    """
    df = pd.read_csv(filepath)
    df.columns = [c.strip() for c in df.columns]
    df.dropna(inplace=True)
    df.reset_index(drop=True, inplace=True)

    fault_flag_cols = ["G", "C", "B", "A"]

    X = df[SENSOR_COLS].copy()

    y_binary = (df[fault_flag_cols].sum(axis=1) > 0).astype(int)

    y_type = df[fault_flag_cols].apply(
        lambda row: FAULT_TYPE_MAP.get(tuple(row), "Unknown"), axis=1
    )

    print(f"   classData ed: {len(df)} rows")
    print(f"   Fault types found:\n{y_type.value_counts().to_string()}")

    return X, y_binary, y_type


# ── Shared utilities 

def scale_data(
    X: pd.DataFrame,
    scaler: MinMaxScaler | None = None,
) -> tuple[np.ndarray, MinMaxScaler]:
    """
    Scale sensor readings to [0, 1].
    Pass an existing scaler to transform test data consistently.
    """
    if scaler is None:
        scaler = MinMaxScaler()
        X_scaled = scaler.fit_transform(X)
    else:
        X_scaled = scaler.transform(X)
    return X_scaled.astype(np.float32), scaler


def create_sequences(
    X: np.ndarray,
    y: pd.Series | np.ndarray,
    timesteps: int = 10,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Sliding window: converts flat rows → 3D sequences for LSTM.
    Output shape: (num_windows, timesteps, num_features)

    Why? Grid faults unfold over time.
    A single bad reading might be noise.
    A pattern across 10 readings = real fault.
    """
    Xs, ys = [], []
    y_arr = np.array(y)
    for i in range(len(X) - timesteps):
        Xs.append(X[i : i + timesteps])
        ys.append(y_arr[i + timesteps])
    return np.array(Xs, dtype=np.float32), np.array(ys, dtype=np.int64)


def get_dataset_stats(X: pd.DataFrame, y: pd.Series) -> None:
    """Print a quick sanity check summary."""
    print("\n Dataset Statistics:")
    print(X.describe().round(3).to_string())
    print(f"\nClass balance — Normal: {(y==0).sum()} | Fault: {(y==1).sum()}")
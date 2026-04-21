# ml/isolation_forest.py
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest


def train_isolation_forest(X_scaled: np.ndarray) -> IsolationForest:
    """
    Unsupervised outlier detector.
    Doesn't need labels - learns what 'normal' looks like by isolating points.
    Anomalies need fewer splits to isolate = they score lower.
    """
    model = IsolationForest(
        n_estimators=300,       # more trees = more stable scores
        contamination=0.05,     # assume 5% of readings are faults
        max_samples="auto",
        random_state=42,
        n_jobs=-1,              # use all CPU cores
    )
    model.fit(X_scaled)
    return model


def get_anomaly_scores(
    model: IsolationForest, X_scaled: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    raw_scores = model.decision_function(X_scaled)
    # Flip: more negative raw score = more anomalous
    # After flip: higher score = more anomalous (intuitive)
    anomaly_scores = -raw_scores
    raw_preds = model.predict(X_scaled)
    # IF returns -1 (anomaly) or 1 (normal). Convert to 1/0.
    labels = np.where(raw_preds == -1, 1, 0)
    return anomaly_scores, labels
 

def save_model(model: IsolationForest, path: str = "models/isolation_forest.pkl") -> None:
    joblib.dump(model, path)
    print(f"  Isolation Forest saved → {path}")
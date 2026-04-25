import numpy as np
#In this hybrid approach we check if both models agree
"""
# def hybrid_predict(
#     if_labels: np.ndarray,
#     lstm_errors: np.ndarray,
#     lstm_threshold: float,
# ) -> tuple[np.ndarray, np.ndarray]:
#     

#     lstm_labels = (lstm_errors > lstm_threshold).astype(int)
#     combined = np.logical_and(if_labels, lstm_labels).astype(int)

#     # Normalize LSTM error to 0–1 for a confidence score
#     err_min, err_max = lstm_errors.min(), lstm_errors.max()
#     normalized_error = (lstm_errors - err_min) / (err_max - err_min + 1e-8)
#     confidence = np.where(combined == 1, normalized_error, 0.0)

#     return combined, confidence
"""

def hybrid_predict(if_labels, lstm_errors, lstm_threshold):
    """
    At least one model should agree there is an anomaly.
    """
    lstm_labels = (lstm_errors > lstm_threshold).astype(int)
    combined = np.logical_or(if_labels, lstm_labels).astype(int)
    
    max_expected_error = lstm_threshold * 3.0 
    
    lstm_confidence = np.clip(
        (lstm_errors - lstm_threshold) / (max_expected_error - lstm_threshold + 1e-8), 
        0.0, 
        1.0
    )
    
    confidence = np.where(
        lstm_labels == 1, 
        lstm_confidence, 
        np.where(if_labels == 1, 0.5, 0.0)
    )
    
    return combined, confidence
def classify_severity(confidence_score: float) -> str:
    """Map confidence score to human-readable alert level."""
    if confidence_score > 0.80:
        return " CRITICAL"
    elif confidence_score > 0.55:
        return " HIGH"
    elif confidence_score > 0.25:
        return " MEDIUM"
    else:
        return " LOW"
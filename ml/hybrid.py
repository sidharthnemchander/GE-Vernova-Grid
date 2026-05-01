import numpy as np
#In this hybrid approach we check if both models agree
def hybrid_predict(
    if_labels: np.ndarray,
    lstm_errors: np.ndarray,
    lstm_threshold: float,
) -> tuple[np.ndarray, np.ndarray]:
    
    from api.model_loader import store
    lstm_labels = (lstm_errors > lstm_threshold).astype(int)
    combined = np.logical_and(if_labels, lstm_labels).astype(int)

    # Normalize LSTM error to 0–1 for a confidence score
    err_min = store.train_err_min
    err_max = store.train_err_max
    normalized_error = (lstm_errors - err_min) / (err_max - err_min + 1e-8)
    normalized_error = np.clip(normalized_error, 0.0, 1.0)
    confidence = np.where(combined == 1, normalized_error, 0.0)

    return combined, confidence


# def hybrid_predict(if_labels, lstm_errors, lstm_threshold):
#     """
#     Calculates a continuous confidence score from 0.0 to 1.0 based on 
#     reconstruction error magnitude and model consensus.
#     """
#     lstm_labels = (lstm_errors > lstm_threshold).astype(int)
    
#     max_expected_error = lstm_threshold * 4.0 
    
#     raw_lstm_confidence = np.clip(
#         (lstm_errors - lstm_threshold) / (max_expected_error - lstm_threshold + 1e-8), 
#         0.0, 
#         1.0
#     )
    
#     final_confidence = []
#     final_labels = []

#     for i in range(len(lstm_labels)):
#         is_lstm_fault = lstm_labels[i] == 1
#         is_if_fault = if_labels[i] == 1
        
#         if is_lstm_fault:

#             if is_if_fault:
#                 conf = np.clip(raw_lstm_confidence[i] + 0.2, 0.1, 1.0)

#             else:
#                 conf = raw_lstm_confidence[i]
            
#             label = 1
#         else:

#             if is_if_fault:
#                 conf = 0.15  
#                 label = 1    
#             else:
#                 conf = 0.0
#                 label = 0
                
#         final_confidence.append(conf)
#         final_labels.append(label)

#     return np.array(final_labels), np.array(final_confidence)
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
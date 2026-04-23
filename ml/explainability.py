import shap
import numpy as np
import matplotlib.pyplot as plt


def explain_with_shap(
    if_model,
    X_scaled: np.ndarray,
    feature_names: list[str],
) -> np.ndarray:
    """
    SHAP TreeExplainer is the right choice for Isolation Forest.
    It tells us: for each anomaly, which sensor reading pushed the
    score toward 'anomalous' the most?
    """
    explainer = shap.TreeExplainer(if_model)
    shap_values = explainer.shap_values(X_scaled)
    return shap_values


def plot_shap_summary(
    shap_values: np.ndarray,
    X_scaled: np.ndarray,
    feature_names: list[str],
    save_path: str = "models/shap_summary.png",
) -> None:
    """Overall: which sensors matter most across ALL anomalies?"""
    shap.summary_plot(
        shap_values,
        X_scaled,
        feature_names=feature_names,
        show=False,
        plot_size=(10, 5),
    )
    plt.title("Sensor Importance for Anomaly Detection", fontsize=14)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f" SHAP summary saved → {save_path}")


def explain_single_anomaly(
    shap_values: np.ndarray,
    X_scaled: np.ndarray,
    sample_index: int,
    feature_names: list[str],
    save_path: str | None = None,
) -> None:
    """
    Waterfall chart for ONE flagged anomaly.
    Shows exactly which sensor pushed it over the threshold.
    This renders in your React dashboard's 'Why was this flagged?' panel.
    """
    explanation = shap.Explanation(
        values=shap_values[sample_index],
        base_values=float(np.mean(shap_values)),
        data=X_scaled[sample_index],
        feature_names=feature_names,
    )
    shap.waterfall_plot(explanation, show=False)
    plt.title(f"Why was reading #{sample_index} flagged as anomalous?")
    plt.tight_layout()
    path = save_path or f"models/explanation_{sample_index}.png"
    plt.savefig(path, dpi=150)
    plt.close()
    print(f" Explanation saved → {path}")


def get_top_contributing_sensors(
    shap_values: np.ndarray,
    sample_index: int,
    feature_names: list[str],
    top_n: int = 3,
) -> list[dict]:
    """
    Returns a clean JSON-serializable list of the top N sensors
    that caused this anomaly. This plugs directly into your API response.

    Example output:
    [
      {"sensor": "Ia", "impact": 0.42, "direction": "↑ above normal"},
      {"sensor": "Va", "impact": 0.31, "direction": "↓ below normal"},
    ]
    """
    sample_shap = shap_values[sample_index]
    top_indices = np.argsort(np.abs(sample_shap))[::-1][:top_n]

    return [
        {
            "sensor": feature_names[idx],
            "impact": round(float(sample_shap[idx]), 4),
            "direction": "↑ above normal" if sample_shap[idx] > 0 else "↓ below normal",
        }
        for idx in top_indices
    ]
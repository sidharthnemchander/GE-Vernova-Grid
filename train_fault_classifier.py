import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.preprocessing import MinMaxScaler
from ml.preprocess import load_class_dataset, SENSOR_COLS


def add_features(X_df: pd.DataFrame) -> pd.DataFrame:
    """
    Feature engineering for fault type classification.

    """
    X_new = X_df.copy()

    X_new["I_zero_seq"] = (X_df["Ia"] + X_df["Ib"] + X_df["Ic"]) / 3

    X_new["I_imbalance"] = X_df[["Ia", "Ib", "Ic"]].std(axis=1, ddof=1)
    X_new["V_imbalance"] = X_df[["Va", "Vb", "Vc"]].std(axis=1, ddof=1)

    X_new["S_a"] = (X_df["Ia"] * X_df["Va"]).abs()
    X_new["S_b"] = (X_df["Ib"] * X_df["Vb"]).abs()
    X_new["S_c"] = (X_df["Ic"] * X_df["Vc"]).abs()

    X_new["S_total"] = X_new["S_a"] + X_new["S_b"] + X_new["S_c"]

    X_new["V_depression"] = X_df[["Va", "Vb", "Vc"]].min(axis=1)

    return X_new


def main():
    print(" Loading classData.csv...")
    X, _, y_type = load_class_dataset("data/raw/classData.csv")
    print(f" {len(X)} rows loaded\n")

    scaler = joblib.load("models/scaler.pkl")

    X_engineered = add_features(X)

    original_scaled = scaler.transform(X_engineered[SENSOR_COLS])

    new_feature_cols = [
        "I_zero_seq", "I_imbalance", "V_imbalance",
        "S_a", "S_b", "S_c", "S_total", "V_depression"
    ]
    new_features_df = X_engineered[new_feature_cols]
    feat_scaler = MinMaxScaler()
    new_features_scaled = feat_scaler.fit_transform(new_features_df)

    X_final = np.hstack([original_scaled, new_features_scaled])

    joblib.dump(new_feature_cols, "models/feature_col_order.pkl")
    print(f"Feature columns: {new_feature_cols}\n")

    X_train, X_test, y_train, y_test = train_test_split(
        X_final, y_type,
        test_size=0.2,
        random_state=42,
        stratify=y_type,
    )

    print(" Training GradientBoosting classifier...")
    clf = GradientBoostingClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        random_state=42,
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    print("\n Classification Report:")
    print(classification_report(y_test, y_pred))

    joblib.dump(clf,         "models/fault_classifier.pkl")
    joblib.dump(feat_scaler, "models/feature_scaler.pkl")
    print(" fault_classifier.pkl saved")
    print(" feature_scaler.pkl saved")
    print(" feature_col_order.pkl saved")



if __name__ == "__main__":
    main()
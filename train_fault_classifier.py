import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

from ml.preprocess import load_class_dataset, scale_data, SENSOR_COLS


def main():
    print(" Loading classData.csv...")
    X, _, y_type = load_class_dataset("data/raw/classData.csv")

    print(f" Loaded {len(X)} rows")
    print(f"   Fault types:\n{y_type.value_counts().to_string()}\n")

    scaler = joblib.load("models/scaler.pkl")
    X_scaled, _ = scale_data(X, scaler=scaler)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y_type,
        test_size=0.2,
        random_state=42,
        stratify=y_type,
    )

    print("Training Random Forest fault classifier...")
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced",
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    print("\n Classification Report:")
    print(classification_report(y_test, y_pred))

    joblib.dump(clf, "models/fault_classifier.pkl")
    print(" Fault classifier saved → models/fault_classifier.pkl")
    print("\n Restart your FastAPI server — the Fault Type page will now work.")


if __name__ == "__main__":
    main()
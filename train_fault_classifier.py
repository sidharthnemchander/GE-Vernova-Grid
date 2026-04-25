import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.preprocessing import MinMaxScaler
from ml.preprocess import load_class_dataset, SENSOR_COLS

X, _, y_type = load_class_dataset("data/raw/classData.csv")
scaler = joblib.load("models/scaler.pkl")

def add_features(X_df):
    """
    Add engineered features that help separate electrically similar faults.
    Three Phase + Ground has ground current (zero sequence) unlike Phase ABC Fault.
    """
    X_new = X_df.copy()
    
    X_new["I_zero_seq"] = (X_df["Ia"] + X_df["Ib"] + X_df["Ic"]) / 3
    
    X_new["I_imbalance"] = X_df[["Ia","Ib","Ic"]].std(axis=1)
    X_new["V_imbalance"] = X_df[["Va","Vb","Vc"]].std(axis=1)
    
    X_new["S_a"] = np.abs(X_df["Ia"] * X_df["Va"])
    X_new["S_b"] = np.abs(X_df["Ib"] * X_df["Vb"])
    X_new["S_c"] = np.abs(X_df["Ic"] * X_df["Vc"])
    
    X_new["S_total"] = X_new["S_a"] + X_new["S_b"] + X_new["S_c"]
    
    X_new["V_depression"] = X_df[["Va","Vb","Vc"]].min(axis=1)
    
    return X_new

# Apply feature engineering
X_engineered = add_features(X)
print(f"Features: {list(X_engineered.columns)}")

original_scaled = scaler.transform(X_engineered[SENSOR_COLS])
new_features = X_engineered.drop(columns=SENSOR_COLS).values
new_scaler = MinMaxScaler()
new_features_scaled = new_scaler.fit_transform(new_features)
X_final = np.hstack([original_scaled, new_features_scaled])

X_train, X_test, y_train, y_test = train_test_split(
    X_final, y_type,
    test_size=0.2,
    random_state=42,
    stratify=y_type,
)

from sklearn.ensemble import GradientBoostingClassifier
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

joblib.dump(clf, "models/fault_classifier.pkl")
joblib.dump(new_scaler, "models/feature_scaler.pkl")
print(" Saved fault_classifier.pkl and feature_scaler.pkl")
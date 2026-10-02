import pandas as pd
import numpy as np
import os
import joblib
import json
from pathlib import Path

from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_score, recall_score, f1_score

BASE_DIR = Path(__file__).resolve().parents[1]

def train_and_save_model():
    dataset_path = BASE_DIR / "data" / "symptom_dataset.csv"
    
    if not os.path.exists(dataset_path):
        print(f"Dataset not found at {dataset_path}. Please generate it first.")
        return

    # 1. Load dataset
    df = pd.read_csv(dataset_path)

    # 2. Separate features and target
    X = df.drop('Condition', axis=1)
    y = df['Condition']

    # 3. Split into training and testing data (80/20 stratified split)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    # 4. Train Decision Tree Classifier
    model = DecisionTreeClassifier(
        criterion="entropy",
        max_depth=10,
        random_state=42
    )
    model.fit(X_train, y_train)

    # 5. Calculate exact metrics
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
    recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
    
    print(f"Model Accuracy: {accuracy * 100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    # 6. Save trained model
    joblib.dump(model, BASE_DIR / "treatment_model.joblib")
    print("Model saved to treatment_model.joblib")

    # 7. Save symptom column names
    symptom_columns = list(X.columns)
    joblib.dump(symptom_columns, BASE_DIR / "symptom_columns.joblib")
    print("Symptom columns saved to symptom_columns.joblib")

    # 8. Save metrics and parameters to JSON for /model-info
    metrics = {
        "algorithm": "Decision Tree Classifier",
        "criterion": "entropy",
        "max_depth": 10,
        "random_state": 42,
        "train_split": 0.8,
        "test_split": 0.2,
        "input_features": len(symptom_columns),
        "condition_categories": len(np.unique(y)),
        "confusion_matrix": confusion_matrix(y_test, y_pred, labels=model.classes_).tolist(),
        "condition_labels": model.classes_.tolist(),
        "evaluation": {
            "accuracy": round(accuracy * 100, 2),
            "precision": round(precision * 100, 2),
            "recall": round(recall * 100, 2),
            "f1_score": round(f1 * 100, 2)
        }
    }
    with (BASE_DIR / "model_metrics.json").open("w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=4)
    print("Model metrics saved to model_metrics.json")

if __name__ == "__main__":
    train_and_save_model()

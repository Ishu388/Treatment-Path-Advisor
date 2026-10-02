import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from joblib import load
from sklearn.tree import DecisionTreeClassifier

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

ROOT_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT_DIR / "treatment_model.joblib"
METRICS_PATH = ROOT_DIR / "model_metrics.json"
FEATURES_PATH = ROOT_DIR / "symptom_columns.joblib"
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from treatment_kb import TREATMENT_PATHS as EDUCATIONAL_TREATMENT_PATHS

SYMPTOMS = [
    "Fever",
    "Cough",
    "Sore Throat",
    "Runny Nose",
    "Sneezing",
    "Headache",
    "Fatigue",
    "Body Pain",
    "Chills",
    "Nausea",
    "Vomiting",
    "Diarrhea",
    "Stomach Pain",
    "Chest Pain",
    "Shortness of Breath",
    "Wheezing",
    "Dizziness",
    "Loss of Appetite",
    "Muscle Pain",
    "Joint Pain",
    "Back Pain",
    "Abdominal Pain",
    "Constipation",
    "Heartburn",
    "Skin Rash",
    "Itching",
    "Red Eyes",
    "Watery Eyes",
    "Ear Pain",
    "Tooth Pain",
    "Difficulty Swallowing",
    "Nasal Congestion",
    "Sweating",
    "Weakness",
    "Increased Thirst",
    "Frequent Urination",
    "Sleep Problems",
    "Anxiety",
]
SEVERITY_LABELS = ["Mild", "Moderate", "Severe"]
CONDITION_LABELS = sorted(EDUCATIONAL_TREATMENT_PATHS)
TREATMENT_PATHS = {
    condition: care["self_care"] + care["precautions"]
    for condition, care in EDUCATIONAL_TREATMENT_PATHS.items()
}

RISK_SCORE_MAP = {
    "Influenza": "Medium",
    "Asthma": "Medium",
    "Food Poisoning": "Medium",
    "Gastroenteritis": "Medium",
    "Urinary Tract Infection": "Medium",
    "Viral Fever": "Medium",
}

MODEL: DecisionTreeClassifier | None = None
METRICS: Dict[str, Any] = {}

SPECIALTY_BY_CONDITION = {
    "Acid Reflux": "Gastroenterology",
    "Allergy": "Allergy and Immunology",
    "Asthma": "Pulmonology",
    "Food Poisoning": "Gastroenterology",
    "Gastroenteritis": "Gastroenterology",
    "Influenza": "Primary Care",
    "Migraine": "Neurology",
    "Skin Allergy": "Dermatology",
    "Tension Headache": "Neurology",
    "Urinary Tract Infection": "Urology",
    "Viral Fever": "Primary Care",
}


def normalize_symptoms(symptoms: List[str]) -> List[str]:
    normalized = [symptom.strip().lower() for symptom in symptoms if symptom and symptom.strip()]
    aliases = {
        "difficulty breathing": "shortness of breath",
        "severe weakness": "weakness",
    }
    return [aliases.get(symptom, symptom) for symptom in normalized]


def build_feature_vector(symptoms: List[str], severity: str) -> List[int]:
    normalized = set(normalize_symptoms(symptoms))
    return [1 if symptom.lower() in normalized else 0 for symptom in SYMPTOMS]


def build_explanation(label: str, symptoms: List[str], severity: str) -> str:
    return f"The Decision Tree selected {label} from the recorded binary symptom pattern. See the decision path for the splits used."


def risk_score_for_label(label: str, severity: str) -> str:
    base = RISK_SCORE_MAP.get(label, "Low")
    if severity.lower() == "severe":
        return "High"
    if label == "Potential cardiac event":
        return "High"
    return base


def train_model() -> None:
    global MODEL, METRICS
    if str(ROOT_DIR) not in sys.path:
        sys.path.insert(0, str(ROOT_DIR))
    from data.generate_dataset import generate_dataset
    from model.train_model import train_and_save_model

    dataset_path = ROOT_DIR / "data" / "symptom_dataset.csv"
    if not dataset_path.exists():
        generate_dataset()
    train_and_save_model()
    MODEL = load(MODEL_PATH)
    with METRICS_PATH.open("r", encoding="utf-8") as metrics_file:
        saved_metrics = json.load(metrics_file)

    evaluation = saved_metrics["evaluation"]
    feature_columns = load(FEATURES_PATH)
    if feature_columns != SYMPTOMS or MODEL.n_features_in_ != len(feature_columns):
        raise ValueError("Saved model features do not match the configured symptom columns.")

    METRICS = {
        "algorithm": "Decision Tree Classifier",
        "criterion": MODEL.criterion,
        "max_depth": MODEL.max_depth,
        "random_state": 42,
        "train_split": 0.8,
        "test_split": 0.2,
        "input_features": len(feature_columns),
        "condition_categories": len(MODEL.classes_),
        "accuracy": evaluation["accuracy"] / 100,
        "precision": evaluation["precision"] / 100,
        "recall": evaluation["recall"] / 100,
        "f1_score": evaluation["f1_score"] / 100,
        "confusion_matrix": saved_metrics["confusion_matrix"],
        "feature_importance": {
            name: float(value)
            for name, value in zip(SYMPTOMS, MODEL.feature_importances_)
            if float(value) > 0
        },
        "labels": MODEL.classes_.tolist(),
        "evaluation": {
            "strategy": "Stratified 80/20 train/test split",
            "random_state": saved_metrics["random_state"],
            "test_samples": sum(sum(row) for row in saved_metrics["confusion_matrix"]),
        },
    }


def load_model() -> DecisionTreeClassifier:
    global MODEL, METRICS
    if MODEL is not None:
        return MODEL

    if not MODEL_PATH.exists() or not FEATURES_PATH.exists() or not METRICS_PATH.exists():
        train_model()
    else:
        MODEL = load(MODEL_PATH)
        feature_columns = load(FEATURES_PATH)
        if feature_columns != SYMPTOMS or MODEL.n_features_in_ != len(feature_columns):
            MODEL = None
            train_model()
            return MODEL
        with METRICS_PATH.open("r", encoding="utf-8") as metrics_file:
            saved_metrics = json.load(metrics_file)
        evaluation = saved_metrics["evaluation"]
        METRICS = {
            "algorithm": "Decision Tree Classifier",
            "criterion": MODEL.criterion,
            "max_depth": MODEL.max_depth,
            "random_state": saved_metrics["random_state"],
            "train_split": saved_metrics["train_split"],
            "test_split": saved_metrics["test_split"],
            "input_features": len(feature_columns),
            "condition_categories": len(MODEL.classes_),
            "accuracy": evaluation["accuracy"] / 100,
            "precision": evaluation["precision"] / 100,
            "recall": evaluation["recall"] / 100,
            "f1_score": evaluation["f1_score"] / 100,
            "confusion_matrix": saved_metrics["confusion_matrix"],
            "feature_importance": {
                name: float(value)
                for name, value in zip(SYMPTOMS, MODEL.feature_importances_)
                if float(value) > 0
            },
            "labels": MODEL.classes_.tolist(),
            "evaluation": {
                "strategy": "Stratified 80/20 train/test split",
                "random_state": saved_metrics["random_state"],
                "test_samples": sum(sum(row) for row in saved_metrics["confusion_matrix"]),
            },
        }

    return MODEL


def get_symptom_library() -> List[Dict[str, Any]]:
    dataset = pd.read_csv(ROOT_DIR / "data" / "symptom_dataset.csv")
    profiles = dataset.groupby("Condition")[SYMPTOMS].mean()
    return [
        {
            "name": symptom,
            "description": f"{symptom} is a binary input in the project's educational dataset.",
            "severity": "Moderate",
            "common_conditions": profiles[symptom].sort_values(ascending=False).head(3).index.tolist(),
        }
        for symptom in SYMPTOMS
    ]


def get_decision_tree_structure() -> Dict[str, Any]:
    model = load_model()
    tree = model.tree_
    feature_names = SYMPTOMS

    def recurse(node: int) -> Dict[str, Any]:
        if tree.feature[node] != -2:
            name = feature_names[tree.feature[node]]
            threshold = tree.threshold[node]
            return {
                "feature": name,
                "threshold": float(threshold),
                "left": recurse(tree.children_left[node]),
                "right": recurse(tree.children_right[node]),
            }
        values = tree.value[node][0]
        predicted_label = model.classes_[int(values.argmax())] if values.sum() else "Unknown"
        return {
            "leaf": True,
            "prediction": predicted_label,
            "distribution": [int(v) for v in values],
        }

    return recurse(0)


def get_personalized_summary(symptoms: List[str], severity: str) -> str:
    summary_symptoms = ", ".join(symptoms[:3])
    return (
        f"Based on symptoms such as {summary_symptoms} and severity {severity}, we recommend a focused clinical evaluation and follow-up if symptoms persist."
    )


def get_condition_catalog() -> List[Dict[str, Any]]:
    dataset = pd.read_csv(ROOT_DIR / "data" / "symptom_dataset.csv")
    catalog = []
    for condition in CONDITION_LABELS:
        condition_rows = dataset[dataset["Condition"] == condition]
        key_symptoms = (
            condition_rows[SYMPTOMS].mean().sort_values(ascending=False).head(5).index.tolist()
            if not condition_rows.empty
            else []
        )
        catalog.append({
            "condition": condition,
            "specialty": SPECIALTY_BY_CONDITION.get(condition, "Primary Care"),
            "risk_level": risk_score_for_label(condition, "Moderate"),
            "summary": "Dataset-based educational category; not a clinical diagnosis.",
            "key_symptoms": key_symptoms,
        })
    return catalog


def get_translation_catalog(language: str | None = None) -> List[Dict[str, Any]]:
    from .database import get_connection

    connection = get_connection()
    query = "SELECT language, key_name, value FROM translations"
    params = ()
    if language:
        query += " WHERE language = ?"
        params = (language,)
    rows = connection.execute(query, params).fetchall()
    connection.close()
    return [{"language": row["language"], "key": row["key_name"], "value": row["value"]} for row in rows]


def get_doctor_recommendation(condition: str, risk_score: str, location: str = "Bengaluru") -> str:
    if risk_score in {"High", "Critical"}:
        return "Consult an emergency physician or specialist immediately."
    specialty = SPECIALTY_BY_CONDITION.get(condition, "Primary Care")
    return f"A {specialty} specialist in {location} is recommended for a verified clinical review."


def get_doctor_recommendations(condition: str, location: str = "Bengaluru", lat: float = None, lng: float = None) -> List[Dict[str, Any]]:
    from .database import get_connection

    specialty = SPECIALTY_BY_CONDITION.get(condition, "Primary Care")
    connection = get_connection()
    rows = connection.execute(
        "SELECT name, specialty, location, lat, lng, phone, rating, verified, availability FROM doctors WHERE specialty = ? OR location = ?",
        (specialty, location),
    ).fetchall()
    connection.close()
    
    results = []
    for row in rows:
        doctor = dict(row)
        doctor["verified"] = bool(doctor["verified"])
        if lat is not None and lng is not None and doctor.get("lat") and doctor.get("lng"):
            doctor["distance_km"] = round(haversine(lat, lng, doctor["lat"], doctor["lng"]), 2)
        else:
            doctor["distance_km"] = None
        results.append(doctor)
    
    if lat is not None and lng is not None:
        results.sort(key=lambda x: x["distance_km"] if x["distance_km"] is not None else float('inf'))
    else:
        results.sort(key=lambda x: x["rating"], reverse=True)
        
    return results[:5]


def get_hospital_recommendations(location: str = "Bengaluru", specialty: str | None = None, lat: float = None, lng: float = None) -> List[Dict[str, Any]]:
    from .database import get_connection

    connection = get_connection()
    if specialty:
        rows = connection.execute(
            "SELECT name, location, lat, lng, specialty, phone, beds, emergency FROM hospitals WHERE specialty = ? OR location = ?",
            (specialty, location),
        ).fetchall()
    else:
        rows = connection.execute(
            "SELECT name, location, lat, lng, specialty, phone, beds, emergency FROM hospitals WHERE location = ?",
            (location,),
        ).fetchall()
    connection.close()
    
    results = []
    for row in rows:
        hospital = dict(row)
        hospital["emergency"] = bool(hospital["emergency"])
        if lat is not None and lng is not None and hospital.get("lat") and hospital.get("lng"):
            hospital["distance_km"] = round(haversine(lat, lng, hospital["lat"], hospital["lng"]), 2)
        else:
            hospital["distance_km"] = None
        results.append(hospital)
        
    if lat is not None and lng is not None:
        results.sort(key=lambda x: x["distance_km"] if x["distance_km"] is not None else float('inf'))
    else:
        results.sort(key=lambda x: x["beds"], reverse=True)
        
    return results[:5]


def get_medication_guidance(condition: str) -> List[str]:
    guidance = {
        "Potential cardiac event": [
            "Medication and dosage decisions must be made only by a licensed clinician using verified medical protocols.",
            "Do not self-prescribe cardiovascular medicine or alter prescribed therapy without professional review.",
        ],
        "Respiratory infection": [
            "Treatment plans should follow verified clinical guidance and local infection protocols.",
            "Avoid taking antibiotics without a licensed clinician's assessment.",
        ],
        "Migraine or tension headache": [
            "Medication choices depend on headache type, severity, and medical history.",
            "Only a clinician may determine safe use of analgesics or antiemetics.",
        ],
        "Inflammatory joint condition": [
            "Inflammatory treatment requires clinician review based on diagnosis and lab findings.",
            "Do not start or stop anti-inflammatory drugs without professional oversight.",
        ],
    }
    return guidance.get(condition, [
        "Follow verified clinical guidance and consult a licensed healthcare professional for any medication-related decisions.",
        "This system does not prescribe medication or dosage automatically.",
    ])


def predict_treatment(
    symptoms: List[str], severity: str, language: str = "en", vitals_heart_rate: int = None, vitals_spo2: int = None,
    age: int = None, gender: str = None, duration: str = None, vitals_temp: float = None, vitals_bp: str = None
) -> Dict[str, Any]:
    model = load_model()
    severity = severity or "Moderate"
    severity = severity if severity in SEVERITY_LABELS else "Moderate"
    feature_values = build_feature_vector(symptoms, severity)
    feature_vector = np.asarray(feature_values, dtype=float)
    prediction_input = pd.DataFrame([feature_values], columns=SYMPTOMS)
    probabilities = model.predict_proba(prediction_input)[0]
    options = sorted(
        zip(model.classes_, probabilities), key=lambda pair: pair[1], reverse=True
    )[:3]
    top_predictions = [
        {"condition": condition, "confidence": round(float(confidence * 100), 1)}
        for condition, confidence in options
    ]
    condition = top_predictions[0]["condition"]
    confidence = top_predictions[0]["confidence"]
    risk_score = risk_score_for_label(condition, severity)
    red_flags = {"chest pain", "shortness of breath", "difficulty breathing", "severe weakness"}
    raw_symptoms = {symptom.strip().casefold() for symptom in symptoms if symptom and symptom.strip()}
    if raw_symptoms & red_flags:
        risk_score = "Critical"
    emergency_warning = bool(raw_symptoms & red_flags) or risk_score == "High"
    care_path = EDUCATIONAL_TREATMENT_PATHS[condition]
    recommended_path = TREATMENT_PATHS[condition]
    visual_path = [
        "Review the reported symptom pattern",
        "Follow the listed general self-care guidance and precautions",
        "Contact a clinician if the listed warning signs occur",
    ]
    specialty = SPECIALTY_BY_CONDITION.get(condition, "Primary Care")

    if vitals_spo2 is not None and vitals_spo2 < 92:
        risk_score = "Critical"
        emergency_warning = True
    elif vitals_heart_rate is not None and (vitals_heart_rate > 120 or vitals_heart_rate < 50):
        risk_score = "Critical"
        emergency_warning = True
    elif vitals_temp is not None and (vitals_temp > 103.0 or vitals_temp < 95.0):
        risk_score = "Critical"
        emergency_warning = True

    explanation = build_explanation(condition, symptoms, severity)
    if emergency_warning:
        explanation = "Emergency warning: seek immediate professional medical assistance. The model output is not a diagnosis."

    node_indicator = model.decision_path(prediction_input)
    leaf_id = model.apply(prediction_input)[0]
    node_indices = node_indicator.indices[node_indicator.indptr[0]:node_indicator.indptr[1]]
    decision_path = []
    for node_id in node_indices:
        feature_index = model.tree_.feature[node_id]
        if node_id == leaf_id or feature_index < 0:
            continue
        symptom_name = SYMPTOMS[feature_index]
        answer = "Yes" if feature_vector[feature_index] > model.tree_.threshold[node_id] else "No"
        decision_path.append(f"{symptom_name} → {answer}")

    feature_importance_list = [
        {"symptom": symptom, "importance": round(float(importance), 3)}
        for symptom, importance in zip(SYMPTOMS, model.feature_importances_)
        if importance > 0
    ]
    feature_importance_list.sort(key=lambda feature: feature["importance"], reverse=True)
    feature_importance_list = feature_importance_list[:5]

    return {
        "condition": condition,
        "confidence": confidence,
        "recommended_path": recommended_path,
        "visual_path": visual_path,
        "note": "This educational prediction uses a local Decision Tree and does not provide a diagnosis.",
        "risk_score": risk_score,
        "top_predictions": top_predictions,
        "explanation": explanation,
        "severity_label": severity,
        "emergency_warning": emergency_warning,
        "specialty": specialty,
        "medication_guidance": get_medication_guidance(condition),
        "feature_importance": feature_importance_list,
        "decision_path": decision_path,
        "self_care": care_path["self_care"],
        "precautions": care_path["precautions"],
        "see_a_doctor_if": care_path["see_a_doctor_if"],
        "patient_details": {
            "age": age,
            "gender": gender,
            "duration": duration,
            "vitals_temp": vitals_temp,
            "vitals_bp": vitals_bp,
            "vitals_heart_rate": vitals_heart_rate,
            "vitals_spo2": vitals_spo2,
        },
    }


def get_prediction_history(limit: int = 20) -> List[Dict[str, Any]]:
    from .database import fetch_history

    load_model()
    return fetch_history(limit)


def get_ml_insights() -> Dict[str, Any]:
    load_model()
    if not METRICS:
        if METRICS_PATH.exists():
            with open(METRICS_PATH, "r", encoding="utf-8") as metrics_file:
                metrics = json.load(metrics_file)
                metrics.setdefault("precision", 0.0)
                metrics.setdefault("recall", 0.0)
                metrics.setdefault("f1_score", 0.0)
                return metrics
        train_model()

    metrics = dict(METRICS)
    metrics.setdefault("precision", 0.0)
    metrics.setdefault("recall", 0.0)
    metrics.setdefault("f1_score", 0.0)
    return metrics

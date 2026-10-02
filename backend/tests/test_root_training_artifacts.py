import json
from pathlib import Path

import joblib

from treatment_kb import TREATMENT_PATHS


ROOT_DIR = Path(__file__).resolve().parents[2]


def test_standalone_model_artifacts_match_features_and_treatments():
    model = joblib.load(ROOT_DIR / "treatment_model.joblib")
    symptom_columns = joblib.load(ROOT_DIR / "symptom_columns.joblib")
    metrics = json.loads((ROOT_DIR / "model_metrics.json").read_text(encoding="utf-8"))

    assert len(symptom_columns) == model.n_features_in_ == 38
    assert len(model.classes_) == 13
    assert model.criterion == "entropy"
    assert model.max_depth == 10
    assert set(model.classes_) == set(TREATMENT_PATHS)
    assert metrics["input_features"] == len(symptom_columns)
    assert metrics["condition_categories"] == len(model.classes_)
    assert len(metrics["confusion_matrix"]) == 13
    assert all(
        treatment["self_care"] and treatment["precautions"] and treatment["see_a_doctor_if"]
        for treatment in TREATMENT_PATHS.values()
    )
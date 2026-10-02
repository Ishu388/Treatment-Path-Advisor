import asyncio

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from starlette.responses import FileResponse

from app import main


def test_model_info_returns_evaluation_metrics():
    payload = main.model_info()
    assert payload["success"] is True
    assert payload["data"]["evaluation"]["strategy"] == "Stratified 80/20 train/test split"
    assert payload["data"]["input_features"] == 38
    assert payload["data"]["condition_categories"] == 13


def test_predict_returns_top_three_xai_and_emergency_warning(monkeypatch):
    monkeypatch.setattr(main, "save_prediction", lambda record: None)
    request = main.SymptomRequest(
        symptoms=["Chest Pain", "Shortness of Breath", "Severe Weakness"],
        severity="Severe",
        duration="1 hour",
    )
    payload = asyncio.run(main.get_treatment_path(request))
    assert payload["emergency_warning"] is True
    assert payload["risk_alert"] is True
    assert payload["risk_score"] == "Critical"
    assert 1 <= len(payload["top_predictions"]) <= 3
    assert payload["decision_path"]
    assert payload["feature_importance"]
    assert payload["self_care"]
    assert payload["precautions"]
    assert payload["see_a_doctor_if"]


def test_predict_rejects_empty_or_unknown_symptoms():
    with pytest.raises(ValidationError):
        main.SymptomRequest(symptoms=[])
    with pytest.raises(ValidationError):
        main.SymptomRequest(symptoms=["Unknown symptom"])


def test_predict_rejects_invalid_severity_and_duration():
    with pytest.raises(ValidationError):
        main.SymptomRequest(symptoms=["Fever"], severity="Extreme")
    with pytest.raises(ValidationError):
        main.SymptomRequest(symptoms=["Fever"], duration=3)


def test_frontend_fallback_serves_spa_without_exposing_other_paths(monkeypatch, tmp_path):
    (tmp_path / "index.html").write_text("<main>local app</main>", encoding="utf-8")
    monkeypatch.setattr(main, "FRONTEND_DIST", tmp_path)

    assert isinstance(main._frontend_response("patient/dashboard"), FileResponse)
    with pytest.raises(HTTPException) as api_error:
        main._frontend_response("api/not-found")
    with pytest.raises(HTTPException) as traversal_error:
        main._frontend_response("../README.md")
    assert api_error.value.status_code == 404
    assert traversal_error.value.status_code == 404
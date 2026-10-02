import app.model as model


def test_get_ml_insights_backfills_missing_score_fields(monkeypatch):
    monkeypatch.setattr(model, "load_model", lambda: None)
    monkeypatch.setattr(
        model,
        "METRICS",
        {"accuracy": 0.5, "confusion_matrix": [], "feature_importance": {}, "labels": []},
    )

    result = model.get_ml_insights()

    assert result["precision"] == 0.0
    assert result["recall"] == 0.0
    assert result["f1_score"] == 0.0

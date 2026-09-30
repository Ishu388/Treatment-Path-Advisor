from flask import Flask, Response, render_template, request, jsonify
from urllib.error import HTTPError, URLError
from urllib.request import Request as UpstreamRequest, urlopen
import joblib
import numpy as np
import os
import json

from treatment_kb import TREATMENT_PATHS
from data.generate_dataset import generate_dataset
from model.train_model import train_and_save_model

app = Flask(__name__, static_folder='frontend/dist', static_url_path='/')

MODEL_PATH = 'treatment_model.joblib'
COLUMNS_PATH = 'symptom_columns.joblib'
METRICS_PATH = 'model_metrics.json'

EMERGENCY_SYMPTOMS = ["Chest Pain", "Shortness of Breath", "Severe Weakness", "Difficulty Breathing"]

def initialize_model():
    if not os.path.exists(MODEL_PATH) or not os.path.exists(COLUMNS_PATH) or not os.path.exists(METRICS_PATH):
        print("Model artifacts missing. Automatically generating dataset and training model...")
        generate_dataset()
        train_and_save_model()

initialize_model()

@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
def proxy_api(path):
    query = request.query_string.decode('latin-1')
    url = f"http://127.0.0.1:8011/api/{path}"
    if query:
        url = f"{url}?{query}"

    headers = {
        name: value for name, value in request.headers.items()
        if name.lower() not in {'host', 'content-length', 'connection'}
    }
    upstream_request = UpstreamRequest(
        url,
        data=request.get_data() or None,
        headers=headers,
        method=request.method,
    )

    try:
        with urlopen(upstream_request, timeout=30) as upstream:
            response_headers = {
                name: upstream.headers[name]
                for name in ('Content-Type', 'Content-Disposition', 'Cache-Control')
                if name in upstream.headers
            }
            return Response(upstream.read(), status=upstream.status, headers=response_headers)
    except HTTPError as error:
        response_headers = {
            name: error.headers[name]
            for name in ('Content-Type', 'Content-Disposition', 'Cache-Control')
            if name in error.headers
        }
        return Response(error.read(), status=error.code, headers=response_headers)
    except (URLError, TimeoutError):
        return jsonify(detail='Backend API is unavailable. Start it on port 8011.'), 502


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return app.send_static_file(path)
    else:
        return app.send_static_file('index.html')

@app.route('/model-info', methods=['GET'])
def get_model_info():
    try:
        with open(METRICS_PATH, 'r') as f:
            metrics = json.load(f)
        return jsonify({"success": True, "data": metrics})
    except Exception as e:
        return jsonify({"success": False, "error": "Model info not available."}), 500

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if not data or 'symptoms' not in data:
            return jsonify({"success": False, "error": "Invalid request. Please provide symptoms."}), 400

        user_symptoms = data['symptoms']
        if not isinstance(user_symptoms, list) or len(user_symptoms) == 0:
            return jsonify({"success": False, "error": "Please select at least one symptom."}), 400

        severity = data.get('severity', {})
        duration = data.get('duration', 'Not specified')

        try:
            model = joblib.load(MODEL_PATH)
            symptom_columns = joblib.load(COLUMNS_PATH)
        except Exception:
            return jsonify({"success": False, "error": "Failed to load the model. Please restart the application."}), 500

        feature_vector = np.zeros(len(symptom_columns))

        # Check for emergency/red-flag symptoms
        risk_alert = any(sym in user_symptoms for sym in EMERGENCY_SYMPTOMS)

        # Build feature vector
        for symptom in user_symptoms:
            if symptom in symptom_columns:
                index = symptom_columns.index(symptom)
                feature_vector[index] = 1
            else:
                return jsonify({"success": False, "error": f"Invalid symptom received: {symptom}"}), 400

        feature_vector = feature_vector.reshape(1, -1)

        # 1. Prediction & Probabilities
        predicted_condition = model.predict(feature_vector)[0]
        probabilities = model.predict_proba(feature_vector)[0]

        # 2. Top-3 Predictions
        class_indices = np.argsort(probabilities)[::-1]
        top_predictions = []
        for i in range(min(3, len(model.classes_))):
            idx = class_indices[i]
            top_predictions.append({
                "condition": model.classes_[idx],
                "confidence": round(probabilities[idx] * 100, 1)
            })

        main_confidence = top_predictions[0]['confidence']
        
        # 3. Confidence Level
        if main_confidence >= 70:
            confidence_level = "High"
        elif main_confidence >= 40:
            confidence_level = "Moderate"
        else:
            confidence_level = "Low"

        # 4. Explainable AI - Decision Path
        # Extracting the decision path for this specific instance
        node_indicator = model.decision_path(feature_vector)
        leaf_id = model.apply(feature_vector)[0]
        feature = model.tree_.feature
        threshold = model.tree_.threshold
        
        decision_path = []
        node_index = node_indicator.indices[node_indicator.indptr[0]:node_indicator.indptr[1]]

        for node_id in node_index:
            if leaf_id == node_id:
                continue # leaf node
            
            # Check if it's a split node
            if feature[node_id] != -2:
                feat_name = symptom_columns[feature[node_id]]
                val = feature_vector[0, feature[node_id]]
                if val <= threshold[node_id]:
                    decision_path.append(f"{feat_name} → No")
                else:
                    decision_path.append(f"{feat_name} → Yes")

        # 5. Explainable AI - Feature Importances
        importances = model.feature_importances_
        # Get top 5 important features overall for this model
        imp_indices = np.argsort(importances)[::-1][:5]
        important_features = []
        for idx in imp_indices:
            if importances[idx] > 0:
                important_features.append({
                    "symptom": symptom_columns[idx],
                    "importance": round(importances[idx], 3)
                })

        # Load treatment info
        treatment_info = TREATMENT_PATHS.get(predicted_condition, {
            "severity": "Unknown",
            "self_care": [],
            "precautions": [],
            "see_a_doctor_if": []
        })

        response = {
            "success": True,
            "condition": predicted_condition,
            "confidence": main_confidence,
            "confidence_level": confidence_level,
            "top_predictions": top_predictions,
            "decision_path": decision_path,
            "important_features": important_features,
            "severity": treatment_info.get("severity", "Unknown"),
            "duration": duration,
            "self_care": treatment_info.get("self_care", []),
            "precautions": treatment_info.get("precautions", []),
            "see_a_doctor_if": treatment_info.get("see_a_doctor_if", []),
            "risk_alert": risk_alert,
            "disclaimer": "This tool is for educational purposes only and does not replace professional medical advice."
        }

        return jsonify(response)

    except Exception as e:
        print(f"Error during prediction: {str(e)}")
        return jsonify({"success": False, "error": "Unable to process the request. Internal Server Error."}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

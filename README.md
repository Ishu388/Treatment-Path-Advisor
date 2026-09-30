# TreatmentPath Advisor (Advanced Explainable AI Edition)

An advanced educational healthcare decision-support web application that provides Explainable AI (XAI) analysis of symptoms using a Decision Tree Classifier.

## Features
- **Explainable AI (XAI)**: View the exact Decision Path and Top Feature Importances.
- **Top-3 Predictions**: See the top condition categories and their probabilistic confidence.
- **Smart Risk Alert**: Rule-based detection of red-flag symptoms.
- **Bilingual Interface**: Seamless toggle between English and Tamil.
- **Modern Dashboard**: Responsive UI with Dark/Light mode support.
- **Session History**: "Recent Checks" saves temporarily using `sessionStorage` (No persistent tracking).
- **Interactive Checklists & Timeline**: Visual general support path.

## Medical Disclaimer
This tool is for educational purposes only and does not replace professional medical advice. It does not provide medical diagnoses or prescribe medications. If symptoms are severe, rapidly worsening, or you believe this is an emergency, seek immediate professional medical help.

## Technology Stack
- **Backend**: Python, Flask
- **Machine Learning**: Pandas, NumPy, Scikit-learn, Decision Tree Classifier, Joblib
- **Frontend**: HTML5, CSS3 (CSS Variables for themes), Vanilla JavaScript

## Installation & Execution

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Open http://127.0.0.1:5000 in your browser.

## API Documentation
- `GET /model-info`: Retrieves algorithm configuration and calculated training metrics.
- `POST /predict`: Analyzes a symptom list and returns predicted categories, probabilities, decision paths, and a personalized checklist.

## Privacy
We do not use any databases. Session prediction history is kept strictly in the browser memory (`sessionStorage`) and is cleared when the tab is closed.

## Future Enhancements
- Larger de-identified datasets
- Algorithm comparison (e.g., Random Forest vs Decision Tree)
- Formal clinical evaluation

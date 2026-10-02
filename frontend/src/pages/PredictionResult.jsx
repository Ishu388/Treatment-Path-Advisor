import React from 'react';
import { useLocation, Link } from 'react-router-dom';

export default function PredictionResult() {
  const { state } = useLocation();
  const result = state?.result;

  const handleDownloadPDF = async () => {
    if (!result?.case_id) {
      alert("No case ID available for download.");
      return;
    }
    try {
      const res = await fetch(`/api/report/${result.case_id}.pdf`);
      if (!res.ok) throw new Error("Failed to generate report.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TreatmentPath_Advisor_Report_${result.case_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Unable to download the PDF report.");
    }
  };

  if (!result) return <div className="page-container">No data. <Link to="/patient/assessment">Go back</Link></div>;

  return (
    <div className="page-container">
      <div className="card result-card glass-card">
        <h2>Analysis Result</h2>
        {result.emergency_warning && (
          <div role="alert" className="emergency-warning">
            Emergency warning: Seek immediate professional medical assistance.
          </div>
        )}
        <h3 style={{ color: ['High', 'Critical'].includes(result.risk_score) ? '#f44336' : '#4caf50' }}>{result.condition}</h3>
        <p><strong>Risk Level:</strong> {result.risk_score}</p>
        <div style={{ margin: '15px 0' }}>
          <strong>Confidence: {result.confidence}%</strong>
          <div style={{ width: '100%', height: '12px', background: '#e0e0e0', borderRadius: '6px', overflow: 'hidden', marginTop: '5px' }}>
            <div style={{ width: `${result.confidence}%`, height: '100%', background: result.confidence > 70 ? '#4caf50' : result.confidence > 40 ? '#ff9800' : '#f44336', transition: 'width 0.5s ease-in-out' }}></div>
          </div>
        </div>
        <p><strong>Explanation:</strong> {result.explanation}</p>

        {result.top_predictions?.length > 0 && (
          <section aria-label="Top predictions">
            <h3>Top 3 possibilities</h3>
            <ol>
              {result.top_predictions.map((prediction) => (
                <li key={prediction.condition}>
                  {prediction.condition}: {prediction.confidence}%
                </li>
              ))}
            </ol>
          </section>
        )}

        {result.decision_path?.length > 0 && (
          <section aria-label="Decision path">
            <h3>Decision Path</h3>
            <ol>
              {result.decision_path.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
              <li><strong>Result: {result.condition}</strong></li>
            </ol>
          </section>
        )}

        {result.feature_importance && result.feature_importance.length > 0 && (
          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <h3>Global model feature importance</h3>
            <p>These scores describe the trained model overall, not this individual assessment.</p>
            <div style={{ background: 'rgba(0,0,0,0.05)', padding: '15px', borderRadius: '8px' }}>
              {result.feature_importance.map((feature, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ width: '120px', fontWeight: 'bold', fontSize: '14px' }}>{feature.symptom}</div>
                  <div style={{ flex: 1, height: '10px', background: '#ccc', borderRadius: '5px', margin: '0 10px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(feature.importance * 100)}%`, height: '100%', background: '#4caf50' }}></div>
                  </div>
                  <div style={{ width: '40px', fontSize: '12px' }}>{Math.round(feature.importance * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h3>Recommended Action</h3>
        <ul>
          {result.recommended_path.map((step, i) => <li key={i}>{step}</li>)}
        </ul>

        <div className="action-row" style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/patient/treatment" state={{ result }} className="btn-primary">View Treatment Path</Link>
          <button onClick={handleDownloadPDF} className="btn-primary" style={{ background: '#2196f3' }}>Download PDF</button>
          <Link to="/patient/assessment" className="btn-secondary">New Assessment (Reset)</Link>
          <Link to="/patient/dashboard" className="btn-secondary">Done</Link>
        </div>
        
        <p style={{ marginTop: '30px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
          This system is an educational decision-support demonstration and is not a medical diagnostic tool. 
          It does not replace professional medical advice.
        </p>
      </div>
    </div>
  );
}

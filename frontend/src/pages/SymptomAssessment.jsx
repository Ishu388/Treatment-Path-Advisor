import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SYMPTOMS_LIST = [
  "Fever", "Cough", "Sore Throat", "Runny Nose", "Sneezing", "Headache", "Fatigue", "Body Pain",
  "Chills", "Nausea", "Vomiting", "Diarrhea", "Stomach Pain", "Chest Pain", "Shortness of Breath",
  "Wheezing", "Dizziness", "Loss of Appetite", "Muscle Pain", "Joint Pain", "Back Pain", "Abdominal Pain",
  "Constipation", "Heartburn", "Skin Rash", "Itching", "Red Eyes", "Watery Eyes", "Ear Pain", "Tooth Pain",
  "Difficulty Swallowing", "Nasal Congestion", "Sweating", "Weakness", "Increased Thirst", "Frequent Urination",
  "Sleep Problems", "Anxiety", "Difficulty Breathing", "Severe Weakness",
];

export default function SymptomAssessment() {
  const [selected, setSelected] = useState([]);
  const [severity, setSeverity] = useState('Moderate');
  const [vitals, setVitals] = useState({ heartRate: '', spo2: '', temp: '', bp: '' });
  const [personal, setPersonal] = useState({ age: '', gender: 'Male', duration: '1 day' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const toggleSymptom = (s) => setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        symptoms: selected,
        severity,
        language: 'en',
        vitals_heart_rate: vitals.heartRate ? parseInt(vitals.heartRate) : null,
        vitals_spo2: vitals.spo2 ? parseInt(vitals.spo2) : null,
        age: personal.age ? parseInt(personal.age) : null,
        gender: personal.gender,
        duration: personal.duration,
        vitals_temp: vitals.temp ? parseFloat(vitals.temp) : null,
        vitals_bp: vitals.bp || null
      };
      const res = await fetch('/api/treatment-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error('Failed to analyze symptoms. Please try again.');
      }
      const data = await res.json();
      if (data.emergency_warning) {
        navigate('/emergency', { state: { result: data, payload } });
      } else {
        navigate('/patient/prediction', { state: { result: data } });
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h2>Symptom Assessment</h2>
      <div className="card glass-card">
        <h3>Patient Information</h3>
        <div className="form-layout row">
          <label className="field-label">Age
            <input type="number" value={personal.age} onChange={e => setPersonal({...personal, age: e.target.value})} />
          </label>
          <label className="field-label">Gender
            <select value={personal.gender} onChange={e => setPersonal({...personal, gender: e.target.value})}>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </label>
          <label className="field-label">Duration
            <input type="text" placeholder="e.g. 2 days" value={personal.duration} onChange={e => setPersonal({...personal, duration: e.target.value})} />
          </label>
        </div>

        <h3>Select Symptoms</h3>
        <div className="symptom-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
          {SYMPTOMS_LIST.map(s => (
            <button 
              key={s} 
              type="button"
              className={`symptom-chip ${selected.includes(s) ? 'selected' : ''}`} 
              onClick={() => toggleSymptom(s)}
            >
              {selected.includes(s) ? '✓ ' : ''}{s}
            </button>
          ))}
        </div>
        
        <h3>Vitals (Optional)</h3>
        <div className="form-layout row">
          <label className="field-label">Heart Rate (bpm)
            <input type="number" value={vitals.heartRate} onChange={e => setVitals({...vitals, heartRate: e.target.value})} />
          </label>
          <label className="field-label">SpO2 (%)
            <input type="number" value={vitals.spo2} onChange={e => setVitals({...vitals, spo2: e.target.value})} />
          </label>
          <label className="field-label">Temperature (°F)
            <input type="number" step="0.1" value={vitals.temp} onChange={e => setVitals({...vitals, temp: e.target.value})} />
          </label>
          <label className="field-label">Blood Pressure
            <input type="text" placeholder="120/80" value={vitals.bp} onChange={e => setVitals({...vitals, bp: e.target.value})} />
          </label>
        </div>

        <h3>Severity</h3>
        <select value={severity} onChange={e => setSeverity(e.target.value)} className="field-label" style={{ width: '100%', maxWidth: '300px' }}>
          <option>Mild</option>
          <option>Moderate</option>
          <option>Severe</option>
        </select>

        {error && (
          <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '30px' }}>
          <button type="button" onClick={handleSubmit} className="btn-primary" disabled={selected.length === 0 || loading}>
            {loading ? 'Analyzing...' : 'Analyze Symptoms'}
          </button>
        </div>
      </div>
    </div>
  );
}

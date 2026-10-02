import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, HeartPulse, ShieldAlert } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="landing-page page-container">
      <header className="hero">
        <Activity size={64} color="#00bcd4" />
        <h1>Welcome to TreatmentPath Advisor</h1>
        <p>AI-based personalized treatment path and medical decision support system.</p>
        <div className="action-row">
          <Link to="/register" className="btn-primary">Get Started</Link>
          <Link to="/login" className="btn-secondary">Login</Link>
        </div>
      </header>

      <div className="features-grid">
        <div className="card glass-card">
          <HeartPulse size={40} color="#ff4081" />
          <h3>Symptom Analysis</h3>
          <p>Advanced Machine Learning predicts possible risks based on symptoms.</p>
        </div>
        <div className="card glass-card">
          <ShieldAlert size={40} color="#ff9800" />
          <h3>Emergency Response</h3>
          <p>Instant alerts and nearby hospital mapping for critical cases.</p>
        </div>
      </div>
      <div className="disclaimer">
        <strong>Disclaimer:</strong> This is a decision-support system. It does NOT diagnose or cure. Always seek professional medical care.
      </div>
    </div>
  );
}

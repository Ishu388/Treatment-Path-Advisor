import React from 'react';
import { useLocation, Link } from 'react-router-dom';

export default function TreatmentPath() {
  const { state } = useLocation();
  const result = state?.result;

  if (!result) return <div className="page-container">No data. <Link to="/patient/assessment">Go back</Link></div>;

  return (
    <div className="page-container">
      <h2>Visual Treatment Pathway</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        This informational pathway outlines the standard recommendations for your predicted condition.
        <br/><strong>Note:</strong> Always review these steps with a qualified healthcare professional.
      </p>
      
      <div className="card glass-card">
        {result.emergency_warning && (
          <div role="alert" className="emergency-warning">
            Emergency warning: Seek immediate professional medical assistance.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {result.visual_path?.map((step, index) => (
            <div key={index} style={{ display: 'flex', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#00bcd4', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {index + 1}
                </div>
                {index < result.visual_path.length - 1 && (
                  <div style={{ width: '2px', height: '100%', background: '#e0e0e0', margin: '5px 0' }}></div>
                )}
              </div>
              <div style={{ flex: 1, padding: '15px', background: '#f5f5f5', borderRadius: '8px', borderLeft: '4px solid #00bcd4' }}>
                <h4 style={{ margin: '0 0 5px 0' }}>Step {index + 1}</h4>
                <p style={{ margin: 0, color: '#333' }}>{step}</p>
              </div>
            </div>
          ))}
        </div>
        {[
          { title: 'Self-care', items: result.self_care },
          { title: 'Precautions', items: result.precautions },
          { title: 'Contact a doctor if', items: result.see_a_doctor_if },
        ].map(({ title, items }) => items?.length > 0 && (
          <section key={title}>
            <h3>{title}</h3>
            <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ))}
        <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
          <Link to="/patient/dashboard" className="btn-primary">Return to Dashboard</Link>
          <Link to="/nearby" className="btn-secondary">Find Healthcare Nearby</Link>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '',
    role: 'Patient', 
    age: '', 
    gender: '' 
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!formData.email.trim()) {
      setError('Please enter your email.');
      return;
    }
    if (!formData.password) {
      setError('Please enter a password.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Backend expects 'username' for login, so we map email -> username
      // Backend expects 'full_name' for name
      const payload = { 
        full_name: formData.name.trim(),
        username: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender || null
      };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      
      if (res.status === 409) {
        setError('Email already registered. Please use another email or login.');
      } else if (!res.ok) {
        let detailMsg = '';
        if (Array.isArray(data.detail)) {
            // Extract Pydantic validation errors nicely
            detailMsg = data.detail.map(err => `${err.loc.join('.')} - ${err.msg}`).join(', ');
        } else {
            detailMsg = data.detail;
        }
        
        console.error('Registration failed:', { status: res.status, detail: data.detail });
        setError(detailMsg || (res.status >= 500
          ? 'Server error. Please try again later.'
          : 'Unable to register. Please check your details and try again.'));
      } else {
        setSuccess('Registration successful! Redirecting to login...');
        setTimeout(() => {
            navigate('/login', { state: { registrationSuccess: true } });
        }, 1500);
      }
    } catch {
      setError('Unable to connect to the local service. Check that the backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container center-content">
      <div className="card register-card glass-card">
        <h2>Register</h2>
        {error && <div className="error-box" role="alert">{error}</div>}
        {success && <div className="success-box" style={{color: 'green', marginBottom: '1rem'}} role="alert">{success}</div>}
        <form onSubmit={handleSubmit} className="form-layout" noValidate>
          <label className="field-label">Full Name 
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </label>
          <label className="field-label">Email Address 
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          </label>
          <label className="field-label">Password 
            <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required minLength={8} />
          </label>
          <label className="field-label">Confirm Password 
            <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} required minLength={8} />
          </label>
          {formData.role === 'Patient' && (
            <>
              <label className="field-label">Age 
                <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
              </label>
              <label className="field-label">Gender 
                <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </>
          )}
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}

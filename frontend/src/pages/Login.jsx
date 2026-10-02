import React, { useState, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError('Invalid username or password.');
        return;
      }
      if (res.status >= 500) {
        setError('Server error. Please try again later.');
        return;
      }
      if (!res.ok) {
        const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail;
        setError(detail || 'Unable to sign in. Please check your details and try again.');
        return;
      }
      if (!data.token || !data.username || !data.role) {
        setError('The server returned an invalid sign-in response.');
        return;
      }
      login(data);
      if (data.role === 'Doctor') navigate('/doctor/dashboard');
      else if (data.role === 'Admin') navigate('/admin/dashboard');
      else navigate('/patient/dashboard');
    } catch {
      setError('Unable to connect to server. Please check that the backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container center-content">
      <div className="card login-card glass-card">
        <h2>Login</h2>
        {location.state?.registrationSuccess && <div role="status">Registration successful. Please sign in.</div>}
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleSubmit} className="form-layout" noValidate>
          <label className="field-label">
            Email Address / Username
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
          </label>
          <label className="field-label">
            Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  );
}

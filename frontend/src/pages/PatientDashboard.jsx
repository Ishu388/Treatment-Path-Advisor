import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LanguageContext } from '../i18n/LanguageContext';
import { Stethoscope, MapPin, AlertTriangle, Activity, History, FileText, Droplets, Moon, Footprints, Upload, Calendar, Search } from 'lucide-react';

export default function PatientDashboard() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(LanguageContext);
  const [history, setHistory] = useState([]);
  
  // Dummy data for Wellness Tracker
  const [wellness, setWellness] = useState({
    water: 60, // 60%
    sleep: 80, // 80%
    steps: 45 // 45%
  });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/prediction-history');
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchHistory();
  }, []);

  const totalAssessments = history.length;
  const latestAssessment = history.length > 0 ? history[0] : null;

  return (
    <div className="page-container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>{t('dashboard.welcomeBack', { name: user?.username || 'Patient' })}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t('dashboard.overview')}</p>
        </div>
        <div style={{ position: 'relative', width: '250px' }}>
          <Search size={20} color="var(--text-muted)" style={{ position: 'absolute', top: '12px', left: '12px' }} />
          <input type="text" placeholder={t('common.search')} style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '20px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Outfit' }} />
        </div>
      </header>

      {/* Main Stats */}
      <div className="stat-grid" style={{ marginBottom: '30px' }}>
        <div className="card">
          <div className="stat-card">
            <div className="card-icon-wrap" style={{ background: 'rgba(0, 242, 254, 0.1)' }}>
              <Activity color="#00f2fe" size={28} />
            </div>
            <div>
              <p className="stat-label">{t('dashboard.totalAssessments')}</p>
              <h2 className="stat-val">{totalAssessments}</h2>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="stat-card">
            <div className="card-icon-wrap" style={{ background: 'rgba(161, 140, 209, 0.1)' }}>
              <Calendar color="#a18cd1" size={28} />
            </div>
            <div>
              <p className="stat-label">{t('dashboard.latestAssessment')}</p>
              <h2 className="stat-val" style={{ fontSize: '1.5rem', background: 'var(--text-main)', WebkitBackgroundClip: 'text' }}>
                {latestAssessment ? new Date(latestAssessment.created_at).toLocaleDateString() : 'None'}
              </h2>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="stat-card">
            <div className="card-icon-wrap" style={{ background: latestAssessment?.risk_score === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }}>
              <AlertTriangle color={latestAssessment?.risk_score === 'High' ? '#ef4444' : '#10b981'} size={28} />
            </div>
            <div>
              <p className="stat-label">{t('dashboard.riskLevel')}</p>
              <h2 className="stat-val" style={{ fontSize: '1.8rem', background: latestAssessment?.risk_score === 'High' ? 'var(--grad-2)' : 'var(--grad-4)', WebkitBackgroundClip: 'text' }}>
                {latestAssessment ? latestAssessment.risk_score : 'N/A'}
              </h2>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Quick Action Center */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3>{t('dashboard.quickAction')}</h3>
          <div className="quick-action-grid">
            <Link to="/patient/assessment" className="quick-action-btn">
              <Stethoscope size={24} color="#00f2fe" />
              <span>{t('dashboard.newAssessment')}</span>
            </Link>
            <Link to="/patient/documents" className="quick-action-btn">
              <Upload size={24} color="#a18cd1" />
              <span>{t('dashboard.uploadReport')}</span>
            </Link>
            <Link to="/patient/assessment" className="quick-action-btn">
              <Calendar size={24} color="#38f9d7" />
              <span>{t('dashboard.bookAppointment')}</span>
            </Link>
            <Link to="/emergency" className="quick-action-btn" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <AlertTriangle size={24} color="#ff0844" />
              <span>{t('dashboard.emergencyHelp')}</span>
            </Link>
          </div>
        </div>

        {/* Digital Health Passport */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="passport-header">
            <div className="passport-avatar">{user?.username?.[0]?.toUpperCase() || 'P'}</div>
            <div className="passport-info">
              <h3>{t('dashboard.healthPassport')}</h3>
              <p>{t('dashboard.passportSubtitle')}</p>
            </div>
          </div>
          <div className="passport-grid">
            <div className="passport-field">
              <label>{t('dashboard.bloodGroup')}</label>
              <div>O+</div>
            </div>
            <div className="passport-field">
              <label>{t('dashboard.allergies')}</label>
              <div>Penicillin, Peanuts</div>
            </div>
            <div className="passport-field">
              <label>{t('dashboard.emergencyContact')}</label>
              <div>+1 234 567 890</div>
            </div>
            <div className="passport-field">
              <label>{t('dashboard.status')}</label>
              <div style={{ color: '#10b981' }}>{t('dashboard.verified')}</div>
            </div>
          </div>
        </div>

        {/* Wellness Tracker */}
        <div className="card">
          <h3>{t('dashboard.dailyWellness')}</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('dashboard.trackGoals')}</p>
          
          <div className="wellness-item">
            <div className="wellness-header">
              <span><Droplets size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} color="#00f2fe" /> {t('dashboard.waterIntake')}</span>
              <span>1.5L / 2.5L</span>
            </div>
            <div className="wellness-bar"><div className="wellness-fill" style={{ width: `${wellness.water}%`, background: 'var(--grad-1)' }}></div></div>
          </div>

          <div className="wellness-item">
            <div className="wellness-header">
              <span><Moon size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} color="#a18cd1" /> {t('dashboard.sleep')}</span>
              <span>6.5h / 8h</span>
            </div>
            <div className="wellness-bar"><div className="wellness-fill" style={{ width: `${wellness.sleep}%`, background: 'var(--grad-3)' }}></div></div>
          </div>

          <div className="wellness-item">
            <div className="wellness-header">
              <span><Footprints size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} color="#38f9d7" /> {t('dashboard.steps')}</span>
              <span>4,500 / 10,000</span>
            </div>
            <div className="wellness-bar"><div className="wellness-fill" style={{ width: `${wellness.steps}%`, background: 'var(--grad-4)' }}></div></div>
          </div>
        </div>

        <Link to="/nearby" className="card hover-card">
          <div className="card-icon-wrap"><MapPin size={32} color="#10b981" /></div>
          <h3>{t('dashboard.nearbyHealthcare')}</h3>
          <p>{t('dashboard.nearbyDesc')}</p>
        </Link>
        
        <Link to="/patient/documents" className="card hover-card">
          <div className="card-icon-wrap"><FileText size={32} color="#f59e0b" /></div>
          <h3>{t('dashboard.documentVault')}</h3>
          <p>{t('dashboard.documentDesc')}</p>
        </Link>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <History size={24} color="#a18cd1" />
            <h3 style={{ margin: 0 }}>{t('dashboard.recentAssessments')}</h3>
          </div>
          {history.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>{t('dashboard.noPrevious')}</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {history.slice(0, 3).map((item, idx) => (
                <li key={idx} style={{ padding: '12px 0', borderBottom: idx !== 2 ? '1px solid var(--glass-border)' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ display: 'block', color: 'white' }}>{item.condition}</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <span className={`badge ${item.risk_score === 'High' ? 'badge-danger' : 'badge-warning'}`} style={{ alignSelf: 'center' }}>{item.risk_score} Risk</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

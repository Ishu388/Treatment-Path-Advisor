import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LanguageContext } from '../i18n/LanguageContext';
import { Activity, LogOut, User, Bell } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const { lang, setLang, t } = useContext(LanguageContext);
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications/${user.username}`);
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAsRead = async (id) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <nav className="navbar" style={{ position: 'relative' }}>
      <div className="navbar-brand">
        <Activity className="icon" color="#00f2fe" />
        <Link to="/">{t('nav.title')}</Link>
      </div>
      <div className="navbar-links">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '15px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '15px' }}>
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value)} 
            style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', cursor: 'pointer' }}
          >
            <option value="en">EN | English</option>
            <option value="ta">தமிழ் (Tamil)</option>
          </select>
        </div>
        {user ? (
          <>
            {user.role === 'Patient' && <Link to="/patient/dashboard">{t('nav.dashboard')}</Link>}
            {user.role === 'Doctor' && <Link to="/doctor/dashboard">{t('nav.doctorHub')}</Link>}
            {user.role === 'Admin' && <Link to="/admin/dashboard">{t('nav.adminPanel')}</Link>}
            
            <div style={{ position: 'relative' }}>
              <button className={`icon-btn ${unreadCount > 0 ? 'notification-dot' : ''}`} title={t('nav.notifications')} onClick={() => setShowNotifications(!showNotifications)}>
                <Bell size={20} />
              </button>
              {showNotifications && (
                <div style={{ position: 'absolute', top: '50px', right: '0', background: 'var(--panel-bg)', backdropFilter: 'blur(10px)', border: '1px solid var(--glass-border)', padding: '15px', borderRadius: '12px', width: '300px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 1000, maxHeight: '400px', overflowY: 'auto' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: 'white' }}>{t('nav.notifications')}</h4>
                  {notifications.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('nav.noNotifications')}</p>
                  ) : notifications.map(n => (
                    <div key={n.id} onClick={() => markAsRead(n.id)} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.9rem', cursor: 'pointer', background: n.is_read ? 'transparent' : 'rgba(0, 242, 254, 0.1)', borderRadius: '8px', marginBottom: '5px' }}>
                      <strong style={{ display: 'block', color: 'white' }}>{lang === 'ta' ? n.title_ta : n.title_en}</strong>
                      <p style={{ margin: '5px 0', color: 'var(--text-muted)' }}>{lang === 'ta' ? n.message_ta : n.message_en}</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                  <button onClick={() => setShowNotifications(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', width: '100%', padding: '10px 0 0 0', cursor: 'pointer', fontSize: '0.8rem' }}>{t('common.cancel')}</button>
                </div>
              )}
            </div>
            
            <button className="icon-btn" onClick={handleLogout} title={t('common.logout')}>
              <LogOut size={20} />
            </button>
            <span className="user-badge"><User size={16}/> {user.username}</span>
          </>
        ) : (
          <>
            <Link to="/login" className="btn-secondary">Login</Link>
            <Link to="/register" className="btn-primary">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

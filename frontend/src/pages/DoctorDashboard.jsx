import React, { useEffect, useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { CheckCircle, Send, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

function MapUpdater({ center }) {
  const map = useMap();
  const manuallyMoved = useRef(false);
  useEffect(() => {
    const markMoved = () => { manuallyMoved.current = true; };
    map.on('dragstart', markMoved);
    return () => map.off('dragstart', markMoved);
  }, [map]);
  useEffect(() => {
    if (!manuallyMoved.current) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function DoctorDashboard() {
  const { user } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [availability, setAvailability] = useState('OFFLINE');
  const [availabilityError, setAvailabilityError] = useState('');
  const doctorLocationRef = useRef(null);
  const availabilityRef = useRef('OFFLINE');
  const doctorWatchIdRef = useRef(null);
  const messagesEndRef = useRef(null);

  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${user?.token || ''}`
  });

  const fetchRequests = async () => {
    try {
      const res = await fetch(`${apiBase}/api/emergency/requests`, { headers: authHeaders() });
      if (res.ok) setRequests(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChat = async (caseId) => {
    try {
      const chatRes = await fetch(`${apiBase}/api/emergency/chat/${caseId}`, { headers: authHeaders() });
      if (chatRes.ok) {
        setMessages(await chatRes.json());
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(() => {
      fetchRequests();
      if (activeCaseId) fetchChat(activeCaseId);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeCaseId]);

  useEffect(() => {
    if (availability === 'OFFLINE') return undefined;
    const sendHeartbeat = () => {
      fetch(`${apiBase}/api/doctors/heartbeat`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ status: availabilityRef.current, ...doctorLocationRef.current })
      }).catch(error => setAvailabilityError(error.message || 'Heartbeat failed.'));
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [availability]);

  useEffect(() => () => {
    if (doctorWatchIdRef.current !== null) navigator.geolocation?.clearWatch(doctorWatchIdRef.current);
  }, []);

  const updateAvailability = (status) => {
    availabilityRef.current = status;
    setAvailability(status);
    setAvailabilityError('');
    if (status === 'OFFLINE') {
      if (doctorWatchIdRef.current !== null) navigator.geolocation?.clearWatch(doctorWatchIdRef.current);
      doctorWatchIdRef.current = null;
      doctorLocationRef.current = null;
      fetch(`${apiBase}/api/doctors/heartbeat`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ status })
      }).catch(error => setAvailabilityError(error.message || 'Could not update status.'));
      return;
    }
    if (!navigator.geolocation) {
      setAvailabilityError('Location sharing is unavailable; you will not appear in nearby results.');
      return;
    }
    if (doctorWatchIdRef.current !== null) navigator.geolocation.clearWatch(doctorWatchIdRef.current);
    doctorWatchIdRef.current = navigator.geolocation.watchPosition(
      position => {
        doctorLocationRef.current = { lat: position.coords.latitude, lng: position.coords.longitude };
      },
      () => setAvailabilityError('Location could not be shared; you will not appear in nearby results.'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    );
  };

  const handleAccept = async (emergencyId) => {
    try {
      const response = await fetch(`${apiBase}/api/doctor/request/accept`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ emergency_id: emergencyId })
      });
      if (!response.ok) throw new Error('This request is no longer available.');
      updateAvailability('BUSY');
      fetchRequests();
      setActiveCaseId(emergencyId);
    } catch (err) {
      setAvailabilityError(err.message || 'Could not accept this request.');
    }
  };

  const handleResolve = async (emergencyId) => {
    try {
      const response = await fetch(`${apiBase}/api/emergency/${emergencyId}/resolve`, {
        method: 'POST', headers: authHeaders()
      });
      if (!response.ok) throw new Error('Could not resolve this request.');
      fetchRequests();
      setActiveCaseId(null);
    } catch (error) { setAvailabilityError(error.message); }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeCaseId) return;
    try {
      await fetch(`${apiBase}/api/emergency/chat`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          emergency_id: activeCaseId,
          message: newMessage
        })
      });
      setNewMessage('');
      fetchChat(activeCaseId);
    } catch (err) {
      console.error(err);
    }
  };

  const activeReq = requests.find(r => r.emergency_id === activeCaseId);

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Doctor Dashboard</h1>
        <p>Active Emergency Requests</p>
        <section className="doctor-availability-control" aria-label="Doctor availability">
          <strong>Your status: {availability}</strong>
          <button onClick={() => updateAvailability('AVAILABLE')} className="btn-primary">Go Online</button>
          <button onClick={() => updateAvailability('BUSY')} className="btn-secondary">Go Busy</button>
          <button onClick={() => updateAvailability('OFFLINE')} className="btn-secondary">Go Offline</button>
          {availabilityError && <p role="status">{availabilityError}</p>}
          {availability !== 'OFFLINE' && <small>Demo availability is not a verified promise of response.</small>}
        </section>
      </header>
      
      <div className="dashboard-grid">
        <div className="requests-grid" style={{ gridColumn: activeCaseId ? '1' : '1 / -1' }}>
          {requests.length === 0 ? <p>No active requests.</p> : requests.map(req => (
            <div key={req.id} className="card glass-card">
              <h3>Case: {req.emergency_id}</h3>
              <span className={`badge ${['Pending', 'SEARCHING'].includes(req.status) ? 'badge-warning' : 'badge-success'}`}>{req.status}</span>
              <div style={{ marginTop: '15px' }}>
                <p><strong>Patient:</strong> {req.patient_username} (Age: {req.patient_age})</p>
                <p><strong>Symptoms:</strong> {req.symptoms?.join(', ')}</p>
                <p><strong>Vitals:</strong> {req.vital_signs}</p>
                <p><strong>Risk Level:</strong> <span style={{ color: 'red' }}>{req.risk_level}</span></p>
                <p><strong>Location:</strong> {req.lat && req.lng ? `${req.lat.toFixed(4)}, ${req.lng.toFixed(4)}` : 'Unknown'}</p>
                <p><strong>Time:</strong> {new Date(req.request_time).toLocaleString()}</p>
              </div>
              
              {['Pending', 'SEARCHING'].includes(req.status) && (
                <div className="action-row" style={{ marginTop: '20px' }}>
                  <button onClick={() => handleAccept(req.emergency_id)} className="btn-primary">Accept Case</button>
                </div>
              )}
              {req.status === 'DOCTOR_ASSIGNED' && req.accepted_by === user.username && (
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ color: '#4caf50', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle size={20} /> You have accepted this case.
                  </div>
                  {activeCaseId !== req.emergency_id && (
                    <button onClick={() => setActiveCaseId(req.emergency_id)} className="btn-secondary">Open Case Details</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Active Case Detail View (Map + Chat) */}
        {activeCaseId && activeReq && (
          <div className="card glass-card" style={{ gridColumn: '2 / span 2', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3><MapPin size={20}/> Live Patient Tracking ({activeCaseId})</h3>
            {activeReq.status === 'DOCTOR_ASSIGNED' && (
              <button onClick={() => handleResolve(activeCaseId)} className="btn-secondary">Resolve Emergency Request</button>
            )}
            
            <div style={{ height: '300px', borderRadius: '12px', overflow: 'hidden' }}>
              {activeReq.lat && activeReq.lng ? (
                <MapContainer center={[activeReq.lat, activeReq.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[activeReq.lat, activeReq.lng]}>
                    <Popup>Patient Location</Popup>
                  </Marker>
                  <MapUpdater center={[activeReq.lat, activeReq.lng]} />
                </MapContainer>
              ) : (
                <div className="center-content">Waiting for patient location...</div>
              )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ marginTop: 0 }}>Emergency Chat</h4>
              <div style={{ flex: 1, overflowY: 'auto', minHeight: '200px', marginBottom: '10px' }}>
                {messages.length === 0 ? <p>No messages yet.</p> : messages.map((msg, idx) => (
                  <div key={idx} style={{ marginBottom: '8px', textAlign: msg.sender_username === user.username ? 'right' : 'left' }}>
                    <div style={{
                      display: 'inline-block',
                      padding: '8px 12px',
                      borderRadius: '16px',
                      background: msg.sender_username === user.username ? '#00bcd4' : '#e2e8f0',
                      color: msg.sender_username === user.username ? 'white' : 'black'
                    }}>
                      <strong style={{ fontSize: '0.8rem', display: 'block', opacity: 0.8 }}>{msg.sender_username}</strong>
                      {msg.message}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  value={newMessage} 
                  onChange={e => setNewMessage(e.target.value)} 
                  placeholder="Type your message..." 
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <button type="submit" className="btn-primary"><Send size={18} /></button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

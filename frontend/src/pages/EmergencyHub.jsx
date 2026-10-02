import React, { useState, useEffect, useContext, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { AlertOctagon, PhoneCall, MapPin, Send, Crosshair, Stethoscope, HeartPulse } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const SYMPTOMS_LIST = ["Chest pain", "Shortness of breath", "Severe bleeding", "Loss of consciousness", "Sudden weakness", "Severe abdominal pain", "High Fever", "Seizures"];

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

function MapFocus({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), 14));
  }, [position, map]);
  return null;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function EmergencyHub() {
  const { state } = useLocation();
  const { user } = useContext(AuthContext);
  const emergencySessionKey = `active_emergency_${user?.username || 'guest'}`;
  
  // Quick Scan State
  const [selectedSymptoms, setSelectedSymptoms] = useState(state?.payload?.symptoms || []);
  const [vitals, setVitals] = useState({ 
    heartRate: state?.payload?.vitals_heart_rate || '', 
    spo2: state?.payload?.vitals_spo2 || '',
    temperature: state?.payload?.vitals_temp || '',
    bloodPressure: state?.payload?.vitals_bp || ''
  });
  const [assessmentResult, setAssessmentResult] = useState(state?.result || null);
  const [isScanning, setIsScanning] = useState(false);

  // Location State
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nearbyDocs, setNearbyDocs] = useState([]);
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [radiusKm, setRadiusKm] = useState(10);
  const [hospitalError, setHospitalError] = useState('');
  const [doctorError, setDoctorError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [canContinueWithoutLocation, setCanContinueWithoutLocation] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('emergency_contact') || '{"name":"","relationship":"","phone":""}');
    } catch {
      return { name: '', relationship: '', phone: '' };
    }
  });
  const [requestCreatedAt, setRequestCreatedAt] = useState('');
  const [mapFocus, setMapFocus] = useState(null);
  const watchIdRef = useRef(null);

  // Case State
  const [caseId, setCaseId] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [caseStatus, setCaseStatus] = useState('Pending');
  const [requestRisk, setRequestRisk] = useState('');
  const [doctorAssigned, setDoctorAssigned] = useState('');
  const caseIdRef = useRef(caseId);
  const lastHospitalLookupRef = useRef(null);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user?.username) return;
    const savedCaseId = sessionStorage.getItem(emergencySessionKey);
    if (savedCaseId) {
      caseIdRef.current = savedCaseId;
      setCaseId(savedCaseId);
      setRequestSent(true);
    }
  }, [emergencySessionKey, user?.username]);

  // 1. Emergency Quick Scan Function
  const runQuickScan = async () => {
    setIsScanning(true);
    try {
      const payload = {
        symptoms: selectedSymptoms,
        severity: state?.payload?.severity || "Severe",
        language: 'en',
        vitals_heart_rate: vitals.heartRate ? parseInt(vitals.heartRate) : null,
        vitals_spo2: vitals.spo2 ? parseInt(vitals.spo2) : null,
        vitals_temp: vitals.temperature ? parseFloat(vitals.temperature) : null,
        vitals_bp: vitals.bloodPressure || null,
        age: state?.payload?.age ?? user?.age ?? null,
        gender: state?.payload?.gender || user?.gender || null,
        duration: state?.payload?.duration || null
      };
      const res = await fetch('/api/treatment-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setAssessmentResult(data);
    } catch (err) {
      console.error("Scan error", err);
    }
    setIsScanning(false);
  };

  const toggleSymptom = (s) => setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // ======================================================
  // LIVE GPS LOCATION - ACCURACY + PERMISSION + TRACKING
  // ======================================================

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${user?.token || ''}`
  });

  const requestPayload = () => ({
    patient_age: state?.payload?.age ?? user?.age ?? null,
    gender: state?.payload?.gender || user?.gender || null,
    symptoms: selectedSymptoms,
    risk_level: assessmentResult?.risk_score || 'Unknown',
    severity: state?.payload?.severity || 'Severe',
    duration: state?.payload?.duration || null,
    vitals: {
      heart_rate: vitals.heartRate ? Number(vitals.heartRate) : null,
      spo2: vitals.spo2 ? Number(vitals.spo2) : null,
      temperature: vitals.temperature ? Number(vitals.temperature) : null,
      blood_pressure: vitals.bloodPressure || null
    }
  });

  const createEmergencyRequest = async (coords = null) => {
    try {
      const payload = requestPayload();
      if (coords) Object.assign(payload, coords);
      const response = await fetch(`${API_BASE}/api/emergency/request`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to create emergency request.');
      caseIdRef.current = data.emergency_id;
      setCaseId(data.emergency_id);
      sessionStorage.setItem(emergencySessionKey, data.emergency_id);
      setCaseStatus(data.status);
      setRequestCreatedAt(data.created_at || new Date().toISOString());
      setRequestRisk(payload.risk_level);
      setRequestSent(true);
      setCanContinueWithoutLocation(false);
      setIsRequesting(false);
      setRequestError('');
    } catch (error) {
      setIsRequesting(false);
      setRequestError(error.message || 'Unable to create emergency request.');
    }
  };

  const updateRequestLocation = (coords) => {
    const activeCaseId = caseIdRef.current;
    if (!activeCaseId) return;
    fetch(`${API_BASE}/api/emergency/${activeCaseId}/location`, {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify(coords)
    }).catch(error => console.error('Emergency location update failed:', error));
  };

  const startLocationTracking = (createRequestOnFix = false) => {
    if (!navigator.geolocation) {
      setGeoError('GPS unavailable. You can continue without live location.');
      setCanContinueWithoutLocation(createRequestOnFix);
      return;
    }
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    setGeoError('Waiting for a GPS location…');
    setCanContinueWithoutLocation(false);
    let requestCreated = false;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (result) => {
        const coords = {
          lat: result.coords.latitude,
          lng: result.coords.longitude,
          accuracy: result.coords.accuracy
        };
        setPosition({ lat: coords.lat, lng: coords.lng });
        setAccuracy(coords.accuracy);
        setLocationEnabled(true);
        setLastUpdated(new Date().toLocaleTimeString());
        setGeoError('');
        if (createRequestOnFix && !requestCreated) {
          requestCreated = true;
          createEmergencyRequest(coords);
        } else {
          updateRequestLocation(coords);
        }
      },
      (error) => {
        setLocationEnabled(false);
        setCanContinueWithoutLocation(createRequestOnFix);
        if (error.code === 1) setGeoError('Location permission is required for live emergency tracking. Permission was denied; allow location or continue without it.');
        else if (error.code === 2) setGeoError('Unable to obtain your location. You can continue without live location.');
        else if (error.code === 3) setGeoError('Location request timed out. Please try again or continue without location.');
        else setGeoError('Unable to obtain your location. You can continue without live location.');
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  };

  const stopLiveLocation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setLocationEnabled(false);
    setPosition(null);
    setAccuracy(null);
    setLastUpdated(null);
    setNearbyHospitals([]);
    setNearbyDocs([]);
    if (caseIdRef.current) {
      fetch(`${API_BASE}/api/emergency/${caseIdRef.current}/location`, {
        method: 'DELETE', headers: authHeaders()
      }).catch(error => console.error('Could not clear the shared location:', error));
    }
  };

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current);
    if (caseIdRef.current && user?.token) {
      fetch(`${API_BASE}/api/emergency/${caseIdRef.current}/location`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      }).catch(() => {});
    }
  }, [user?.token]);

  useEffect(() => {
    if (!position || !user?.token) return undefined;
    const now = Date.now();
    const previousLookup = lastHospitalLookupRef.current;
    const movedEnough = !previousLookup
      || Math.abs(position.lat - previousLookup.lat) > 0.005
      || Math.abs(position.lng - previousLookup.lng) > 0.005;
    if (previousLookup && previousLookup.radiusKm === radiusKm && !movedEnough && now - previousLookup.at < 30000) return undefined;
    lastHospitalLookupRef.current = { lat: position.lat, lng: position.lng, radiusKm, at: now };
    const query = `lat=${position.lat}&lng=${position.lng}&radius_km=${radiusKm}`;
    const loadNearby = async () => {
      try {
        setHospitalError('');
        const response = await fetch(`${API_BASE}/api/hospitals/nearby?${query}`, { headers: authHeaders() });
        if (!response.ok) throw new Error('Unable to retrieve nearby hospitals.');
        const data = await response.json();
        setNearbyHospitals(data.hospitals || []);
      } catch (error) {
        setNearbyHospitals([]);
        setHospitalError(error.message || 'Unable to retrieve nearby hospitals.');
      }
      try {
        setDoctorError('');
        const response = await fetch(`${API_BASE}/api/doctors/nearby?${query}`, { headers: authHeaders() });
        if (!response.ok) throw new Error('Doctor availability is currently unavailable.');
        setNearbyDocs(await response.json());
      } catch (error) {
        setNearbyDocs([]);
        setDoctorError(error.message || 'Doctor availability is currently unavailable.');
      }
    };
    loadNearby();
  }, [position, radiusKm, user?.token]);

  useEffect(() => {
    if (!caseId || !user?.token) return undefined;
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/emergency/${caseId}`, { headers: authHeaders() });
        if (response.ok) {
          const activeRequest = await response.json();
          setCaseStatus(activeRequest.status);
          setDoctorAssigned(activeRequest.accepted_by || '');
          setRequestRisk(activeRequest.risk_level || 'Unknown');
          setRequestCreatedAt(activeRequest.request_time || '');
          if (activeRequest.lat != null && activeRequest.lng != null) {
            setPosition({ lat: activeRequest.lat, lng: activeRequest.lng });
            setAccuracy(activeRequest.accuracy);
            setLastUpdated(activeRequest.updated_at || activeRequest.request_time);
          }
          if (['CANCELLED', 'RESOLVED'].includes(activeRequest.status) && watchIdRef.current !== null) {
            navigator.geolocation?.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          if (['CANCELLED', 'RESOLVED'].includes(activeRequest.status)) {
            setLocationEnabled(false);
            setPosition(null);
            setAccuracy(null);
            setNearbyHospitals([]);
            setNearbyDocs([]);
            sessionStorage.removeItem(emergencySessionKey);
          }
        }
        if (caseStatus === 'DOCTOR_ASSIGNED') {
          const chatResponse = await fetch(`${API_BASE}/api/emergency/chat/${caseId}`, { headers: authHeaders() });
          if (chatResponse.ok) setMessages(await chatResponse.json());
        }
      } catch (error) { console.error(error); }
    };
    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [caseId, caseStatus, user?.token]);

  const requestAssistance = () => {
    if (!window.confirm('Create an emergency assistance request and share your location if you allow it?')) return;
    setIsRequesting(true);
    setRequestError('');
    if (position && locationEnabled) createEmergencyRequest({ ...position, accuracy });
    else startLocationTracking(true);
  };

  const continueWithoutLocation = () => {
    stopLiveLocation();
    createEmergencyRequest();
  };

  const cancelEmergencyRequest = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/emergency/${caseId}/cancel`, {
        method: 'POST', headers: authHeaders()
      });
      if (!response.ok) throw new Error('Unable to cancel this request.');
      setCaseStatus('CANCELLED');
      stopLiveLocation();
      sessionStorage.removeItem(emergencySessionKey);
    } catch (error) { setRequestError(error.message); }
  };

  const saveEmergencyContact = (contact) => {
    setEmergencyContact(contact);
    localStorage.setItem('emergency_contact', JSON.stringify(contact));
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!newMessage.trim() || !caseId) return;
    try {
      const response = await fetch(`${API_BASE}/api/emergency/chat`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ emergency_id: caseId, message: newMessage.trim() })
      });
      if (!response.ok) throw new Error('Message could not be sent.');
      setNewMessage('');
    } catch (error) { setRequestError(error.message); }
  };

  const startNewRequest = () => {
    setRequestSent(false);
    setCaseId('');
    caseIdRef.current = '';
    setCaseStatus('Pending');
    setDoctorAssigned('');
    setRequestRisk('');
    setRequestCreatedAt('');
    setAssessmentResult(null);
    setSelectedSymptoms([]);
    setMessages([]);
  };

  const isHighRisk = assessmentResult?.risk_score === 'High' || assessmentResult?.risk_score === 'Critical';

  return (
    <div className="page-container">
      <div className="card emergency-card" style={{ padding: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#d32f2f', marginBottom: '20px' }}>
          <AlertOctagon size={48} />
          <h1 style={{ color: '#d32f2f', margin: 0 }}>Emergency Response Hub</h1>
        </div>
        <p className="emergency-ready">● Emergency system ready</p>
        <div className="emergency-actions">
          <button onClick={requestAssistance} className="btn-primary emergency-sos" disabled={isRequesting || requestSent}>
            <AlertOctagon size={20} /> {isRequesting ? 'Requesting assistance…' : 'REQUEST EMERGENCY ASSISTANCE / SOS'}
          </button>
          <button onClick={() => startLocationTracking()} className="btn-secondary" disabled={locationEnabled || (requestSent && ['CANCELLED', 'RESOLVED'].includes(caseStatus))}>
            <Crosshair size={18} /> SHARE LIVE LOCATION
          </button>
          <a href="tel:112" className="btn-secondary"><PhoneCall size={18} /> CALL EMERGENCY SERVICE (112)</a>
        </div>
        {(assessmentResult?.risk_score === 'Critical' || requestRisk === 'Critical') && <div className="critical-emergency"><strong>CRITICAL RISK</strong><span>Immediate professional medical assistance is recommended.</span></div>}
        {requestError && <p className="error-box" role="alert">{requestError}</p>}
        
        {/* Step 1: Emergency Quick Scan */}
        {!requestSent && (
          <div className="card glass-card emergency-light-panel" style={{ marginBottom: '20px', background: '#ffffff', color: '#0f172a' }}>
            <h3 style={{ marginTop: 0 }}><HeartPulse size={20} /> Emergency Quick Scan</h3>
            <div className="symptom-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
              {SYMPTOMS_LIST.map(s => (
                <button key={s} className={`symptom-chip ${selectedSymptoms.includes(s) ? 'selected' : ''}`} onClick={() => toggleSymptom(s)}>{s}</button>
              ))}
            </div>
            <div className="form-layout row" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' }}>
              <label className="field-label">Heart Rate (bpm)
                <input type="number" value={vitals.heartRate} onChange={e => setVitals({...vitals, heartRate: e.target.value})} />
              </label>
              <label className="field-label">SpO2 (%)
                <input type="number" value={vitals.spo2} onChange={e => setVitals({...vitals, spo2: e.target.value})} />
              </label>
            </div>
            <button onClick={runQuickScan} className="btn-secondary" disabled={isScanning || selectedSymptoms.length === 0}>
              {isScanning ? 'Scanning...' : 'Run Quick Scan'}
            </button>

            {assessmentResult && (
              <div style={{ marginTop: '15px', padding: '15px', background: isHighRisk ? '#ffebee' : '#e8f5e9', color: isHighRisk ? '#7f1d1d' : '#14532d', borderRadius: '8px', border: `1px solid ${isHighRisk ? '#f44336' : '#4caf50'}` }}>
                <strong style={{ color: isHighRisk ? '#b91c1c' : '#15803d', display: 'block', fontSize: '1.1rem' }}>Risk Score: {assessmentResult.risk_score}</strong>
                <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>{assessmentResult.condition}</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.95rem' }}>{assessmentResult.explanation}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Live Location */}
        <section className="card glass-card emergency-light-panel emergency-location-panel">
          <h3><MapPin size={20} /> Patient Location</h3>
          {locationEnabled ? (
            <p className="live-location-status"><strong>● {locationEnabled ? 'Live Location Active' : 'Last shared location'}</strong> · Updated {lastUpdated}</p>
          ) : (
            <p>Location is shared only after you allow browser access.</p>
          )}
          {position && <p className="location-coordinates">Latitude {position.lat.toFixed(5)} · Longitude {position.lng.toFixed(5)} · Accuracy {Math.round(accuracy)} m</p>}
          {locationEnabled && accuracy > 50 && <p className="location-warning">GPS accuracy is currently low. Move to an open area or enable device location.</p>}
          {geoError && <p className="error-box" role="status">{geoError}</p>}
          {!locationEnabled && <button onClick={() => startLocationTracking()} className="btn-primary"><Crosshair size={18} /> Allow Location</button>}
          {canContinueWithoutLocation && <button onClick={continueWithoutLocation} className="btn-secondary" disabled={!isRequesting}>Continue Without Location</button>}
          {locationEnabled && <button onClick={stopLiveLocation} className="btn-secondary">Stop Live Location</button>}

          {position ? (
            <div className="emergency-map-wrap">
              <MapContainer center={[position.lat, position.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[position.lat, position.lng]} icon={userIcon}><Popup>Patient location</Popup></Marker>
                <Circle center={[position.lat, position.lng]} radius={accuracy || 0} pathOptions={{ color: '#00bcd4', fillColor: '#00bcd4', fillOpacity: 0.18 }} />
                {nearbyHospitals.map(hospital => (
                  <Marker key={hospital.id} position={[hospital.lat, hospital.lng]} icon={hospitalIcon}>
                    <Popup><strong>{hospital.name}</strong><br />{hospital.distance_km} km · OpenStreetMap</Popup>
                  </Marker>
                ))}
                <MapFocus position={mapFocus} />
                <MapUpdater center={[position.lat, position.lng]} />
              </MapContainer>
            </div>
          ) : <div className="emergency-map-empty">Map appears after you share your location.</div>}
        </section>

        <section className="emergency-directory">
          <div className="directory-heading">
            <div><h2>Nearby Hospitals</h2><p>OpenStreetMap · straight-line distances · location shared with OSM for this search</p></div>
            <label>Search radius
              <select value={radiusKm} onChange={event => setRadiusKm(Number(event.target.value))}>
                <option value={5}>5 km</option><option value={10}>10 km</option><option value={25}>25 km</option>
              </select>
            </label>
          </div>
          {hospitalError && <p className="error-box" role="status">{hospitalError}</p>}
          {!position && <p>Share your location to search for nearby hospitals.</p>}
          {position && !hospitalError && nearbyHospitals.length === 0 && <p>No hospitals were returned for this radius.</p>}
          <div className="emergency-card-grid">
            {nearbyHospitals.map(hospital => {
              const directions = new URL('https://www.google.com/maps/dir/');
              directions.searchParams.set('api', '1');
              directions.searchParams.set('destination', `${hospital.lat},${hospital.lng}`);
              directions.searchParams.set('origin', `${position.lat},${position.lng}`);
              return (
                <article className="emergency-provider-card" key={hospital.id}>
                  <h3>🏥 {hospital.name}</h3>
                  <p>Distance: {hospital.distance_km} km · driving ETA unavailable</p>
                  <p>{hospital.emergency_availability}</p>
                  <p>{hospital.opening_status}</p>
                  <p>Source: {hospital.source} · listed phone is not independently verified</p>
                  <div className="provider-actions">
                    {hospital.phone
                      ? <a href={`tel:${hospital.phone}`} className="btn-secondary"><PhoneCall size={16} /> Call</a>
                      : <button className="btn-secondary" disabled title="Phone number unavailable">Phone number unavailable</button>}
                    <button onClick={() => setMapFocus([hospital.lat, hospital.lng])} className="btn-secondary">View on Map</button>
                    <a href={directions.toString()} target="_blank" rel="noreferrer" className="btn-primary">Get Directions</a>
                    <button onClick={requestAssistance} className="btn-secondary" disabled={requestSent || isRequesting}>Request Assistance</button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="directory-heading doctor-directory-heading">
            <div><h2>Nearby Doctors</h2><p>Status is heartbeat-based; it does not confirm response or assignment.</p></div>
          </div>
          {doctorError && <p className="error-box" role="status">{doctorError}</p>}
          {position && !doctorError && nearbyDocs.length === 0 && <p>Doctor availability unavailable. No registered doctor location and current heartbeat were found.</p>}
          <div className="emergency-card-grid">
            {nearbyDocs.map((doctor, index) => (
              <article className="emergency-provider-card" key={`${doctor.name}-${index}`}>
                <h3>👨‍⚕️ {doctor.name}</h3>
                <p>Specialization: {doctor.specialization}</p>
                <p>Distance: {doctor.distance_km} km</p>
                <p>Status: {doctor.status} · Demo availability (doctor account heartbeat)</p>
                <div className="provider-actions">
                  {doctor.phone
                    ? <a href={`tel:${doctor.phone}`} className="btn-secondary"><PhoneCall size={16} /> Call</a>
                    : <button className="btn-secondary" disabled title="Phone number unavailable">Phone number unavailable</button>}
                  <span>{doctor.eta || 'Response time unavailable'}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card glass-card emergency-light-panel contact-panel">
          <h3>Emergency Contact</h3>
          <div className="contact-fields">
            <label>Name<input value={emergencyContact.name} onChange={event => saveEmergencyContact({ ...emergencyContact, name: event.target.value })} /></label>
            <label>Relationship<input value={emergencyContact.relationship} onChange={event => saveEmergencyContact({ ...emergencyContact, relationship: event.target.value })} /></label>
            <label>Phone<input type="tel" value={emergencyContact.phone} onChange={event => saveEmergencyContact({ ...emergencyContact, phone: event.target.value })} /></label>
          </div>
          {emergencyContact.phone
            ? <a href={`tel:${emergencyContact.phone}`} className="btn-secondary"><PhoneCall size={16} /> Call Emergency Contact</a>
            : <button className="btn-secondary" disabled>Call Emergency Contact</button>}
        </section>

        {/* Step 3: Request & Guidance */}
        {!requestSent ? (
          <div className="action-row" style={{ marginTop: '30px' }}>
            <button onClick={requestAssistance} className="btn-primary emergency-sos" disabled={isRequesting}>
              <AlertOctagon size={24} /> {isRequesting ? 'Requesting assistance…' : 'REQUEST EMERGENCY ASSISTANCE'}
            </button>
          </div>
        ) : (
          <div className="emergency-request-status" role="status">
            <h3>🚨 Emergency Request Active</h3>
            <p><strong>Request ID:</strong> {caseId}</p>
            <p><strong>Risk Level:</strong> {requestRisk || assessmentResult?.risk_score || 'Not assessed'}</p>
            <p><strong>Location:</strong> {locationEnabled ? 'Live location active' : position ? 'Last location shared' : 'Not shared'}</p>
            <p><strong>Nearby hospitals:</strong> {hospitalError ? 'Unavailable' : nearbyHospitals.length}</p>
            <p><strong>Demo available doctors:</strong> {doctorError ? 'Unavailable' : nearbyDocs.filter(doctor => doctor.status === 'AVAILABLE').length}</p>
            <p><strong>Request time:</strong> {requestCreatedAt ? new Date(requestCreatedAt).toLocaleTimeString() : 'Unavailable'}</p>
            <p><strong>Status:</strong> {caseStatus}</p>
            {caseStatus === 'SEARCHING' && <p>Searching for assistance. No hospital has confirmed availability.</p>}
            {caseStatus === 'DOCTOR_ASSIGNED' && <p>Doctor {doctorAssigned} assigned and responding. ETA unavailable.</p>}
            {caseStatus === 'CANCELLED' && <p>This request was cancelled.</p>}
            {caseStatus === 'RESOLVED' && <p>This request has been resolved.</p>}
            <p>Hospital availability could not be verified. Call a listed provider directly to confirm.</p>
            {!['CANCELLED', 'RESOLVED'].includes(caseStatus) && (
              <button onClick={cancelEmergencyRequest} className="btn-secondary">Cancel Emergency Request</button>
            )}
            {['CANCELLED', 'RESOLVED'].includes(caseStatus) && (
              <button onClick={startNewRequest} className="btn-primary">Start Another Emergency Request</button>
            )}
          </div>
        )}

        {/* Chat Interface - Only show if doctor accepted */}
        {caseStatus === 'DOCTOR_ASSIGNED' && (
          <div className="card glass-card emergency-light-panel" style={{ marginTop: '20px', background: '#ffffff', color: '#0f172a' }}>
            <h3 style={{ marginTop: 0 }}><Stethoscope size={20} /> Doctor Chat</h3>
            <div style={{ height: '250px', overflowY: 'auto', background: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #e2e8f0' }}>
              {messages.length === 0 ? <p>Say hello to your doctor.</p> : messages.map((msg, idx) => (
                <div key={idx} style={{ marginBottom: '10px', textAlign: msg.sender_username === user.username ? 'right' : 'left' }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '10px 15px',
                    borderRadius: '16px',
                    background: msg.sender_username === user.username ? '#00bcd4' : '#e2e8f0',
                    color: msg.sender_username === user.username ? 'white' : 'black',
                    maxWidth: '80%'
                  }}>
                    <strong style={{ fontSize: '0.8rem', display: 'block', opacity: 0.8, marginBottom: '2px' }}>{msg.sender_username}</strong>
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
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0 20px' }}><Send size={20} /></button>
            </form>
          </div>
        )}

        {/* Pre-Arrival Guidance */}
        {(assessmentResult && isHighRisk) && (
          <div className="emergency-light-panel" style={{ marginTop: '30px', padding: '20px', background: '#ffffff', color: '#0f172a', borderLeft: '4px solid #f44336', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ color: '#b91c1c', marginTop: 0 }}>While Waiting for Medical Help</h3>
            <ul style={{ lineHeight: '1.6', paddingLeft: '20px', fontWeight: '500' }}>
              <li>Stay calm and remain in a safe, comfortable position.</li>
              <li>Avoid unnecessary movement, especially if you experience chest pain.</li>
              <li>Unlock your main door for emergency responders.</li>
              <li>Gather any medications you are currently taking to show the doctor.</li>
              <li>Have a family member or neighbor stay with you if possible.</li>
            </ul>
            <p style={{ fontSize: '0.95rem', color: '#334155', marginTop: '15px', fontStyle: 'italic', background: '#f1f5f9', padding: '12px', borderRadius: '6px', borderLeft: '3px solid #cbd5e1' }}>
              <strong style={{ color: '#0f172a' }}>Disclaimer:</strong> This information provides safe general first-response guidance. It does not prescribe medications and does not replace professional medical care.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
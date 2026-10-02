import React, { useContext, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { AuthContext } from '../context/AuthContext';

// Fix leaflet icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icon for user location
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

const doctorIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});


function MapBounds({ position, places }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      const bounds = L.latLngBounds([position.lat, position.lng]);
      let validBounds = false;
      places.forEach(p => {
        if (p.lat && p.lng) {
          bounds.extend([p.lat, p.lng]);
          validBounds = true;
        }
      });
      if (validBounds) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } else {
        map.setView([position.lat, position.lng], 15);
      }
    }
  }, [position, places, map]);
  return null;
}

export default function NearbyLocations() {
  const { user } = useContext(AuthContext);
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [position, setPosition] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [filterType, setFilterType] = useState('All'); // All, Hospitals, Doctors
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [distanceFilter, setDistanceFilter] = useState(25);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition({ lat: latitude, lng: longitude });
        fetchData(latitude, longitude);
      },
      (err) => {
        setGeoError('Location access denied. Nearby lookup was not performed.');
      }
    );
  }, [user?.token]);

  const fetchData = async (lat, lng) => {
    try {
      const headers = { Authorization: `Bearer ${user?.token || ''}` };
      const params = `lat=${lat}&lng=${lng}&radius_km=25`;
      const [hospitalResponse, doctorResponse] = await Promise.all([
        fetch(`/api/hospitals/nearby?${params}`, { headers }),
        fetch(`/api/doctors/nearby?${params}`, { headers }),
      ]);

      if (!hospitalResponse.ok || !doctorResponse.ok) {
        throw new Error('Nearby provider information is unavailable.');
      }
      const hospitalData = await hospitalResponse.json();
      const doctorData = await doctorResponse.json();
      setHospitals(hospitalData.hospitals || []);
      setDoctors(doctorData.map((doctor) => ({
        ...doctor,
        specialty: doctor.specialization,
        availability: doctor.status === 'AVAILABLE' ? 'Available' : 'Busy',
      })));
    } catch (err) {
      console.error(err);
      setGeoError(err.message || 'Nearby provider information is unavailable.');
    }
  };

  const filteredHospitals = hospitals.filter(h => 
    (filterType === 'All' || filterType === 'Hospitals') &&
    (h.distance_km <= distanceFilter) &&
    (specialtyFilter === '' || h.specialty?.toLowerCase().includes(specialtyFilter.toLowerCase()))
  );

  const filteredDoctors = doctors.filter(d => 
    (filterType === 'All' || filterType === 'Doctors') &&
    (d.distance_km <= distanceFilter) &&
    (specialtyFilter === '' || d.specialty?.toLowerCase().includes(specialtyFilter.toLowerCase()))
  );

  return (
    <div className="page-container">
      <header className="page-header" style={{ marginBottom: '20px' }}>
        <h1>Nearby Doctors & Hospitals</h1>
        <p>Find medical help near your live location.</p>
      </header>

      {geoError && <div className="error-box">{geoError}</div>}
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.8)', padding: '15px', borderRadius: '8px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 'bold' }}>
          Show:
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '5px' }}>
            <option>All</option>
            <option>Hospitals</option>
            <option>Doctors</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 'bold' }}>
          Max Distance (km): {distanceFilter}
          <input type="range" min="1" max="50" value={distanceFilter} onChange={e => setDistanceFilter(e.target.value)} style={{ marginTop: '5px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 'bold', flex: 1 }}>
          Specialty (e.g. Cardiology):
          <input type="text" placeholder="Filter by specialty..." value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '5px' }} />
        </label>
      </div>

      <div style={{ background: '#e3f2fd', color: '#0277bd', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #0288d1' }}>
        <strong>Location data:</strong> Your coordinates are sent to OpenStreetMap to find hospitals. Listings are not verified for emergency availability. Doctor listings show registered accounts that recently shared availability. Confirm details directly before travelling.
      </div>
      
      <div className="card glass-card" style={{ height: '500px', padding: 0, overflow: 'hidden' }}>
        <MapContainer center={position ? [position.lat, position.lng] : [0, 0]} zoom={position ? 13 : 2} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {position && (
            <Marker position={[position.lat, position.lng]} icon={userIcon}>
              <Popup><strong>You are here</strong></Popup>
            </Marker>
          )}

          {filteredHospitals.map(h => (
            h.lat && h.lng && (
              <Marker key={`h-${h.name}`} position={[h.lat, h.lng]} icon={hospitalIcon}>
                <Popup minWidth={200}>
                  <strong style={{ fontSize: '1.1rem', color: '#0277bd' }}>🏥 {h.name}</strong> <br/>
                  <div style={{ marginTop: '10px' }}>
                    <strong>Distance:</strong> {h.distance_km ? `${h.distance_km} km` : 'N/A'} <br/>
                    <strong>Emergency availability:</strong> {h.emergency_availability} <br/>
                    {h.phone && <><strong>Contact:</strong> <a href={`tel:${h.phone}`}>{h.phone}</a></>}
                  </div>
                </Popup>
              </Marker>
            )
          ))}

          {filteredDoctors.map(d => (
            d.lat && d.lng && (
              <Marker key={`d-${d.name}`} position={[d.lat, d.lng]} icon={doctorIcon}>
                <Popup minWidth={200}>
                  <strong style={{ fontSize: '1.1rem', color: '#2e7d32' }}>👨‍⚕️ {d.name}</strong> <br/>
                  <div style={{ marginTop: '10px' }}>
                    <strong>Distance:</strong> {d.distance_km ? `${d.distance_km} km` : 'N/A'} <br/>
                    <strong>Specialty:</strong> {d.specialty} <br/>
                    <strong>Availability:</strong> {d.availability} <br/>
                  </div>
                </Popup>
              </Marker>
            )
          ))}

          {position && <MapBounds position={position} places={[...filteredHospitals, ...filteredDoctors]} />}
        </MapContainer>
      </div>

      <div className="dashboard-grid" style={{ marginTop: '20px' }}>
        {(filterType === 'All' || filterType === 'Hospitals') && (
          <div className="card glass-card">
            <h3 style={{ color: '#0277bd', display: 'flex', alignItems: 'center', gap: '10px' }}>🏥 Nearest Hospitals</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filteredHospitals.map((h, i) => (
                <li key={i} style={{ padding: '15px 10px', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{h.name}</strong> <span style={{ fontSize: '0.75rem', color: '#666' }}>OpenStreetMap</span><br/>
                      <small style={{ color: '#666' }}>{h.emergency_availability}</small><br/>
                      {h.phone && <small style={{ color: '#0277bd' }}>{h.phone}</small>}
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>
                      {h.distance_km} km
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {(filterType === 'All' || filterType === 'Doctors') && (
          <div className="card glass-card">
            <h3 style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px' }}>👨‍⚕️ Nearest Doctors</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filteredDoctors.map((d, i) => (
                <li key={i} style={{ padding: '15px 10px', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{d.name}</strong> <span style={{ fontSize: '0.75rem', color: '#666' }}>Registered account</span><br/>
                      <small style={{ color: '#666' }}>{d.specialty} | {d.availability}</small><br/>
                      <small style={{ color: '#2e7d32' }}>{d.phone}</small>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>
                      {d.distance_km} km
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

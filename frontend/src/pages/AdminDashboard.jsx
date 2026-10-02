import React, { useContext, useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { AuthContext } from '../context/AuthContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [emergencies, setEmergencies] = useState([]);
  const [mlStats, setMlStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin-stats');
        if (res.ok) setStats(await res.json());
      } catch (err) {
        console.error(err);
      }
    };
    const fetchEmergencies = async () => {
      try {
        const res = await fetch('/api/emergency/requests', {
          headers: { Authorization: `Bearer ${user?.token || ''}` }
        });
        if (res.ok) setEmergencies(await res.json());
      } catch (err) {
        console.error(err);
      }
    };
    const fetchMlStats = async () => {
      try {
        const res = await fetch('/api/ml-insights');
        if (res.ok) setMlStats(await res.json());
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
    fetchEmergencies();
    fetchMlStats();
    const interval = setInterval(fetchEmergencies, 5000);
    return () => clearInterval(interval);
  }, [user?.token]);

  if (!stats) return <div className="page-container">Loading stats...</div>;

  const pieData = {
    labels: stats.top_conditions.map(c => c.condition),
    datasets: [{
      data: stats.top_conditions.map(c => c.count),
      backgroundColor: ['#00bcd4', '#4caf50', '#ff9800', '#f44336', '#9c27b0']
    }]
  };

  const activeEmergencies = emergencies.filter(e => !['CANCELLED', 'RESOLVED'].includes(e.status));
  const activeCount = activeEmergencies.length;

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Admin Dashboard</h1>
        <p>System Overview & Statistics</p>
      </header>

      <div className="dashboard-grid">
        <div className="card glass-card text-center" style={{ borderColor: activeCount > 0 ? '#f44336' : '', background: activeCount > 0 ? '#ffebee' : '' }}>
          <h2 style={{ color: activeCount > 0 ? '#d32f2f' : 'inherit' }}>{activeCount}</h2>
          <p style={{ color: activeCount > 0 ? '#d32f2f' : 'inherit', fontWeight: 'bold' }}>Active Emergencies</p>
        </div>
        <div className="card glass-card text-center">
          <h2>{stats.total_users}</h2>
          <p>Total Users</p>
        </div>
        <div className="card glass-card text-center">
          <h2>{stats.total_assessments}</h2>
          <p>Total Predictions</p>
        </div>
        <div className="card glass-card text-center">
          <h2>{stats.total_doctors}</h2>
          <p>Registered Doctors</p>
        </div>
        <div className="card glass-card text-center">
          <h2>{stats.total_hospitals}</h2>
          <p>Hospitals</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: '20px' }}>
        <div className="card glass-card">
          <h3>Top Predicted Conditions</h3>
          <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
            <Pie data={pieData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
        
        <div className="card glass-card" style={{ gridColumn: 'span 2' }}>
          <h3>Live Emergency Cases</h3>
          {activeEmergencies.length === 0 ? <p>No active emergencies.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ccc' }}>
                    <th style={{ padding: '8px' }}>ID</th>
                    <th style={{ padding: '8px' }}>Patient</th>
                    <th style={{ padding: '8px' }}>Risk</th>
                    <th style={{ padding: '8px' }}>Status</th>
                    <th style={{ padding: '8px' }}>Doctor</th>
                    <th style={{ padding: '8px' }}>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEmergencies.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>{e.emergency_id}</td>
                      <td style={{ padding: '8px' }}>{e.patient_username}</td>
                      <td style={{ padding: '8px', color: '#d32f2f' }}>{e.risk_level}</td>
                      <td style={{ padding: '8px' }}><span className={`badge ${['Pending', 'SEARCHING'].includes(e.status) ? 'badge-warning' : 'badge-success'}`}>{e.status}</span></td>
                      <td style={{ padding: '8px' }}>{e.accepted_by || '-'}</td>
                      <td style={{ padding: '8px' }}>{e.updated_at ? new Date(e.updated_at).toLocaleString() : new Date(e.request_time).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {activeEmergencies.length > 0 && (
        <section className="card glass-card" style={{ marginTop: '20px' }}>
          <h3>Active Patient Locations · Admin Access</h3>
          {activeEmergencies.some(request => request.lat != null && request.lng != null) ? (
            <div className="emergency-map-wrap">
              <MapContainer
                center={[
                  activeEmergencies.find(request => request.lat != null && request.lng != null).lat,
                  activeEmergencies.find(request => request.lat != null && request.lng != null).lng
                ]}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {activeEmergencies.filter(request => request.lat != null && request.lng != null).map(request => (
                  <Marker key={request.emergency_id} position={[request.lat, request.lng]}>
                    <Popup>{request.emergency_id} · {request.status}<br />Updated: {request.updated_at || request.request_time}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          ) : <p>No active requests are sharing a location.</p>}
          <p>Location records are automatically cleared after 24 hours and when a request closes.</p>
        </section>
      )}

      {mlStats && (
        <div className="dashboard-grid" style={{ marginTop: '20px' }}>
          <div className="card glass-card" style={{ gridColumn: 'span 3' }}>
            <h3>Machine Learning Model Evaluation</h3>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '15px' }}>
              <div className="stat-box" style={{ flex: 1, minWidth: '120px', padding: '15px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>{(mlStats.accuracy * 100).toFixed(1)}%</div>
                <div>Accuracy</div>
              </div>
              <div className="stat-box" style={{ flex: 1, minWidth: '120px', padding: '15px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>{(mlStats.precision * 100).toFixed(1)}%</div>
                <div>Precision</div>
              </div>
              <div className="stat-box" style={{ flex: 1, minWidth: '120px', padding: '15px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>{(mlStats.recall * 100).toFixed(1)}%</div>
                <div>Recall</div>
              </div>
              <div className="stat-box" style={{ flex: 1, minWidth: '120px', padding: '15px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9c27b0' }}>{(mlStats.f1_score * 100).toFixed(1)}%</div>
                <div>F1-Score</div>
              </div>
            </div>

            <div style={{ marginTop: '30px' }}>
              <h4>Confusion Matrix</h4>
              <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px', textAlign: 'center' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #ccc', padding: '5px', background: '#eee' }}>Actual \ Predicted</th>
                      {mlStats.labels.map((l, i) => <th key={i} style={{ border: '1px solid #ccc', padding: '5px', background: '#eee' }}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {mlStats.confusion_matrix.map((row, i) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #ccc', padding: '5px', fontWeight: 'bold', background: '#eee', textAlign: 'left' }}>{mlStats.labels[i]}</td>
                        {row.map((val, j) => (
                          <td key={j} style={{ 
                            border: '1px solid #ccc', 
                            padding: '5px',
                            background: i === j ? `rgba(76, 175, 80, ${Math.max(0.1, val/50)})` : val > 0 ? `rgba(244, 67, 54, ${Math.max(0.1, val/50)})` : 'transparent'
                          }}>
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import SymptomAssessment from './pages/SymptomAssessment';
import PredictionResult from './pages/PredictionResult';
import TreatmentPath from './pages/TreatmentPath';
import EmergencyHub from './pages/EmergencyHub';
import NearbyLocations from './pages/NearbyLocations';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DocumentVault from './pages/DocumentVault';
import { AuthContext } from './context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isReady } = useContext(AuthContext);
  if (!isReady) return null;
  if (!user) {
    return <Navigate to="/login" />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />; // Redirect to home if not authorized
  }
  return children;
};

export default function App() {
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Patient Routes */}
          <Route path="/patient/dashboard" element={<ProtectedRoute allowedRoles={['Patient']}><PatientDashboard /></ProtectedRoute>} />
          <Route path="/patient/assessment" element={<ProtectedRoute allowedRoles={['Patient']}><SymptomAssessment /></ProtectedRoute>} />
          <Route path="/patient/prediction" element={<ProtectedRoute allowedRoles={['Patient']}><PredictionResult /></ProtectedRoute>} />
          <Route path="/patient/treatment" element={<ProtectedRoute allowedRoles={['Patient']}><TreatmentPath /></ProtectedRoute>} />
          <Route path="/patient/documents" element={<ProtectedRoute allowedRoles={['Patient']}><DocumentVault /></ProtectedRoute>} />
          <Route path="/emergency" element={<ProtectedRoute allowedRoles={['Patient']}><EmergencyHub /></ProtectedRoute>} />
          <Route path="/nearby" element={<ProtectedRoute allowedRoles={['Patient']}><NearbyLocations /></ProtectedRoute>} />

          {/* Doctor Routes */}
          <Route path="/doctor/dashboard" element={<ProtectedRoute allowedRoles={['Doctor']}><DoctorDashboard /></ProtectedRoute>} />
          
          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboard /></ProtectedRoute>} />
        </Routes>
      </div>
    </div>
  );
}

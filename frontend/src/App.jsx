import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Movies from './pages/Movies';
import Hotels from './pages/Hotels';
import Travel from './pages/Travel';
import Receipt from './pages/Receipt';
import MyBookings from './pages/MyBookings';
import Admin from './pages/Admin';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="movies" element={<PrivateRoute><Movies /></PrivateRoute>} />
        <Route path="hotels" element={<PrivateRoute><Hotels /></PrivateRoute>} />
        <Route path="travel" element={<PrivateRoute><Travel /></PrivateRoute>} />
        <Route path="bookings" element={<PrivateRoute><MyBookings /></PrivateRoute>} />
        <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="receipt/:bookingId" element={<PrivateRoute><Receipt /></PrivateRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

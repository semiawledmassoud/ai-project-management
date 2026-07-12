import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocaleProvider } from './context/LocaleContext';
import { ThemeProvider } from './context/ThemeContext';

import Login         from './pages/Login';
import Signup        from './pages/Signup';
import Layout        from './components/Layout';
import Dashboard     from './pages/Dashboard';
import Projects      from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Analysis      from './pages/Analysis';
import Risks         from './pages/Risks';
import Recommendations from './pages/Recommendations';
import Forecast      from './pages/Forecast';
import Milestones    from './pages/Milestones';
import Reports       from './pages/Reports';
import Notifications from './pages/Notifications';
import Profile       from './pages/Profile';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{
      minHeight:'100vh',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      background:'#0D0F14',
      color:'#9BA3C8'
    }}>
      Chargement...
    </div>
  );

  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
            <Route path="/login"  element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/" element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="analysis" element={<Analysis />} />
              <Route path="risks" element={<Risks />} />
              <Route path="recommendations" element={<Recommendations />} />
              <Route path="forecast" element={<Forecast />} />
              <Route path="milestones" element={<Milestones />} />
              <Route path="reports" element={<Reports />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
            </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  // Charger le nombre de notifications non lues
  useEffect(() => {
    const loadUnread = () => {
      API.get('/notifications/unread-count')
        .then(r => setUnreadCount(r.data.count))
        .catch(() => {});
    };
    loadUnread();
    // Rafraîchir toutes les 60 secondes
    const interval = setInterval(loadUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => { logout(); nav('/login'); };

  const navStyle = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', borderRadius: 8,
    color: isActive ? '#4F8FFF' : '#9BA3C8',
    background: isActive ? 'rgba(79,143,255,0.1)' : 'transparent',
    textDecoration: 'none', fontSize: 13, fontWeight: 500,
    margin: '1px 0', transition: 'all .15s', position: 'relative',
  });

  const sectionLabel = {
    fontSize: 10, color: '#5C6490', letterSpacing: 1,
    textTransform: 'uppercase', padding: '12px 8px 4px'
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#131620',
        borderRight: '1px solid #252A3D',
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #252A3D', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#4F8FFF,#A78BFA)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 16 }}>P</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#E8EAF6' }}>ProAI</div>
            <div style={{ fontSize: 9, color: '#5C6490', fontFamily: 'monospace' }}>v2.0 · LIVE</div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ padding: '8px 8px', flex: 1, overflowY: 'auto' }}>

          <div style={sectionLabel}>Principal</div>
          <NavLink to="/" style={navStyle} end>📊 Dashboard</NavLink>
          <NavLink to="/projects" style={navStyle}>📁 Projets</NavLink>

          <div style={sectionLabel}>Analyse IA</div>
          <NavLink to="/analysis" style={navStyle}>🔬 Analyse IA</NavLink>
          <NavLink to="/forecast" style={navStyle}>🔮 Prévisions 30/60/90j</NavLink>
          <NavLink to="/risks" style={navStyle}>⚠️ Risques</NavLink>
          <NavLink to="/recommendations" style={navStyle}>💡 Recommandations</NavLink>

          <div style={sectionLabel}>Gestion</div>
          <NavLink to="/milestones" style={navStyle}>🎯 Jalons & Objectifs</NavLink>
          <NavLink to="/reports" style={navStyle}>📊 Rapport hebdo</NavLink>

          <div style={sectionLabel}>Compte</div>

          {/* Notifications avec badge */}
          <NavLink to="/notifications" style={({ isActive }) => ({
            ...navStyle({ isActive }),
            justifyContent: 'space-between'
          })}>
            <span>🔔 Notifications</span>
            {unreadCount > 0 && (
              <span style={{ background: '#F87171', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>

          <NavLink to="/profile" style={navStyle}>👤 Mon profil</NavLink>

        </nav>

        {/* User footer */}
        <div style={{ padding: 10, borderTop: '1px solid #252A3D' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: '#22263A', borderRadius: 8, cursor: 'pointer' }} onClick={() => nav('/profile')}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2D5FCC,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#E8EAF6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: '#5C6490' }}>{user?.role || 'Manager'}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); handleLogout(); }}
              style={{ background: 'none', border: 'none', color: '#5C6490', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>⏻</button>
          </div>
        </div>
      </aside>

      {/* Contenu principal */}
      <main style={{ flex: 1, overflow: 'auto', background: '#0D0F14' }}>
        <Outlet />
      </main>
    </div>
  );
}
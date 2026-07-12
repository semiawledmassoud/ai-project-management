import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const nav = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(name, email, password);
      nav('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    background: '#1A1D28',
    border: '1px solid #252A3D',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#E8EAF6',
    fontSize: 13,
    outline: 'none',
    marginTop: 5,
  };

  return (
    <div className="auth-page">
      <div className="auth-background">
        <div className="auth-grid" />
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg,#4F8FFF,#A78BFA)',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: '#fff',
            marginBottom: 12
          }}>P</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#E8EAF6' }}>
            Créer un compte
          </div>
          <div style={{ fontSize: 12, color: '#5C6490', marginTop: 4 }}>
            Rejoignez PREDYNEX gratuitement
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(248,113,113,.12)',
            border: '1px solid rgba(248,113,113,.25)',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#F87171',
            fontSize: 13,
            marginBottom: 16
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#9BA3C8' }}>Nom complet</label>
            <input
              type="text"
              placeholder="Votre nom"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#9BA3C8' }}>Email</label>
            <input
              type="email"
              placeholder="vous@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: '#9BA3C8' }}>Mot de passe</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#2D5FCC' : '#4F8FFF',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '11px',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: '#5C6490' }}>
          Déjà un compte ?{' '}
          <Link to="/login" style={{ color: '#4F8FFF', textDecoration: 'none' }}>
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
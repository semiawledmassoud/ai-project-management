import React, { useState } from 'react';
import API from '../utils/api';

export default function AlertEmail({ project, risks, score }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post('/alerts/send', {
        email,
        projectName: project?.name,
        risks,
        score
      });
      setSent(true);
      setTimeout(() => { setSent(false); setShow(false); setEmail(''); }, 3000);
    } catch (err) {
      alert('Erreur envoi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const criticalCount = risks?.filter(r => r.severity === 'critical').length || 0;

  return (
    <div style={{ background: '#131620', border: '1px solid #252A3D', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>📧 Alertes automatiques</div>
          <div style={{ fontSize: 11, color: '#5C6490', marginTop: 2 }}>
            {criticalCount > 0
              ? `⚠️ ${criticalCount} risque(s) critique(s) — alerte recommandée`
              : 'Aucun risque critique détecté'}
          </div>
        </div>
        <button onClick={() => setShow(!show)}
          style={{ background: criticalCount > 0 ? 'rgba(248,113,113,.15)' : 'rgba(79,143,255,.1)', color: criticalCount > 0 ? '#F87171' : '#4F8FFF', border: `1px solid ${criticalCount > 0 ? 'rgba(248,113,113,.25)' : 'rgba(79,143,255,.2)'}`, borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          {show ? 'Fermer' : 'Envoyer alerte'}
        </button>
      </div>

      {show && (
        <form onSubmit={send} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="destinataire@email.com"
            style={{ flex: 1, background: '#1A1D28', border: '1px solid #252A3D', borderRadius: 7, padding: '8px 10px', color: '#E8EAF6', fontSize: 12, outline: 'none' }} />
          <button type="submit" disabled={loading}
            style={{ background: '#F87171', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? '...' : sent ? '✓ Envoyé !' : 'Envoyer'}
          </button>
        </form>
      )}

      {sent && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#34D399', textAlign: 'center' }}>
          ✅ Alerte envoyée à {email}
        </div>
      )}
    </div>
  );
}
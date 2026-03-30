import React, { useState, useEffect } from 'react';
import API from '../utils/api';

const actionColors = {
  'Projet créé': '#34D399',
  'Projet modifié': '#4F8FFF',
  'Risque détecté': '#F87171',
  'Risque résolu': '#34D399',
  'Membre ajouté': '#A78BFA',
  'Commentaire ajouté': '#F59E0B',
  'Score IA calculé': '#22D3EE',
};

export default function HistoryLog({ projectId }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    API.get(`/history/${projectId}`).then(r => setHistory(r.data)).catch(console.error);
  }, [projectId]);

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs/24)}j`;
  };

  return (
    <div style={{ background: '#131620', border: '1px solid #252A3D', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
        📜 Historique ({history.length} événements)
      </div>

      {history.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#5C6490', padding: 20, fontSize: 13 }}>
          Aucun historique disponible
        </div>
      ) : (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {history.map((h, i) => (
            <div key={h._id || i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #1A1D28' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: actionColors[h.action] || '#5C6490', flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>
                  <span style={{ color: actionColors[h.action] || '#9BA3C8' }}>{h.action}</span>
                  {h.field && <span style={{ color: '#5C6490' }}> · {h.field}</span>}
                </div>
                {h.oldValue && h.newValue && (
                  <div style={{ fontSize: 11, color: '#5C6490', marginTop: 2 }}>
                    <span style={{ color: '#F87171' }}>{h.oldValue}</span>
                    <span> → </span>
                    <span style={{ color: '#34D399' }}>{h.newValue}</span>
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#5C6490', marginTop: 2, fontFamily: 'monospace' }}>
                  {h.userName} · {timeAgo(h.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
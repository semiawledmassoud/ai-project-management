import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Comments({ projectId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    API.get(`/comments/${projectId}`).then(r => setComments(r.data)).catch(console.error);
  };

  useEffect(() => { load(); }, [projectId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      await API.post(`/comments/${projectId}`, { text });
      setText('');
      load();
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const del = async (id) => {
    await API.delete(`/comments/${id}`);
    setComments(comments.filter(c => c._id !== id));
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Il y a ${hrs}h`;
    return `Il y a ${Math.floor(hrs/24)} jour(s)`;
  };

  return (
    <div style={{ background: '#131620', border: '1px solid #252A3D', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
        💬 Commentaires ({comments.length})
      </div>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#4F8FFF,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ajouter un commentaire..."
          style={{ flex: 1, background: '#1A1D28', border: '1px solid #252A3D', borderRadius: 8, padding: '8px 12px', color: '#E8EAF6', fontSize: 13, outline: 'none' }}
        />
        <button type="submit" disabled={loading || !text.trim()}
          style={{ background: '#4F8FFF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !text.trim() ? 0.5 : 1 }}>
          Envoyer
        </button>
      </form>

      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#5C6490', padding: 20, fontSize: 13 }}>
          Aucun commentaire — soyez le premier !
        </div>
      ) : (
        comments.map(c => (
          <div key={c._id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #252A3D' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2D5FCC,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {c.userName?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.userName}</span>
                <span style={{ fontSize: 10, color: '#5C6490', fontFamily: 'monospace' }}>{timeAgo(c.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: '#9BA3C8', lineHeight: 1.5 }}>{c.text}</div>
            </div>
            {c.userId === user?.id && (
              <button onClick={() => del(c._id)}
                style={{ background: 'none', border: 'none', color: '#5C6490', cursor: 'pointer', fontSize: 12, alignSelf: 'flex-start' }}>
                ✕
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
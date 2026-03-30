import React, { useState, useEffect } from 'react';
import API from '../utils/api';

const statusColors = { active: '#34D399', absent: '#F59E0B', overloaded: '#F87171' };
const statusLabels = { active: 'Actif', absent: 'Absent', overloaded: 'Surchargé' };

export default function TeamMembers({ projectId }) {
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', email: '', workload: 80, status: 'active' });

  const load = () => API.get(`/team/${projectId}`).then(r => setMembers(r.data)).catch(console.error);
  useEffect(() => { load(); }, [projectId]);

  const submit = async (e) => {
    e.preventDefault();
    await API.post(`/team/${projectId}`, form);
    setShowForm(false);
    setForm({ name: '', role: '', email: '', workload: 80, status: 'active' });
    load();
  };

  const del = async (id) => {
    if (window.confirm('Supprimer ce membre ?')) {
      await API.delete(`/team/${id}`);
      load();
    }
  };

  const updateStatus = async (id, status) => {
    await API.put(`/team/${id}`, { status });
    load();
  };

  const inp = { width: '100%', background: '#1A1D28', border: '1px solid #252A3D', borderRadius: 7, padding: '8px 10px', color: '#E8EAF6', fontSize: 12, outline: 'none' };

  return (
    <div style={{ background: '#131620', border: '1px solid #252A3D', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>👥 Équipe ({members.length} membres)</div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: '#4F8FFF', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          {showForm ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} style={{ background: '#1A1D28', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: '#5C6490', display: 'block', marginBottom: 3 }}>Nom *</label>
              <input style={inp} value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Prénom Nom" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#5C6490', display: 'block', marginBottom: 3 }}>Rôle *</label>
              <input style={inp} value={form.role} onChange={e => setForm({...form, role: e.target.value})} required placeholder="Ex: Lead Dev" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#5C6490', display: 'block', marginBottom: 3 }}>Email</label>
              <input style={inp} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@exemple.com" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#5C6490', display: 'block', marginBottom: 3 }}>Charge de travail ({form.workload}%)</label>
              <input type="range" min="0" max="130" value={form.workload} onChange={e => setForm({...form, workload: +e.target.value})}
                style={{ width: '100%', marginTop: 4 }} />
            </div>
          </div>
          <button type="submit" style={{ background: '#34D399', color: '#0D0F14', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ✓ Ajouter le membre
          </button>
        </form>
      )}

      {members.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#5C6490', padding: 20, fontSize: 13 }}>
          Aucun membre — cliquez sur "+ Ajouter"
        </div>
      ) : (
        members.map(m => (
          <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #252A3D' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#2D5FCC,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {m.name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: '#5C6490' }}>{m.role}</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{ height: 4, background: '#22263A', borderRadius: 2, overflow: 'hidden', marginBottom: 2 }}>
                <div style={{ height: '100%', width: Math.min(m.workload, 100)+'%', background: m.workload > 100 ? '#F87171' : m.workload > 80 ? '#F59E0B' : '#34D399', borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 10, color: m.workload > 100 ? '#F87171' : '#9BA3C8' }}>{m.workload}%</div>
            </div>
            <select value={m.status} onChange={e => updateStatus(m._id, e.target.value)}
              style={{ background: '#1A1D28', border: `1px solid ${statusColors[m.status]}44`, borderRadius: 6, color: statusColors[m.status], fontSize: 10, padding: '3px 6px', cursor: 'pointer', outline: 'none' }}>
              {Object.entries(statusLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => del(m._id)} style={{ background: 'none', border: 'none', color: '#5C6490', cursor: 'pointer', fontSize: 14 }}>🗑</button>
          </div>
        ))
      )}
    </div>
  );
}
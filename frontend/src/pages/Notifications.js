import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

const TYPE_ICONS  = { risk:'⚠️', score:'📊', recommendation:'💡', milestone:'🎯', report:'📄', system:'🔔' };
const SEV_COLORS  = { critical:'#F87171', high:'#F59E0B', medium:'#4F8FFF', low:'#34D399', info:'#A78BFA' };

export default function Notifications() {
  const nav = useNavigate();
  const [notifs, setNotifs]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [generating, setGen]    = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get('/notifications');
      setNotifs(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await API.put(`/notifications/${id}/read`);
    setNotifs(notifs.map(n => n._id === id ? {...n, read:true} : n));
  };

  const markAllRead = async () => {
    await API.put('/notifications/read-all');
    setNotifs(notifs.map(n => ({...n, read:true})));
  };

  const del = async (id) => {
    await API.delete(`/notifications/${id}`);
    setNotifs(notifs.filter(n => n._id !== id));
  };

  const autoGenerate = async () => {
    setGen(true);
    try {
      const res = await API.post('/notifications/auto-generate');
      await load();
      alert(`✅ ${res.data.generated} notification(s) générée(s) depuis vos projets`);
    } catch (err) { alert('Erreur: '+err.message); }
    finally { setGen(false); }
  };

  const filtered = notifs.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'critical') return n.severity === 'critical';
    if (filter !== 'all') return n.type === filter;
    return true;
  });

  const unreadCount = notifs.filter(n => !n.read).length;

  const timeAgo = (date) => {
    const d = Date.now() - new Date(date);
    const m = Math.floor(d/60000);
    if (m < 1) return "À l'instant";
    if (m < 60) return `${m} min`;
    const h = Math.floor(m/60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h/24)}j`;
  };

  const card = { background:'#131620', border:'1px solid #252A3D', borderRadius:12, padding:'16px 20px', marginBottom:12 };

  return (
    <div style={{padding:24}}>
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22, fontWeight:700}}>🔔 Notifications</h1>
          <p style={{color:'#5C6490', fontSize:13, marginTop:4}}>
            {unreadCount} non lue(s) · {notifs.length} au total
          </p>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button onClick={autoGenerate} disabled={generating}
            style={{background:'rgba(167,139,250,.1)', color:'#A78BFA', border:'1px solid rgba(167,139,250,.2)', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer'}}>
            {generating ? '⏳ Analyse...' : '⟳ Analyser projets'}
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              style={{background:'rgba(52,211,153,.1)', color:'#34D399', border:'1px solid rgba(52,211,153,.2)', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer'}}>
              ✓ Tout marquer lu
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20}}>
        {[
          {label:'Non lues', val:unreadCount, col:'#4F8FFF'},
          {label:'Critiques', val:notifs.filter(n=>n.severity==='critical').length, col:'#F87171'},
          {label:'Risques', val:notifs.filter(n=>n.type==='risk').length, col:'#F59E0B'},
          {label:'Score', val:notifs.filter(n=>n.type==='score').length, col:'#A78BFA'},
        ].map(k => (
          <div key={k.label} style={{...card, marginBottom:0, textAlign:'center'}}>
            <div style={{fontSize:10, color:'#5C6490', textTransform:'uppercase', marginBottom:6}}>{k.label}</div>
            <div style={{fontSize:28, fontWeight:700, color:k.col}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{display:'flex', gap:6, marginBottom:16, flexWrap:'wrap'}}>
        {['all','unread','critical','risk','score','milestone','recommendation'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid', transition:'all .15s',
              background: filter===f ? 'rgba(79,143,255,.15)' : 'transparent',
              borderColor: filter===f ? '#4F8FFF' : '#252A3D',
              color: filter===f ? '#4F8FFF' : '#5C6490'}}>
            {f==='all'?`Toutes (${notifs.length})`:f==='unread'?`Non lues (${unreadCount})`:f==='critical'?'Critiques':f==='risk'?'Risques':f==='score'?'Score':f==='milestone'?'Jalons':'Recs'}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{textAlign:'center', color:'#5C6490', padding:60}}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:'center', color:'#5C6490', padding:60, background:'#131620', borderRadius:12, border:'1px dashed #252A3D'}}>
          <div style={{fontSize:32, marginBottom:12}}>🔔</div>
          <div>Aucune notification</div>
          <div style={{fontSize:12, marginTop:6}}>Cliquez sur "Analyser projets" pour générer des alertes automatiques</div>
        </div>
      ) : (
        <div style={{display:'grid', gap:8}}>
          {filtered.map(n => (
            <div key={n._id}
              style={{background: n.read ? '#131620' : '#1A1D28', border:`1px solid ${n.read?'#252A3D':SEV_COLORS[n.severity]+'44'}`, borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer', opacity:n.read?0.75:1}}
              onClick={() => { markRead(n._id); if(n.link) nav(n.link); }}>
              <div style={{fontSize:20, flexShrink:0, marginTop:2}}>{TYPE_ICONS[n.type]||'🔔'}</div>
              <div style={{flex:1}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                  {!n.read && <div style={{width:7, height:7, borderRadius:'50%', background:'#4F8FFF', flexShrink:0}}/>}
                  <span style={{fontSize:13, fontWeight:600}}>{n.title}</span>
                  <span style={{fontSize:10, background:`rgba(${n.severity==='critical'?'248,113,113':n.severity==='high'?'245,158,11':'79,143,255'},.12)`, color:SEV_COLORS[n.severity]||'#4F8FFF', padding:'1px 7px', borderRadius:4, fontFamily:'monospace'}}>
                    {n.severity}
                  </span>
                </div>
                <div style={{fontSize:12, color:'#9BA3C8', lineHeight:1.4}}>{n.message}</div>
                <div style={{fontSize:10, color:'#5C6490', marginTop:4, fontFamily:'monospace'}}>{timeAgo(n.createdAt)}</div>
              </div>
              <button onClick={e=>{e.stopPropagation(); del(n._id);}}
                style={{background:'none', border:'none', color:'#5C6490', cursor:'pointer', fontSize:14, flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
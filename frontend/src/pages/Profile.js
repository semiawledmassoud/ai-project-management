import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';

const ROLES = {
  admin:   { label:'Administrateur', color:'#F87171', desc:'Accès total, gestion des utilisateurs' },
  manager: { label:'Chef de projet', color:'#4F8FFF', desc:'Créer et gérer des projets' },
  member:  { label:'Membre',         color:'#34D399', desc:'Voir et commenter les projets' },
  viewer:  { label:'Observateur',    color:'#A78BFA', desc:'Accès en lecture seule' },
};

export default function Profile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [stats, setStats]   = useState(null);
  const [form, setForm]     = useState({ name:'', email:'' });
  const [saved, setSaved]   = useState(false);
  const [tab, setTab]       = useState('profile');

  useEffect(() => {
    if (user) setForm({ name: user.name||'', email: user.email||'' });
    API.get('/users/stats').then(r => setStats(r.data)).catch(console.error);
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await API.put('/users/me', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { alert(err.response?.data?.message || err.message); }
  };

  const handleLogout = () => { logout(); nav('/login'); };

  const inp = {width:'100%', background:'#1A1D28', border:'1px solid #252A3D', borderRadius:8, padding:'9px 12px', color:'#E8EAF6', fontSize:13, outline:'none'};
  const card = {background:'#131620', border:'1px solid #252A3D', borderRadius:12, padding:'16px 20px', marginBottom:16};

  const role = ROLES[user?.role] || ROLES.manager;

  return (
    <div style={{padding:24, maxWidth:800}}>
      <h1 style={{fontSize:22, fontWeight:700, marginBottom:20}}>👤 Mon profil</h1>

      {/* Avatar + info */}
      <div style={{...card, display:'flex', alignItems:'center', gap:20}}>
        <div style={{width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#4F8FFF,#A78BFA)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, color:'#fff', flexShrink:0}}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:20, fontWeight:700}}>{user?.name}</div>
          <div style={{fontSize:13, color:'#5C6490', marginTop:2}}>{user?.email}</div>
          <div style={{display:'inline-flex', alignItems:'center', gap:6, marginTop:8, background:`rgba(${role.color==='#F87171'?'248,113,113':role.color==='#4F8FFF'?'79,143,255':'52,211,153'},.12)`, color:role.color, padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600}}>
            {role.label}
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:6}}>
          <button onClick={handleLogout}
            style={{background:'rgba(248,113,113,.1)', color:'#F87171', border:'1px solid rgba(248,113,113,.2)', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer'}}>
            ⏻ Déconnexion
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16}}>
          {[
            {label:'Projets', val:stats.totalProjects, col:'#4F8FFF'},
            {label:'Actifs', val:stats.activeProjects, col:'#34D399'},
            {label:'Score moyen', val:stats.avgScore+'/10', col:stats.avgScore>=7?'#34D399':stats.avgScore>=5?'#F59E0B':'#F87171'},
            {label:'Risques critiques', val:stats.criticalRisks, col:'#F87171'},
          ].map(k => (
            <div key={k.label} style={{...card, marginBottom:0, textAlign:'center'}}>
              <div style={{fontSize:10, color:'#5C6490', textTransform:'uppercase', marginBottom:6}}>{k.label}</div>
              <div style={{fontSize:24, fontWeight:700, color:k.col}}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex', gap:4, marginBottom:16, background:'#131620', padding:4, borderRadius:10, border:'1px solid #252A3D'}}>
        {['profile','role','security'].map(t => (
          <button key={t} onClick={()=>setTab(t)}
            style={{flex:1, padding:'8px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
              background:tab===t?'#1A1D28':'transparent',
              color:tab===t?'#E8EAF6':'#5C6490'}}>
            {t==='profile'?'📋 Profil':t==='role'?'🔑 Rôles':'🔒 Sécurité'}
          </button>
        ))}
      </div>

      {/* Tab Profil */}
      {tab==='profile' && (
        <form onSubmit={saveProfile} style={card}>
          <div style={{fontSize:13, fontWeight:600, marginBottom:14}}>Modifier le profil</div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Nom complet</label>
            <input style={inp} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Votre nom"/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Email</label>
            <input style={inp} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="votre@email.com"/>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <button type="submit"
              style={{background:'#4F8FFF', color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontSize:13, fontWeight:600, cursor:'pointer'}}>
              Sauvegarder
            </button>
            {saved && <span style={{color:'#34D399', fontSize:13}}>✓ Profil mis à jour</span>}
          </div>
        </form>
      )}

      {/* Tab Rôles */}
      {tab==='role' && (
        <div style={card}>
          <div style={{fontSize:13, fontWeight:600, marginBottom:14}}>Système de rôles PREDYNEX</div>
          <div style={{display:'grid', gap:10}}>
            {Object.entries(ROLES).map(([key, r]) => (
              <div key={key} style={{background:'#1A1D28', borderRadius:8, padding:'12px 14px', border:`1px solid ${user?.role===key?r.color+'44':'#252A3D'}`, display:'flex', alignItems:'center', gap:12}}>
                <div style={{width:36, height:36, borderRadius:8, background:`rgba(${r.color==='#F87171'?'248,113,113':r.color==='#4F8FFF'?'79,143,255':'52,211,153'},.12)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16}}>
                  {key==='admin'?'👑':key==='manager'?'📋':key==='member'?'👥':'👁️'}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13, fontWeight:600, color:r.color}}>{r.label}</div>
                  <div style={{fontSize:11, color:'#5C6490', marginTop:2}}>{r.desc}</div>
                </div>
                {user?.role===key && (
                  <span style={{fontSize:10, background:`rgba(${r.color==='#F87171'?'248,113,113':'79,143,255'},.1)`, color:r.color, padding:'3px 8px', borderRadius:5, fontFamily:'monospace'}}>
                    VOTRE RÔLE
                  </span>
                )}
              </div>
            ))}
          </div>
          <div style={{marginTop:14, padding:'10px 14px', background:'rgba(79,143,255,.05)', borderRadius:8, border:'1px solid rgba(79,143,255,.12)', fontSize:12, color:'#9BA3C8'}}>
            ℹ️ Pour changer votre rôle, contactez un administrateur PREDYNEX.
          </div>
        </div>
      )}

      {/* Tab Sécurité */}
      {tab==='security' && (
        <div style={card}>
          <div style={{fontSize:13, fontWeight:600, marginBottom:14}}>Sécurité du compte</div>
          <div style={{background:'#1A1D28', borderRadius:8, padding:'14px', marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:4}}>Authentification JWT</div>
            <div style={{fontSize:11, color:'#5C6490', marginBottom:8}}>Votre session expire dans 7 jours. Reconnectez-vous pour renouveler.</div>
            <div style={{display:'flex', gap:8}}>
              <div style={{background:'rgba(52,211,153,.08)', border:'1px solid rgba(52,211,153,.15)', borderRadius:6, padding:'5px 10px', fontSize:11, color:'#34D399'}}>✓ Session active</div>
              <div style={{background:'rgba(79,143,255,.08)', border:'1px solid rgba(79,143,255,.15)', borderRadius:6, padding:'5px 10px', fontSize:11, color:'#4F8FFF'}}>🔒 Token JWT sécurisé</div>
            </div>
          </div>
          <div style={{background:'#1A1D28', borderRadius:8, padding:'14px'}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:4}}>Données personnelles</div>
            <div style={{fontSize:11, color:'#5C6490', marginBottom:8}}>Vos données sont stockées dans MongoDB Atlas avec chiffrement en transit.</div>
            <button onClick={handleLogout}
              style={{background:'rgba(248,113,113,.1)', color:'#F87171', border:'1px solid rgba(248,113,113,.2)', borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer'}}>
              ⏻ Se déconnecter de tous les appareils
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [projects, setProjects] = useState([]);
  const [risks, setRisks]       = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      API.get('/projects').catch(() => ({ data: [] })),
      API.get('/risks').catch(() => ({ data: [] }))
    ]).then(([pRes, rRes]) => {
      setProjects(pRes.data);
      setRisks(rRes.data);
      setLoading(false);
    });
  }, []);

  const activeProjects = projects.filter(p => p.status === 'active').length;
  const avgScore = projects.length
    ? (projects.reduce((a, p) => a + (p.aiScore || 0), 0) / projects.length).toFixed(1)
    : '0';
  const criticalRisks = risks.filter(r => r.severity === 'critical' && r.status === 'active').length;
  const successRate = projects.length
    ? Math.round(projects.filter(p => p.aiScore >= 7).length / projects.length * 100)
    : 0;

  const scoreColor = (s) => s >= 7 ? '#34D399' : s >= 5 ? '#F59E0B' : '#F87171';
  const card = { background:'#131620', border:'1px solid #252A3D', borderRadius:12, padding:'18px 20px' };

  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:'#9BA3C8' }}>Chargement...</div>
  );

  return (
    <div style={{ padding:24 }}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#E8EAF6' }}>
          Bonjour, {user?.name} 👋
        </h1>
        <p style={{ color:'#5C6490', fontSize:13, marginTop:4 }}>
          Tableau de bord ProAI — Vue globale de vos projets
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Projets actifs',    value: activeProjects,      color:'#4F8FFF' },
          { label:'Score IA moyen',    value: avgScore + '/10',    color: scoreColor(+avgScore) },
          { label:'Risques critiques', value: criticalRisks,       color:'#F87171' },
          { label:'Taux de succès',    value: successRate + '%',   color:'#34D399' },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ fontSize:11, color:'#5C6490', marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>{k.label}</div>
            <div style={{ fontSize:30, fontWeight:700, color:k.color, fontFamily:'monospace' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Projets récents */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16, marginBottom:16 }}>
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:600 }}>Projets récents</div>
            <button onClick={() => nav('/projects')}
              style={{ background:'#4F8FFF', color:'#fff', border:'none', borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              + Nouveau projet
            </button>
          </div>
          {projects.length === 0 ? (
            <div style={{ textAlign:'center', color:'#5C6490', padding:40 }}>
              Aucun projet — cliquez sur "+ Nouveau projet"
            </div>
          ) : (
            projects.slice(0, 6).map(p => (
              <div key={p._id} onClick={() => nav(`/projects/${p._id}`)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:'1px solid #252A3D', cursor:'pointer' }}>
                <div style={{ width:9, height:9, borderRadius:'50%', flexShrink:0, background: scoreColor(p.aiScore) }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:500, color:'#E8EAF6' }}>{p.name}</div>
                  <div style={{ fontSize:11, color:'#5C6490', marginTop:2 }}>
                    {p.methodology} · {p.progress}% · {p.teamSize} membres
                  </div>
                </div>
                <div style={{ textAlign:'center', minWidth:80 }}>
                  <div style={{ height:4, background:'#22263A', borderRadius:2, overflow:'hidden', marginBottom:3 }}>
                    <div style={{ height:'100%', width:p.progress+'%', background:'#4F8FFF', borderRadius:2 }} />
                  </div>
                  <div style={{ fontSize:10, color:'#5C6490' }}>{p.progress}%</div>
                </div>
                <div style={{ textAlign:'center', minWidth:48 }}>
                  <div style={{ fontSize:18, fontWeight:700, color: scoreColor(p.aiScore), fontFamily:'monospace' }}>{p.aiScore}</div>
                  <div style={{ fontSize:10, color:'#5C6490' }}>score</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Raccourcis */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[
            { icon:'🔬', label:'Analyse IA',          sub:'Analyser vos projets',      path:'/analysis',      col:'#4F8FFF' },
            { icon:'🔮', label:'Prévisions',           sub:'30 / 60 / 90 jours',        path:'/forecast',      col:'#A78BFA' },
            { icon:'⚠️', label:'Risques',              sub: criticalRisks + ' critique(s)', path:'/risks',    col:'#F87171' },
            { icon:'🎯', label:'Jalons',               sub:'Objectifs & milestones',    path:'/milestones',    col:'#34D399' },
            { icon:'📊', label:'Rapport hebdo',        sub:'Générer le rapport',        path:'/reports',       col:'#F59E0B' },
          ].map(item => (
            <div key={item.path} onClick={() => nav(item.path)}
              style={{ ...card, padding:'12px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:12, transition:'border-color .2s', border:`1px solid ${item.col}22` }}>
              <span style={{ fontSize:20 }}>{item.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#E8EAF6' }}>{item.label}</div>
                <div style={{ fontSize:11, color:'#5C6490', marginTop:1 }}>{item.sub}</div>
              </div>
              <span style={{ color:item.col, fontSize:14 }}>→</span>
            </div>
          ))}
        </div>
      </div>

      {/* Risques récents */}
      {risks.filter(r => r.status === 'active').length > 0 && (
        <div style={card}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>
            Risques actifs récents
            <span onClick={() => nav('/risks')} style={{ fontSize:12, color:'#4F8FFF', cursor:'pointer', marginLeft:10, fontWeight:400 }}>Voir tous →</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {risks.filter(r => r.status === 'active').slice(0, 3).map(r => (
              <div key={r._id} style={{ background:'#1A1D28', borderRadius:8, padding:12, borderLeft:`3px solid ${r.severity==='critical'?'#F87171':r.severity==='high'?'#F59E0B':'#4F8FFF'}` }}>
                <div style={{ fontSize:10, color: r.severity==='critical'?'#F87171':r.severity==='high'?'#F59E0B':'#4F8FFF', marginBottom:4, fontWeight:700 }}>
                  {r.severity?.toUpperCase()}
                </div>
                <div style={{ fontSize:12, fontWeight:500, color:'#E8EAF6' }}>{r.title}</div>
                <div style={{ fontSize:11, color:'#5C6490', marginTop:3 }}>{r.projectId?.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats globales */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginTop:16 }}>
        {[
          { label:'Total projets',   val: projects.length,       col:'#4F8FFF' },
          { label:'Livrés',          val: projects.filter(p=>p.status==='delivered').length, col:'#34D399' },
          { label:'En retard',       val: projects.filter(p=>p.status==='late').length,      col:'#F87171' },
          { label:'Risques actifs',  val: risks.filter(r=>r.status==='active').length,       col:'#F59E0B' },
        ].map(k => (
          <div key={k.label} style={{ ...card, textAlign:'center' }}>
            <div style={{ fontSize:10, color:'#5C6490', textTransform:'uppercase', marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:26, fontWeight:700, color:k.col, fontFamily:'monospace' }}>{k.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
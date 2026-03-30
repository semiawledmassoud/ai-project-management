import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

export default function Reports() {
  const nav = useNavigate();
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/reports/weekly').then(r => {
      setReport(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const downloadReport = () => {
    window.open('/api/reports/weekly/download', '_blank');
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ProAI_Report_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const scoreColor = (s) => s>=7?'#34D399':s>=5?'#F59E0B':'#F87171';
  const card = {background:'#131620', border:'1px solid #252A3D', borderRadius:12, padding:'16px 20px', marginBottom:16};

  if (loading) return <div style={{padding:40, textAlign:'center', color:'#5C6490'}}>Génération du rapport...</div>;
  if (!report)  return <div style={{padding:40, textAlign:'center', color:'#5C6490'}}>Erreur de chargement</div>;

  return (
    <div style={{padding:24}}>
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22, fontWeight:700}}>📊 Rapport hebdomadaire</h1>
          <p style={{color:'#5C6490', fontSize:13, marginTop:4}}>
            Semaine {report.weekNumber} · Généré le {new Date(report.generatedAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button onClick={exportJSON}
            style={{background:'rgba(79,143,255,.1)', color:'#4F8FFF', border:'1px solid rgba(79,143,255,.2)', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer'}}>
            📥 Export JSON
          </button>
          <button onClick={downloadReport}
            style={{background:'#4F8FFF', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer'}}>
            📄 Télécharger rapport
          </button>
        </div>
      </div>

      {/* Highlights */}
      {report.highlights?.length > 0 && (
        <div style={{...card, background:'rgba(79,143,255,.04)', border:'1px solid rgba(79,143,255,.15)'}}>
          <div style={{fontSize:13, fontWeight:600, marginBottom:10, color:'#4F8FFF'}}>Points clés de la semaine</div>
          {report.highlights.map((h,i) => (
            <div key={i} style={{display:'flex', gap:8, alignItems:'flex-start', marginBottom:6}}>
              <span style={{color:'#4F8FFF', flexShrink:0}}>→</span>
              <span style={{fontSize:12, color:'#9BA3C8'}}>{h}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPIs globaux */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16}}>
        {[
          {label:'Projets actifs', val:report.stats.activeProjects+' / '+report.stats.totalProjects, col:'#4F8FFF'},
          {label:'Score IA moyen', val:report.stats.avgScore+'/10', col:scoreColor(+report.stats.avgScore)},
          {label:'Risques critiques', val:report.stats.criticalRisks, col:'#F87171'},
          {label:'Taux de succès', val:report.stats.successRate+'%', col:'#34D399'},
        ].map(k => (
          <div key={k.label} style={{...card, marginBottom:0, textAlign:'center'}}>
            <div style={{fontSize:10, color:'#5C6490', textTransform:'uppercase', letterSpacing:.5, marginBottom:8}}>{k.label}</div>
            <div style={{fontSize:24, fontWeight:700, color:k.col}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Métriques supplémentaires */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16}}>
        {[
          {label:'Progression moyenne', val:report.stats.avgProgress+'%', col:'#4F8FFF'},
          {label:'Vélocité moyenne', val:report.stats.avgVelocity+' pts', col:'#A78BFA'},
          {label:'Risques élevés', val:report.stats.highRisks, col:'#F59E0B'},
        ].map(k => (
          <div key={k.label} style={{...card, marginBottom:0, textAlign:'center'}}>
            <div style={{fontSize:10, color:'#5C6490', textTransform:'uppercase', letterSpacing:.5, marginBottom:8}}>{k.label}</div>
            <div style={{fontSize:22, fontWeight:700, color:k.col}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* État des projets */}
      <div style={card}>
        <div style={{fontSize:13, fontWeight:600, marginBottom:14}}>État détaillé des projets</div>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
          <thead>
            <tr style={{background:'#1A1D28'}}>
              {['Projet','Score IA','Progression','Vélocité','Budget','Risques','Statut'].map(h => (
                <th key={h} style={{padding:'8px 12px', textAlign:'left', color:'#5C6490', fontWeight:500, fontSize:10, textTransform:'uppercase', letterSpacing:.5}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.projects?.map((p,i) => (
              <tr key={i} onClick={() => nav(`/projects/${p.id}`)}
                style={{borderBottom:'1px solid #252A3D', cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.background='#1A1D28'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{padding:'10px 12px', fontWeight:500}}>{p.name}</td>
                <td style={{padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:scoreColor(p.score)}}>{p.score}</td>
                <td style={{padding:'10px 12px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <div style={{width:60, height:4, background:'#22263A', borderRadius:2, overflow:'hidden'}}>
                      <div style={{height:'100%', width:p.progress+'%', background:'#4F8FFF', borderRadius:2}}/>
                    </div>
                    <span style={{color:'#9BA3C8'}}>{p.progress}%</span>
                  </div>
                </td>
                <td style={{padding:'10px 12px', color:'#A78BFA', fontFamily:'monospace'}}>{p.velocity} pts</td>
                <td style={{padding:'10px 12px', color:p.budgetRatio>85?'#F87171':'#F59E0B', fontFamily:'monospace'}}>{p.budgetRatio}%</td>
                <td style={{padding:'10px 12px', color:p.risks>0?'#F87171':'#34D399', fontFamily:'monospace'}}>{p.risks}</td>
                <td style={{padding:'10px 12px'}}>
                  <span style={{fontSize:10, background:p.scoreStatus==='bon'?'rgba(52,211,153,.1)':p.scoreStatus==='moyen'?'rgba(245,158,11,.1)':'rgba(248,113,113,.1)', color:p.scoreStatus==='bon'?'#34D399':p.scoreStatus==='moyen'?'#F59E0B':'#F87171', padding:'2px 8px', borderRadius:5, fontWeight:600}}>
                    {p.scoreStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top risques critiques */}
      {report.topRisks?.length > 0 && (
        <div style={card}>
          <div style={{fontSize:13, fontWeight:600, marginBottom:14}}>Risques critiques de la semaine</div>
          {report.topRisks.map((r,i) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #252A3D'}}>
              <div style={{width:8, height:8, borderRadius:'50%', background:'#F87171', flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13, fontWeight:500}}>{r.title}</div>
                <div style={{fontSize:11, color:'#5C6490', marginTop:2}}>📁 {r.project}</div>
              </div>
              <span style={{fontSize:12, fontFamily:'monospace', color:'#F87171', fontWeight:700}}>{r.probability}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Période */}
      <div style={{...card, background:'rgba(79,143,255,.04)', border:'1px solid rgba(79,143,255,.1)', textAlign:'center'}}>
        <div style={{fontSize:11, color:'#5C6490'}}>
          Période analysée : {new Date(report.period.from).toLocaleDateString('fr-FR')} → {new Date(report.period.to).toLocaleDateString('fr-FR')}
          {' · '}Rapport généré automatiquement par ProAI v2.0
        </div>
      </div>
    </div>
  );
}
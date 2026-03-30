import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

const COLORS = { critical:'#F87171', high:'#F59E0B', medium:'#4F8FFF', low:'#34D399' };
const LABELS = { critical:'Critique', high:'Élevé', medium:'Modéré', low:'Faible' };
const CATS   = { planning:'Planification', budget:'Budget', hr:'RH / Équipe', technical:'Technique', global:'Global' };

export default function Risks() {
  const nav = useNavigate();
  const [risks, setRisks]       = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('active');
  const [filterSev, setFilterSev] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch]     = useState('');
  const [sortBy, setSortBy]     = useState('probability');
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({
    projectId:'', title:'', description:'',
    severity:'medium', probability:50, category:'planning',
    owner:'', dueDate:'', mitigationSteps:''
  });

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, pRes] = await Promise.all([API.get('/risks'), API.get('/projects')]);
      setRisks(rRes.data);
      setProjects(pRes.data);
      if (pRes.data.length > 0) setForm(f => ({...f, projectId: pRes.data[0]._id}));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id) => {
    await API.put(`/risks/${id}/resolve`);
    setRisks(risks.map(r => r._id === id ? {...r, status:'resolved'} : r));
  };
  const ignore = async (id) => {
    await API.put(`/risks/${id}/ignore`);
    setRisks(risks.map(r => r._id === id ? {...r, status:'ignored'} : r));
  };
  const del = async (id) => {
    if (!window.confirm('Supprimer ce risque ?')) return;
    await API.delete(`/risks/${id}`);
    setRisks(risks.filter(r => r._id !== id));
  };
  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/risks', {
        ...form,
        actions: form.mitigationSteps ? form.mitigationSteps.split('\n').filter(Boolean) : []
      });
      setRisks([res.data, ...risks]);
      setShowForm(false);
      setForm({projectId: projects[0]?._id||'', title:'', description:'', severity:'medium', probability:50, category:'planning', owner:'', dueDate:'', mitigationSteps:''});
    } catch (err) { alert(err.response?.data?.message || err.message); }
  };

  const exportCSV = () => {
    const h = 'Titre,Sévérité,Probabilité,Catégorie,Statut,Projet,Responsable,Date limite\n';
    const rows = filtered.map(r =>
      `"${r.title}","${LABELS[r.severity]}","${r.probability}%","${CATS[r.category]||r.category}","${r.status}","${r.projectId?.name||''}","${r.owner||''}","${r.dueDate||''}"`
    ).join('\n');
    const blob = new Blob([h+rows], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;
    a.download=`ProAI_Risques_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Score global 0-100
  const riskScore = () => {
    const active = risks.filter(r => r.status==='active');
    if (!active.length) return 0;
    const w = {critical:4, high:3, medium:2, low:1};
    const total = active.reduce((s,r) => s + (w[r.severity]||1)*(r.probability/100), 0);
    return Math.round((total / (active.length * 4)) * 100);
  };

  const filtered = risks
    .filter(r => {
      const mS = filter==='all' || r.status===filter;
      const mSev = filterSev==='all' || r.severity===filterSev;
      const mCat = filterCat==='all' || r.category===filterCat;
      const mQ = search==='' || r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.projectId?.name||'').toLowerCase().includes(search.toLowerCase()) ||
        (r.owner||'').toLowerCase().includes(search.toLowerCase());
      return mS && mSev && mCat && mQ;
    })
    .sort((a,b) => {
      if (sortBy==='probability') return b.probability - a.probability;
      if (sortBy==='severity') { const w={critical:4,high:3,medium:2,low:1}; return (w[b.severity]||0)-(w[a.severity]||0); }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const countBy  = (s) => risks.filter(r => r.severity===s && r.status==='active').length;
  const activeN  = risks.filter(r => r.status==='active').length;
  const resolvedN= risks.filter(r => r.status==='resolved').length;
  const score    = riskScore();
  const scoreCol = score>=70?'#F87171':score>=40?'#F59E0B':'#34D399';

  const inp  = {width:'100%', background:'#1A1D28', border:'1px solid #252A3D', borderRadius:8, padding:'9px 12px', color:'#E8EAF6', fontSize:13, outline:'none'};
  const card = {background:'#131620', border:'1px solid #252A3D', borderRadius:12, padding:'16px 20px', marginBottom:12};

  // ── Matrice 4×5 ────────────────────────────────────────────────────────────
  const MatrixView = () => {
    const active = risks.filter(r => r.status==='active');
    const cells = {};
    active.forEach(r => {
      const si = {critical:4,high:3,medium:2,low:1}[r.severity]||2;
      const pi = Math.min(5, Math.ceil(r.probability/20));
      const k = `${pi}-${si}`;
      if (!cells[k]) cells[k]=[];
      cells[k].push(r);
    });
    const bg = (p,s) => {
      const v=p*s;
      if(v>=16) return 'rgba(248,113,113,.2)';
      if(v>=9)  return 'rgba(245,158,11,.15)';
      if(v>=4)  return 'rgba(79,143,255,.1)';
      return 'rgba(52,211,153,.06)';
    };
    return (
      <div style={card}>
        <div style={{fontSize:13, fontWeight:600, marginBottom:14}}>Matrice Probabilité × Impact</div>
        <div style={{display:'flex', gap:4}}>
          <div style={{display:'flex', flexDirection:'column', gap:4, marginTop:18}}>
            {[5,4,3,2,1].map(p=>(
              <div key={p} style={{height:44, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:5, fontSize:10, color:'#5C6490', minWidth:28}}>{p*20}%</div>
            ))}
          </div>
          <div style={{flex:1}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:3, marginBottom:3}}>
              {['Faible','Moyen','Élevé','Critique'].map(l=>(
                <div key={l} style={{textAlign:'center', fontSize:9, color:'#5C6490'}}>{l}</div>
              ))}
            </div>
            {[5,4,3,2,1].map(prob=>(
              <div key={prob} style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:3, marginBottom:3}}>
                {[1,2,3,4].map(sev=>{
                  const k=`${prob}-${sev}`;
                  const cr=cells[k]||[];
                  return (
                    <div key={sev} style={{height:44, borderRadius:6, background:bg(prob,sev), border:'1px solid #252A3D', display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap', gap:2, padding:3}}>
                      {cr.slice(0,4).map((r,i)=>(
                        <div key={i} title={r.title} onClick={()=>nav(`/projects/${r.projectId?._id||r.projectId}`)}
                          style={{width:16,height:16,borderRadius:'50%',background:COLORS[r.severity],display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'#0D0F14',cursor:'pointer'}}>
                          {i+1}
                        </div>
                      ))}
                      {cr.length>4&&<div style={{fontSize:9,color:'#5C6490'}}>+{cr.length-4}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{textAlign:'center', fontSize:9, color:'#5C6490', marginTop:4}}>Impact →</div>
          </div>
        </div>
        {active.length>0&&(
          <div style={{display:'flex', gap:6, marginTop:10, flexWrap:'wrap'}}>
            {active.slice(0,6).map((r,i)=>(
              <div key={i} style={{display:'flex', alignItems:'center', gap:4, fontSize:11}}>
                <div style={{width:13,height:13,borderRadius:'50%',background:COLORS[r.severity],display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'#0D0F14'}}>{i+1}</div>
                <span style={{color:'#9BA3C8'}}>{r.title.slice(0,18)}...</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Graphique évolution ─────────────────────────────────────────────────────
  const TrendChart = () => {
    const weeks = ['S-4','S-3','S-2','S-1','Auj.'];
    const data = weeks.map((_,i)=>({
      week: weeks[i],
      active:   Math.max(0, activeN + (4-i)*2 - i),
      resolved: Math.max(0, resolvedN - (4-i)),
    }));
    const maxVal = Math.max(...data.map(d=>d.active+d.resolved), 6);
    return (
      <div style={card}>
        <div style={{fontSize:13, fontWeight:600, marginBottom:14}}>Évolution temporelle</div>
        <div style={{display:'flex', alignItems:'flex-end', gap:6, height:110}}>
          {data.map((d,i)=>(
            <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2}}>
              <div style={{width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:88}}>
                <div title={`Actifs: ${d.active}`} style={{flex:1,borderRadius:'3px 3px 0 0',background:'rgba(248,113,113,.7)',height:((d.active/maxVal)*88)+'px',minHeight:2,transition:'height .5s'}}/>
                <div title={`Résolus: ${d.resolved}`} style={{flex:1,borderRadius:'3px 3px 0 0',background:'rgba(52,211,153,.6)',height:((d.resolved/maxVal)*88)+'px',minHeight:2,transition:'height .5s'}}/>
              </div>
              <div style={{fontSize:9, color:'#5C6490'}}>{d.week}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex', gap:14, marginTop:8}}>
          <div style={{display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#9BA3C8'}}>
            <div style={{width:10,height:10,borderRadius:2,background:'rgba(248,113,113,.7)'}}/> Actifs
          </div>
          <div style={{display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#9BA3C8'}}>
            <div style={{width:10,height:10,borderRadius:2,background:'rgba(52,211,153,.6)'}}/> Résolus
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{padding:24}}>
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22, fontWeight:700}}>⚠️ Gestion des risques</h1>
          <p style={{color:'#5C6490', fontSize:13, marginTop:4}}>
            {activeN} actif(s) · {resolvedN} résolu(s) · Détection IA automatique
          </p>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button onClick={exportCSV}
            style={{background:'rgba(167,139,250,.1)', color:'#A78BFA', border:'1px solid rgba(167,139,250,.2)', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer'}}>
            📥 Export CSV
          </button>
          <button onClick={()=>setShowForm(!showForm)}
            style={{background:'#F87171', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer'}}>
            {showForm ? '✕ Annuler' : '+ Nouveau risque'}
          </button>
        </div>
      </div>

      {/* Score global + KPIs */}
      <div style={{display:'grid', gridTemplateColumns:'180px 1fr', gap:14, marginBottom:20}}>
        <div style={{...card, marginBottom:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'16px 12px'}}>
          <div style={{fontSize:10, color:'#5C6490', marginBottom:8, textTransform:'uppercase', letterSpacing:.5, textAlign:'center'}}>Score de risque global</div>
          <div style={{position:'relative', width:84, height:84, marginBottom:8}}>
            <svg width="84" height="84" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="33" fill="none" stroke="#22263A" strokeWidth="9"/>
              <circle cx="42" cy="42" r="33" fill="none" stroke={scoreCol} strokeWidth="9"
                strokeDasharray={`${score*2.07} 207`} strokeDashoffset="-51.8" strokeLinecap="round"/>
            </svg>
            <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center'}}>
              <div style={{fontSize:18, fontWeight:700, color:scoreCol, fontFamily:'monospace'}}>{score}</div>
              <div style={{fontSize:9, color:'#5C6490'}}>/100</div>
            </div>
          </div>
          <div style={{fontSize:11, color:scoreCol, fontWeight:600, textAlign:'center'}}>
            {score>=70?'🔴 Critique':score>=40?'🟡 Modéré':'🟢 Faible'}
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10}}>
          {['critical','high','medium','low'].map(s=>(
            <div key={s} onClick={()=>setFilterSev(filterSev===s?'all':s)}
              style={{...card, marginBottom:0, cursor:'pointer', border:`1px solid ${filterSev===s?COLORS[s]:'#252A3D'}`, transition:'border-color .2s', textAlign:'center'}}>
              <div style={{fontSize:10, color:COLORS[s], textTransform:'uppercase', letterSpacing:.5, marginBottom:6}}>{LABELS[s]}</div>
              <div style={{fontSize:30, fontWeight:700, color:COLORS[s]}}>{countBy(s)}</div>
              <div style={{fontSize:10, color:'#5C6490', marginTop:2}}>actif(s)</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerte critiques */}
      {countBy('critical')>0 && (
        <div style={{background:'rgba(248,113,113,.06)', border:'1px solid rgba(248,113,113,.2)', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:12}}>
          <span style={{fontSize:18}}>🚨</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13, fontWeight:600, color:'#F87171'}}>{countBy('critical')} risque(s) critique(s) — action immédiate requise</div>
            <div style={{fontSize:11, color:'#9BA3C8', marginTop:2}}>Consultez les recommandations IA pour les actions prioritaires</div>
          </div>
          <button onClick={()=>nav('/recommendations')}
            style={{background:'#F87171', color:'#fff', border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer'}}>
            Recommandations →
          </button>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <form onSubmit={submit} style={{...card, marginBottom:16}}>
          <div style={{fontSize:14, fontWeight:600, marginBottom:14}}>Nouveau risque</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Projet *</label>
              <select style={inp} value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})} required>
                {projects.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}
              </select></div>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Sévérité</label>
              <select style={{...inp, color:COLORS[form.severity]}} value={form.severity} onChange={e=>setForm({...form,severity:e.target.value})}>
                {Object.entries(LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Catégorie</label>
              <select style={inp} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
                {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Probabilité : {form.probability}%</label>
              <input type="range" min="0" max="100" step="1" value={form.probability}
                onChange={e=>setForm({...form,probability:+e.target.value})} style={{width:'100%', marginTop:8}}/></div>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Responsable</label>
              <input style={inp} value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})} placeholder="Nom du responsable"/></div>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Date limite</label>
              <input style={inp} type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></div>
          </div>
          <div style={{marginBottom:10}}><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Titre *</label>
            <input style={inp} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required placeholder="Ex: Dépassement budgétaire"/></div>
          <div style={{marginBottom:10}}><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Description</label>
            <textarea style={{...inp, resize:'vertical', minHeight:60}} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Décrivez le risque..."/></div>
          <div style={{marginBottom:14}}><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Plan de mitigation (une étape par ligne)</label>
            <textarea style={{...inp, resize:'vertical', minHeight:60}} value={form.mitigationSteps} onChange={e=>setForm({...form,mitigationSteps:e.target.value})} placeholder={"Étape 1\nÉtape 2\nÉtape 3"}/></div>
          <button type="submit" style={{background:'#F87171', color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontSize:13, fontWeight:600, cursor:'pointer'}}>
            ⚠️ Ajouter le risque
          </button>
        </form>
      )}

      {/* Graphiques */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20}}>
        <MatrixView/>
        <TrendChart/>
      </div>

      {/* Filtres */}
      <div style={{display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center'}}>
        <div style={{position:'relative', flex:1, minWidth:180}}>
          <span style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#5C6490', fontSize:14}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher risque, projet, responsable..."
            style={{...inp, paddingLeft:32}}/>
        </div>
        {['all','active','resolved','ignored'].map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{padding:'7px 12px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid', transition:'all .15s',
              background:filter===s?'rgba(79,143,255,.15)':'transparent',
              borderColor:filter===s?'#4F8FFF':'#252A3D',
              color:filter===s?'#4F8FFF':'#5C6490'}}>
            {s==='all'?`Tous (${risks.length})`:s==='active'?`Actifs (${activeN})`:s==='resolved'?`Résolus (${resolvedN})`:'Ignorés'}
          </button>
        ))}
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
          style={{background:'#131620', border:'1px solid #252A3D', borderRadius:8, color:'#9BA3C8', padding:'7px 10px', fontSize:12, cursor:'pointer', outline:'none'}}>
          <option value="all">Toutes catégories</option>
          {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
          style={{background:'#131620', border:'1px solid #252A3D', borderRadius:8, color:'#9BA3C8', padding:'7px 10px', fontSize:12, cursor:'pointer', outline:'none'}}>
          <option value="probability">Trier: Probabilité</option>
          <option value="severity">Trier: Sévérité</option>
          <option value="date">Trier: Date</option>
        </select>
        <div style={{fontSize:11, color:'#5C6490', marginLeft:'auto'}}>{filtered.length} résultat(s)</div>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{textAlign:'center', color:'#5C6490', padding:60}}>Chargement...</div>
      ) : filtered.length===0 ? (
        <div style={{textAlign:'center', color:'#5C6490', padding:60, background:'#131620', borderRadius:12, border:'1px dashed #252A3D'}}>
          {risks.length===0 ? "Aucun risque — créez des projets pour l'analyse IA automatique" : 'Aucun résultat pour ces filtres'}
        </div>
      ) : (
        <div style={{display:'grid', gap:10}}>
          {filtered.map(r=>{
            const isExp = expandedId===r._id;
            const due   = r.dueDate ? new Date(r.dueDate) : null;
            const overdue = due && due < new Date() && r.status==='active';
            return (
              <div key={r._id} style={{background:'#131620', border:`1px solid ${r.status==='active'?COLORS[r.severity]+'33':'#252A3D'}`, borderRadius:12, overflow:'hidden', opacity:r.status==='resolved'?0.65:1}}>
                <div style={{padding:'14px 18px', display:'flex', alignItems:'flex-start', gap:14}}>
                  <div style={{width:10, height:10, borderRadius:'50%', background:r.status==='resolved'?'#34D399':COLORS[r.severity], flexShrink:0, marginTop:4}}/>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:5, flexWrap:'wrap'}}>
                      <span style={{fontSize:10, fontFamily:'monospace', fontWeight:700,
                        background:`rgba(${r.severity==='critical'?'248,113,113':r.severity==='high'?'245,158,11':r.severity==='medium'?'79,143,255':'52,211,153'},.12)`,
                        color:COLORS[r.severity], padding:'2px 8px', borderRadius:5}}>
                        {(LABELS[r.severity]||r.severity).toUpperCase()}
                      </span>
                      {r.aiDetected && <span style={{fontSize:10, background:'rgba(167,139,250,.1)', color:'#A78BFA', padding:'2px 7px', borderRadius:5, fontFamily:'monospace'}}>◈ IA</span>}
                      <span style={{fontSize:10, background:'#1A1D28', color:'#5C6490', padding:'2px 7px', borderRadius:5}}>{CATS[r.category]||r.category}</span>
                      {r.status==='resolved' && <span style={{fontSize:10, background:'rgba(52,211,153,.1)', color:'#34D399', padding:'2px 7px', borderRadius:5}}>✓ Résolu</span>}
                      {r.status==='ignored'  && <span style={{fontSize:10, background:'rgba(92,100,144,.1)', color:'#5C6490', padding:'2px 7px', borderRadius:5}}>Ignoré</span>}
                      {overdue && <span style={{fontSize:10, background:'rgba(248,113,113,.1)', color:'#F87171', padding:'2px 7px', borderRadius:5}}>⏰ En retard</span>}
                    </div>
                    <div style={{fontSize:14, fontWeight:600, marginBottom:4, cursor:'pointer'}} onClick={()=>setExpandedId(isExp?null:r._id)}>
                      {r.title} <span style={{fontSize:11, color:'#5C6490'}}>{isExp?'▲':'▼'}</span>
                    </div>
                    <div style={{display:'flex', gap:14, fontSize:11, color:'#5C6490', flexWrap:'wrap'}}>
                      <span>Prob: <span style={{color:COLORS[r.severity], fontWeight:600}}>{r.probability}%</span></span>
                      {r.owner && <span>👤 {r.owner}</span>}
                      {r.dueDate && <span style={{color:overdue?'#F87171':'#5C6490'}}>📅 {new Date(r.dueDate).toLocaleDateString('fr-FR')}</span>}
                      {r.projectId?.name && (
                        <span onClick={()=>nav(`/projects/${r.projectId._id||r.projectId}`)}
                          style={{color:'#4F8FFF', cursor:'pointer', textDecoration:'underline'}}>
                          📁 {r.projectId.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:5, flexShrink:0}}>
                    {r.status==='active' && <>
                      <button onClick={()=>resolve(r._id)} style={{background:'rgba(52,211,153,.1)', border:'1px solid rgba(52,211,153,.2)', color:'#34D399', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap'}}>✓ Résoudre</button>
                      <button onClick={()=>ignore(r._id)}  style={{background:'transparent', border:'1px solid #252A3D', color:'#5C6490', borderRadius:6, padding:'5px 10px', fontSize:11, cursor:'pointer'}}>Ignorer</button>
                    </>}
                    <button onClick={()=>del(r._id)} style={{background:'transparent', border:'none', color:'#5C6490', cursor:'pointer', fontSize:13, padding:'4px'}}>🗑</button>
                  </div>
                </div>
                {isExp && (
                  <div style={{padding:'0 18px 14px 42px', borderTop:'1px solid #1A1D28'}}>
                    {r.description && <div style={{fontSize:12, color:'#9BA3C8', lineHeight:1.5, marginTop:10, marginBottom:8}}>{r.description}</div>}
                    {r.actions && r.actions.length>0 && (
                      <div style={{background:'#1A1D28', borderRadius:8, padding:'10px 12px', marginBottom:8}}>
                        <div style={{fontSize:10, color:'#5C6490', textTransform:'uppercase', letterSpacing:.5, marginBottom:6}}>Plan de mitigation</div>
                        {r.actions.map((a,i)=>(
                          <div key={i} style={{display:'flex', alignItems:'flex-start', gap:8, marginTop:5}}>
                            <div style={{width:14, height:14, borderRadius:3, border:'1px solid #252A3D', flexShrink:0, marginTop:2}}/>
                            <div style={{fontSize:12, color:'#9BA3C8'}}>{a}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={()=>nav(`/projects/${r.projectId?._id||r.projectId}`)}
                      style={{background:'rgba(79,143,255,.08)', color:'#4F8FFF', border:'1px solid rgba(79,143,255,.15)', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:600, cursor:'pointer'}}>
                      Voir le projet →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {risks.length===0 && !loading && (
        <div style={{textAlign:'center', marginTop:16}}>
          <button onClick={()=>nav('/projects')}
            style={{background:'#4F8FFF', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:600, cursor:'pointer'}}>
            Créer un projet pour lancer l'analyse IA →
          </button>
        </div>
      )}
    </div>
  );
}
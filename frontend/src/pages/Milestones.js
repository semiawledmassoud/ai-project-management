import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

const STATUS_CONFIG = {
  pending:    { label:'En attente',  color:'#5C6490', bg:'rgba(92,100,144,.1)' },
  inprogress: { label:'En cours',    color:'#4F8FFF', bg:'rgba(79,143,255,.1)' },
  completed:  { label:'Complété ✓',  color:'#34D399', bg:'rgba(52,211,153,.1)' },
  overdue:    { label:'En retard ⏰', color:'#F87171', bg:'rgba(248,113,113,.1)' },
};
const PRIORITY_COLORS = { critical:'#F87171', high:'#F59E0B', medium:'#4F8FFF', low:'#34D399' };

export default function Milestones() {
  const nav = useNavigate();
  const [milestones, setMilestones] = useState([]);
  const [projects, setProjects]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [filter, setFilter]         = useState('all');
  const [form, setForm] = useState({
    projectId:'', title:'', description:'',
    dueDate:'', targetScore:7, targetProgress:80, priority:'medium'
  });

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, pRes] = await Promise.all([API.get('/milestones'), API.get('/projects')]);
      // Auto-update overdue
      const now = new Date();
      const updated = mRes.data.map(m => ({
        ...m,
        status: m.status !== 'completed' && new Date(m.dueDate) < now ? 'overdue' : m.status
      }));
      setMilestones(updated);
      setProjects(pRes.data);
      if (pRes.data.length > 0) setForm(f => ({...f, projectId: pRes.data[0]._id}));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/milestones', {...form, status:'pending'});
      setMilestones([...milestones, res.data]);
      setShowForm(false);
      setForm({projectId:projects[0]?._id||'', title:'', description:'', dueDate:'', targetScore:7, targetProgress:80, priority:'medium'});
    } catch (err) { alert(err.response?.data?.message || err.message); }
  };

  const complete = async (id) => {
    await API.put(`/milestones/${id}/complete`);
    setMilestones(milestones.map(m => m._id===id ? {...m,status:'completed',completedAt:new Date()} : m));
  };

  const del = async (id) => {
    if (!window.confirm('Supprimer ce jalon ?')) return;
    await API.delete(`/milestones/${id}`);
    setMilestones(milestones.filter(m => m._id!==id));
  };

  const filtered = milestones.filter(m => filter==='all' || m.status===filter);

  const completed  = milestones.filter(m => m.status==='completed').length;
  const overdue    = milestones.filter(m => m.status==='overdue').length;
  const inprogress = milestones.filter(m => m.status==='inprogress').length;
  const pending    = milestones.filter(m => m.status==='pending').length;

  const daysUntil = (date) => {
    const d = Math.ceil((new Date(date) - Date.now()) / (1000*60*60*24));
    if (d < 0) return `${Math.abs(d)}j de retard`;
    if (d === 0) return "Aujourd'hui";
    return `Dans ${d}j`;
  };

  const inp = {width:'100%', background:'#1A1D28', border:'1px solid #252A3D', borderRadius:8, padding:'9px 12px', color:'#E8EAF6', fontSize:13, outline:'none'};
  const card = {background:'#131620', border:'1px solid #252A3D', borderRadius:12, padding:'16px 20px', marginBottom:12};

  // Progression globale jalons
  const globalProgress = milestones.length ? Math.round(completed/milestones.length*100) : 0;

  return (
    <div style={{padding:24}}>
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22, fontWeight:700}}>🎯 Jalons & Objectifs</h1>
          <p style={{color:'#5C6490', fontSize:13, marginTop:4}}>
            {milestones.length} jalon(s) · {completed} complété(s) · {overdue} en retard
          </p>
        </div>
        <button onClick={()=>setShowForm(!showForm)}
          style={{background:'#4F8FFF', color:'#fff', border:'none', borderRadius:8, padding:'9px 18px', fontSize:13, fontWeight:600, cursor:'pointer'}}>
          {showForm ? '✕ Annuler' : '+ Nouveau jalon'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{display:'grid', gridTemplateColumns:'1fr repeat(4,auto)', gap:12, marginBottom:20, alignItems:'center'}}>
        <div style={{...card, marginBottom:0}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
            <div style={{fontSize:12, fontWeight:600}}>Progression globale</div>
            <div style={{fontSize:18, fontWeight:700, color:'#34D399', fontFamily:'monospace'}}>{globalProgress}%</div>
          </div>
          <div style={{height:8, background:'#22263A', borderRadius:4, overflow:'hidden'}}>
            <div style={{height:'100%', width:globalProgress+'%', background:'#34D399', borderRadius:4, transition:'width .5s'}}/>
          </div>
        </div>
        {[
          {label:'Complétés', val:completed, col:'#34D399'},
          {label:'En cours', val:inprogress, col:'#4F8FFF'},
          {label:'En attente', val:pending, col:'#5C6490'},
          {label:'En retard', val:overdue, col:'#F87171'},
        ].map(k => (
          <div key={k.label} style={{...card, marginBottom:0, textAlign:'center', minWidth:90}}>
            <div style={{fontSize:9, color:'#5C6490', textTransform:'uppercase', marginBottom:5}}>{k.label}</div>
            <div style={{fontSize:24, fontWeight:700, color:k.col}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Formulaire */}
      {showForm && (
        <form onSubmit={submit} style={{...card, marginBottom:16}}>
          <div style={{fontSize:14, fontWeight:600, marginBottom:14}}>Nouveau jalon</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Projet *</label>
              <select style={inp} value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})} required>
                {projects.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}
              </select></div>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Priorité</label>
              <select style={{...inp, color:PRIORITY_COLORS[form.priority]}} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
                {Object.entries(PRIORITY_COLORS).map(([k])=><option key={k} value={k}>{k}</option>)}
              </select></div>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Titre *</label>
              <input style={inp} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required placeholder="Ex: Livraison MVP"/></div>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Date limite *</label>
              <input style={inp} type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} required/></div>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Score IA cible : {form.targetScore}/10</label>
              <input type="range" min="1" max="10" step="0.5" value={form.targetScore}
                onChange={e=>setForm({...form,targetScore:+e.target.value})} style={{width:'100%', marginTop:8}}/></div>
            <div><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Progression cible : {form.targetProgress}%</label>
              <input type="range" min="0" max="100" step="5" value={form.targetProgress}
                onChange={e=>setForm({...form,targetProgress:+e.target.value})} style={{width:'100%', marginTop:8}}/></div>
          </div>
          <div style={{marginBottom:12}}><label style={{fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4}}>Description</label>
            <textarea style={{...inp, resize:'vertical', minHeight:60}} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Décrivez l'objectif..."/></div>
          <button type="submit" style={{background:'#4F8FFF', color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontSize:13, fontWeight:600, cursor:'pointer'}}>
            🎯 Créer le jalon
          </button>
        </form>
      )}

      {/* Filtres */}
      <div style={{display:'flex', gap:6, marginBottom:16, flexWrap:'wrap'}}>
        {['all','pending','inprogress','completed','overdue'].map(s => (
          <button key={s} onClick={()=>setFilter(s)}
            style={{padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid', transition:'all .15s',
              background: filter===s ? 'rgba(79,143,255,.15)' : 'transparent',
              borderColor: filter===s ? '#4F8FFF' : '#252A3D',
              color: filter===s ? '#4F8FFF' : '#5C6490'}}>
            {s==='all'?`Tous (${milestones.length})`:STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      {/* Liste jalons */}
      {loading ? (
        <div style={{textAlign:'center', color:'#5C6490', padding:60}}>Chargement...</div>
      ) : filtered.length===0 ? (
        <div style={{textAlign:'center', color:'#5C6490', padding:60, background:'#131620', borderRadius:12, border:'1px dashed #252A3D'}}>
          Aucun jalon — créez votre premier objectif
        </div>
      ) : (
        <div style={{display:'grid', gap:10}}>
          {filtered.map(m => {
            const sc    = STATUS_CONFIG[m.status] || STATUS_CONFIG.pending;
            const proj  = projects.find(p => p._id===m.projectId?._id || p._id===m.projectId);
            const scoreOk  = proj && proj.aiScore >= m.targetScore;
            const progOk   = proj && proj.progress >= m.targetProgress;
            const daysStr  = m.dueDate ? daysUntil(m.dueDate) : '';
            const isOverdue= m.status === 'overdue';
            return (
              <div key={m._id} style={{background:'#131620', border:`1px solid ${isOverdue?'rgba(248,113,113,.2)':m.status==='completed'?'rgba(52,211,153,.15)':'#252A3D'}`, borderRadius:12, padding:'16px 20px'}}>
                <div style={{display:'flex', alignItems:'flex-start', gap:12}}>
                  <div style={{fontSize:22, flexShrink:0}}>
                    {m.status==='completed'?'✅':m.status==='overdue'?'⏰':m.priority==='critical'?'🔴':'🎯'}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', gap:6, marginBottom:6, flexWrap:'wrap'}}>
                      <span style={{fontSize:10, background:sc.bg, color:sc.color, padding:'2px 8px', borderRadius:5, fontWeight:600}}>{sc.label}</span>
                      <span style={{fontSize:10, background:`rgba(${PRIORITY_COLORS[m.priority]==='#F87171'?'248,113,113':m.priority==='high'?'245,158,11':'79,143,255'},.1)`, color:PRIORITY_COLORS[m.priority]||'#4F8FFF', padding:'2px 7px', borderRadius:5}}>{m.priority}</span>
                      {m.projectId?.name && <span style={{fontSize:10, background:'#1A1D28', color:'#5C6490', padding:'2px 7px', borderRadius:5}}>📁 {m.projectId.name}</span>}
                    </div>
                    <div style={{fontSize:15, fontWeight:600, marginBottom:4}}>{m.title}</div>
                    {m.description && <div style={{fontSize:12, color:'#9BA3C8', marginBottom:8}}>{m.description}</div>}

                    {/* Objectifs */}
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10}}>
                      <div style={{background:'#1A1D28', borderRadius:7, padding:'8px 12px'}}>
                        <div style={{fontSize:10, color:'#5C6490', marginBottom:4}}>Score IA cible</div>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <div style={{height:4, flex:1, background:'#22263A', borderRadius:2, overflow:'hidden', marginRight:8}}>
                            <div style={{height:'100%', width:((proj?.aiScore||0)/10*100)+'%', background:scoreOk?'#34D399':'#F59E0B', borderRadius:2}}/>
                          </div>
                          <span style={{fontSize:12, fontFamily:'monospace', color:scoreOk?'#34D399':'#F59E0B', whiteSpace:'nowrap'}}>
                            {proj?.aiScore||0} / {m.targetScore} {scoreOk?'✓':''}
                          </span>
                        </div>
                      </div>
                      <div style={{background:'#1A1D28', borderRadius:7, padding:'8px 12px'}}>
                        <div style={{fontSize:10, color:'#5C6490', marginBottom:4}}>Progression cible</div>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <div style={{height:4, flex:1, background:'#22263A', borderRadius:2, overflow:'hidden', marginRight:8}}>
                            <div style={{height:'100%', width:((proj?.progress||0)/100*100)+'%', background:progOk?'#34D399':'#4F8FFF', borderRadius:2}}/>
                          </div>
                          <span style={{fontSize:12, fontFamily:'monospace', color:progOk?'#34D399':'#4F8FFF', whiteSpace:'nowrap'}}>
                            {proj?.progress||0}% / {m.targetProgress}% {progOk?'✓':''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{display:'flex', gap:12, fontSize:11, color:'#5C6490'}}>
                      {m.dueDate && <span style={{color:isOverdue?'#F87171':'#5C6490'}}>📅 {daysStr}</span>}
                      {scoreOk && progOk && m.status!=='completed' && (
                        <span style={{color:'#34D399', fontWeight:600}}>🎉 Objectifs atteints — prêt à compléter !</span>
                      )}
                    </div>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:5, flexShrink:0}}>
                    {m.status!=='completed' && (
                      <button onClick={()=>complete(m._id)}
                        style={{background:'rgba(52,211,153,.1)', color:'#34D399', border:'1px solid rgba(52,211,153,.2)', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap'}}>
                        ✓ Compléter
                      </button>
                    )}
                    {m.projectId && (
                      <button onClick={()=>nav(`/projects/${m.projectId._id||m.projectId}`)}
                        style={{background:'rgba(79,143,255,.08)', color:'#4F8FFF', border:'1px solid rgba(79,143,255,.15)', borderRadius:6, padding:'5px 10px', fontSize:11, cursor:'pointer'}}>
                        Voir projet
                      </button>
                    )}
                    <button onClick={()=>del(m._id)}
                      style={{background:'transparent', border:'none', color:'#5C6490', cursor:'pointer', fontSize:13}}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
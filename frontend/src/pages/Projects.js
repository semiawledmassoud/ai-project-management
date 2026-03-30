import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import API from '../utils/api';
import SearchBar from '../components/SearchBar';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const { t } = useLocale();
  const [filterMethod, setFilterMethod] = useState('Tous');
  const [filterScore, setFilterScore] = useState('Tous');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', methodology: 'Scrum',
    budget: 0, budgetUsed: 0, progress: 0,
    velocity: 50, teamSize: 3, endDate: ''
  });
  const nav = useNavigate();

  const load = () => API.get('/projects').then(r => setProjects(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchMethod = filterMethod === 'Tous' || p.methodology === filterMethod;
    const matchScore = filterScore === 'Tous' ||
      (filterScore === 'Bon' && p.aiScore >= 7) ||
      (filterScore === 'Moyen' && p.aiScore >= 5 && p.aiScore < 7) ||
      (filterScore === 'Critique' && p.aiScore < 5);
    return matchSearch && matchMethod && matchScore;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post('/projects', form);
      await API.post(`/history/${res.data._id}`, {
        action: 'Projet créé',
        newValue: form.name
      }).catch(() => {});
      setShowForm(false);
      setForm({ name:'', description:'', methodology:'Scrum', budget:0, budgetUsed:0, progress:0, velocity:50, teamSize:3, endDate:'' });
      load();
    } catch (err) {
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  const del = async (id) => {
    if (window.confirm('Supprimer ce projet ?')) {
      await API.delete(`/projects/${id}`);
      load();
    }
  };

  const inp = { width:'100%', background:'#1A1D28', border:'1px solid #252A3D', borderRadius:8, padding:'9px 12px', color:'#E8EAF6', fontSize:13, outline:'none' };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:700 }}>{t('projects', 'Projets')}</h1>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background:'#4F8FFF', color:'#fff', border:'none', borderRadius:8, padding:'9px 18px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          {showForm ? t('overview', 'Annuler') : `+ ${t('projects', 'Nouveau projet')}`}
        </button>
      </div>

      {/* Recherche + Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <SearchBar value={search} onChange={setSearch} placeholder={t('quickActions', 'Rechercher un projet...')} />
        <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
          style={{ background:'#131620', border:'1px solid #252A3D', borderRadius:8, color:'#9BA3C8', padding:'9px 12px', fontSize:13, cursor:'pointer', outline:'none' }}>
          {['Tous','Scrum','Kanban','Waterfall','Agile'].map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filterScore} onChange={e => setFilterScore(e.target.value)}
          style={{ background:'#131620', border:'1px solid #252A3D', borderRadius:8, color:'#9BA3C8', padding:'9px 12px', fontSize:13, cursor:'pointer', outline:'none' }}>
          {['Tous','Bon','Moyen','Critique'].map(s => <option key={s}>{s}</option>)}
        </select>
        <div style={{ fontSize:12, color:'#5C6490', display:'flex', alignItems:'center' }}>
          {filtered.length} / {projects.length} projets
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ background:'#131620', border:'1px solid #252A3D', borderRadius:12, padding:20, marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Nouveau projet</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={{ fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4 }}>Nom *</label>
              <input style={inp} value={form.name} onChange={e => setForm({...form,name:e.target.value})} required placeholder="Ex: Refonte CRM" /></div>
            <div><label style={{ fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4 }}>Méthodologie</label>
              <select style={inp} value={form.methodology} onChange={e => setForm({...form,methodology:e.target.value})}>
                {['Scrum','Kanban','Waterfall','Agile'].map(m => <option key={m}>{m}</option>)}</select></div>
            <div><label style={{ fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4 }}>Budget total (€)</label>
              <input style={inp} type="number" value={form.budget} onChange={e => setForm({...form,budget:+e.target.value})} /></div>
            <div><label style={{ fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4 }}>Budget consommé (€)</label>
              <input style={inp} type="number" value={form.budgetUsed} onChange={e => setForm({...form,budgetUsed:+e.target.value})} /></div>
            <div><label style={{ fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4 }}>Progression (%)</label>
              <input style={inp} type="number" min="0" max="100" value={form.progress} onChange={e => setForm({...form,progress:+e.target.value})} /></div>
            <div><label style={{ fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4 }}>Vélocité (pts)</label>
              <input style={inp} type="number" value={form.velocity} onChange={e => setForm({...form,velocity:+e.target.value})} /></div>
            <div><label style={{ fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4 }}>Taille équipe</label>
              <input style={inp} type="number" value={form.teamSize} onChange={e => setForm({...form,teamSize:+e.target.value})} /></div>
            <div><label style={{ fontSize:11, color:'#9BA3C8', display:'block', marginBottom:4 }}>Date livraison</label>
              <input style={inp} type="date" value={form.endDate} onChange={e => setForm({...form,endDate:e.target.value})} /></div>
          </div>
          <button type="submit" disabled={loading}
            style={{ marginTop:14, background:'#4F8FFF', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            {loading ? 'Création...' : '✓ Créer et analyser avec l\'IA'}
          </button>
        </form>
      )}

      {/* Liste filtrée */}
      <div style={{ display:'grid', gap:12 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', color:'#5C6490', padding:60, background:'#131620', borderRadius:12, border:'1px dashed #252A3D' }}>
            {projects.length === 0 ? 'Aucun projet — cliquez sur "+ Nouveau projet"' : 'Aucun projet correspond à votre recherche'}
          </div>
        ) : (
          filtered.map(p => (
            <div key={p._id} onClick={() => nav(`/projects/${p._id}`)}
              style={{ background:'#131620', border:'1px solid #252A3D', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:16, cursor:'pointer', transition:'border-color .2s' }}>
              <div style={{ width:10, height:10, borderRadius:'50%', flexShrink:0,
                background: p.aiScore>=7?'#34D399':p.aiScore>=5?'#F59E0B':'#F87171' }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:600 }}>{p.name}</div>
                <div style={{ fontSize:12, color:'#5C6490', marginTop:2 }}>
                  {p.methodology} · {p.teamSize} membres · {p.budget?.toLocaleString()}€
                </div>
              </div>
              <div style={{ textAlign:'center', minWidth:90 }}>
                <div style={{ height:5, background:'#22263A', borderRadius:3, overflow:'hidden', marginBottom:3 }}>
                  <div style={{ height:'100%', width:p.progress+'%', background:'#4F8FFF', borderRadius:3 }} />
                </div>
                <div style={{ fontSize:11, color:'#9BA3C8' }}>{p.progress}%</div>
              </div>
              <div style={{ textAlign:'center', minWidth:55 }}>
                <div style={{ fontSize:22, fontWeight:700,
                  color: p.aiScore>=7?'#34D399':p.aiScore>=5?'#F59E0B':'#F87171' }}>{p.aiScore}</div>
                <div style={{ fontSize:10, color:'#5C6490' }}>score IA</div>
              </div>
              <button onClick={e => {e.stopPropagation(); del(p._id);}}
                style={{ background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.2)', color:'#F87171', borderRadius:6, padding:'5px 10px', fontSize:11, cursor:'pointer' }}>
                🗑
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import API from '../utils/api';

const COLORS = { critical: '#F87171', high: '#F59E0B', medium: '#4F8FFF', low: '#34D399' };
const LABELS = { critical: 'Critique', high: 'Eleve', medium: 'Modere', low: 'Faible' };
const CATS = { planning: 'Planification', budget: 'Budget', hr: 'RH / Equipe', technical: 'Technique', global: 'Global' };
const STATUS = { active: 'Actif', resolved: 'Resolu', ignored: 'Ignore' };
const SEVERITY_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const riskProjectId = (risk) => risk.projectId?._id || risk.projectId || '';
const formatDate = (value) => {
  if (!value) return 'Non defini';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non defini';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const impactOf = (risk) => Number(risk.impact || SEVERITY_WEIGHT[risk.severity] || 2);
const exposureOf = (risk) => Math.round((Number(risk.probability || 0) / 100) * impactOf(risk) * 25);
const confidenceOf = (risk) => clamp(52 + Number(risk.probability || 0) * 0.28 + impactOf(risk) * 7 + (risk.aiDetected ? 8 : 0), 35, 98);

// Normalise le statut pour comparer sans sensibilité à la casse ni aux valeurs absentes
const normalizeStatus = (status) => (status || 'active').toLowerCase().trim();
const isActive = (r) => normalizeStatus(r.status) === 'active';
const isResolved = (r) => normalizeStatus(r.status) === 'resolved';
const isIgnored = (r) => normalizeStatus(r.status) === 'ignored';

// Source de vérité unique : le statut de santé renvoyé par /predict (le même
// que celui affiché sur la page Analyse IA). On en dérive un "score de
// risque" (inverse de la santé) et un libellé/couleur cohérents, pour que
// cette page ne puisse jamais afficher un verdict contraire à l'Analyse IA
// pour le même projet au même instant.
const healthToRiskView = (health) => {
  if (!health) return null;
  const riskScore = clamp(100 - (health.healthScore ?? 50));
  let level, color;
  if (health.healthStatus === 'critical') { level = 'Risque eleve'; color = COLORS.critical; }
  else if (health.healthStatus === 'warning') { level = 'Risque moyen'; color = COLORS.high; }
  else { level = 'Risque faible'; color = COLORS.low; }
  return { riskScore, level, color };
};

export default function Risks() {
  const nav = useNavigate();
  const [risks, setRisks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterSev, setFilterSev] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [filterOwner, setFilterOwner] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('exposure');
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({
    projectId: '', title: '', description: '',
    severity: 'medium', probability: 50, impact: 3, category: 'planning',
    owner: '', dueDate: '', mitigationSteps: ''
  });

  // Résultat /predict pour le projet sélectionné — même source que la page
  // Analyse IA. Sert d'ancrage pour le score global et le niveau de risque.
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, pRes] = await Promise.all([API.get('/risks'), API.get('/projects')]);
      const projectData = pRes.data || [];
      const riskData = rRes.data || [];

      console.log('[Risks] projectData:', projectData);
      console.log('[Risks] riskData:', riskData);
      console.log('[Risks] statuts distincts:', [...new Set(riskData.map(r => r.status))]);

      setProjects(projectData);
      setRisks(riskData);

      // Sélectionner automatiquement le premier projet qui a des risques actifs,
      // sinon le premier projet disponible, afin d'éviter un score à 0 par défaut.
      if (projectData.length > 0) {
        const firstWithRisks = projectData.find(p =>
          riskData.some(r => String(riskProjectId(r)) === String(p._id) && isActive(r))
        );
        const defaultProject = firstWithRisks || projectData[0];
        setSelectedProjectId(defaultProject._id);
        setForm(f => ({ ...f, projectId: defaultProject._id }));
        console.log('[Risks] projet par défaut sélectionné:', defaultProject.name, defaultProject._id);
      }
    } catch (err) {
      console.error('[Risks] Erreur de chargement:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectedProject = useMemo(
    () => projects.find(p => p._id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  // Appelle le même endpoint /predict que la page Analyse IA dès qu'un projet
  // est sélectionné, pour garantir un verdict identique entre les deux pages.
  useEffect(() => {
    let cancelled = false;
    if (!selectedProject) {
      setHealth(null);
      return;
    }
    setHealthLoading(true);
    fetch('http://localhost:8000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedProject),
    })
      .then(res => res.json())
      .then(data => { if (!cancelled) setHealth(data); })
      .catch(() => { if (!cancelled) setHealth(null); })
      .finally(() => { if (!cancelled) setHealthLoading(false); });
    return () => { cancelled = true; };
  }, [selectedProject]);

  const projectRisks = useMemo(() => (
    selectedProjectId === 'all' ? risks : risks.filter(r => String(riskProjectId(r)) === String(selectedProjectId))
  ), [risks, selectedProjectId]);

  // Filtrage normalisé : accepte status absent/undefined/majuscules
  const activeProjectRisks = projectRisks.filter(isActive);
  const resolvedProjectRisks = projectRisks.filter(isResolved);

  console.log('[Risks] projectRisks:', projectRisks.length, '| actifs:', activeProjectRisks.length, '| résolus:', resolvedProjectRisks.length);

  const criticalProjectRisks = activeProjectRisks.filter(r => r.severity === 'critical');

  // Score global ancré sur /predict quand disponible (cas "all" ou échec
  // réseau -> fallback sur le calcul historique basé sur les risques stockés).
  const healthView = selectedProjectId !== 'all' ? healthToRiskView(health) : null;
  const fallbackScore = getRiskScore(activeProjectRisks);
  const score = healthView ? healthView.riskScore : fallbackScore;
  const scoreCol = healthView ? healthView.color : (score >= 70 ? COLORS.critical : score >= 40 ? COLORS.high : COLORS.low);

  const resolutionRate = projectRisks.length ? Math.round(resolvedProjectRisks.length / projectRisks.length * 100) : 0;
  const exposure = activeProjectRisks.reduce((sum, r) => sum + exposureOf(r), 0);

  const owners = useMemo(() => (
    [...new Set(projectRisks.map(r => r.owner).filter(Boolean))].sort()
  ), [projectRisks]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projectRisks
      .filter(r => {
        const due = r.dueDate ? new Date(r.dueDate) : null;
        const now = new Date();
        const in7 = new Date(); in7.setDate(now.getDate() + 7);
        const in30 = new Date(); in30.setDate(now.getDate() + 30);
        const dateMatch =
          filterDate === 'all' ||
          (filterDate === 'overdue' && due && due < now && isActive(r)) ||
          (filterDate === '7d' && due && due >= now && due <= in7) ||
          (filterDate === '30d' && due && due >= now && due <= in30) ||
          (filterDate === 'none' && !due);
        const qMatch = !query ||
          (r.title || '').toLowerCase().includes(query) ||
          (r.description || '').toLowerCase().includes(query) ||
          (r.owner || '').toLowerCase().includes(query) ||
          (r.projectId?.name || '').toLowerCase().includes(query);

        // Comparaison normalisée pour le filtre statut
        const statusMatch = filterStatus === 'all' || normalizeStatus(r.status) === filterStatus;

        return statusMatch &&
          (filterSev === 'all' || r.severity === filterSev) &&
          (filterCat === 'all' || r.category === filterCat) &&
          (filterOwner === 'all' || r.owner === filterOwner) &&
          dateMatch &&
          qMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'exposure') return exposureOf(b) - exposureOf(a);
        if (sortBy === 'probability') return Number(b.probability || 0) - Number(a.probability || 0);
        if (sortBy === 'severity') return (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0);
        if (sortBy === 'impact') return impactOf(b) - impactOf(a);
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [projectRisks, search, filterStatus, filterSev, filterCat, filterOwner, filterDate, sortBy]);

  const summary = getAiSummary(projectRisks, selectedProject, score, exposure, healthView);
  const actions = getPriorityActions(projectRisks);
  const trendData = getTrendData(projectRisks);
  const categoryData = getCategoryData(activeProjectRisks);

  const updateRiskInState = (updated) => {
    setRisks(current => current.map(r => r._id === updated._id ? { ...r, ...updated } : r));
  };

  const resolve = async (id) => {
    const res = await API.put(`/risks/${id}/resolve`);
    updateRiskInState(res.data);
  };

  const ignore = async (id) => {
    const res = await API.put(`/risks/${id}/ignore`);
    updateRiskInState(res.data);
  };

  const del = async (id) => {
    if (!window.confirm('Supprimer ce risque ?')) return;
    await API.delete(`/risks/${id}`);
    setRisks(current => current.filter(r => r._id !== id));
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/risks', {
        ...form,
        dueDate: form.dueDate || undefined,
        actions: form.mitigationSteps ? form.mitigationSteps.split('\n').filter(Boolean) : []
      });
      const created = {
        ...res.data,
        projectId: projects.find(p => p._id === res.data.projectId) || res.data.projectId,
      };
      setRisks(current => [created, ...current]);
      setSelectedProjectId(String(form.projectId));
      setShowForm(false);
      setForm({ projectId: form.projectId || projects[0]?._id || '', title: '', description: '', severity: 'medium', probability: 50, impact: 3, category: 'planning', owner: '', dueDate: '', mitigationSteps: '' });
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const exportCSV = () => {
    const h = 'Projet,Titre,Criticite,Probabilite,Impact,Exposition,Categorie,Statut,Responsable,Date limite\n';
    const rows = filtered.map(r =>
      `"${r.projectId?.name || selectedProject?.name || ''}","${r.title}","${LABELS[r.severity] || r.severity}","${r.probability}%","${impactOf(r)}","${exposureOf(r)}","${CATS[r.category] || r.category}","${r.status}","${r.owner || ''}","${r.dueDate || ''}"`
    ).join('\n');
    const blob = new Blob([h + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PREDYNEX_Risques_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inp = { width: '100%', background: '#1A1D28', border: '1px solid #252A3D', borderRadius: 9, padding: '9px 12px', color: '#E8EAF6', fontSize: 13, outline: 'none' };
  const card = { background: 'linear-gradient(180deg, rgba(19,22,32,0.96), rgba(12,16,28,0.92))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 20px', boxShadow: '0 18px 44px rgba(2,6,23,0.28)' };

  return (
    <div className="risks-premium" style={{ padding: 24, background: '#070b14', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: '#7C91C7', textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: 7, fontWeight: 800 }}>Risk intelligence</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#E8EAF6', margin: 0 }}>Gestion des risques</h1>
          <p style={{ color: '#9BA3C8', fontSize: 13, marginTop: 5 }}>
            {selectedProject ? selectedProject.name : 'Tous les projets'} / {activeProjectRisks.length} actif(s) / {resolvedProjectRisks.length} resolu(s)
            {healthLoading ? ' / synchronisation Analyse IA...' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={exportCSV} className="risks-button" style={{ background: 'rgba(167,139,250,.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,.2)', borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Export CSV
          </button>
          <button onClick={() => setShowForm(!showForm)} className="risks-button" style={{ background: '#F87171', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            {showForm ? 'Annuler' : '+ Nouveau risque'}
          </button>
        </div>
      </div>

      <div className="risks-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Score global', value: `${score}/100`, color: scoreCol, hint: summary.level },
          { label: 'Risques actifs', value: activeProjectRisks.length, color: '#4F8FFF', hint: `${projectRisks.length} total` },
          { label: 'Risques critiques', value: criticalProjectRisks.length, color: '#F87171', hint: 'Action immediate' },
          { label: 'Taux resolution', value: `${resolutionRate}%`, color: '#34D399', hint: `${resolvedProjectRisks.length} resolu(s)` },
          { label: 'Exposition globale', value: exposure, color: exposure > 180 ? '#F87171' : exposure > 90 ? '#F59E0B' : '#34D399', hint: 'Probabilite x impact' },
        ].map((k, i) => (
          <div key={k.label} className="risks-card risks-kpi-card" style={{ ...card, padding: 15, animationDelay: `${i * 60}ms` }}>
            <div style={{ fontSize: 10, color: '#7C91C7', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 900, color: k.color, fontFamily: 'monospace' }}>{k.value}</div>
            <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${k.label === 'Exposition globale' ? clamp(exposure / Math.max(1, activeProjectRisks.length * 25) * 100) : k.label === 'Risques actifs' ? clamp(activeProjectRisks.length * 16) : k.label === 'Risques critiques' ? clamp(criticalProjectRisks.length * 25) : parseInt(k.value, 10) || score}%`, background: k.color, borderRadius: 999 }} />
            </div>
            <div style={{ color: '#9BA3C8', fontSize: 11, marginTop: 8 }}>{k.hint}</div>
          </div>
        ))}
      </div>

      <div className="risks-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div className="risks-card" style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <SectionTitle title="Resume IA" subtitle="Classification dynamique du projet selectionne" />
            <StatusPill label={summary.level} color={summary.color} />
          </div>
          <p style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 1.65, margin: '0 0 12px' }}>{summary.text}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {summary.factors.map(f => <StatusPill key={f} label={f} color="#4F8FFF" />)}
          </div>
        </div>

        <div className="risks-card" style={card}>
          <SectionTitle title="Actions prioritaires" subtitle="Top 3 actions a plus fort impact" />
          <div style={{ display: 'grid', gap: 9 }}>
            {actions.map((a, i) => (
              <div key={`${a.title}-${i}`} className="risks-action-card" style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto', gap: 10, alignItems: 'center', padding: 10, borderRadius: 12, background: 'rgba(10,16,29,0.74)', border: `1px solid ${a.color}33` }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${a.color}18`, color: a.color, border: `1px solid ${a.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>#{i + 1}</div>
                <div>
                  <div style={{ color: '#E8EAF6', fontSize: 13, fontWeight: 800 }}>{a.title}</div>
                  <div style={{ color: '#9BA3C8', fontSize: 11, marginTop: 2 }}>{a.detail}</div>
                </div>
                <div style={{ color: a.color, fontSize: 12, fontWeight: 900, fontFamily: 'monospace' }}>-{a.impact}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="risks-card" style={{ ...card, marginBottom: 16 }}>
          <SectionTitle title="Nouveau risque" subtitle="Les statistiques se recalculent automatiquement apres creation" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 10 }} className="risks-form-grid">
            <Field label="Projet *"><select style={inp} value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })} required>{projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></Field>
            <Field label="Criticite"><select style={{ ...inp, color: COLORS[form.severity] }} value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>{Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label={`Probabilite : ${form.probability}%`}><input type="range" min="0" max="100" step="1" value={form.probability} onChange={e => setForm({ ...form, probability: +e.target.value })} style={{ width: '100%', marginTop: 9 }} /></Field>
            <Field label={`Impact : ${form.impact}/5`}><input type="range" min="1" max="5" step="1" value={form.impact} onChange={e => setForm({ ...form, impact: +e.target.value })} style={{ width: '100%', marginTop: 9 }} /></Field>
            <Field label="Categorie"><select style={inp} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Responsable"><input style={inp} value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="Nom du responsable" /></Field>
            <Field label="Date limite"><input style={inp} type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></Field>
          </div>
          <Field label="Titre *"><input style={inp} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Ex: Depassement budgetaire" /></Field>
          <div style={{ height: 10 }} />
          <Field label="Description"><textarea style={{ ...inp, resize: 'vertical', minHeight: 64 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Decrivez le risque..." /></Field>
          <div style={{ height: 10 }} />
          <Field label="Plan de mitigation (une etape par ligne)"><textarea style={{ ...inp, resize: 'vertical', minHeight: 64 }} value={form.mitigationSteps} onChange={e => setForm({ ...form, mitigationSteps: e.target.value })} placeholder={"Etape 1\nEtape 2\nEtape 3"} /></Field>
          <button type="submit" className="risks-button" style={{ marginTop: 14, background: '#F87171', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            Ajouter le risque
          </button>
        </form>
      )}

      <div className="risks-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <MatrixView risks={activeProjectRisks} card={card} />
        <TrendChart data={trendData} card={card} />
      </div>

      <div className="risks-card" style={{ ...card, marginBottom: 16 }}>
        <SectionTitle title="Repartition par categorie" subtitle="Exposition active du projet selectionne" />
        <div style={{ height: 190 }}>
          <ResponsiveContainer>
            <BarChart data={categoryData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="rgba(92,100,144,0.18)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#9BA3C8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9BA3C8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1A1D28', border: '1px solid #252A3D', borderRadius: 10, color: '#E8EAF6' }} />
              <Bar dataKey="exposure" radius={[6, 6, 0, 0]} name="Exposition">
                {categoryData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="risks-card" style={{ ...card, marginBottom: 16 }}>
        <SectionTitle title="Filtres avances" subtitle="Projet, responsable, categorie, criticite, date, statut et recherche instantanee" />
        <div className="risks-filter-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(6, minmax(130px, 1fr))', gap: 8, alignItems: 'end' }}>
          <Field label="Recherche"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Risque, projet, responsable..." style={inp} /></Field>
          <Field label="Projet"><select value={selectedProjectId} onChange={e => { setSelectedProjectId(e.target.value); setForm(f => ({ ...f, projectId: e.target.value === 'all' ? projects[0]?._id || '' : e.target.value })); }} style={inp}><option value="all">Tous</option>{projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></Field>
          <Field label="Responsable"><select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} style={inp}><option value="all">Tous</option>{owners.map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
          <Field label="Categorie"><select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={inp}><option value="all">Toutes</option>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Criticite"><select value={filterSev} onChange={e => setFilterSev(e.target.value)} style={inp}><option value="all">Toutes</option>{Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Date"><select value={filterDate} onChange={e => setFilterDate(e.target.value)} style={inp}><option value="all">Toutes</option><option value="overdue">En retard</option><option value="7d">7 jours</option><option value="30d">30 jours</option><option value="none">Sans date</option></select></Field>
          <Field label="Statut"><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp}><option value="all">Tous</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inp, width: 220 }}>
            <option value="exposure">Trier: exposition</option>
            <option value="probability">Trier: probabilite</option>
            <option value="impact">Trier: impact</option>
            <option value="severity">Trier: criticite</option>
            <option value="date">Trier: date</option>
          </select>
          <div style={{ fontSize: 12, color: '#9BA3C8' }}>{filtered.length} resultat(s) / {projectRisks.length} risque(s) projet</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#5C6490', padding: 60 }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="risks-card" style={{ textAlign: 'center', color: '#5C6490', padding: 60, background: '#131620', borderRadius: 14, border: '1px dashed #252A3D' }}>
          {projectRisks.length === 0 ? "Aucun risque pour ce projet." : 'Aucun resultat pour ces filtres.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(r => (
            <RiskRow
              key={r._id}
              risk={r}
              expanded={expandedId === r._id}
              toggle={() => setExpandedId(expandedId === r._id ? null : r._id)}
              resolve={resolve}
              ignore={ignore}
              del={del}
              nav={nav}
            />
          ))}
        </div>
      )}

      {risks.length === 0 && !loading && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => nav('/projects')} className="risks-button" style={{ background: '#4F8FFF', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            Creer un projet pour lancer l'analyse IA
          </button>
        </div>
      )}
    </div>
  );
}

function getRiskScore(activeRisks) {
  if (!activeRisks.length) return 0;
  const total = activeRisks.reduce((sum, r) => sum + (SEVERITY_WEIGHT[r.severity] || 1) * impactOf(r) * (Number(r.probability || 0) / 100), 0);
  return clamp((total / (activeRisks.length * 20)) * 100);
}

function getAiSummary(projectRisks, project, score, exposure, healthView) {
  const active = projectRisks.filter(isActive);
  const critical = active.filter(r => r.severity === 'critical').length;
  const high = active.filter(r => r.severity === 'high').length;
  const overdue = active.filter(r => r.dueDate && new Date(r.dueDate) < new Date()).length;
  const topCat = Object.entries(active.reduce((acc, r) => ({ ...acc, [r.category]: (acc[r.category] || 0) + exposureOf(r) }), {})).sort((a, b) => b[1] - a[1])[0];

  // Le niveau/couleur affichés sont ancrés sur /predict (healthView) quand
  // disponible, pour rester strictement aligné avec la page Analyse IA.
  // Le fallback (calcul historique basé sur les risques stockés) ne sert
  // que si /predict est indisponible ou si "Tous les projets" est sélectionné.
  const level = healthView ? healthView.level : (score >= 54 ? 'Risque eleve' : score >= 30 ? 'Risque moyen' : 'Risque faible');
  const color = healthView ? healthView.color : (score >= 54 ? COLORS.critical : score >= 30 ? COLORS.high : COLORS.low);

  const factors = [
    critical ? `${critical} critique(s)` : null,
    high ? `${high} eleve(s)` : null,
    overdue ? `${overdue} en retard` : null,
    topCat ? `${CATS[topCat[0]] || topCat[0]}` : null,
  ].filter(Boolean);
  const projectName = project?.name || 'Le portefeuille selectionne';
  const text = active.length
    ? `${projectName} est classe en ${level.toLowerCase()} avec un score de ${score}/100 et une exposition cumulee de ${exposure}. Le classement reprend le statut de sante calcule par le moteur IA (identique a la page Analyse IA) et integre la criticite, la probabilite, l'impact et les echeances des risques actifs.`
    : `${projectName} ne presente aucun risque actif dans les donnees actuelles, mais le moteur IA classe ce projet en ${level.toLowerCase()} sur la base de son score de sante global.`;
  return { level, color, text, factors: factors.length ? factors : ['Aucun facteur critique actif'] };
}

function getPriorityActions(projectRisks) {
  const active = projectRisks.filter(isActive).sort((a, b) => exposureOf(b) - exposureOf(a));
  if (!active.length) return [{ title: 'Maintenir la surveillance', detail: 'Conserver une revue reguliere des risques du projet.', impact: 0, color: COLORS.low }];
  return active.slice(0, 3).map(r => ({
    title: r.actions?.[0] || actionForCategory(r.category),
    detail: `${r.title} / ${LABELS[r.severity] || r.severity} / exposition ${exposureOf(r)}`,
    impact: exposureOf(r),
    color: COLORS[r.severity] || COLORS.medium,
  }));
}

function actionForCategory(category) {
  return {
    planning: 'Replanifier les dependances critiques',
    budget: 'Revoir les arbitrages budgetaires',
    hr: 'Reequilibrer la charge equipe',
    technical: 'Reduire les blocages techniques prioritaires',
    global: 'Escalader le risque en comite projet',
  }[category] || 'Definir une action de mitigation';
}

function getTrendData(projectRisks) {
  const now = new Date();
  return [5, 4, 3, 2, 1, 0].map(offset => {
    const start = new Date(now); start.setDate(now.getDate() - offset * 7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const label = offset === 0 ? 'Auj.' : `S-${offset}`;
    const created = projectRisks.filter(r => {
      const d = new Date(r.createdAt || 0);
      return d >= start && d < end;
    }).length;
    const active = projectRisks.filter(r => isActive(r) && new Date(r.createdAt || 0) <= end).length;
    const resolved = projectRisks.filter(r => isResolved(r) && new Date(r.updatedAt || r.createdAt || 0) <= end).length;
    return { label, created, active, resolved };
  });
}

function getCategoryData(activeRisks) {
  return Object.entries(CATS).map(([key, label]) => {
    const subset = activeRisks.filter(r => r.category === key);
    return {
      label,
      exposure: subset.reduce((sum, r) => sum + exposureOf(r), 0),
      count: subset.length,
      color: key === 'budget' ? COLORS.high : key === 'technical' ? COLORS.critical : key === 'hr' ? '#A78BFA' : key === 'planning' ? COLORS.medium : COLORS.low,
    };
  });
}

function MatrixView({ risks, card }) {
  const cells = {};
  risks.forEach(r => {
    const si = impactOf(r);
    const pi = Math.max(1, Math.min(5, Math.ceil(Number(r.probability || 0) / 20)));
    const k = `${pi}-${si}`;
    if (!cells[k]) cells[k] = [];
    cells[k].push(r);
  });
  const bg = (p, s) => {
    const v = p * s;
    if (v >= 20) return 'rgba(248,113,113,.22)';
    if (v >= 12) return 'rgba(245,158,11,.17)';
    if (v >= 6) return 'rgba(79,143,255,.12)';
    return 'rgba(52,211,153,.08)';
  };
  return (
    <div className="risks-card" style={card}>
      <SectionTitle title="Matrice Probabilite x Impact" subtitle="Uniquement les risques actifs du projet selectionne" />
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 18 }}>
          {[5, 4, 3, 2, 1].map(p => <div key={p} style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 5, fontSize: 10, color: '#5C6490', minWidth: 28 }}>{p * 20}%</div>)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 3, marginBottom: 3 }}>
            {[1, 2, 3, 4, 5].map(l => <div key={l} style={{ textAlign: 'center', fontSize: 9, color: '#5C6490' }}>I{l}</div>)}
          </div>
          {[5, 4, 3, 2, 1].map(prob => (
            <div key={prob} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 3, marginBottom: 3 }}>
              {[1, 2, 3, 4, 5].map(impact => {
                const cr = cells[`${prob}-${impact}`] || [];
                return (
                  <div key={impact} style={{ height: 44, borderRadius: 7, background: bg(prob, impact), border: '1px solid #252A3D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 3, padding: 3 }}>
                    {cr.slice(0, 4).map((r, i) => <div key={r._id || i} title={r.title} style={{ width: 17, height: 17, borderRadius: '50%', background: COLORS[r.severity], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: '#0D0F14' }}>{i + 1}</div>)}
                    {cr.length > 4 && <div style={{ fontSize: 9, color: '#9BA3C8' }}>+{cr.length - 4}</div>}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ textAlign: 'center', fontSize: 9, color: '#5C6490', marginTop: 4 }}>Impact -&gt;</div>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ data, card }) {
  return (
    <div className="risks-card" style={card}>
      <SectionTitle title="Evolution temporelle" subtitle="Creation, risques actifs et resolutions selon l'historique disponible" />
      <div style={{ height: 240 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="rgba(92,100,144,0.18)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#9BA3C8', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9BA3C8', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#1A1D28', border: '1px solid #252A3D', borderRadius: 10, color: '#E8EAF6' }} />
            <Area type="monotone" dataKey="active" stroke="#F87171" fill="#F87171" fillOpacity={0.16} name="Actifs" strokeWidth={2} />
            <Area type="monotone" dataKey="resolved" stroke="#34D399" fill="#34D399" fillOpacity={0.14} name="Resolus" strokeWidth={2} />
            <Area type="monotone" dataKey="created" stroke="#4F8FFF" fill="#4F8FFF" fillOpacity={0.10} name="Crees" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RiskRow({ risk, expanded, toggle, resolve, ignore, del, nav }) {
  const col = COLORS[risk.severity] || COLORS.medium;
  const overdue = risk.dueDate && new Date(risk.dueDate) < new Date() && isActive(risk);
  const history = getRiskHistory(risk);
  return (
    <div className="risks-card risks-risk-row" style={{ background: 'linear-gradient(180deg, rgba(19,22,32,0.96), rgba(10,16,29,0.9))', border: `1px solid ${isActive(risk) ? col + '44' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, overflow: 'hidden', opacity: isResolved(risk) ? 0.72 : 1 }}>
      <div style={{ padding: '15px 18px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, flexWrap: 'wrap' }}>
            <StatusPill label={LABELS[risk.severity] || risk.severity} color={col} />
            <StatusPill label={CATS[risk.category] || risk.category} color="#9BA3C8" />
            <StatusPill label={STATUS[normalizeStatus(risk.status)] || risk.status} color={isResolved(risk) ? COLORS.low : isIgnored(risk) ? '#9BA3C8' : col} />
            {risk.aiDetected && <StatusPill label="IA" color="#A78BFA" />}
            {overdue && <StatusPill label="En retard" color={COLORS.critical} />}
          </div>
          <div onClick={toggle} style={{ fontSize: 15, fontWeight: 800, marginBottom: 5, cursor: 'pointer', color: '#E8EAF6' }}>
            {risk.title} <span style={{ fontSize: 11, color: '#5C6490' }}>{expanded ? '^' : 'v'}</span>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#9BA3C8', flexWrap: 'wrap' }}>
            <span>Probabilite <b style={{ color: col }}>{risk.probability || 0}%</b></span>
            <span>Impact <b style={{ color: col }}>{impactOf(risk)}/5</b></span>
            <span>Exposition <b style={{ color: col }}>{exposureOf(risk)}</b></span>
            <span>Confiance IA <b style={{ color: '#A78BFA' }}>{confidenceOf(risk)}%</b></span>
            {risk.owner && <span>Responsable {risk.owner}</span>}
            {risk.dueDate && <span style={{ color: overdue ? COLORS.critical : '#9BA3C8' }}>Echeance {formatDate(risk.dueDate)}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 106 }}>
          {isActive(risk) && <>
            <button onClick={() => resolve(risk._id)} className="risks-button" style={{ background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.22)', color: '#34D399', borderRadius: 7, padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Resoudre</button>
            <button onClick={() => ignore(risk._id)} className="risks-button" style={{ background: 'transparent', border: '1px solid #252A3D', color: '#9BA3C8', borderRadius: 7, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>Ignorer</button>
          </>}
          <button onClick={() => del(risk._id)} className="risks-button" style={{ background: 'transparent', border: 'none', color: '#5C6490', cursor: 'pointer', fontSize: 12, padding: 4 }}>Supprimer</button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 18px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {risk.description && <div style={{ fontSize: 12, color: '#CBD5E1', lineHeight: 1.55, marginTop: 12, marginBottom: 10 }}>{risk.description}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="risks-detail-grid">
            <div style={{ background: '#1A1D28', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, color: '#7C91C7', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>Recommandations</div>
              {(risk.actions?.length ? risk.actions : [actionForCategory(risk.category)]).map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 6, color: '#CBD5E1', fontSize: 12 }}>
                  <span style={{ color: col, fontWeight: 900 }}>{i + 1}.</span>{a}
                </div>
              ))}
            </div>
            <div style={{ background: '#1A1D28', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, color: '#7C91C7', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>Timeline & historique</div>
              {history.map((h, i) => (
                <div key={`${h.label}-${i}`} style={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: h.color, marginTop: 4 }} />
                  <div>
                    <div style={{ fontSize: 12, color: '#E8EAF6', fontWeight: 700 }}>{h.label}</div>
                    <div style={{ fontSize: 11, color: '#9BA3C8' }}>{h.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => nav(`/projects/${riskProjectId(risk)}`)} className="risks-button" style={{ marginTop: 12, background: 'rgba(79,143,255,.08)', color: '#4F8FFF', border: '1px solid rgba(79,143,255,.15)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            Voir le projet
          </button>
        </div>
      )}
    </div>
  );
}

function getRiskHistory(risk) {
  const base = [
    { label: risk.aiDetected ? 'Risque detecte par IA' : 'Risque cree manuellement', date: formatDate(risk.createdAt), color: COLORS[risk.severity] || COLORS.medium },
  ];
  if (risk.dueDate) base.push({ label: 'Echeance planifiee', date: formatDate(risk.dueDate), color: COLORS.high });
  if (Array.isArray(risk.history) && risk.history.length) {
    risk.history.forEach(h => base.push({ label: h.label || h.action || 'Changement de statut', date: formatDate(h.at), color: h.status === 'resolved' ? COLORS.low : h.status === 'ignored' ? '#9BA3C8' : COLORS.medium }));
  } else if (!isActive(risk)) {
    base.push({ label: `Statut actuel : ${STATUS[normalizeStatus(risk.status)] || risk.status}`, date: formatDate(risk.updatedAt || risk.createdAt), color: isResolved(risk) ? COLORS.low : '#9BA3C8' });
  }
  return base;
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 900, color: '#E8EAF6' }}>{title}</div>
      <div style={{ fontSize: 11, color: '#7C91C7', marginTop: 3 }}>{subtitle}</div>
    </div>
  );
}

function StatusPill({ label, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 999, background: `${color}18`, border: `1px solid ${color}2e`, color, fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ fontSize: 11, color: '#9BA3C8', display: 'block', marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}
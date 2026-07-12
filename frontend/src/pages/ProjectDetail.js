import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { useLocale } from '../context/LocaleContext';

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject]   = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [risksSaved, setRisksSaved] = useState(false);
  const [comments, setComments] = useState([]);
  const [team, setTeam]         = useState([]);
  const [history, setHistory]   = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', role: '', email: '', workload: 80 });
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', priority: 'medium', status: 'planned' });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const { t } = useLocale();

  // ── Chargement projet + analyse IA ─────────────────────────────────────────
  const loadProject = useCallback(async () => {
    try {
      const res = await API.get(`/projects/${id}`);
      setProject(res.data);

      // Appel IA
      const iaRes = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(res.data)
      });
      const iaData = await iaRes.json();
      setAnalysis(iaData);

      // Sauvegarder automatiquement les risques IA en base
      if (iaData.risks && iaData.risks.length > 0) {
        try {
          await API.post(`/risks/save-ai/${id}`, { risks: iaData.risks });
          setRisksSaved(true);
        } catch (e) {
          console.warn('Risques IA non sauvegardés:', e.message);
        }
      }

      // Log historique
      API.post(`/history/${id}`, {
        action: 'Score IA calculé',
        field: 'aiScore',
        newValue: iaData.score + '/10'
      }).catch(() => {});

    } catch (err) {
      console.error('Erreur chargement projet:', err);
    }
  }, [id]);

  // ── Chargement commentaires, équipe, historique ────────────────────────────
  const loadExtras = useCallback(async () => {
    try {
      const [cRes, tRes, hRes] = await Promise.all([
        API.get(`/comments/${id}`).catch(() => ({ data: [] })),
        API.get(`/team/${id}`).catch(() => ({ data: [] })),
        API.get(`/history/${id}`).catch(() => ({ data: [] }))
      ]);
      const taskRes = await API.get(`/tasks/${id}`).catch(() => ({ data: [] }));
      setComments(cRes.data);
      setTeam(tRes.data);
      setHistory(hRes.data);
      setTasks(taskRes.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
    loadExtras();
  }, [loadProject, loadExtras]);

  // ── Commentaire ───────────────────────────────────────────────────────────
  const submitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const res = await API.post(`/comments/${id}`, { text: newComment });
      setComments([res.data, ...comments]);
      setNewComment('');
    } catch (err) {
      alert('Erreur commentaire: ' + err.message);
    }
  };

  const delComment = async (cid) => {
    await API.delete(`/comments/${cid}`);
    setComments(comments.filter(c => c._id !== cid));
  };

  // ── Membre équipe ─────────────────────────────────────────────────────────
  const addMember = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post(`/team/${id}`, memberForm);
      setTeam([...team, res.data]);
      setMemberForm({ name: '', role: '', email: '', workload: 80 });
      setShowMemberForm(false);
      API.post(`/history/${id}`, { action: 'Membre ajouté', newValue: memberForm.name }).catch(() => {});
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const delMember = async (mid) => {
    if (!window.confirm('Supprimer ce membre ?')) return;
    await API.delete(`/team/${mid}`);
    setTeam(team.filter(m => m._id !== mid));
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    try {
      const res = await API.post(`/tasks/${id}`, {
        title: taskForm.title.trim(),
        priority: taskForm.priority,
        status: taskForm.status
      });
      setTasks([res.data, ...tasks]);
      setTaskForm({ title: '', priority: 'medium', status: 'planned' });
      setShowTaskForm(false);
      API.post(`/history/${id}`, { action: 'Tâche ajoutée', newValue: res.data.title }).catch(() => {});
    } catch (err) {
      alert('Erreur tâche: ' + err.message);
    }
  };

  const toggleTaskStatus = async (taskId) => {
    const task = tasks.find(t => t._id === taskId);
    if (!task) return;
    const nextStatus = task.status === 'done' ? 'planned' : 'done';
    try {
      const res = await API.put(`/tasks/${taskId}`, { status: nextStatus });
      setTasks(tasks.map(t => t._id === taskId ? res.data : t));
    } catch (err) {
      alert('Erreur mise à jour tâche: ' + err.message);
    }
  };

  const delTask = async (taskId) => {
    try {
      await API.delete(`/tasks/${taskId}`);
      setTasks(tasks.filter(task => task._id !== taskId));
    } catch (err) {
      alert('Erreur suppression tâche: ' + err.message);
    }
  };

  const timeAgo = (date) => {
    const d = Date.now() - new Date(date);
    const m = Math.floor(d / 60000);
    if (m < 1) return "À l'instant";
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}j`;
  };

  // ── Export rapport ────────────────────────────────────────────────────────
  const exportRapport = () => {
    const content = `RAPPORT PREDYNEX — ${project?.name}
Généré le ${new Date().toLocaleDateString('fr-FR')}
${'='.repeat(50)}

SCORE IA : ${project?.aiScore}/10
Méthodologie : ${project?.methodology}
Équipe : ${project?.teamSize} membres
Budget : ${project?.budget?.toLocaleString()}€ (${Math.round((project?.budgetUsed / Math.max(project?.budget, 1)) * 100)}% utilisé)
Progression : ${project?.progress}%
Vélocité : ${project?.velocity} pts

PRÉDICTIONS IA
${'─'.repeat(30)}
Probabilité retard : ${analysis?.predictions?.delayProbability}%
Délai estimé : +${analysis?.predictions?.estimatedDelay}j
Dépassement budget : +${analysis?.predictions?.budgetOverrun}%
Probabilité succès : ${Math.round(analysis?.successProbability || 0)}%

RISQUES (${analysis?.risks?.length || 0})
${'─'.repeat(30)}
${analysis?.risks?.map((r, i) => `${i + 1}. [${r.severity.toUpperCase()}] ${r.title}
   ${r.description}
   Probabilité: ${r.probability}%`).join('\n') || 'Aucun'}

RECOMMANDATIONS (${analysis?.recommendations?.length || 0})
${'─'.repeat(30)}
${analysis?.recommendations?.map((r, i) => `${i + 1}. ${r.title}
   ${r.description}
   Impact: ${r.impact}
   Confiance: ${r.confidence}%`).join('\n') || 'Aucune'}

ÉQUIPE (${team.length} membres)
${'─'.repeat(30)}
${team.map(m => `- ${m.name} (${m.role}) — Charge: ${m.workload}%`).join('\n') || 'Aucun membre'}

Rapport généré par PREDYNEX v2.0`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PREDYNEX_${project?.name?.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!project) return (
    <div style={{ padding: 40, color: '#9BA3C8', textAlign: 'center' }}>
      Chargement du projet...
    </div>
  );

  const score = project.aiScore;
  const col   = score >= 7 ? '#34D399' : score >= 5 ? '#F59E0B' : '#F87171';
  const card  = { background: '#131620', border: '1px solid #252A3D', borderRadius: 16, padding: '16px 20px', marginBottom: 16, boxShadow: '0 8px 24px rgba(2, 6, 23, 0.25)' };
  const healthStatusColor = (status) => status === 'healthy' ? '#34D399' : status === 'warning' ? '#F59E0B' : '#F87171';
  const inp   = { width: '100%', background: '#1A1D28', border: '1px solid #252A3D', borderRadius: 8, padding: '9px 12px', color: '#E8EAF6', fontSize: 13, outline: 'none' };

  const tabs = [
    { id: 'overview',  label: `📊 ${t('overview', 'Vue globale')}` },
    { id: 'risks',     label: `⚠️ ${t('risks', 'Risques')} ${analysis?.risks?.length ? `(${analysis.risks.length})` : ''}` },
    { id: 'recs',      label: `💡 ${t('recommendations', 'Recommandations')}` },
    { id: 'team',      label: `👥 ${t('projects', 'Équipe')} (${team.length})` },
    { id: 'tasks',     label: `✅ Plan d'action (${tasks.length})` },
    { id: 'comments',  label: `💬 ${t('quickActions', 'Commentaires')} (${comments.length})` },
    { id: 'history',   label: '📜 Historique' },
  ];

  return (
    <div style={{ padding: 24, position: 'relative', background: 'linear-gradient(145deg, rgba(13, 20, 34, 0.88) 0%, rgba(7, 14, 29, 0.93) 35%, rgba(19, 29, 55, 0.96) 75%, rgba(13, 20, 34, 1) 100%)', borderRadius: 16, boxShadow: '0 12px 35px rgba(9, 14, 27, .45)' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, rgba(41, 88, 255, 0.08), transparent 50%, rgba(93, 171, 255, 0.06))', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 2 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => nav('/projects')}
          style={{ background: 'none', border: '1px solid #252A3D', color: '#9BA3C8', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
          ← {t('overview', 'Retour')}
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{project.name}</h1>
          <div style={{ fontSize: 12, color: '#5C6490', marginTop: 3 }}>
            {project.methodology} · {project.teamSize} {t('projects', 'membres')} · {project.budget?.toLocaleString()}€
            {risksSaved && <span style={{ color: '#34D399', marginLeft: 8 }}>{t('saved', '✓ Risques IA sauvegardés')}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={exportRapport}
            style={{ background: 'rgba(167,139,250,.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,.2)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            📄 {t('saved', 'Exporter')}
          </button>
          <button onClick={() => nav('/risks')}
            style={{ background: 'rgba(248,113,113,.1)', color: '#F87171', border: '1px solid rgba(248,113,113,.2)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ⚠️ {t('risks', 'Tous les risques')}
          </button>
          <div style={{ textAlign: 'center', background: '#131620', border: `2px solid ${col}44`, borderRadius: 12, padding: '10px 18px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: col }}>{score}</div>
            <div style={{ fontSize: 10, color: '#5C6490' }}>Score IA</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 20, background: '#131620', padding: 4, borderRadius: 10, border: '1px solid #252A3D', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, minWidth: 'fit-content', padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
              background: activeTab === t.id ? '#1A1D28' : 'transparent',
              color: activeTab === t.id ? '#E8EAF6' : '#5C6490' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Vue globale ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          <div>
            {/* Indicateurs */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Indicateurs clés</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {[
                  ['Progression', project.progress + '%', '#4F8FFF'],
                  ['Budget utilisé', Math.round((project.budgetUsed / Math.max(project.budget, 1)) * 100) + '%', '#F59E0B'],
                  ['Vélocité', project.velocity + ' pts', '#A78BFA'],
                  ['Équipe', project.teamSize + ' membres', '#34D399'],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ background: '#1A1D28', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#5C6490', marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prédictions */}
            {analysis && (
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Analyse de santé</div>
                  <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: healthStatusColor(analysis.healthStatus), background: `${healthStatusColor(analysis.healthStatus)}22`, border: `1px solid ${healthStatusColor(analysis.healthStatus)}44` }}>
                    {analysis.healthStatus === 'healthy' ? 'Sain' : analysis.healthStatus === 'warning' ? 'À surveiller' : 'Critique'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 10 }}>
                  <div style={{ background: 'linear-gradient(135deg, rgba(79,143,255,.12), rgba(167,139,250,.08))', border: '1px solid rgba(79,143,255,.18)', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 12, color: '#9BA3C8', marginBottom: 6 }}>Score de santé</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: '#E8EAF6' }}>{analysis.healthScore}/100</div>
                    <div style={{ fontSize: 12, color: '#9BA3C8', marginTop: 6 }}>{analysis.healthSummary}</div>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ background: 'rgba(248,113,113,.06)', border: '1px solid rgba(248,113,113,.15)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 11, color: '#9BA3C8' }}>Retard</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#F87171' }}>{analysis.predictions?.delayProbability}%</div>
                    </div>
                    <div style={{ background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 11, color: '#9BA3C8' }}>Budget</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#F59E0B' }}>{Math.round((project.budgetUsed / Math.max(project.budget, 1)) * 100)}%</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div style={{ background: '#1A1D28', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Facteurs positifs</div>
                    {analysis.positives?.length ? analysis.positives.map((item, idx) => (
                      <div key={idx} style={{ fontSize: 11, color: '#9BA3C8', marginBottom: 6 }}><span style={{ color: '#34D399', marginRight: 6 }}>✓</span>{item.label}: {item.detail}</div>
                    )) : <div style={{ fontSize: 11, color: '#5C6490' }}>Aucun facteur positif particulier</div>}
                  </div>
                  <div style={{ background: '#1A1D28', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Facteurs de risque</div>
                    {analysis.negatives?.length ? analysis.negatives.map((item, idx) => (
                      <div key={idx} style={{ fontSize: 11, color: '#9BA3C8', marginBottom: 6 }}><span style={{ color: '#F87171', marginRight: 6 }}>⚠</span>{item.label}: {item.detail}</div>
                    )) : <div style={{ fontSize: 11, color: '#5C6490' }}>Aucun facteur de risque majeur</div>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Colonne droite */}
          <div>
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Probabilité de succès</div>
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 40, fontWeight: 700, fontFamily: 'monospace',
                  color: (analysis?.successProbability || 0) >= 60 ? '#34D399' : (analysis?.successProbability || 0) >= 40 ? '#F59E0B' : '#F87171' }}>
                  {Math.round(analysis?.successProbability || 0)}%
                </div>
                <div style={{ fontSize: 11, color: '#5C6490' }}>GradientBoosting ML</div>
              </div>
              <div style={{ height: 6, background: '#22263A', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (analysis?.successProbability || 0) + '%', borderRadius: 3,
                  background: (analysis?.successProbability || 0) >= 60 ? '#34D399' : '#F87171' }} />
              </div>
            </div>

            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Navigation rapide</div>
              <button onClick={() => setActiveTab('risks')}
                style={{ width: '100%', background: 'rgba(248,113,113,.08)', color: '#F87171', border: '1px solid rgba(248,113,113,.15)', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 6 }}>
                ⚠️ Voir les risques ({analysis?.risks?.length || 0})
              </button>
              <button onClick={() => setActiveTab('recs')}
                style={{ width: '100%', background: 'rgba(79,143,255,.08)', color: '#4F8FFF', border: '1px solid rgba(79,143,255,.15)', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 6 }}>
                💡 Recommandations ({analysis?.recommendations?.length || 0})
              </button>
              <button onClick={() => setActiveTab('team')}
                style={{ width: '100%', background: 'rgba(52,211,153,.08)', color: '#34D399', border: '1px solid rgba(52,211,153,.15)', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                👥 Équipe ({team.length} membres)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Risques ─────────────────────────────────────────────────────── */}
      {activeTab === 'risks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              Risques détectés par l'IA ({analysis?.risks?.length || 0})
            </div>
            <button onClick={() => nav('/risks')}
              style={{ background: 'rgba(79,143,255,.1)', color: '#4F8FFF', border: '1px solid rgba(79,143,255,.2)', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              Voir tous les risques →
            </button>
          </div>

          {!analysis ? (
            <div style={{ textAlign: 'center', color: '#5C6490', padding: 40, background: '#131620', borderRadius: 12, border: '1px dashed #252A3D' }}>
              Lance python app.py dans ia-engine/ pour voir les risques
            </div>
          ) : analysis.risks?.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#34D399', padding: 40, background: 'rgba(52,211,153,.04)', borderRadius: 12, border: '1px solid rgba(52,211,153,.15)' }}>
              ✓ Aucun risque critique détecté — projet en bonne santé
            </div>
          ) : (
            analysis.risks.map((r, i) => {
              const COLORS = { critical: '#F87171', high: '#F59E0B', medium: '#4F8FFF', low: '#34D399' };
              return (
                <div key={i} style={{ ...card, borderLeft: `3px solid ${COLORS[r.severity] || '#4F8FFF'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                        background: `rgba(${r.severity === 'critical' ? '248,113,113' : r.severity === 'high' ? '245,158,11' : '79,143,255'},.12)`,
                        color: COLORS[r.severity] || '#4F8FFF', padding: '2px 8px', borderRadius: 5, marginRight: 8 }}>
                        {(r.severity || 'medium').toUpperCase()}
                      </span>
                      <span style={{ fontSize: 10, background: 'rgba(167,139,250,.1)', color: '#A78BFA', padding: '2px 7px', borderRadius: 5, fontFamily: 'monospace' }}>
                        ◈ IA détecté
                      </span>
                    </div>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS[r.severity] || '#4F8FFF', fontWeight: 700 }}>
                      {r.probability}%
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: '#9BA3C8', lineHeight: 1.5, marginBottom: 4 }}>{t('detailedDescription', 'Description détaillée')} : {r.description || t('noData', 'Aucune donnée disponible')}</div>
                  <div style={{ fontSize: 12, color: '#5C6490', marginBottom: 6 }}>
                    {t('impactEstimated', 'Impact estimé')} : <strong>{Math.round((r.probability || 0) * (r.severity === 'critical' ? 1.3 : r.severity === 'high' ? 1.1 : r.severity === 'medium' ? 0.8 : 0.5))}%</strong>
                  </div>
                  {r.actions && r.actions.length > 0 && (
                    <div style={{ background: '#1A1D28', borderRadius: 7, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: '#5C6490', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('mitigationPlan', 'Plan de mitigation')}</div>
                      {r.actions.map((a, j) => (
                        <div key={j} style={{ fontSize: 12, color: '#4F8FFF', marginTop: 4 }}>→ {a}</div>
                      ))}
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: Recommandations ─────────────────────────────────────────────── */}
      {activeTab === 'recs' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Recommandations IA ({analysis?.recommendations?.length || 0})
            <span style={{ fontSize: 11, color: '#5C6490', marginLeft: 8, fontWeight: 400 }}>
              Basées sur les indicateurs projet et les risques détectés
            </span>
          </div>
          {!analysis ? (
            <div style={{ textAlign: 'center', color: '#5C6490', padding: 40, background: '#131620', borderRadius: 12, border: '1px dashed #252A3D' }}>
              Lance le serveur IA pour recevoir des recommandations
            </div>
          ) : (
            analysis.recommendations?.map((r, i) => {
              const priorityColor = { urgent: '#F87171', high: '#F59E0B', medium: '#4F8FFF', low: '#34D399' };
              return (
                <div key={i} style={{ ...card, borderLeft: '3px solid #4F8FFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', background: `rgba(${r.priority === 'urgent' ? '248,113,113' : '79,143,255'},.12)`, color: priorityColor[r.priority] || '#4F8FFF', padding: '2px 8px', borderRadius: 5 }}>
                        {(r.priority || 'medium').toUpperCase()}
                      </span>
                    </div>
                    {typeof r.confidence === 'number' && (
                      <span style={{ fontSize: 11, color: '#34D399', fontFamily: 'monospace', fontWeight: 600 }}>
                        Confiance {r.confidence}%
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: '#9BA3C8', lineHeight: 1.5, marginBottom: 8 }}>{r.projectStatus}</div>
                  <div style={{ fontSize: 12, color: '#E8EAF6', marginBottom: 8 }}><strong>Analyse :</strong> {r.analysis}</div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#34D399', marginBottom: 4 }}>Forces</div>
                    {r.strengths?.map((item, idx) => <div key={idx} style={{ fontSize: 11, color: '#9BA3C8', marginBottom: 3 }}>• {item}</div>)}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#F59E0B', marginBottom: 4 }}>Faiblesses</div>
                    {r.weaknesses?.map((item, idx) => <div key={idx} style={{ fontSize: 11, color: '#9BA3C8', marginBottom: 3 }}>• {item}</div>)}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#4F8FFF', marginBottom: 4 }}>Actions recommandées</div>
                    {r.recommendedActions?.map((item, idx) => <div key={idx} style={{ fontSize: 11, color: '#9BA3C8', marginBottom: 3 }}>→ {item}</div>)}
                  </div>
                  <div style={{ fontSize: 11, color: '#5C6490' }}>Impact : {r.impact} · Effort : {r.effort}</div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: Équipe ──────────────────────────────────────────────────────── */}
      {activeTab === 'team' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Membres de l'équipe ({team.length})</div>
            <button onClick={() => setShowMemberForm(!showMemberForm)}
              style={{ background: '#4F8FFF', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {showMemberForm ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

          {showMemberForm && (
            <form onSubmit={addMember} style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#9BA3C8', display: 'block', marginBottom: 4 }}>Nom *</label>
                  <input style={inp} value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} required placeholder="Prénom Nom" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#9BA3C8', display: 'block', marginBottom: 4 }}>Rôle *</label>
                  <input style={inp} value={memberForm.role} onChange={e => setMemberForm({ ...memberForm, role: e.target.value })} required placeholder="Ex: Lead Dev" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#9BA3C8', display: 'block', marginBottom: 4 }}>Email</label>
                  <input style={inp} type="email" value={memberForm.email} onChange={e => setMemberForm({ ...memberForm, email: e.target.value })} placeholder="email@exemple.com" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#9BA3C8', display: 'block', marginBottom: 4 }}>Charge : {memberForm.workload}%</label>
                  <input type="range" min="0" max="130" value={memberForm.workload}
                    onChange={e => setMemberForm({ ...memberForm, workload: +e.target.value })}
                    style={{ width: '100%', marginTop: 8 }} />
                </div>
              </div>
              <button type="submit"
                style={{ background: '#34D399', color: '#0D0F14', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ✓ Ajouter
              </button>
            </form>
          )}

          {team.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#5C6490', padding: 40, background: '#131620', borderRadius: 12, border: '1px dashed #252A3D' }}>
              Aucun membre — cliquez sur "+ Ajouter"
            </div>
          ) : (
            team.map(m => (
              <div key={m._id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#2D5FCC,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {m.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#5C6490' }}>{m.role}{m.email ? ` · ${m.email}` : ''}</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 90 }}>
                  <div style={{ height: 5, background: '#22263A', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                    <div style={{ height: '100%', width: Math.min(m.workload, 100) + '%', borderRadius: 3,
                      background: m.workload > 100 ? '#F87171' : m.workload > 80 ? '#F59E0B' : '#34D399' }} />
                  </div>
                  <div style={{ fontSize: 11, color: m.workload > 100 ? '#F87171' : '#9BA3C8' }}>{m.workload}%</div>
                </div>
                <button onClick={() => delMember(m._id)}
                  style={{ background: 'none', border: 'none', color: '#5C6490', cursor: 'pointer', fontSize: 14 }}>🗑</button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB: Tâches ─────────────────────────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Plan d'action du projet ({tasks.length})</div>
            <button onClick={() => setShowTaskForm(!showTaskForm)} style={{ background: '#4F8FFF', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {showTaskForm ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

          {showTaskForm && (
            <form onSubmit={addTask} style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#9BA3C8', display: 'block', marginBottom: 4 }}>Tâche</label>
                  <input style={inp} value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} required placeholder="Ex: Finaliser la revue budget" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#9BA3C8', display: 'block', marginBottom: 4 }}>Priorité</label>
                  <select style={inp} value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    {['low','medium','high','urgent'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#9BA3C8', display: 'block', marginBottom: 4 }}>Statut</label>
                  <select style={inp} value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}>
                    {['planned','in-progress','done'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" style={{ background: '#34D399', color: '#0D0F14', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Enregistrer</button>
            </form>
          )}

          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#5C6490', padding: 40, background: '#131620', borderRadius: 12, border: '1px dashed #252A3D' }}>
              Aucune tâche — ajoutez une action claire pour guider l'équipe.
            </div>
          ) : tasks.map(task => (
            <div key={task.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <button onClick={() => toggleTaskStatus(task.id)} style={{ border: 'none', background: task.status === 'done' ? '#34D399' : '#1A1D28', color: task.status === 'done' ? '#0D0F14' : '#9BA3C8', borderRadius: 999, width: 26, height: 26, cursor: 'pointer' }}>✓</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: task.status === 'done' ? '#34D399' : '#E8EAF6', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</div>
                <div style={{ fontSize: 11, color: '#5C6490', marginTop: 3 }}>Priorité: {task.priority} · Statut: {task.status}</div>
              </div>
              <button onClick={() => delTask(task.id)} style={{ background: 'none', border: 'none', color: '#5C6490', cursor: 'pointer', fontSize: 14 }}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Commentaires ────────────────────────────────────────────────── */}
      {activeTab === 'comments' && (
        <div>
          <form onSubmit={submitComment} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={newComment} onChange={e => setNewComment(e.target.value)}
              placeholder="Ajouter un commentaire..."
              style={{ flex: 1, background: '#1A1D28', border: '1px solid #252A3D', borderRadius: 8, padding: '10px 12px', color: '#E8EAF6', fontSize: 13, outline: 'none' }} />
            <button type="submit" disabled={!newComment.trim()}
              style={{ background: '#4F8FFF', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !newComment.trim() ? 0.5 : 1 }}>
              Envoyer
            </button>
          </form>

          {comments.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#5C6490', padding: 40, background: '#131620', borderRadius: 12, border: '1px dashed #252A3D' }}>
              Aucun commentaire — soyez le premier !
            </div>
          ) : (
            comments.map(c => (
              <div key={c._id} style={{ ...card, display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#4F8FFF,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {c.userName?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.userName}</span>
                    <span style={{ fontSize: 11, color: '#5C6490', fontFamily: 'monospace' }}>{timeAgo(c.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#9BA3C8', lineHeight: 1.5 }}>{c.text}</div>
                </div>
                <button onClick={() => delComment(c._id)}
                  style={{ background: 'none', border: 'none', color: '#5C6490', cursor: 'pointer', fontSize: 12, alignSelf: 'flex-start' }}>✕</button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB: Historique ──────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Historique des modifications ({history.length})
          </div>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#5C6490', padding: 40, background: '#131620', borderRadius: 12, border: '1px dashed #252A3D' }}>
              Aucun historique disponible
            </div>
          ) : (
            history.map((h, i) => {
              const actionColors = {
                'Score IA calculé': '#22D3EE', 'Projet créé': '#34D399',
                'Membre ajouté': '#A78BFA', 'Commentaire ajouté': '#F59E0B',
                'Risque détecté': '#F87171', 'Risque résolu': '#34D399',
              };
              return (
                <div key={h._id || i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #252A3D' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: actionColors[h.action] || '#5C6490', flexShrink: 0, marginTop: 6 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      <span style={{ color: actionColors[h.action] || '#E8EAF6' }}>{h.action}</span>
                      {h.field && <span style={{ color: '#5C6490' }}> · {h.field}</span>}
                    </div>
                    {h.newValue && (
                      <div style={{ fontSize: 12, color: '#9BA3C8', marginTop: 2 }}>
                        {h.oldValue && <><span style={{ color: '#F87171' }}>{h.oldValue}</span> → </>}
                        <span style={{ color: '#34D399' }}>{h.newValue}</span>
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#5C6490', marginTop: 3, fontFamily: 'monospace' }}>
                      {h.userName || 'Système'} · {timeAgo(h.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
      </div>
    </div>
  );
}
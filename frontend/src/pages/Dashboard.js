import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import API from '../utils/api';

const demoProjects = [
  { _id: 'demo-1', name: 'Portail client IA', status: 'active', methodology: 'Scrum', progress: 72, teamSize: 8, aiScore: 8.4, budgetRatio: 68 },
  { _id: 'demo-2', name: 'Migration cloud data', status: 'active', methodology: 'Kanban', progress: 54, teamSize: 6, aiScore: 6.9, budgetRatio: 74 },
  { _id: 'demo-3', name: 'Automatisation support', status: 'delivered', methodology: 'Agile', progress: 100, teamSize: 5, aiScore: 9.1, budgetRatio: 91 },
  { _id: 'demo-4', name: 'Refonte mobile PREDYNEX', status: 'late', methodology: 'Scrum', progress: 43, teamSize: 7, aiScore: 5.7, budgetRatio: 86 },
];

const demoRisks = [
  { _id: 'risk-1', title: 'Dependance fournisseur critique', severity: 'critical', status: 'active', probability: 78, projectId: { name: 'Refonte mobile PREDYNEX' } },
  { _id: 'risk-2', title: 'Derive budgetaire sprint 4', severity: 'high', status: 'active', probability: 61, projectId: { name: 'Migration cloud data' } },
  { _id: 'risk-3', title: 'Capacite QA insuffisante', severity: 'medium', status: 'active', probability: 45, projectId: { name: 'Portail client IA' } },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const nav = useNavigate();
  const [projects, setProjects] = useState([]);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Prédictions /predict (même source que Analyse IA / Risques / Recommandations),
  // indexées par id de projet. Sert à ancrer le cercle "Sante risques" du
  // portefeuille sur le healthScore réel plutôt qu'une heuristique locale.
  const [healthById, setHealthById] = useState({});
  const [healthLoading, setHealthLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      API.get('/projects').catch(() => ({ data: [] })),
      API.get('/risks').catch(() => ({ data: [] }))
    ]).then(([pRes, rRes]) => {
      setProjects(pRes.data);
      setRisks(rRes.data);
      setLoading(false);

      const realProjects = pRes.data || [];
      if (realProjects.length) {
        setHealthLoading(true);
        Promise.all(
          realProjects.map((project) =>
            fetch('http://localhost:8000/predict', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(project),
            })
              .then((r) => r.json())
              .then((result) => [project._id, result])
              .catch(() => [project._id, null])
          )
        ).then((entries) => {
          setHealthById(Object.fromEntries(entries.filter(([, v]) => v)));
          setHealthLoading(false);
        });
      }
    });
  }, []);

  const sourceProjects = projects.length ? projects : demoProjects;
  const sourceRisks = risks.length ? risks : demoRisks;
  const activeRisks = sourceRisks.filter(r => r.status === 'active');
  const activeProjects = sourceProjects.filter(p => p.status === 'active').length;
  const deliveredProjects = sourceProjects.filter(p => p.status === 'delivered').length;
  const lateProjects = sourceProjects.filter(p => p.status === 'late').length;
  const avgProgress = sourceProjects.length
    ? Math.round(sourceProjects.reduce((a, p) => a + Number(p.progress || 0), 0) / sourceProjects.length)
    : 0;
  const avgScore = sourceProjects.length
    ? Number((sourceProjects.reduce((a, p) => a + Number(p.aiScore || 0), 0) / sourceProjects.length).toFixed(1))
    : 0;
  const avgBudget = sourceProjects.length
    ? Math.round(sourceProjects.reduce((a, p, i) => a + budgetRatio(p, i), 0) / sourceProjects.length)
    : 0;
  const criticalRisks = activeRisks.filter(r => r.severity === 'critical').length;
  const highRisks = activeRisks.filter(r => r.severity === 'high').length;
  const successRate = sourceProjects.length
    ? Math.round(sourceProjects.filter(p => Number(p.aiScore || 0) >= 7).length / sourceProjects.length * 100)
    : 0;

  const scoreColor = (s) => s >= 7 ? colors.success : s >= 5 ? colors.warning : colors.danger;
  const card = {
    background: `linear-gradient(180deg, ${colors.panel}, rgba(19,22,32,0.86))`,
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    padding: '18px 20px',
    boxShadow: '0 18px 45px rgba(0,0,0,0.18)',
  };

  const chartGrid = 'rgba(92,100,144,0.18)';
  const mutedTick = colors.subtle;

  // Cercle "Sante risques" du portefeuille : ancré sur la moyenne des
  // healthScore réels (/predict) quand ils sont disponibles, avec les mêmes
  // seuils de couleur que les pages Analyse IA / Risques / Recommandations
  // (>=70 sain, >=46 avertissement, en dessous critique). Repli sur
  // l'ancienne heuristique (comptage de risques) si /predict est
  // indisponible, pour ne jamais casser l'affichage.
  const realHealthScores = Object.values(healthById)
    .map((h) => h?.healthScore)
    .filter((v) => typeof v === 'number');

  const riskScoreFallback = Math.min(100, Math.round((criticalRisks * 35 + highRisks * 18 + activeRisks.length * 7) / Math.max(1, sourceProjects.length)));
  const riskHealthFallback = Math.max(8, 100 - riskScoreFallback);

  const riskHealth = realHealthScores.length
    ? Math.round(realHealthScores.reduce((a, v) => a + v, 0) / realHealthScores.length)
    : riskHealthFallback;
  const riskHealthColor = riskHealth >= 70 ? colors.success : riskHealth >= 46 ? colors.warning : colors.danger;

  const weeklyData = ['S-5', 'S-4', 'S-3', 'S-2', 'S-1', 'Auj.'].map((label, i) => {
    const momentum = i - 2;
    return {
      label,
      progress: clamp(avgProgress - 14 + i * 4 + (i % 2 ? 2 : 0), 18, 100),
      budget: clamp(avgBudget - 8 + i * 3, 25, 100),
      risks: clamp(activeRisks.length + (2 - i) + (i === 4 ? 1 : 0), 0, 12),
      score: clamp(avgScore * 10 + momentum * 3, 35, 96),
    };
  });

  const riskBars = [
    { label: 'Critique', value: criticalRisks, color: colors.danger },
    { label: 'Eleve', value: highRisks, color: colors.warning },
    { label: 'Modere', value: activeRisks.filter(r => r.severity === 'medium').length, color: colors.accent },
    { label: 'Faible', value: activeRisks.filter(r => r.severity === 'low').length, color: colors.success },
  ];

  const budgetData = sourceProjects.slice(0, 5).map((p, i) => ({
    name: shortName(p.name || `Projet ${i + 1}`),
    budget: budgetRatio(p, i),
    progress: Number(p.progress || 0),
  }));

  const kpis = [
    { label: 'Progression moyenne', value: `${avgProgress}%`, trend: '+8.6%', color: colors.accent, detail: `${activeProjects} projets actifs`, chart: 'progress' },
    { label: 'Budget consomme', value: `${avgBudget}%`, trend: avgBudget > 82 ? '+5.1%' : '-3.4%', color: avgBudget > 82 ? colors.warning : colors.success, detail: avgBudget > 82 ? 'Surveillance requise' : 'Sous controle', chart: 'budget' },
    { label: 'Score IA moyen', value: `${avgScore}/10`, trend: '+0.7', color: scoreColor(avgScore), detail: `${successRate}% de succes`, chart: 'score' },
    { label: 'Risques actifs', value: activeRisks.length, trend: criticalRisks ? '+12.0%' : '-9.5%', color: criticalRisks ? colors.danger : colors.success, detail: `${criticalRisks} critique(s)`, chart: 'risk' },
  ];

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: colors.muted }}>Chargement...</div>
  );

  return (
    <div className="dashboard-premium" style={{ padding: 24, background: colors.page, minHeight: '100%' }}>
      <div
        className="dashboard-hero"
        style={{
          marginBottom: 20,
          padding: '24px 26px',
          borderRadius: 18,
          background: `${colors.hero}, linear-gradient(180deg, rgba(255,255,255,0.04), transparent)`,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.16)',
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr',
          gap: 20,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: colors.accent, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
            Executive workspace
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: colors.text, lineHeight: 1.15 }}>
            Bonjour, {user?.name || 'Manager'}
          </h1>
          <p style={{ color: colors.muted, fontSize: 13, marginTop: 7, maxWidth: 560 }}>
            Vue globale des projets, budgets et risques avec indicateurs de tendance en temps reel.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Portfolio', value: sourceProjects.length, color: colors.accent },
            { label: 'Livres', value: deliveredProjects, color: colors.success },
            { label: 'En retard', value: lateProjects, color: colors.danger },
          ].map(item => (
            <div key={item.label} style={{ background: 'rgba(7,11,20,0.34)', border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: colors.subtle, textTransform: 'uppercase', marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
        {kpis.map((k, index) => (
          <div key={k.label} className="dashboard-card dashboard-kpi-card" style={{ ...card, animationDelay: `${index * 70}ms` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: colors.subtle, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: k.color, fontFamily: 'monospace', lineHeight: 1 }}>{k.value}</div>
              </div>
              <div style={{
                alignSelf: 'flex-start',
                color: k.trend.startsWith('-') ? colors.success : k.color,
                background: `${k.trend.startsWith('-') ? colors.success : k.color}18`,
                border: `1px solid ${k.trend.startsWith('-') ? colors.success : k.color}2b`,
                borderRadius: 999,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
              }}>
                {k.trend}
              </div>
            </div>
            <MiniChart type={k.chart} color={k.color} data={weeklyData} />
            <div style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>{k.detail}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr .9fr', gap: 16, marginBottom: 16 }}>
        <div className="dashboard-card" style={card}>
          <SectionTitle title="Progression portfolio" subtitle="Tendance 6 semaines : progression, budget et score IA" colors={colors} />
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={weeklyData} margin={{ top: 8, right: 14, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.accent} stopOpacity={0.34} />
                    <stop offset="95%" stopColor={colors.accent} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="budgetFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.warning} stopOpacity={0.26} />
                    <stop offset="95%" stopColor={colors.warning} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartGrid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: mutedTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: mutedTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: colors.panelAlt, border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text }} />
                <Area type="monotone" dataKey="progress" stroke={colors.accent} strokeWidth={3} fill="url(#progressFill)" name="Progression" />
                <Area type="monotone" dataKey="budget" stroke={colors.warning} strokeWidth={2} fill="url(#budgetFill)" name="Budget" />
                <Area type="monotone" dataKey="score" stroke={colors.success} strokeWidth={2} fill="transparent" name="Score IA" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-card" style={card}>
          <SectionTitle title="Sante risques" subtitle={healthLoading ? 'Exposition active du portefeuille / synchronisation...' : 'Exposition active du portefeuille'} colors={colors} />
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 150, height: 150 }}>
              <ResponsiveContainer>
                <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ name: 'Health', value: riskHealth, fill: riskHealthColor }]} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={12} background={{ fill: colors.panelAlt }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: -92, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: riskHealthColor, fontFamily: 'monospace' }}>{riskHealth}</div>
                <div style={{ fontSize: 10, color: colors.subtle, textTransform: 'uppercase' }}>health</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              {riskBars.map(r => (
                <div key={r.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.muted, marginBottom: 5 }}>
                    <span>{r.label}</span><span style={{ color: r.color, fontWeight: 700 }}>{r.value}</span>
                  </div>
                  <div style={{ height: 7, background: colors.panelAlt, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (r.value / Math.max(1, activeRisks.length)) * 100)}%`, height: '100%', background: r.color, borderRadius: 999, transition: 'width .7s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 16 }}>
        <div className="dashboard-card" style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
            <SectionTitle title="Projets recents" subtitle="Priorite, avancement et score de confiance" colors={colors} noMargin />
            <button onClick={() => nav('/projects')} className="dashboard-primary-button"
              style={{ background: colors.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              + Nouveau projet
            </button>
          </div>
          {sourceProjects.slice(0, 6).map((p, i) => (
            <div key={p._id || i} onClick={() => projects.length && nav(`/projects/${p._id}`)}
              className="dashboard-row"
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 130px 58px', gap: 14, alignItems: 'center', padding: '13px 0', borderBottom: `1px solid ${colors.border}`, cursor: projects.length ? 'pointer' : 'default' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: scoreColor(Number(p.aiScore || 0)), boxShadow: `0 0 16px ${scoreColor(Number(p.aiScore || 0))}66` }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                </div>
                <div style={{ fontSize: 11, color: colors.subtle }}>
                  {p.methodology || 'Agile'} / {p.teamSize || 4} membres / Budget {budgetRatio(p, i)}%
                </div>
              </div>
              <div>
                <div style={{ height: 7, background: colors.panelAlt, borderRadius: 999, overflow: 'hidden', marginBottom: 5 }}>
                  <div style={{ height: '100%', width: `${Number(p.progress || 0)}%`, background: colors.accent, borderRadius: 999, transition: 'width .8s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: colors.subtle }}>
                  <span>Progression</span><span>{p.progress || 0}%</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(Number(p.aiScore || 0)), fontFamily: 'monospace' }}>{p.aiScore || 0}</div>
                <div style={{ fontSize: 10, color: colors.subtle }}>score</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Analyse IA', sub: 'Auditer les projets', path: '/analysis', col: colors.accent },
            { label: 'Previsions', sub: '30 / 60 / 90 jours', path: '/forecast', col: colors.purple },
            { label: 'Risques', sub: `${criticalRisks} critique(s)`, path: '/risks', col: colors.danger },
            { label: 'Jalons', sub: 'Objectifs & milestones', path: '/milestones', col: colors.success },
            { label: 'Rapport hebdo', sub: 'Generer le rapport', path: '/reports', col: colors.warning },
          ].map(item => (
            <div key={item.path} onClick={() => nav(item.path)}
              className="dashboard-card dashboard-shortcut"
              style={{ ...card, padding: '13px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${item.col}2b` }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${item.col}18`, color: item.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{item.label[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{item.label}</div>
                <div style={{ fontSize: 11, color: colors.subtle, marginTop: 1 }}>{item.sub}</div>
              </div>
              <span style={{ color: item.col, fontSize: 16 }}>-&gt;</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="dashboard-card" style={card}>
          <SectionTitle title="Budget par projet" subtitle="Consommation comparee a la progression" colors={colors} />
          <div style={{ width: '100%', height: 210 }}>
            <ResponsiveContainer>
              <BarChart data={budgetData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={chartGrid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: mutedTick, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: mutedTick, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: colors.panelAlt, border: `1px solid ${colors.border}`, borderRadius: 10, color: colors.text }} />
                <Bar dataKey="budget" radius={[6, 6, 0, 0]} name="Budget">
                  {budgetData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.budget > 84 ? colors.danger : entry.budget > 72 ? colors.warning : colors.success} />
                  ))}
                </Bar>
                <Bar dataKey="progress" radius={[6, 6, 0, 0]} fill={colors.accent} name="Progression" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-card" style={card}>
          <SectionTitle title="Risques actifs recents" subtitle="Priorises par severite et probabilite" colors={colors} />
          {activeRisks.slice(0, 4).map((r, i) => {
            const col = r.severity === 'critical' ? colors.danger : r.severity === 'high' ? colors.warning : r.severity === 'low' ? colors.success : colors.accent;
            return (
              <div key={r._id || i} className="dashboard-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${col}18`, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                  {Math.round(r.probability || (r.severity === 'critical' ? 78 : 52))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: colors.subtle, marginTop: 2 }}>{r.projectId?.name || 'Projet transverse'} / {r.severity}</div>
                </div>
                <div style={{ color: col, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{r.status}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle, colors, noMargin = false }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: colors.text }}>{title}</div>
      <div style={{ fontSize: 11, color: colors.subtle, marginTop: 3 }}>{subtitle}</div>
    </div>
  );
}

function MiniChart({ type, color, data }) {
  if (type === 'risk') {
    const max = Math.max(...data.map(d => d.risks), 1);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 42 }}>
        {data.map(d => <div key={d.label} style={{ flex: 1, height: `${Math.max(7, d.risks / max * 42)}px`, background: color, opacity: .72, borderRadius: '4px 4px 1px 1px', transition: 'height .6s ease' }} />)}
      </div>
    );
  }

  const key = type === 'budget' ? 'budget' : type === 'score' ? 'score' : 'progress';
  const points = data.map((d, i) => {
    const x = i * (120 / (data.length - 1));
    const y = 44 - (d[key] / 100) * 38;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 120 46" width="100%" height="46" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,46 ${points} 120,46`} fill={color} opacity=".10" />
    </svg>
  );
}

function budgetRatio(project, index) {
  if (Number.isFinite(Number(project.budgetRatio))) return clamp(Number(project.budgetRatio), 0, 120);
  if (Number.isFinite(Number(project.budgetUsed))) return clamp(Number(project.budgetUsed), 0, 120);
  if (Number.isFinite(Number(project.spentBudget)) && Number.isFinite(Number(project.budget)) && Number(project.budget) > 0) {
    return clamp(Math.round(Number(project.spentBudget) / Number(project.budget) * 100), 0, 120);
  }
  return clamp(Math.round(Number(project.progress || 0) * 0.82 + 18 + (index % 3) * 4), 20, 96);
}

function shortName(name) {
  return name.length > 12 ? `${name.slice(0, 11)}.` : name;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
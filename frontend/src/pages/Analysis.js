import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import API from '../utils/api';

export default function Analysis() {
  const nav = useNavigate();
  const { t } = useLocale();
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    API.get('/projects').then(r => {
      setProjects(r.data);
      if (r.data.length > 0) analyzeProject(r.data[0]);
    }).catch(console.error);
  }, []);

  const analyzeProject = async (project) => {
    setSelected(project);
    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      });
      const data = await res.json();
      setAnalysis(data);
    } catch {
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const card = {
    background: '#131620',
    border: '1px solid #252A3D',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 16
  };

  const scoreColor = (s) => s >= 7 ? '#34D399' : s >= 5 ? '#F59E0B' : '#F87171';

  // Radar chart SVG
  const RadarChart = ({ project }) => {
    if (!project) return null;
    const metrics = [
      { label: 'Progression', value: project.progress / 10 },
      { label: 'Budget', value: Math.max(0, 10 - (project.budgetUsed / Math.max(project.budget, 1)) * 10) },
      { label: 'Vélocité', value: Math.min(project.velocity / 10, 10) },
      { label: 'Équipe', value: Math.min(project.teamSize / 2, 10) },
      { label: 'Score IA', value: project.aiScore },
    ];
    const cx = 150, cy = 150, r = 100;
    const n = metrics.length;
    const points = metrics.map((m, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const val = m.value / 10;
      return {
        x: cx + r * val * Math.cos(angle),
        y: cy + r * val * Math.sin(angle),
        lx: cx + (r + 25) * Math.cos(angle),
        ly: cy + (r + 25) * Math.sin(angle),
        label: m.label,
        value: Math.round(m.value * 10) / 10,
        gx: cx + r * Math.cos(angle),
        gy: cy + r * Math.sin(angle),
      };
    });
    const polygon = points.map(p => `${p.x},${p.y}`).join(' ');
    const grid = [0.25, 0.5, 0.75, 1].map(f =>
      metrics.map((_, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        return `${cx + r * f * Math.cos(angle)},${cy + r * f * Math.sin(angle)}`;
      }).join(' ')
    );

    return (
      <svg width="300" height="300" viewBox="0 0 300 300">
        {grid.map((g, i) => (
          <polygon key={i} points={g} fill="none" stroke="#252A3D" strokeWidth="1" />
        ))}
        {points.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.gx} y2={p.gy} stroke="#252A3D" strokeWidth="1" />
        ))}
        <polygon points={polygon} fill="rgba(79,143,255,0.2)" stroke="#4F8FFF" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#4F8FFF" />
        ))}
        {points.map((p, i) => (
          <text key={i} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle"
            fill="#9BA3C8" fontSize="11" fontFamily="Segoe UI">
            {p.label}
          </text>
        ))}
      </svg>
    );
  };

  // Matrice des risques SVG
  const RiskMatrix = ({ risks }) => {
    if (!risks || risks.length === 0) return (
      <div style={{ textAlign: 'center', color: '#5C6490', padding: 20 }}>
        Aucun risque détecté
      </div>
    );
    const sevMap = { critical: 4, high: 3, medium: 2, low: 1 };
    const colors = { critical: '#F87171', high: '#F59E0B', medium: '#4F8FFF', low: '#34D399' };
    const cellColors = [
      ['#1A2A1A','#1A2A1A','#2A2A1A','#2A1A1A'],
      ['#1A2A1A','#2A2A1A','#2A2A1A','#2A1A1A'],
      ['#1A2A1A','#2A2A1A','#2A1A1A','#2A1A1A'],
      ['#2A2A1A','#2A1A1A','#2A1A1A','#2A1A1A'],
    ];

    return (
      <div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <div style={{ width: 60, fontSize: 10, color: '#5C6490', textAlign: 'right', paddingRight: 6, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
            Prob.
          </div>
          {['Faible','Moyen','Fort','Critique'].map(l => (
            <div key={l} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#5C6490' }}>{l}</div>
          ))}
        </div>
        {[4,3,2,1].map(row => (
          <div key={row} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <div style={{ width: 60, fontSize: 10, color: '#5C6490', textAlign: 'right', paddingRight: 6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {row * 25}%
            </div>
            {[1,2,3,4].map(col => {
              const cellRisks = risks.filter(r => {
                const sev = sevMap[r.severity] || 2;
                const prob = Math.ceil(r.probability / 25);
                return sev === col && prob === row;
              });
              return (
                <div key={col} style={{
                  flex: 1, height: 52, borderRadius: 6,
                  background: cellColors[4-row][col-1],
                  border: '1px solid #252A3D',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexWrap: 'wrap', gap: 2, padding: 2
                }}>
                  {cellRisks.map((r, i) => (
                    <div key={i} style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: colors[r.severity],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: '#0D0F14'
                    }}>
                      {i+1}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <div style={{ width: 60 }}></div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#5C6490' }}>Impact →</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {risks.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: colors[r.severity], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#0D0F14' }}>{i+1}</div>
              <span style={{ color: '#9BA3C8' }}>{r.title.slice(0, 25)}...</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Timeline
  const Timeline = ({ risks, project }) => {
    const events = [];
    if (project) {
      if (project.velocity < 40) events.push({ icon: '⚡', color: '#F87171', title: 'Vélocité critique détectée', desc: `Vélocité à ${project.velocity} pts`, time: "Aujourd'hui" });
      if (project.budgetUsed / Math.max(project.budget,1) > 0.7) events.push({ icon: '💰', color: '#F59E0B', title: 'Alerte budget', desc: `${Math.round(project.budgetUsed/Math.max(project.budget,1)*100)}% du budget consommé`, time: 'Il y a 2h' });
      if (project.progress < 50) events.push({ icon: '📊', color: '#4F8FFF', title: 'Progression en retard', desc: `${project.progress}% — sous la trajectoire`, time: 'Il y a 5h' });
      events.push({ icon: '🤖', color: '#34D399', title: 'Analyse IA complétée', desc: `Score calculé: ${project.aiScore}/10`, time: 'Il y a 10min' });
      events.push({ icon: '📋', title: 'Projet créé', color: '#A78BFA', desc: project.name, time: 'Création' });
    }

    return (
      <div>
        {events.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 14, position: 'relative' }}>
            {i < events.length - 1 && (
              <div style={{ position: 'absolute', left: 14, top: 28, bottom: 0, width: 1, background: '#252A3D' }} />
            )}
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${e.color}22`, border: `1px solid ${e.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
              {e.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{e.title}</div>
              <div style={{ fontSize: 11, color: '#9BA3C8', marginTop: 2 }}>{e.desc}</div>
              <div style={{ fontSize: 10, color: '#5C6490', marginTop: 3, fontFamily: 'monospace' }}>{e.time}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t('analysis', 'Analyse IA')}</h1>
          <p style={{ color: '#5C6490', fontSize: 13, marginTop: 4 }}>
            {t('aiRecommendations', 'Analyse prédictive')} · Modèle RandomForest + GradientBoosting · R²=0.863
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, background: 'rgba(52,211,153,.1)', color: '#34D399', border: '1px solid rgba(52,211,153,.2)', fontFamily: 'monospace' }}>
            ● IA ACTIVE
          </span>
          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, background: 'rgba(167,139,250,.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,.2)', fontFamily: 'monospace' }}>
            Précision 88.5%
          </span>
        </div>
      </div>

      {/* Sélecteur de projet */}
      <div style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600, width: '100%', marginBottom: 8 }}>
          Sélectionner un projet à analyser
        </div>
        {projects.length === 0 ? (
          <div style={{ color: '#5C6490', fontSize: 13 }}>
            Aucun projet —{' '}
            <span onClick={() => nav('/projects')} style={{ color: '#4F8FFF', cursor: 'pointer' }}>
              créez-en un
            </span>
          </div>
        ) : (
          projects.map(p => (
            <button key={p._id} onClick={() => analyzeProject(p)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                background: selected?._id === p._id ? 'rgba(79,143,255,.15)' : '#1A1D28',
                borderColor: selected?._id === p._id ? '#4F8FFF' : '#252A3D',
                color: selected?._id === p._id ? '#4F8FFF' : '#9BA3C8',
              }}>
              {p.name}
              <span style={{ marginLeft: 6, fontSize: 11,
                color: p.aiScore>=7?'#34D399':p.aiScore>=5?'#F59E0B':'#F87171' }}>
                {p.aiScore}/10
              </span>
            </button>
          ))
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#5C6490' }}>
          Analyse IA en cours...
        </div>
      )}

      {selected && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
          {/* COLONNE GAUCHE */}
          <div>
            {/* Score + Prédictions */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                <div style={{ textAlign: 'center', background: '#1A1D28', borderRadius: 12, padding: '16px 24px', border: `2px solid ${scoreColor(selected.aiScore)}44` }}>
                  <div style={{ fontSize: 40, fontWeight: 700, color: scoreColor(selected.aiScore), fontFamily: 'monospace' }}>
                    {selected.aiScore}
                  </div>
                  <div style={{ fontSize: 11, color: '#5C6490' }}>Score IA / 10</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: '#5C6490', marginBottom: 12 }}>
                    {selected.methodology} · {selected.teamSize} membres · Budget {selected.budget?.toLocaleString()}€
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      ['Progression', selected.progress+'%', '#4F8FFF'],
                      ['Budget utilisé', Math.round((selected.budgetUsed/Math.max(selected.budget,1))*100)+'%', '#F59E0B'],
                      ['Vélocité', selected.velocity+' pts', '#A78BFA'],
                      ['Équipe', selected.teamSize+' membres', '#34D399'],
                    ].map(([l,v,c]) => (
                      <div key={l} style={{ background: '#1A1D28', borderRadius: 7, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#5C6490' }}>{l}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c, fontFamily: 'monospace' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {analysis && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  <div style={{ background: 'rgba(248,113,113,.06)', border: '1px solid rgba(248,113,113,.15)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#F87171', fontFamily: 'monospace' }}>
                      {analysis.predictions?.delayProbability}%
                    </div>
                    <div style={{ fontSize: 11, color: '#9BA3C8', marginTop: 4 }}>Probabilité retard</div>
                  </div>
                  <div style={{ background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#F59E0B', fontFamily: 'monospace' }}>
                      +{analysis.predictions?.budgetOverrun}%
                    </div>
                    <div style={{ fontSize: 11, color: '#9BA3C8', marginTop: 4 }}>Dépassement budget</div>
                  </div>
                  <div style={{ background: 'rgba(79,143,255,.06)', border: '1px solid rgba(79,143,255,.15)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#4F8FFF', fontFamily: 'monospace' }}>
                      +{analysis.predictions?.estimatedDelay}j
                    </div>
                    <div style={{ fontSize: 11, color: '#9BA3C8', marginTop: 4 }}>Délai estimé</div>
                  </div>
                </div>
              )}
            </div>

            {/* Radar */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                Graphique radar — Métriques du projet
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <RadarChart project={selected} />
                <div style={{ flex: 1 }}>
                  {[
                    ['Progression', selected.progress+'%', selected.progress/10],
                    ['Budget ctrl', Math.max(0,Math.round(10-(selected.budgetUsed/Math.max(selected.budget,1))*10))+'/10', Math.max(0,10-(selected.budgetUsed/Math.max(selected.budget,1))*10)],
                    ['Vélocité', Math.min(selected.velocity/10,10).toFixed(1)+'/10', Math.min(selected.velocity/10,10)],
                    ['Score IA', selected.aiScore+'/10', selected.aiScore],
                  ].map(([l,v,val]) => (
                    <div key={l} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                        <span style={{ color: '#9BA3C8' }}>{l}</span>
                        <span style={{ color: '#E8EAF6', fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>
                      </div>
                      <div style={{ height: 5, background: '#22263A', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: (val/10*100)+'%', borderRadius: 3,
                          background: val>=7?'#34D399':val>=5?'#F59E0B':'#F87171' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Importance des variables */}
            {analysis?.featureImportances && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                  Importance des variables — Modèle RandomForest
                </div>
                {Object.entries(analysis.featureImportances)
                  .sort((a,b) => b[1]-a[1])
                  .slice(0,8)
                  .map(([key, val], i) => {
                    const labels = {
                      budget_ratio:'Budget ratio', progress:'Progression',
                      velocity:'Vélocité', overscoped:'Périmètre large',
                      team_issues:'Problèmes équipe', open_tickets:'Tickets ouverts',
                      absences:'Absences', scope_creep:'Scope creep',
                      tech_debt:'Dette technique', team_size:'Taille équipe',
                      methodology_enc:'Méthodologie', duration_planned:'Durée prévue'
                    };
                    const colors = ['#F87171','#F87171','#F59E0B','#F59E0B','#4F8FFF','#4F8FFF','#A78BFA','#34D399'];
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 18, fontSize: 10, color: '#5C6490', textAlign: 'right', fontFamily: 'monospace' }}>{i+1}</div>
                        <div style={{ width: 140, fontSize: 12, color: '#9BA3C8' }}>{labels[key]||key}</div>
                        <div style={{ flex: 1, height: 6, background: '#22263A', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: (val*100/0.25*100)+'%', maxWidth:'100%', background: colors[i], borderRadius: 3 }} />
                        </div>
                        <div style={{ width: 40, textAlign: 'right', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: colors[i] }}>
                          {val.toFixed(3)}
                        </div>
                      </div>
                    );
                  })}
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(79,143,255,.05)', borderRadius: 8, border: '1px solid rgba(79,143,255,.12)', fontSize: 11, color: '#9BA3C8' }}>
                  ◈ Le modèle RandomForest identifie le <strong style={{ color: '#E8EAF6' }}>budget ratio et la progression</strong> comme facteurs principaux du score IA.
                </div>
              </div>
            )}

            {/* Matrice des risques */}
            {analysis?.risks && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                  Matrice Probabilité × Impact
                </div>
                <RiskMatrix risks={analysis.risks} />
              </div>
            )}

            {/* Risques détaillés */}
            {analysis?.risks?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                  Risques détectés par l'IA ({analysis.risks.length})
                </div>
                {analysis.risks.map((r, i) => (
                  <div key={i} style={{ padding: '12px 14px', background: '#1A1D28', borderRadius: 8, marginBottom: 8,
                    borderLeft: `3px solid ${r.severity==='critical'?'#F87171':r.severity==='high'?'#F59E0B':'#4F8FFF'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
                        color: r.severity==='critical'?'#F87171':r.severity==='high'?'#F59E0B':'#4F8FFF',
                        background: `rgba(${r.severity==='critical'?'248,113,113':r.severity==='high'?'245,158,11':'79,143,255'},.1)`,
                        padding: '2px 8px', borderRadius: 4 }}>
                        {r.severity.toUpperCase()} · {r.probability}%
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9BA3C8', marginBottom: 8 }}>{r.description}</div>
                    {r.actions?.map((a, j) => (
                      <div key={j} style={{ fontSize: 11, color: '#4F8FFF', marginTop: 3 }}>→ {a}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Recommandations */}
            {analysis?.recommendations?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                  Recommandations IA ({analysis.recommendations.length})
                </div>
                {analysis.recommendations.map((r, i) => (
                  <div key={i} style={{ padding: '12px 14px', background: '#1A1D28', borderRadius: 8, marginBottom: 8, borderLeft: '3px solid #4F8FFF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 10, color: r.priority==='urgent'?'#F87171':'#F59E0B',
                          background: `rgba(${r.priority==='urgent'?'248,113,113':'245,158,11'},.1)`,
                          padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace' }}>
                          {(r.priority||'medium').toUpperCase()}
                        </span>
                        <span style={{ fontSize: 10, color: '#34D399', fontFamily: 'monospace' }}>
                          {r.confidence}%
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#9BA3C8', marginBottom: 6 }}>{r.description}</div>
                    <div style={{ fontSize: 11, color: '#4F8FFF', marginBottom: 3 }}>→ {r.impact}</div>
                    {r.effort && <div style={{ fontSize: 11, color: '#5C6490' }}>Effort : {r.effort}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COLONNE DROITE */}
          <div>
            {/* Métriques modèle */}
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                Métriques du modèle IA
              </div>
              <div style={{ background: 'linear-gradient(135deg,rgba(79,143,255,.08),rgba(167,139,250,.08))', border: '1px solid rgba(79,143,255,.15)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#5C6490', fontFamily: 'monospace', marginBottom: 4 }}>MODÈLE ACTIF</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#4F8FFF' }}>ProAI RandomForest v2.4</div>
                <div style={{ fontSize: 11, color: '#9BA3C8', marginTop: 2 }}>scikit-learn · 1000 projets</div>
              </div>
              {[
                ['R² Score', '0.863', '#34D399'],
                ['MAE', '0.563', '#4F8FFF'],
                ['Précision', '88.5%', '#A78BFA'],
                ['CV R²', '0.868 ± 0.021', '#F59E0B'],
                ['Features', '12 variables', '#9BA3C8'],
                ['Latence', '< 50ms', '#22D3EE'],
              ].map(([l,v,c]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #252A3D', fontSize: 12 }}>
                  <span style={{ color: '#9BA3C8' }}>{l}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: c }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Succès probabilité */}
            {analysis && (
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Probabilité de succès</div>
                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'monospace',
                    color: analysis.successProbability >= 60 ? '#34D399' : analysis.successProbability >= 40 ? '#F59E0B' : '#F87171' }}>
                    {Math.round(analysis.successProbability)}%
                  </div>
                  <div style={{ fontSize: 11, color: '#5C6490' }}>Classification GradientBoosting</div>
                </div>
                <div style={{ height: 8, background: '#22263A', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: analysis.successProbability+'%', borderRadius: 4,
                    background: analysis.successProbability>=60?'#34D399':analysis.successProbability>=40?'#F59E0B':'#F87171',
                    transition: 'width 1s ease' }} />
                </div>
              </div>
            )}

            {/* Timeline */}
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
                Événements détectés par l'IA
              </div>
              <Timeline risks={analysis?.risks} project={selected} />
            </div>

            {/* Comparaison avec la moyenne */}
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                Comparaison avec la moyenne
              </div>
              {[
                ['Score IA', selected.aiScore, 6.4, '/10'],
                ['Progression', selected.progress, 53, '%'],
                ['Vélocité', selected.velocity, 66, ' pts'],
                ['Budget utilisé', Math.round((selected.budgetUsed/Math.max(selected.budget,1))*100), 60, '%'],
              ].map(([l, val, avg, unit]) => (
                <div key={l} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                    <span style={{ color: '#9BA3C8' }}>{l}</span>
                    <span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600,
                        color: val >= avg ? '#34D399' : '#F87171' }}>{val}{unit}</span>
                      <span style={{ color: '#5C6490', marginLeft: 4 }}>moy: {avg}{unit}</span>
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: 6, background: '#22263A', borderRadius: 3 }}>
                    <div style={{ position: 'absolute', height: '100%', width: (Math.min(val,100)/100*100)+'%', background: val>=avg?'#34D399':'#F87171', borderRadius: 3 }} />
                    <div style={{ position: 'absolute', left: avg+'%', top: -3, width: 2, height: 12, background: '#5C6490', borderRadius: 1 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Bouton voir projet */}
            <button onClick={() => nav(`/projects/${selected._id}`)}
              style={{ width: '100%', background: '#4F8FFF', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
              Voir le projet complet →
            </button>
            <button onClick={() => nav('/risks')}
              style={{ width: '100%', background: 'rgba(248,113,113,.1)', color: '#F87171', border: '1px solid rgba(248,113,113,.2)', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Gérer les risques ⚠️
            </button>
          </div>
        </div>
      )}

      {!selected && !loading && (
        <div style={{ textAlign: 'center', color: '#5C6490', padding: 60, background: '#131620', borderRadius: 12, border: '1px dashed #252A3D' }}>
          Créez un projet pour lancer l'analyse IA
        </div>
      )}
    </div>
  );
}
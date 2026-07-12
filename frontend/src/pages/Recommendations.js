import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

const PRIORITY_META = {
  critical: { label: 'Critique', color: '#F87171', bg: 'rgba(248, 113, 113, 0.12)' },
  high: { label: 'Haute', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.14)' },
  medium: { label: 'Moyenne', color: '#4F8FFF', bg: 'rgba(79, 143, 255, 0.14)' },
  low: { label: 'Faible', color: '#34D399', bg: 'rgba(52, 211, 153, 0.12)' },
};

const formatPercent = (value) => `${Math.round(value)}%`;

const getStatusLabel = (status) => {
  switch (status) {
    case 'blocked': return 'Bloqué';
    case 'late': return 'En retard';
    case 'delivered': return 'Livré';
    default: return 'Actif';
  }
};

const formatDate = (value) => {
  if (!value) return 'À définir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'À définir';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Repli local — utilisé uniquement si /predict est indisponible pour ce
// projet (échec réseau ou chargement en cours). Dès que la prédiction est
// disponible, getRiskProfile s'appuie exclusivement sur healthStatus/healthScore
// pour rester strictement aligné avec les pages Analyse IA et Risques.
const getFallbackRiskProfile = (project) => {
  const budget = Number(project.budget || 0);
  const budgetUsed = Number(project.budgetUsed || 0);
  const budgetRatio = budget > 0 ? budgetUsed / budget : 0;
  const progress = Number(project.progress || 0);
  const velocity = Number(project.velocity || 0);
  const openTickets = Number(project.openTickets || 0);
  const status = project.status || 'active';
  let score = 0;

  if (status === 'blocked') score += 5;
  else if (status === 'late') score += 3;
  if (budgetRatio > 0.8) score += 2;
  if (progress < 45) score += 2;
  if (velocity < 40) score += 2;
  if (openTickets > 8) score += 1;
  if (project.overscoped || project.scopeCreep || project.teamIssues || project.techDebt) score += 1;

  if (score >= 7) return { label: 'Élevé', color: '#F87171', bg: 'rgba(248, 113, 113, 0.16)', score: 80, width: '92%' };
  if (score >= 4) return { label: 'Moyen', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.16)', score: 55, width: '64%' };
  return { label: 'Faible', color: '#34D399', bg: 'rgba(52, 211, 153, 0.14)', score: 25, width: '34%' };
};

// Source de vérité unique : le statut de santé renvoyé par /predict (même
// endpoint que les pages Analyse IA et Risques). On en dérive un niveau de
// risque et une largeur de barre cohérents, pour que cette page ne puisse
// jamais afficher un verdict contraire aux deux autres pour le même projet.
const getRiskProfile = (project, health) => {
  if (!health) return getFallbackRiskProfile(project);
  const riskScore = Math.max(0, Math.min(100, 100 - (health.healthScore ?? 50)));
  if (health.healthStatus === 'critical') {
    return { label: 'Élevé', color: '#F87171', bg: 'rgba(248, 113, 113, 0.16)', score: riskScore, width: `${Math.max(riskScore, 60)}%` };
  }
  if (health.healthStatus === 'warning') {
    return { label: 'Moyen', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.16)', score: riskScore, width: `${Math.max(riskScore, 35)}%` };
  }
  return { label: 'Faible', color: '#34D399', bg: 'rgba(52, 211, 153, 0.14)', score: riskScore, width: `${Math.max(riskScore, 15)}%` };
};

const buildRecommendations = (project) => {
  const budget = Number(project.budget || 0);
  const budgetUsed = Number(project.budgetUsed || 0);
  const budgetRatio = budget > 0 ? budgetUsed / budget : 0;
  const progress = Number(project.progress || 0);
  const velocity = Number(project.velocity || 0);
  const teamSize = Number(project.teamSize || 0);
  const openTickets = Number(project.openTickets || 0);
  const absences = Number(project.absences || 0);
  const status = project.status || 'active';
  const recs = [];

  if (budgetRatio > 0.8) {
    recs.push({
      title: 'Réviser le budget de la phase actuelle',
      constat: `Le budget consommé atteint ${formatPercent(budgetRatio * 100)} alors que l’avancement est à ${progress}%.`,
      impact: 'Protection du budget et réduction du risque de dépassement.',
      actions: [
        'Comparer les dépenses engagées aux livrables attendus cette semaine.',
        'Reporter ou suspendre les dépenses non prioritaires jusqu’à la prochaine revue.',
        'Valider avec les parties prenantes les priorités de dépenses restantes.'
      ],
      priority: 'high',
      result: 'Meilleure maîtrise financière et moins de pression sur la livraison.'
    });
  }

  if (progress < 45 || status === 'late' || status === 'blocked') {
    recs.push({
      title: 'Stabiliser le planning de livraison',
      constat: `Le projet affiche ${progress}% d’avancement et le statut actuel nécessite un pilotage plus strict.`,
      impact: 'Réduction du risque de retard sur la date de livraison.',
      actions: [
        'Identifier les tâches critiques qui bloquent encore la progression.',
        'Clarifier les dépendances internes et externes à chaque semaine.',
        'Recentrer l’équipe sur les livrables prioritaires de la période.'
      ],
      priority: status === 'blocked' ? 'critical' : 'high',
      result: 'Une trajectoire de livraison plus fiable et mieux suivie.'
    });
  }

  if (velocity < 40) {
    recs.push({
      title: 'Relever la cadence de réalisation',
      constat: `La capacité de livraison est actuellement à ${Math.round(velocity)} story points par sprint.`,
      impact: 'Amélioration de la capacité de livraison sur les prochaines semaines.',
      actions: [
        'Supprimer les blocages opérationnels qui ralentissent l’équipe.',
        'Répartir les tâches de manière plus équilibrée entre les membres.',
        'Mettre en place une revue courte chaque jour pour sécuriser l’exécution.'
      ],
      priority: 'high',
      result: 'Meilleure cadence et meilleure prévisibilité des livraisons.'
    });
  }

  if (teamSize <= 3 || absences >= 2) {
    recs.push({
      title: 'Renforcer la capacité opérationnelle de l’équipe',
      constat: `L’équipe compte ${teamSize} membres et ${absences} absence(s) signalée(s).`,
      impact: 'Moins de risque de saturation et de rupture de charge.',
      actions: [
        'Repartir les responsabilités critiques sur plusieurs personnes.',
        'Prioriser les tâches à forte valeur ajoutée pour éviter la dispersion.',
        'Prévoir un soutien temporaire si la charge persiste.'
      ],
      priority: 'medium',
      result: 'Un fonctionnement plus résilient et plus stable.'
    });
  }

  if (openTickets > 12 || project.techDebt) {
    recs.push({
      title: 'Réduire les tickets ouverts et la dette technique',
      constat: `${openTickets} ticket(s) ouvert(s) et des points de dette technique sont encore présents.`,
      impact: 'Moins de régressions et une qualité de livraison plus robuste.',
      actions: [
        'Classer les tickets par criticité et traiter les plus impactants en priorité.',
        'Mettre de côté du temps de capacité pour la correction des points bloquants.',
        'Prévenir les régressions sur les zones sensibles au changement.'
      ],
      priority: 'high',
      result: 'Une base plus saine pour les prochaines itérations.'
    });
  }

  if (project.overscoped || project.scopeCreep || project.teamIssues) {
    recs.push({
      title: 'Contrôler le périmètre et les tensions de coordination',
      constat: 'Le périmètre ou la coordination semble mettre de la pression sur l’exécution.',
      impact: 'Moins de dérive et meilleure qualité de décision.',
      actions: [
        'Valider les changements de périmètre avant toute nouvelle livraison.',
        'Clarifier les responsabilités sur les zones de friction.',
        'Organiser une revue de coordination hebdomadaire avec les parties prenantes.'
      ],
      priority: 'medium',
      result: 'Un pilotage plus clair et moins de surprises.'
    });
  }

  if (recs.length === 0) {
    recs.push({
      title: 'Maintenir la dynamique de suivi',
      constat: 'Le projet reste stable et les indicateurs ne montrent pas de dérive majeure à ce stade.',
      impact: 'Préserver la performance actuelle et limiter les écarts.',
      actions: [
        'Conserver la cadence de revue hebdomadaire.',
        'Surveiller les indicateurs de budget, progression et charge.',
        'Préparer les prochaines étapes avec les parties prenantes.'
      ],
      priority: 'low',
      result: 'Une livraison plus prévisible et moins exposée aux dérives.'
    });
  }

  return recs.slice(0, 4).map((item) => ({
    ...item,
    projectId: project._id,
    projectName: project.name,
    projectStatus: project.status,
    budgetRatio,
    progress,
    velocity,
    teamSize,
    openTickets
  }));
};

export default function Recommendations() {
  const nav = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Prédictions /predict (même source que Analyse IA et Risques), indexées
  // par id de projet, pour garantir un niveau de risque cohérent partout.
  const [healthById, setHealthById] = useState({});

  useEffect(() => {
    API.get('/projects')
      .then((res) => {
        const data = res.data || [];
        setProjects(data);
        setLoading(false);

        Promise.all(
          data.map((project) =>
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
        });
      })
      .catch(() => setLoading(false));
  }, []);

  const recommendations = useMemo(() => {
    return projects.flatMap((project) => buildRecommendations(project));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(query));
  }, [projects, search]);

  const summary = useMemo(() => {
    // "Projets à risque" reflète désormais healthStatus quand disponible,
    // au lieu d'un seuil de progression isolé, pour rester aligné avec le
    // badge de risque affiché sur chaque carte projet.
    const atRisk = projects.filter((project) => {
      const h = healthById[project._id];
      if (h) return h.healthStatus === 'critical' || h.healthStatus === 'warning';
      return project.status === 'late' || project.status === 'blocked' || Number(project.progress || 0) < 50;
    }).length;
    const budgetWatch = projects.filter((project) => {
      const budget = Number(project.budget || 0);
      const used = Number(project.budgetUsed || 0);
      return budget > 0 && used / budget > 0.8;
    }).length;
    const highPriorityCount = recommendations.filter((item) => item.priority === 'critical' || item.priority === 'high').length;
    return { atRisk, budgetWatch, highPriorityCount };
  }, [projects, recommendations, healthById]);

  return (
    <div style={{ padding: 24, background: 'linear-gradient(135deg, #07111f 0%, #101827 100%)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#7C91C7', marginBottom: 8 }}>
              Recommandations de pilotage
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F8FAFC', margin: '0 0 6px' }}>Priorités concrètes par projet</h1>
            <p style={{ color: '#9BA3C8', fontSize: 13, maxWidth: 760, lineHeight: 1.6, margin: 0 }}>
              Chaque recommandation est construite à partir des données réelles du portefeuille : avancement, budget consommé, cadence de livraison, effectif, tickets ouverts et état de livraison.
            </p>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.76)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 16px', minWidth: 290 }}>
            <div style={{ fontSize: 11, color: '#7C91C7', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Vue d’ensemble</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC' }}>{summary.atRisk}</div>
                <div style={{ fontSize: 11, color: '#9BA3C8' }}>Projets à risque</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC' }}>{summary.budgetWatch}</div>
                <div style={{ fontSize: 11, color: '#9BA3C8' }}>Budget sous pression</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC' }}>{summary.highPriorityCount}</div>
                <div style={{ fontSize: 11, color: '#9BA3C8' }}>Actions prioritaires</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: 14 }}>🔎</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un projet"
              style={{ width: '100%', background: 'rgba(15, 23, 42, 0.82)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px 10px 36px', color: '#F8FAFC', outline: 'none' }}
            />
          </div>
          <div style={{ color: '#9BA3C8', fontSize: 12 }}>{filteredProjects.length} projets affichés</div>
        </div>

        {loading ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#9BA3C8', background: 'rgba(15, 23, 42, 0.72)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
            Chargement des recommandations…
          </div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#9BA3C8', background: 'rgba(15, 23, 42, 0.72)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
            Aucun projet ne correspond à cette recherche.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {filteredProjects.map((project) => {
              const projectRecommendations = buildRecommendations(project);
              const budgetRatio = project.budget > 0 ? (Number(project.budgetUsed || 0) / Number(project.budget || 1)) : 0;
              const health = healthById[project._id];
              const risk = getRiskProfile(project, health);
              const progress = Number(project.progress || 0);
              const responsible = project.ownerName || project.manager || project.projectLead || project.lead || 'Équipe projet';
              return (
                <div key={project._id} style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 18, boxShadow: '0 16px 40px rgba(2, 6, 23, 0.28)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#7C91C7', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.24em' }}>
                        Méthodologie : {project.methodology || 'Scrum'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>{project.name}</h2>
                        <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(79, 143, 255, 0.12)', color: '#8CB8FF', fontSize: 11, fontWeight: 600 }}>
                          {getStatusLabel(project.status)}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => nav(`/projects/${project._id}`)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12 }}>
                      Voir le projet
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', color: '#CBD5E1', fontSize: 12 }}>
                      📅 Livraison : {formatDate(project.endDate || project.deliveryDate)}
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', color: '#CBD5E1', fontSize: 12 }}>
                      👤 Responsable : {responsible}
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, color: risk.color, background: risk.bg, fontSize: 12, fontWeight: 600 }}>
                      ⚠️ Risque : {risk.label}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Avancement', value: `${progress}%` },
                      { label: 'Budget consommé', value: formatPercent(budgetRatio * 100) },
                      { label: 'Cadence', value: `${project.velocity || 0} story points / sprint` },
                      { label: 'Effectif', value: `${project.teamSize || 0} membres` },
                    ].map((item) => (
                      <div key={item.label} style={{ background: 'rgba(10, 16, 29, 0.75)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 10 }}>
                        <div style={{ fontSize: 10, color: '#7C91C7', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 6 }}>{item.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#F8FAFC' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 14 }}>
                    <div style={{ background: 'rgba(10, 16, 29, 0.72)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9BA3C8', marginBottom: 6 }}>
                        <span>Avancement</span>
                        <span>{progress}%</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(6, progress)}%`, background: 'linear-gradient(90deg, #4F8FFF 0%, #22C55E 100%)' }} />
                      </div>
                    </div>
                    <div style={{ background: 'rgba(10, 16, 29, 0.72)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9BA3C8', marginBottom: 6 }}>
                        <span>Niveau de risque</span>
                        <span>{risk.label}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: risk.width, background: risk.color }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {projectRecommendations.map((rec, index) => {
                      const meta = PRIORITY_META[rec.priority] || PRIORITY_META.medium;
                      const icon = index === 0 ? '🎯' : index === 1 ? '⚠️' : index === 2 ? '💡' : '✅';
                      return (
                        <div key={`${project._id}-${rec.title}`} style={{ border: '1px solid rgba(255,255,255,0.07)', borderLeft: `4px solid ${meta.color}`, borderRadius: 14, padding: 14, background: 'rgba(10, 16, 29, 0.7)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC' }}>{icon} {rec.title}</div>
                            <span style={{ padding: '4px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg }}>
                              Priorité {meta.label}
                            </span>
                          </div>
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 10, color: '#7C91C7', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 3 }}>Constat</div>
                              <div style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 1.55 }}>{rec.constat}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: '#7C91C7', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 3 }}>Conséquence attendue</div>
                              <div style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 1.55 }}>{rec.impact}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: '#7C91C7', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 3 }}>Actions prioritaires</div>
                              <ul style={{ margin: 0, paddingLeft: 18, color: '#CBD5E1', fontSize: 13, lineHeight: 1.6 }}>
                                {rec.actions.map((action, actionIndex) => <li key={`${rec.title}-${actionIndex}`}>{action}</li>)}
                              </ul>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: '#7C91C7', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 3 }}>Résultat attendu</div>
                              <div style={{ color: '#F8FAFC', fontSize: 13, lineHeight: 1.55 }}>{rec.result}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
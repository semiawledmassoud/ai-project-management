const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Project = require('../models/Project');
const Risk = require('../models/Risk');

// GET générer rapport hebdomadaire
router.get('/weekly', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    const allRisks = await Risk.find({
      projectId: { $in: projects.map(p => p._id) },
      status: 'active'
    }).populate('projectId', 'name');

    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      totalProjects:  projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      avgScore:       projects.length ? (projects.reduce((s,p) => s+p.aiScore,0)/projects.length).toFixed(1) : 0,
      criticalRisks:  allRisks.filter(r => r.severity === 'critical').length,
      highRisks:      allRisks.filter(r => r.severity === 'high').length,
      successRate:    projects.length ? Math.round(projects.filter(p => p.aiScore >= 7).length / projects.length * 100) : 0,
      avgProgress:    projects.length ? Math.round(projects.reduce((s,p) => s+p.progress,0)/projects.length) : 0,
      avgVelocity:    projects.length ? Math.round(projects.reduce((s,p) => s+p.velocity,0)/projects.length) : 0,
    };

    const projectsReport = projects.map(p => ({
      id: p._id,
      name: p.name,
      score: p.aiScore,
      progress: p.progress,
      velocity: p.velocity,
      status: p.status,
      budgetRatio: p.budget > 0 ? Math.round((p.budgetUsed/p.budget)*100) : 0,
      risks: allRisks.filter(r => r.projectId?._id?.toString() === p._id.toString()).length,
      scoreStatus: p.aiScore >= 7 ? 'bon' : p.aiScore >= 5 ? 'moyen' : 'critique'
    }));

    const report = {
      generatedAt: now.toISOString(),
      period: { from: weekAgo.toISOString(), to: now.toISOString() },
      weekNumber: Math.ceil((now - new Date(now.getFullYear(),0,1)) / (7*24*60*60*1000)),
      stats,
      projects: projectsReport,
      topRisks: allRisks.filter(r => r.severity === 'critical').slice(0,5).map(r => ({
        title: r.title, severity: r.severity, probability: r.probability, project: r.projectId?.name
      })),
      highlights: [
        stats.criticalRisks > 0 ? `${stats.criticalRisks} risque(s) critique(s) nécessitent une attention immédiate` : null,
        stats.avgScore < 5 ? `Score IA moyen faible (${stats.avgScore}/10) — révision des projets recommandée` : null,
        stats.successRate >= 70 ? `Bon taux de succès : ${stats.successRate}% des projets au-dessus de 7/10` : null,
        `${stats.activeProjects} projet(s) actif(s) · ${stats.avgProgress}% de progression moyenne`
      ].filter(Boolean)
    };

    res.json(report);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET télécharger rapport en texte
router.get('/weekly/download', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    const allRisks = await Risk.find({ projectId: { $in: projects.map(p => p._id) }, status: 'active' }).populate('projectId', 'name');

    const avgScore = projects.length ? (projects.reduce((s,p) => s+p.aiScore,0)/projects.length).toFixed(1) : 0;
    const now = new Date();

    let content = `RAPPORT HEBDOMADAIRE PROAI\n`;
    content += `Semaine du ${now.toLocaleDateString('fr-FR')}\n`;
    content += `${'='.repeat(50)}\n\n`;
    content += `RÉSUMÉ EXÉCUTIF\n${'-'.repeat(30)}\n`;
    content += `Projets actifs   : ${projects.filter(p=>p.status==='active').length} / ${projects.length}\n`;
    content += `Score IA moyen   : ${avgScore} / 10\n`;
    content += `Risques critiques: ${allRisks.filter(r=>r.severity==='critical').length}\n`;
    content += `Progression moy. : ${projects.length ? Math.round(projects.reduce((s,p)=>s+p.progress,0)/projects.length) : 0}%\n\n`;
    content += `ÉTAT DES PROJETS\n${'-'.repeat(30)}\n`;
    projects.forEach(p => {
      content += `\n${p.name}\n`;
      content += `  Score IA    : ${p.aiScore}/10\n`;
      content += `  Progression : ${p.progress}%\n`;
      content += `  Vélocité    : ${p.velocity} pts\n`;
      content += `  Budget      : ${p.budget>0?Math.round(p.budgetUsed/p.budget*100):0}% utilisé\n`;
    });
    content += `\nRISQUES CRITIQUES\n${'-'.repeat(30)}\n`;
    allRisks.filter(r=>r.severity==='critical').forEach((r,i) => {
      content += `${i+1}. [${r.severity.toUpperCase()}] ${r.title}\n`;
      content += `   Projet: ${r.projectId?.name} | Probabilité: ${r.probability}%\n`;
    });
    content += `\n${'='.repeat(50)}\nGénéré par ProAI v2.0`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ProAI_Rapport_${now.toISOString().slice(0,10)}.txt"`);
    res.send(content);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
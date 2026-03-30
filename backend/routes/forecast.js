const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Project = require('../models/Project');

// POST prévision d'un projet à 30/60/90 jours
router.post('/project/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
    if (!project) return res.status(404).json({ message: 'Projet non trouvé' });

    // Appel au serveur IA Python
    const axios = require('axios');
    let iaScore = project.aiScore;
    let iaRisks = [];

    try {
      const iaRes = await axios.post('http://localhost:8000/predict', project.toObject(), { timeout: 3000 });
      iaScore = iaRes.data.score;
      iaRisks = iaRes.data.risks || [];
    } catch {}

    // Calcul des prévisions
    const velocity      = project.velocity || 50;
    const progress      = project.progress || 0;
    const budget        = project.budget || 1;
    const budgetUsed    = project.budgetUsed || 0;
    const budgetRatio   = budgetUsed / budget;
    const score         = iaScore || project.aiScore || 5;

    // Taux de progression estimé par sprint (2 semaines)
    const progressRate  = Math.max(0.5, (velocity / 100) * 8);
    const budgetBurnRate= (budgetRatio / Math.max(1, progress)) * 100;
    const scoreGrowth   = score < 7 ? 0.3 : 0.1;

    const forecast = [30, 60, 90].map(days => {
      const sprints   = days / 14;
      const projProgress  = Math.min(100, progress + progressRate * sprints);
      const projBudget    = Math.min(150, budgetRatio * 100 + budgetBurnRate * (days/30));
      const projScore     = Math.min(10, Math.max(1, score + scoreGrowth * sprints));
      const successProb   = Math.min(95, Math.max(5, projScore * 10));
      const delayRisk     = Math.max(0, Math.min(95, (1 - projProgress / 100) * 100 * (1 - score / 10)));

      return {
        days,
        label: `J+${days}`,
        estimatedProgress: Math.round(projProgress),
        estimatedBudgetUsed: Math.round(projBudget),
        estimatedScore: Math.round(projScore * 10) / 10,
        successProbability: Math.round(successProb),
        delayRisk: Math.round(delayRisk),
        recommendation: projScore < 5
          ? `Intervention requise avant J+${days} — risque d'échec élevé`
          : projScore < 7
          ? `Maintenir le rythme et résoudre les blocages identifiés`
          : `Trajectoire positive — continuer les bonnes pratiques`,
        status: projScore >= 7 ? 'good' : projScore >= 5 ? 'warning' : 'danger'
      };
    });

    res.json({
      projectId: project._id,
      projectName: project.name,
      currentScore: score,
      currentProgress: progress,
      currentBudgetRatio: Math.round(budgetRatio * 100),
      forecast,
      risks: iaRisks.slice(0, 3),
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET prévisions de tous les projets
router.get('/all', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    const summaries = projects.map(p => {
      const score    = p.aiScore || 5;
      const velocity = p.velocity || 50;
      const progress = p.progress || 0;
      const projProgress90 = Math.min(100, progress + (velocity / 100) * 8 * (90/14));
      return {
        projectId: p._id,
        name: p.name,
        currentScore: score,
        score90days: Math.min(10, Math.max(1, Math.round((score + (score < 7 ? 1.5 : 0.3)) * 10) / 10)),
        progress90days: Math.round(projProgress90),
        willBeCompleted: projProgress90 >= 95,
        riskLevel: score < 4 ? 'critical' : score < 6 ? 'high' : score < 7.5 ? 'medium' : 'low'
      };
    });
    res.json(summaries);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
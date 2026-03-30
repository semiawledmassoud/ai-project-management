const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const Project = require('../models/Project');

// GET toutes les notifications de l'user
router.get('/', auth, async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 }).limit(50);
    res.json(notifs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET count non lues
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, read: false });
    res.json({ count });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST créer notification
router.post('/', auth, async (req, res) => {
  try {
    const notif = new Notification({ ...req.body, userId: req.user.id });
    await notif.save();
    res.json(notif);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT marquer comme lue
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notif = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    res.json(notif);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT marquer toutes comme lues
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
    res.json({ message: 'Toutes marquées comme lues' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE supprimer une notification
router.delete('/:id', auth, async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: 'Supprimée' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST générer notifications automatiques depuis les projets
router.post('/auto-generate', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    const created = [];

    for (const p of projects) {
      // Score critique
      if (p.aiScore < 4) {
        const exists = await Notification.findOne({ userId: req.user.id, projectId: p._id, type: 'score', read: false });
        if (!exists) {
          const n = await Notification.create({
            userId: req.user.id, projectId: p._id,
            type: 'score', severity: 'critical',
            title: `Score critique — ${p.name}`,
            message: `Le score IA de ${p.name} est de ${p.aiScore}/10. Action urgente requise.`,
            link: `/projects/${p._id}`
          });
          created.push(n);
        }
      }
      // Budget dépassé
      const budgetRatio = p.budget > 0 ? p.budgetUsed / p.budget : 0;
      if (budgetRatio > 0.85) {
        const exists = await Notification.findOne({ userId: req.user.id, projectId: p._id, type: 'risk', title: { $regex: 'budget' } });
        if (!exists) {
          const n = await Notification.create({
            userId: req.user.id, projectId: p._id,
            type: 'risk', severity: 'high',
            title: `Budget à ${Math.round(budgetRatio*100)}% — ${p.name}`,
            message: `Le budget de ${p.name} est consommé à ${Math.round(budgetRatio*100)}%. Risque de dépassement.`,
            link: `/projects/${p._id}`
          });
          created.push(n);
        }
      }
      // Vélocité faible
      if (p.velocity < 30) {
        const exists = await Notification.findOne({ userId: req.user.id, projectId: p._id, type: 'risk', title: { $regex: 'velocite' } });
        if (!exists) {
          const n = await Notification.create({
            userId: req.user.id, projectId: p._id,
            type: 'risk', severity: 'high',
            title: `Vélocité faible — ${p.name}`,
            message: `La vélocité de ${p.name} est de ${p.velocity} pts, très en dessous de la cible.`,
            link: `/projects/${p._id}`
          });
          created.push(n);
        }
      }
    }

    res.json({ generated: created.length, notifications: created });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
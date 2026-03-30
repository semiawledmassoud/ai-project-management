const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Milestone = require('../models/Milestone');
const Project = require('../models/Project');

// GET jalons d'un projet
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const milestones = await Milestone.find({ projectId: req.params.projectId }).sort({ dueDate: 1 });
    res.json(milestones);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET tous les jalons de l'user
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    const ids = projects.map(p => p._id);
    const milestones = await Milestone.find({ projectId: { $in: ids } })
      .populate('projectId', 'name aiScore progress')
      .sort({ dueDate: 1 });
    res.json(milestones);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST créer jalon
router.post('/', auth, async (req, res) => {
  try {
    const milestone = new Milestone({ ...req.body, userId: req.user.id });
    await milestone.save();
    res.json(milestone);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT mettre à jour
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.body.status === 'completed' && !req.body.completedAt) {
      req.body.completedAt = new Date();
    }
    const milestone = await Milestone.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(milestone);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT compléter un jalon
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const milestone = await Milestone.findByIdAndUpdate(
      req.params.id,
      { status: 'completed', completedAt: new Date() },
      { new: true }
    );
    res.json(milestone);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE supprimer
router.delete('/:id', auth, async (req, res) => {
  try {
    await Milestone.findByIdAndDelete(req.params.id);
    res.json({ message: 'Jalon supprimé' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Project = require('../models/Project');
const axios = require('axios');

router.get('/', auth, async (req, res) => {
  const projects = await Project.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json(projects);
});

router.get('/:id', auth, async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
  if (!project) return res.status(404).json({ message: 'Projet non trouvé' });
  res.json(project);
});

router.post('/', auth, async (req, res) => {
  try {
    const project = new Project({ ...req.body, userId: req.user.id });
    await project.save();
    try {
      const response = await axios.post('http://localhost:8000/predict', req.body);
      project.aiScore = response.data.score;
      await project.save();
    } catch {
      const b = req.body;
      const ratio = b.budget > 0 ? b.budgetUsed / b.budget : 0;
      let score = 5 + (b.progress / 100) * 3 - ratio * 4 + (b.velocity / 100) * 2;
      project.aiScore = Math.round(Math.max(1, Math.min(10, score)) * 10) / 10;
      await project.save();
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!project) return res.status(404).json({ message: 'Projet non trouvé' });
    try {
      const response = await axios.post('http://localhost:8000/predict', project.toObject());
      project.aiScore = response.data.score;
      await project.save();
    } catch {}
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  await Project.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ message: 'Projet supprimé' });
});

module.exports = router;
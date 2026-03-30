const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Risk = require('../models/Risk');
const Project = require('../models/Project');

// GET tous les risques de l'utilisateur (tous projets)
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    const ids = projects.map(p => p._id);
    const risks = await Risk.find({ projectId: { $in: ids } })
      .populate('projectId', 'name methodology')
      .sort({ createdAt: -1 });
    res.json(risks);
  } catch (err) {
    console.log('ERREUR GET risks:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET risques d'un projet spécifique
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const risks = await Risk.find({
      projectId: req.params.projectId,
      status: { $ne: 'resolved' }
    }).sort({ createdAt: -1 });
    res.json(risks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST créer un risque manuellement
router.post('/', auth, async (req, res) => {
  try {
    const risk = new Risk({
      ...req.body,
      userId: req.user.id
    });
    await risk.save();
    res.json(risk);
  } catch (err) {
    console.log('ERREUR POST risk:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST sauvegarder risques détectés par l'IA (depuis ProjectDetail)
router.post('/save-ai/:projectId', auth, async (req, res) => {
  try {
    const { risks } = req.body;
    if (!risks || !Array.isArray(risks)) {
      return res.status(400).json({ message: 'risks array requis' });
    }

    // Supprimer anciens risques IA du projet
    await Risk.deleteMany({
      projectId: req.params.projectId,
      aiDetected: true
    });

    // Créer les nouveaux
    const saved = await Risk.insertMany(
      risks.map(r => ({
        projectId:   req.params.projectId,
        userId:      req.user.id,
        title:       r.title,
        description: r.description,
        severity:    r.severity || 'medium',
        probability: r.probability || 50,
        category:    r.category || 'planning',
        status:      'active',
        aiDetected:  true,
        actions:     r.actions || [],
      }))
    );

    res.json({ saved: saved.length, risks: saved });
  } catch (err) {
    console.log('ERREUR save-ai:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT résoudre un risque
router.put('/:id/resolve', auth, async (req, res) => {
  try {
    const risk = await Risk.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved' },
      { new: true }
    );
    if (!risk) return res.status(404).json({ message: 'Risque non trouvé' });
    res.json(risk);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT ignorer un risque
router.put('/:id/ignore', auth, async (req, res) => {
  try {
    const risk = await Risk.findByIdAndUpdate(
      req.params.id,
      { status: 'ignored' },
      { new: true }
    );
    res.json(risk);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT modifier un risque
router.put('/:id', auth, async (req, res) => {
  try {
    const risk = await Risk.findByIdAndUpdate(
      req.params.id, req.body, { new: true }
    );
    res.json(risk);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE supprimer un risque
router.delete('/:id', auth, async (req, res) => {
  try {
    await Risk.findByIdAndDelete(req.params.id);
    res.json({ message: 'Risque supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
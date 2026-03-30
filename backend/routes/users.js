const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Project = require('../models/Project');

// Middleware vérification rôle admin
const adminOnly = async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  next();
};

// GET profil complet utilisateur connecté
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT mettre à jour son profil
router.put('/me', auth, async (req, res) => {
  try {
    const allowed = ['name', 'email', 'role', 'department', 'avatar'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET liste tous les utilisateurs (admin)
router.get('/all', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT changer le rôle d'un user (admin)
router.put('/:id/role', auth, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin','manager','member','viewer'].includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET stats utilisateur
router.get('/stats', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    const Risk = require('../models/Risk');
    const allRisks = await Risk.find({ projectId: { $in: projects.map(p=>p._id) } });
    res.json({
      totalProjects: projects.length,
      activeProjects: projects.filter(p=>p.status==='active').length,
      avgScore: projects.length ? +(projects.reduce((s,p)=>s+p.aiScore,0)/projects.length).toFixed(1) : 0,
      criticalRisks: allRisks.filter(r=>r.severity==='critical'&&r.status==='active').length,
      memberSince: (await User.findById(req.user.id))?.createdAt
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
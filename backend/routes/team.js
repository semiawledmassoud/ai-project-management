const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TeamMember = require('../models/TeamMember');

router.get('/:projectId', auth, async (req, res) => {
  try {
    const members = await TeamMember.find({ projectId: req.params.projectId });
    res.json(members);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:projectId', auth, async (req, res) => {
  try {
    const member = new TeamMember({ projectId: req.params.projectId, ...req.body });
    await member.save();
    res.json(member);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const member = await TeamMember.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(member);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await TeamMember.findByIdAndDelete(req.params.id);
    res.json({ message: 'Supprimé' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
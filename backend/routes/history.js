const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const History = require('../models/History');

router.get('/:projectId', auth, async (req, res) => {
  try {
    const history = await History.find({ projectId: req.params.projectId })
      .sort({ createdAt: -1 }).limit(50);
    res.json(history);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:projectId', auth, async (req, res) => {
  try {
    const entry = new History({
      projectId: req.params.projectId,
      userId: req.user.id,
      userName: req.user.name,
      ...req.body
    });
    await entry.save();
    res.json(entry);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
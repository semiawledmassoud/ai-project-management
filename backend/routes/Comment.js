const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Comment = require('../models/Comment');

router.get('/:projectId', auth, async (req, res) => {
  try {
    const comments = await Comment.find({ projectId: req.params.projectId }).sort({ createdAt: -1 });
    res.json(comments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:projectId', auth, async (req, res) => {
  try {
    const comment = new Comment({
      projectId: req.params.projectId,
      userId: req.user.id,
      userName: req.user.name,
      text: req.body.text
    });
    await comment.save();
    res.json(comment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Supprimé' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
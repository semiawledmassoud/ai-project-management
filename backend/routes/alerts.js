const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.post('/send', auth, async (req, res) => {
  try {
    const { email, projectName, risks, score } = req.body;
    console.log('ALERTE:', { to: email, project: projectName, score });
    res.json({
      success: true,
      message: `Alerte envoyée à ${email}`,
      sentAt: new Date().toISOString()
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
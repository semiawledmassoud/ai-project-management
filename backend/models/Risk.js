const mongoose = require('mongoose');

const RiskSchema = new mongoose.Schema({
  projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  severity:    { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
  probability: { type: Number, default: 50, min: 0, max: 100 },
  category:    { type: String, enum: ['planning', 'budget', 'hr', 'technical', 'global'], default: 'planning' },
  status:      { type: String, enum: ['active', 'resolved', 'ignored'], default: 'active' },
  aiDetected:  { type: Boolean, default: false },
  actions:     [{ type: String }],
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Risk', RiskSchema);
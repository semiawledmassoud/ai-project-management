const mongoose = require('mongoose');

const RiskSchema = new mongoose.Schema({
  projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  severity:    { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
  probability: { type: Number, default: 50, min: 0, max: 100 },
  impact:      { type: Number, default: 3, min: 1, max: 5 },
  category:    { type: String, enum: ['planning', 'budget', 'hr', 'technical', 'global'], default: 'planning' },
  status:      { type: String, enum: ['active', 'resolved', 'ignored'], default: 'active' },
  owner:       { type: String, default: '' },
  dueDate:     { type: Date },
  aiDetected:  { type: Boolean, default: false },
  actions:     [{ type: String }],
  history:     [{
    action: { type: String },
    status: { type: String },
    label:  { type: String },
    at:     { type: Date, default: Date.now }
  }],
}, { timestamps: true });

module.exports = mongoose.model('Risk', RiskSchema);

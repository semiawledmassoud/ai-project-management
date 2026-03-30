const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema({
  projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  dueDate:     { type: Date, required: true },
  targetScore: { type: Number, default: 7 },
  targetProgress: { type: Number, default: 80 },
  status:      { type: String, enum: ['pending','inprogress','completed','overdue'], default: 'pending' },
  completedAt: { type: Date },
  priority:    { type: String, enum: ['critical','high','medium','low'], default: 'medium' },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Milestone', MilestoneSchema);
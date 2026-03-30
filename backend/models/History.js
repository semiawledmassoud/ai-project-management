const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName:  { type: String, default: 'Système' },
  action:    { type: String, required: true },
  field:     { type: String, default: '' },
  oldValue:  { type: String, default: '' },
  newValue:  { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('History', HistorySchema);
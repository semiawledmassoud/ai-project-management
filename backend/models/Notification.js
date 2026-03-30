const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  type:      { type: String, enum: ['risk','score','recommendation','milestone','report','system'], default: 'system' },
  title:     { type: String, required: true },
  message:   { type: String, required: true },
  severity:  { type: String, enum: ['critical','high','medium','low','info'], default: 'info' },
  read:      { type: Boolean, default: false },
  link:      { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);
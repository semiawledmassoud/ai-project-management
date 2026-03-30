const mongoose = require('mongoose');

const KPIWidgetSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  widgets: [{
    id:       String,
    type:     { type: String, enum: ['projects_count','avg_score','risks_count','success_rate','velocity_avg','budget_health','recommendations_count','milestones_progress'] },
    title:    String,
    visible:  { type: Boolean, default: true },
    position: { type: Number, default: 0 },
    color:    { type: String, default: '#4F8FFF' }
  }],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('KPIWidget', KPIWidgetSchema);
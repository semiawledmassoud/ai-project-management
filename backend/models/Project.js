const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:         { type: String, required: true },
  description:  { type: String },
  methodology:  { type: String, enum: ['Scrum','Kanban','Waterfall','Agile'], default: 'Scrum' },
  domain:       { type: String, enum: ['Finance','Healthcare','Retail','IT','Manufacturing','Education','Other'], default: 'Other' },
  budget:       { type: Number, default: 0 },
  budgetUsed:   { type: Number, default: 0 },
  startDate:    { type: Date, default: Date.now },
  endDate:      { type: Date },
  progress:     { type: Number, default: 0 },
  velocity:     { type: Number, default: 50 },
  teamSize:     { type: Number, default: 3 },
  openTickets:  { type: Number, default: 0 },
  absences:     { type: Number, default: 0 },
  overscoped:   { type: Boolean, default: false },
  teamIssues:   { type: Boolean, default: false },
  techDebt:     { type: Boolean, default: false },
  scopeCreep:   { type: Boolean, default: false },
  status:       { type: String, enum: ['active','delivered','late','blocked'], default: 'active' },
  aiScore:      { type: Number, default: 5 },
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Project', ProjectSchema);
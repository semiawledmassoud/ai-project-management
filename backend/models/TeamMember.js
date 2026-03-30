const mongoose = require("mongoose");
const TeamMemberSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  name:      { type: String, required: true },
  role:      { type: String, required: true },
  email:     { type: String, default: "" },
  workload:  { type: Number, default: 80 },
  status:    { type: String, default: "active" },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model("TeamMember", TeamMemberSchema);
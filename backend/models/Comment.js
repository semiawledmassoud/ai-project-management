const mongoose = require("mongoose");
const CommentSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName:  { type: String, required: true },
  text:      { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model("Comment", CommentSchema);

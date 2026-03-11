const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  listingId: { type: String },
  text: { type: String, required: true },
  translatedText: { type: String },
  timestamp: { type: Number, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);

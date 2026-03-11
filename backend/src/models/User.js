const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, enum: ['farmer', 'buyer'], required: true },
  language: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  location: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

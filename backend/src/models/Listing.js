const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  farmerId: { type: String, ref: 'User', required: true },
  farmerName: { type: String, required: true },
  cropName: { type: String, required: true },
  cropNameEnglish: { type: String }, // For standardized search
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  location: { type: String, required: true },
  description: { type: String },
  image: { type: String }, // Path to the uploaded image
}, { timestamps: true });

module.exports = mongoose.model('Listing', listingSchema);

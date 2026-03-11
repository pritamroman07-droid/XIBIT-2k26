const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

// Get all listings
router.get('/', async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const { upload } = require('../middlewares/multer.middleware.js');
const { uploadOnCloudinary } = require('../utils/cloudinary.js');

// Create listing (with optional image)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const listingData = req.body;

    if (req.file) {
      // Upload buffer directly to Cloudinary (no disk write needed)
      const result = await uploadOnCloudinary(req.file.buffer, req.file.mimetype);
      if (result) {
        listingData.image = result.secure_url;
      }
    }

    const listing = await Listing.create(listingData);
    res.status(201).json(listing);
  } catch (error) {
    console.error('❌ Create listing error:', error.message, error.stack);
    res.status(400).json({ message: error.message });
  }
});

// Update listing
router.put('/:id', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(listing);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete listing
router.delete('/:id', async (req, res) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    res.json({ message: 'Listing removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Listing = require('../models/Listing');

// Login or Register
router.post('/login', async (req, res) => {
  const { phone, name, role, language, location } = req.body;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    let user = await User.findOne({ phone });

    if (user) {
      return res.json(user);
    }

    // For simplicity in this demo, if user doesn't exist but we have details, create them.
    // If we only have phone (login attempt), return 404.
    if (!name || !role || !language) {
      // In a real app, you'd check this and trigger a registration flow.
      // Here we assume the frontend might send registration data if login fails or for "signup"
       return res.status(404).json({ message: 'User not found, please provide details to register.' });
    }

    user = await User.create({
      name,
      role,
      language,
      phone,
      location: location || 'Unknown'
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user details
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role, language, location } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (role) user.role = role;
    if (language) user.language = language;
    if (location) user.location = location;

    // Phone number is explicitly NOT updated

    await user.save();

    // If name was updated, update all listings by this farmer
    if (name) {
      // Assuming farmerId in Listing stores the User's _id (as string or ObjectId)
      await Listing.updateMany({ farmerId: id }, { farmerName: name });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user by ID (needed for fetching names in inbox)
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// Get messages between two users (or for a specific listing)
router.get('/', async (req, res) => {
  const { userId, otherUserId, listingId } = req.query;

  try {
    let query = {};
    if (listingId) {
        query.listingId = listingId;
    }
    if (userId && otherUserId) {
        query.$or = [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId }
        ];
    } else if (userId) {
        // Get all messages involving this user (inbox view)
         query.$or = [
            { senderId: userId },
            { receiverId: userId }
        ];
    }

    const messages = await Message.find(query).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send a message
router.post('/', async (req, res) => {
  const { senderId, receiverId, listingId, text, translatedText } = req.body;

  try {
    const newMessage = await Message.create({
      senderId,
      receiverId,
      listingId,
      text,
      translatedText,
      timestamp: Date.now()
    });
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;

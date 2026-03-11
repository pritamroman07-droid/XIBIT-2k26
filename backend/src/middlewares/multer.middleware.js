const multer = require("multer");

// Use memory storage — no disk writes needed.
// Files are held in buffer and streamed directly to Cloudinary.
// This is required for Render free tier (ephemeral filesystem).
const storage = multer.memoryStorage();

const upload = multer({ storage });
module.exports = { upload };
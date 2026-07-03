// name=server/routes/players-upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = express.Router();

// POST /api/players/upload-avatar
// Expects multipart/form-data with fields: image (file), playerId
// Response: { imageUrl }
router.post('/api/players/upload-avatar', upload.single('image'), async (req, res) => {
  try {
    const { playerId } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    if (!playerId) return res.status(400).json({ error: 'Missing playerId' });

    // If AWS S3 is configured, you can upload here. Otherwise we'll save to ./public/uploads/players/<playerId>/
    const useS3 = !!process.env.S3_BUCKET; // boolean toggle

    let publicUrl;

    if (useS3) {
      // Example: Use @aws-sdk/client-s3 to upload. Make sure to `npm install @aws-sdk/client-s3`
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({ region: process.env.AWS_REGION });
      const key = `players/${playerId}/avatar-${Date.now()}${path.extname(file.originalname)}`;
      const params = {
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read'
      };
      await s3.send(new PutObjectCommand(params));
      publicUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    } else {
      // local fallback: save to public/uploads
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'players', String(playerId));
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const filename = `avatar-${Date.now()}${path.extname(file.originalname)}`;
      const filepath = path.join(uploadsDir, filename);
      await fs.promises.writeFile(filepath, file.buffer);
      // If your server serves /public as root, this URL should be accessible
      publicUrl = `/uploads/players/${playerId}/${filename}`;
    }

    // TODO: Update your player record in DB to set avatarUrl = publicUrl
    // Example (pseudo): await db.players.update({ id: playerId }, { avatarUrl: publicUrl });

    return res.json({ imageUrl: publicUrl });
  } catch (err) {
    console.error('Upload error', err);
    return res.status(500).json({ error: 'upload_failed' });
  }
});

module.exports = router;

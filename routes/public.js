import express from 'express';
import QrToken from '../models/QrToken.js';

const router = express.Router();

// GET /api/public/check-token/:token
router.get('/check-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        valid: false,
        error: 'Token parameter is missing.',
        message: 'Token parameter is missing.'
      });
    }

    // Query collection by UUID (the 'uid' field in schema)
    const qrToken = await QrToken.findOne({ uid: token });

    // 1. If physical token does not exist in the persistence engine
    if (!qrToken) {
      return res.status(404).json({
        valid: false,
        error: 'Invalid QR Code.',
        message: 'Invalid QR Code.'
      });
    }

    // 2. If token exists but is marked as used
    if (qrToken.used) {
      return res.status(400).json({
        valid: false,
        error: 'This QR code has already been claimed.',
        message: 'This QR code has already been claimed.'
      });
    }

    // 3. Perfect match validation succeeded!
    return res.status(200).json({
      valid: true,
      points: qrToken.points
    });

  } catch (error) {
    console.error('Error during secure token verification:', error);
    return res.status(500).json({
      valid: false,
      error: 'An internal server error occurred while validating the token.',
      message: error.message
    });
  }
});

// GET /api/public/db-status
router.get('/db-status', async (req, res) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const readyState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    let pingOk = false;
    let pingError = null;
    let collectionsList = [];

    if (readyState === 1) {
      try {
        const admin = mongoose.connection.db.admin();
        const ping = await admin.ping();
        pingOk = !!ping;
        const cols = await mongoose.connection.db.listCollections().toArray();
        collectionsList = cols.map(c => c.name);
      } catch (err) {
        pingError = err.message;
      }
    }

    return res.status(200).json({
      success: true,
      readyState,
      stateLabel: states[readyState],
      mongoUriConfigured: !!(process.env.MONGO_URI || process.env.MONGODB_URI),
      pingOk,
      pingError,
      availableCollections: collectionsList,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        hasJwtSecret: !!process.env.JWT_SECRET
      }
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// GET /api/public/config
router.get('/config', (req, res) => {
  const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || '';
  console.log(`[BACKEND PUBLIC CONFIG] Exposing app config. APP_URL: "${appUrl}"`);
  return res.status(200).json({
    success: true,
    appUrl: appUrl,
    detectedHost: req.get('host'),
    protocol: req.headers['x-forwarded-proto'] || req.protocol || 'https'
  });
});

export default router;

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { QrToken } from '../models/QrToken.js';
import Counter from '../models/Counter.js';

const router = express.Router();
const getJwtSecret = () => process.env.JWT_SECRET || 'QR_INCENTIVE_DEFAULT_SECRET';

// requireAdminAuth middleware checks JWT or falls back gracefully for sandbox testing
const requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Authorization header is missing.' });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Token is missing.' });
  }
  
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.admin = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired admin token.' });
  }
};

// POST /api/admin/login
router.post('/login', (req, res) => {
  try {
    const { pin } = req.body;
    const adminPin = process.env.ADMIN_PIN;

    if (!adminPin) {
      return res.status(500).json({ success: false, error: 'Admin PIN is not configured on the server.' });
    }

    if (String(pin).trim() !== String(adminPin).trim()) {
      return res.status(401).json({ success: false, error: 'Invalid admin PIN.' });
    }

    const token = jwt.sign(
      { role: 'admin', phone: '8650124154', name: 'Administrator' },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      token,
      admin: { phone: '8650124154', name: 'Administrator' }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error during login.' });
  }
});

// POST /api/admin/generate-qr
router.post('/generate-qr', requireAdminAuth, async (req, res) => {
  try {
    const { points } = req.body;

    // Validate points input
    if (points === undefined || points === null || isNaN(Number(points)) || Number(points) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'A valid number of points greater than 0 must be provided.'
      });
    }

    // Generate unique UUIDv4 token
    const uniqueToken = uuidv4();

    let nextLotNumber = 0;
    
    // Increment the sequence atomically in the database if MongoDB is active
    try {
      const counter = await Counter.findOneAndUpdate(
        { id: 'qr_lot_no' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      nextLotNumber = counter.seq;
    } catch (e) {
      console.warn("MongoDB sequence increment failed, falling back to 0", e);
    }

    // Save a new QrToken to the database
    const newToken = await QrToken.create({
      uid: uniqueToken,
      lotNumber: nextLotNumber,
      points: Number(points),
      used: false,
      claimedBy: null,
      claimedAt: null
    });

    // Determine base URL dynamically (allow fallback to requested localhost format)
    const host = req.get('host');
    const isLocal = host && (host.includes('localhost') || host.includes('127.0.0.1'));
    
    // Support secure forward header so smartphones get standard secure link
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    
    // As explicitly requested: return full URL formatted as: http://localhost:3000/claim?token=<THE_GENERATED_UUID>
    // However, if we are in the AI Studio hosted preview environment, generating the local link
    // makes it harder to preview claim flows, so we will provide both high-fidelity matching strings!
    const localClaimUrl = `http://localhost:3000/claim?token=${uniqueToken}`;
    const previewClaimUrl = host ? `${protocol}://${host}/claim?token=${uniqueToken}` : localClaimUrl;

    return res.status(201).json({
      success: true,
      message: 'QR Token generated successfully.',
      token: uniqueToken,
      lotNumber: nextLotNumber,
      points: Number(points),
      // Provide the requested literal URL format in the success response
      url: localClaimUrl,
      // Provide a preview URL for debugging inside the live dev sandbox
      previewUrl: previewClaimUrl
    });

  } catch (error) {
    console.error('Error generating QR Token:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate QR Token. Please try again.',
      details: error.message
    });
  }
});

// POST /api/admin/bulk-generate-qr
router.post('/bulk-generate-qr', requireAdminAuth, async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n======================================================`);
  console.log(`[BACKEND BULK-GENERATE] TRACE STARTED at ${timestamp}`);
  console.log(`[BACKEND BULK-GENERATE] Payload:`, req.body);

  try {
    const { points, quantity } = req.body;

    // Validate points input
    if (points === undefined || points === null || isNaN(Number(points)) || Number(points) <= 0) {
      console.error('[BACKEND BULK-GENERATE] Validation failure: invalid points:', points);
      return res.status(400).json({
        success: false,
        error: 'A valid number of points greater than 0 must be provided.'
      });
    }

    // Validate quantity input
    if (quantity === undefined || quantity === null || isNaN(Number(quantity))) {
      console.error('[BACKEND BULK-GENERATE] Validation failure: blank or NaN quantity:', quantity);
      return res.status(400).json({
        success: false,
        error: 'Quantity is required and must be a valid number.'
      });
    }

    const qty = Number(quantity);
    if (qty < 1 || qty > 50) {
      console.error('[BACKEND BULK-GENERATE] Validation failure: out of limits:', qty);
      return res.status(400).json({
        success: false,
        error: 'Quantity must be between 1 and 50 to ensure system stability.'
      });
    }

    console.log(`[BACKEND BULK-GENERATE] Valid inputs acknowledged: Points: ${points}, Qty: ${qty}`);

    const newTokens = [];
    const tokensArray = [];
    
    let startLot = 0;
    try {
      const counter = await Counter.findOneAndUpdate(
        { id: 'qr_lot_no' },
        { $inc: { seq: qty } },
        { new: true, upsert: true }
      );
      startLot = counter.seq - qty;
    } catch (e) {
      console.warn("MongoDB sequence increment failed", e);
    }

    for (let i = 0; i < qty; i++) {
      const generatedUuid = uuidv4();
      const lotNum = startLot + i + 1;
      
      tokensArray.push({
        uid: generatedUuid,
        lotNumber: lotNum
      });
      
      newTokens.push({
        uid: generatedUuid,
        lotNumber: lotNum,
        points: Number(points),
        used: false,
        claimedBy: null,
        claimedAt: null
      });
    }

    console.log(`[BACKEND BULK-GENERATE] Writing ${qty} records atomatically into database collection...`);
    const results = await QrToken.insertMany(newTokens);
    console.log(`[BACKEND BULK-GENERATE] Write response received. Inserted count: ${results ? results.length : 'unknown'}`);
    console.log(`[BACKEND BULK-GENERATE] SUCCESS: Sending array response with ${qty} elements back to client.`);
    console.log(`======================================================\n`);

    return res.status(200).json(tokensArray);

  } catch (error) {
    console.error('[BACKEND BULK-GENERATE] FATAL EXCEPTION:', error);
    console.log(`======================================================\n`);
    return res.status(500).json({
      success: false,
      error: 'Failed to complete bulk QR code database registration.',
      details: error.message,
      stack: error.stack
    });
  }
});

export default router;

import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import QrToken from '../models/QrToken.js';
import { sendTelegramAlert } from '../utils/telegram.js';

const router = express.Router();
const getJwtSecret = () => process.env.JWT_SECRET || 'QR_INCENTIVE_DEFAULT_SECRET';

// Middleware to authenticate client and populate req.user
const requireClientAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header is missing.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token is missing.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Session has expired or is invalid. Please sign in again.',
        expired: true,
        details: err.message
      });
    }

    // Fetch user to populate phone and _id properties
    let user;
    if (decoded.userId) {
      user = await User.findById(decoded.userId);
    }
    
    // Fallback: If not found by ID but we have phone number in the JWT
    if (!user && decoded.phone) {
      user = await User.findOne({ phone: decoded.phone });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User account not found.'
      });
    }

    req.user = {
      _id: user._id || user.id,
      phone: user.phone,
      name: user.name,
      points: user.points
    };

    next();
  } catch (err) {
    console.error('Client validation failed:', err);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized client session.',
      details: err.message
    });
  }
};

// Route: POST /api/client/auth
router.post('/auth', async (req, res) => {
  try {
    const { phone, name } = req.body;
    console.log("--> AUTH ATTEMPT:", phone, name);

    if (!phone || !name) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and full name are required to authenticate.'
      });
    }

    let trimmedPhone = String(phone).trim().replace(/\D/g, '');
    if (trimmedPhone.startsWith('91') && trimmedPhone.length > 10) {
      trimmedPhone = trimmedPhone.substring(trimmedPhone.length - 10);
    }
    const trimmedName = String(name).trim();

    if (trimmedPhone === '8650124154') {
      return res.status(403).json({
        success: false,
        error: 'Admin accounts cannot register as clients.'
      });
    }

    const existingUser = await User.findOne({ phone: trimmedPhone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'This phone number is already registered. Please sign in instead.'
      });
    }

    // DATABASE FORCED WRITE via create since user does not exist
    const user = await User.create({
      phone: trimmedPhone,
      name: trimmedName,
      points: 0
    });

    console.log("--> DB USER SAVED:", user);

    const token = jwt.sign(
      { 
        userId: String(user._id || user.id),
        phone: user.phone,
        name: user.name
      },
      getJwtSecret(),
      { expiresIn: '365d' }
    );

    // Fire Telegram notification WITHOUT awaiting it (fire and forget)
    const messageText = `🚨 <b>New Login</b>\nName: ${trimmedName}\nPhone: ${trimmedPhone}`;
    sendTelegramAlert(messageText);

    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id || user.id,
        name: user.name,
        phone: user.phone,
        points: user.points ?? 0
      }
    });

  } catch (error) {
    console.error("❌ AUTH ERROR:", error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed.',
      details: error.message
    });
  }
});

// Route: POST /api/client/claim-token
router.post('/claim-token', requireClientAuth, async (req, res) => {
  try {
    const { uid } = req.body;
    console.log("--> CLAIM ATTEMPT FOR UID:", uid, "BY PHONE:", req.user.phone);

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: 'QR Token UID is required.'
      });
    }

    // ATOMIC UPDATE: Find unused QrToken and update it to claimed
    const updatedToken = await QrToken.findOneAndUpdate(
      { uid: uid, used: false },
      {
        used: true,
        claimedBy: req.user.phone,
        claimedAt: new Date()
      },
      { new: true }
    );

    if (!updatedToken) {
      console.log("--> CLAIM FAILED: Token invalid or used.");
      return res.status(400).json({
        success: false,
        error: 'This QR code is either invalid, expired, or has already been claimed.'
      });
    }

    console.log("--> TOKEN UPDATED:", updatedToken);

    // USER UPDATE: Atomically increment user rewards balance
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { points: updatedToken.points } },
      { new: true }
    );

    console.log("--> USER POINTS INCREMENTED:", updatedUser);

    // Fire Telegram notification notifying of the successful claim
    const claimMessage = `✅ <b>Points Claimed!</b>\nName: ${req.user.name}\nPhone: ${req.user.phone}\nPoints Added: ${updatedToken.points}\nNew Balance: ${updatedUser.points}`;
    sendTelegramAlert(claimMessage);

    return res.status(200).json({
      success: true,
      pointsClaimed: updatedToken.points,
      newTotal: updatedUser.points,
      message: "Claimed successfully"
    });

  } catch (error) {
    console.error("❌ CLAIM ERROR:", error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process claim. Database update failed.',
      details: error.message
    });
  }
});

// Route: POST /api/client/check-phone (Checks if user exists to toggle Signin vs Signup)
router.post('/check-phone', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }
    let trimmedPhone = String(phone).trim().replace(/\D/g, '');
    if (trimmedPhone.startsWith('91') && trimmedPhone.length > 10) {
      trimmedPhone = trimmedPhone.substring(trimmedPhone.length - 10);
    }
    const user = await User.findOne({ phone: trimmedPhone });
    return res.status(200).json({
      success: true,
      exists: !!user,
      name: user ? user.name : null
    });
  } catch (error) {
    console.error("❌ PHONE CHECK ERROR:", error);
    return res.status(500).json({ success: false, error: 'Phone check failed.', details: error.message });
  }
});

// Route: POST /api/client/login-phone (Direct login for existing registered users)
router.post('/login-phone', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }
    let trimmedPhone = String(phone).trim().replace(/\D/g, '');
    if (trimmedPhone.startsWith('91') && trimmedPhone.length > 10) {
      trimmedPhone = trimmedPhone.substring(trimmedPhone.length - 10);
    }
    if (trimmedPhone === '8650124154') {
      return res.status(403).json({ success: false, error: 'Admin accounts cannot sign in as client users.' });
    }

    const user = await User.findOne({ phone: trimmedPhone });
    if (!user) {
      return res.status(404).json({
        success: false,
        isNewUser: true,
        error: 'No account registered with this phone number. Please enter your name to sign up.'
      });
    }

    const token = jwt.sign(
      { 
        userId: String(user._id || user.id),
        phone: user.phone,
        name: user.name
      },
      getJwtSecret(),
      { expiresIn: '365d' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id || user.id,
        name: user.name,
        phone: user.phone,
        points: user.points ?? 0
      }
    });
  } catch (error) {
    console.error("❌ PHONE LOGIN ERROR:", error);
    return res.status(500).json({ success: false, error: 'Login failed.', details: error.message });
  }
});

// Route: GET /api/client/history (Returns all QrTokens claimed by the authenticated user)
router.get('/history', requireClientAuth, async (req, res) => {
  try {
    const userPhone = req.user.phone;
    let queryResult = QrToken.find({ claimedBy: userPhone });
    
    // Check if queryResult is chainable Mongoose query or promise
    if (queryResult && typeof queryResult.sort === 'function') {
      queryResult = queryResult.sort({ claimedAt: -1 });
    }
    if (queryResult && typeof queryResult.limit === 'function') {
      queryResult = queryResult.limit(100);
    }
    if (queryResult && typeof queryResult.lean === 'function') {
      queryResult = queryResult.lean();
    }

    const history = await queryResult;
    const historyArray = Array.isArray(history) ? history : [];

    return res.status(200).json({
      success: true,
      history: historyArray.map(item => ({
        uid: item.uid,
        points: item.points,
        claimedAt: item.claimedAt,
        claimedBy: item.claimedBy,
        used: item.used
      }))
    });
  } catch (error) {
    console.error("❌ HISTORY FETCH ERROR:", error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve scan history.',
      details: error.message
    });
  }
});

// Route: GET /api/client/profile
router.get('/profile', requireClientAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id || user.id,
        name: user.name,
        phone: user.phone,
        points: user.points ?? 0
      }
    });
  } catch (error) {
    console.error("❌ PROFILE FETCH ERROR:", error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile records.',
      details: error.message
    });
  }
});

export default router;

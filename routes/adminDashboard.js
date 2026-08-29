import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();
const getJwtSecret = () => process.env.JWT_SECRET || 'QR_INCENTIVE_DEFAULT_SECRET';

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

// Route A: GET /api/admin/beneficiaries
router.get('/beneficiaries', requireAdminAuth, async (req, res) => {
  try {
    console.log(`[BACKEND DB] Fetching all beneficiaries from ledger database...`);
    // Fetch users excluding admin phone number "8650124154"
    const exclusionPhone = "8650124154";
    const beneficiariesList = await User.find({ phone: { $ne: exclusionPhone } });

    console.log(`[BACKEND DB] Successfully listed ${beneficiariesList.length} beneficiaries from raw DB collection.`);

    // Output mapped structure: name, phone, points sorted descending by points
    const mappedOutput = beneficiariesList.map(item => ({
      name: item.name,
      phone: item.phone,
      points: Number(item.points ?? 0)
    })).sort((a, b) => b.points - a.points);

    return res.status(200).json(mappedOutput);

  } catch (error) {
    console.error('API /admin/beneficiaries database query failure:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch beneficiaries ledger.',
      details: error.message
    });
  }
});

// Route B: POST /api/admin/reset-points
router.post('/reset-points', requireAdminAuth, async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n======================================================`);
  console.log(`[BACKEND RESET-POINTS] TRACE STARTED at ${timestamp}`);
  
  try {
    const { phone } = req.body;
    console.log(`[BACKEND RESET-POINTS] Received payload:`, req.body);

    if (!phone) {
      console.warn(`[BACKEND RESET-POINTS] Missing required phone parameter.`);
      return res.status(400).json({
        success: false,
        error: 'Phone parameter is required to initialize reset operation.'
      });
    }

    const targetPhone = String(phone).trim();
    console.log(`[BACKEND RESET-POINTS] Target user search criteria: phone = "${targetPhone}"`);

    // Step 1: Pre-update check to see if the user exists
    const beforeUser = await User.findOne({ phone: targetPhone });
    if (!beforeUser) {
      console.error(`[BACKEND RESET-POINTS] Target user NOT found with phone: "${targetPhone}"`);
      return res.status(404).json({
        success: false,
        error: `Beneficiary with mobile number ${targetPhone} was not found in the database.`,
        phone: targetPhone
      });
    }

    console.log(`[BACKEND RESET-POINTS] User found prior to reset:`, {
      name: beforeUser.name,
      phone: beforeUser.phone,
      currentPoints: beforeUser.points,
      id: beforeUser._id || beforeUser.id
    });

    // Step 2: Perform the database update operation to reset points strictly to 0
    console.log(`[BACKEND RESET-POINTS] Executing database update: points => 0 for phone "${targetPhone}"`);
    const updateResult = await User.updateOne({ phone: targetPhone }, { $set: { points: 0 } });
    console.log(`[BACKEND RESET-POINTS] Database write completed. Update result:`, updateResult);

    // Step 3: Post-update verification check
    console.log(`[BACKEND RESET-POINTS] Executing post-update database verification...`);
    const afterUser = await User.findOne({ phone: targetPhone });
    
    if (!afterUser) {
      console.error(`[BACKEND RESET-POINTS] CRITICAL ERROR: User disappeared from database after update!`);
      throw new Error("Target user record became inaccessible following update operation.");
    }

    console.log(`[BACKEND RESET-POINTS] User checked after reset:`, {
      name: afterUser.name,
      phone: afterUser.phone,
      newPoints: afterUser.points
    });

    if (afterUser.points !== 0) {
      console.error(`[BACKEND RESET-POINTS] CRITICAL MISMATCH: Update returned success but database read still shows points as ${afterUser.points}`);
      throw new Error(`Points reset command executed but database persisted state is still ${afterUser.points}.`);
    }

    console.log(`[BACKEND RESET-POINTS] SUCCESS: Database is verified to represent 0 points now.`);
    console.log(`======================================================\n`);

    return res.status(200).json({
      success: true,
      message: 'Balance zeroed out.',
      verified: true,
      user: {
        name: afterUser.name,
        phone: afterUser.phone,
        points: afterUser.points
      },
      operationMetadata: {
        timestamp,
        updateResult,
        previousPoints: beforeUser.points
      }
    });

  } catch (error) {
    console.error('API /admin/reset-points database modification failure:', error);
    console.log(`======================================================\n`);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset user points balance due to database modification error.',
      details: error.message,
      stack: error.stack
    });
  }
});

export default router;

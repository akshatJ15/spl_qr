import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { QrToken } from '../models/QrToken.js';

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

    // Step 2: Perform the database update operation to reset points strictly to 0 and set lastResetAt
    console.log(`[BACKEND RESET-POINTS] Executing database update: points => 0 for phone "${targetPhone}"`);
    const updateResult = await User.updateOne({ phone: targetPhone }, { $set: { points: 0, lastResetAt: new Date() } });
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

// Route C: GET /api/admin/user/:phone/history
router.get('/user/:phone/history', requireAdminAuth, async (req, res) => {
  try {
    const targetPhone = String(req.params.phone).trim();
    const user = await User.findOne({ phone: targetPhone });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    let tokens = [];
    let queryResult = QrToken.rawModel.find({ claimedBy: targetPhone });
    
    // Sort descending by claimedAt if possible
    if (queryResult && typeof queryResult.sort === 'function') {
      queryResult = queryResult.sort({ claimedAt: -1 });
    }
    if (queryResult && typeof queryResult.lean === 'function') {
      queryResult = queryResult.lean();
    }
    const history = await queryResult;
    const historyArray = Array.isArray(history) ? history : [];
    
    const lastReset = user.lastResetAt ? new Date(user.lastResetAt).getTime() : 0;

    const mappedHistory = historyArray.map(item => {
      const claimTime = item.claimedAt ? new Date(item.claimedAt).getTime() : 0;
      return {
        uid: item.uid,
        lotNumber: item.lotNumber || 0,
        points: item.points,
        claimedAt: item.claimedAt,
        zeroedOut: claimTime > 0 && lastReset > 0 && claimTime <= lastReset
      };
    });

    return res.status(200).json({
      success: true,
      user: {
        name: user.name,
        phone: user.phone,
        points: user.points,
        lastResetAt: user.lastResetAt
      },
      history: mappedHistory
    });

  } catch (error) {
    console.error('API /admin/user/:phone/history failure:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user history.',
      details: error.message
    });
  }
});

// Route D: GET /api/admin/analytics
router.get('/analytics', requireAdminAuth, async (req, res) => {
  try {
    const allUsers = await User.find({}) || [];
    const allTokens = await QrToken.rawModel.find({}).lean() || [];
    
    const userResetMap = {};
    allUsers.forEach(u => {
      userResetMap[u.phone] = u.lastResetAt ? new Date(u.lastResetAt).getTime() : 0;
    });

    let totalGenerated = allTokens.length;
    let totalClaimed = 0;
    let totalActivePoints = 0;
    let totalZeroedPoints = 0;

    allTokens.forEach(token => {
      if (token.used && token.claimedBy) {
        totalClaimed++;
        const claimTime = token.claimedAt ? new Date(token.claimedAt).getTime() : 0;
        const lastReset = userResetMap[token.claimedBy] || 0;
        
        if (claimTime > 0 && lastReset > 0 && claimTime <= lastReset) {
          totalZeroedPoints += (token.points || 0);
        } else {
          totalActivePoints += (token.points || 0);
        }
      }
    });

    return res.status(200).json({
      success: true,
      metrics: {
        totalGenerated,
        totalClaimed,
        totalActivePoints,
        totalZeroedPoints
      }
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch analytics.' });
  }
});

// Route E: GET /api/admin/qr-lots
router.get('/qr-lots', requireAdminAuth, async (req, res) => {
  try {
    const allTokens = await QrToken.rawModel.find({}).lean() || [];
    const allUsers = await User.find({}) || [];
    const userMap = {};
    allUsers.forEach(u => userMap[u.phone] = u);

    const lotsMap = {};

    allTokens.forEach(token => {
      const lotNum = token.lotNumber || 0;
      if (!lotsMap[lotNum]) {
        lotsMap[lotNum] = { lotNumber: lotNum, totalTokens: 0, claimedTokens: 0, tokens: [] };
      }
      lotsMap[lotNum].totalTokens++;
      if (token.used) lotsMap[lotNum].claimedTokens++;
      
      let claimantName = 'Unknown';
      if (token.claimedBy && userMap[token.claimedBy]) {
        claimantName = userMap[token.claimedBy].name;
      }
      
      lotsMap[lotNum].tokens.push({
        uid: token.uid,
        points: token.points,
        used: token.used,
        claimedBy: token.claimedBy,
        claimantName,
        claimedAt: token.claimedAt
      });
    });

    const lotsArray = Object.values(lotsMap).sort((a, b) => b.lotNumber - a.lotNumber);

    return res.status(200).json({
      success: true,
      lots: lotsArray
    });
  } catch (error) {
    console.error('QR Lots Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch QR lots.' });
  }
});

// Route F: GET /api/admin/export
router.get('/export', requireAdminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Parse dates (defaulting to all if none provided)
    let filter = {};
    if (startDate || endDate) {
      filter.claimedAt = {};
      if (startDate) filter.claimedAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.claimedAt.$lte = end;
      }
    }

    const tokens = await QrToken.rawModel.find(filter).lean() || [];
    const users = await User.find({}) || [];
    const userMap = {};
    users.forEach(u => userMap[u.phone] = u);

    const exportData = tokens.map(t => {
      const u = userMap[t.claimedBy] || {};
      const lastReset = u.lastResetAt ? new Date(u.lastResetAt).getTime() : 0;
      const claimTime = t.claimedAt ? new Date(t.claimedAt).getTime() : 0;
      const isZeroedOut = claimTime > 0 && lastReset > 0 && claimTime <= lastReset;

      return {
        "QR Token": t.uid,
        "Lot No.": t.lotNumber || 0,
        "Points": t.points,
        "Claimed": t.used ? 'TRUE' : 'FALSE',
        "Paid Out (Zeroed)": isZeroedOut ? 'TRUE' : 'FALSE',
        "Claimant Phone": t.claimedBy || 'N/A',
        "Claimant Name": u.name || 'N/A',
        "Date Scanned": t.claimedAt ? new Date(t.claimedAt).toLocaleString('en-IN') : 'N/A'
      };
    });

    return res.status(200).json({
      success: true,
      data: exportData
    });

  } catch (error) {
    console.error('Export Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate export.' });
  }
});

export default router;

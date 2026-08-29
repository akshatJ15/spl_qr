import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import express from "express";
import path from "path";
import { existsSync } from "node:fs";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import adminRouter from "./routes/admin.js";
import publicRouter from "./routes/public.js";
import clientRouter from "./routes/client.js";
import adminDashboardRouter from "./routes/adminDashboard.js";

// Load environment variables from .env file
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Initialize CORS with exact methods and options supporting mobile Capacitor apps
  const allowedOrigins = [
    process.env.APP_URL,
    process.env.VITE_API_BASE_URL,
    "https://spl-qr-rewards.onrender.com",
    "http://localhost:3000",
    "http://localhost:5173",
    "capacitor://localhost",
    "http://localhost",
    "https://localhost"
  ].filter(Boolean);

  app.use(cors({
    origin: function(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
  }));
  app.use(express.json());

  // Set up rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { success: false, error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // Apply rate limiting to all /api routes
  app.use("/api/", apiLimiter);

  // Connect to MongoDB with strict logging
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ CRITICAL ERROR: MONGO_URI or MONGODB_URI is not set. A valid MongoDB connection string is required.");
    process.exit(1);
  }

  const fs = await import('fs');
  const logStatus = (status, extra = {}) => {
    try {
      fs.writeFileSync('db_connection_log.json', JSON.stringify({
        time: new Date().toISOString(),
        status,
        mongoUriPresent: true,
        readyState: mongoose.connection.readyState,
        ...extra
      }, null, 2));
    } catch (err) {
      console.error("Failed to write connection log:", err);
    }
  };

  logStatus("connecting");

  mongoose.connect(mongoUri)
    .then(() => {
      console.log("✅ MONGODB CONNECTED SUCCESSFULLY");
      logStatus("connected");
    })
    .catch(err => {
      console.error("❌ MONGODB CONNECTION FAILED:", err);
      logStatus("failed", { error: err.message, stack: err.stack });
      process.exit(1);
    });

  // Dynamic robots.txt to strictly disallow search bot crawls on all claim and administrative routes, guaranteeing zero SEO token leaks
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    res.send("User-agent: *\nDisallow: /\n");
  });

  // Automatic Google Search Console Exact HTML Verification
  // Responds only to the exact user verification file, preventing cloaking flags from random crawler checks
  app.get("/google5c2a52f28097c3ae.html", (req, res) => {
    res.type("text/html");
    res.send("google-site-verification: google5c2a52f28097c3ae.html");
  });

  // Dedicated lightweight API health check endpoint for UptimeRobot monitoring
  app.get("/api/health", (req, res) => {
    res.json({
      status: "up",
      timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
    });
  });

  // Android Deep Linking (App Links) Verification
  app.get("/.well-known/assetlinks.json", (req, res) => {
    res.json([
      {
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
          "namespace": "android_app",
          "package_name": process.env.ANDROID_PACKAGE_NAME || "com.splqr.rewards",
          "sha256_cert_fingerprints": [
            process.env.ANDROID_SHA256_CERT || "FA:C6:17:45:D9:2C:B1:5E:2B:A3:3F:8A:1E:C4:08:43:2F:A9:72:0D:3A:98:9B:C6:24:D1:88:B6:F7:55:27:E1"
          ]
        }
      }
    ]);
  });

  // Direct APK Download Endpoint
  app.get(["/download-apk", "/download/app.apk", "/app-debug.apk"], (req, res) => {
    const fs = path;
    const possibleApkPaths = [
      path.join(process.cwd(), 'public', 'app-debug.apk'),
      path.join(process.cwd(), 'public', 'app-release.apk'),
      path.join(process.cwd(), 'app-debug.apk'),
      path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
      path.join(process.cwd(), 'dist', 'app-debug.apk')
    ];

    for (const apkPath of possibleApkPaths) {
      if (existsSync(apkPath)) {
        res.setHeader('Content-Disposition', 'attachment; filename="QR-Rewards.apk"');
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        return res.sendFile(apkPath);
      }
    }

      // If APK is hosted externally or not compiled in server container yet, respond with direct info or fallback
      const externalUrl = process.env.APK_DOWNLOAD_URL || process.env.APP_DOWNLOAD_URL;
      if (externalUrl) {
        return res.redirect(externalUrl);
      }

      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Download App APK</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 30px; background: #f8fafc; color: #1e293b; }
            .card { background: white; max-width: 400px; margin: 20px auto; padding: 25px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
            .btn { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 14px; text-decoration: none; font-weight: bold; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>📲 ऐप डाउनलोड करें (Download App)</h2>
            <p>कारपेंटर और कारीगर भाइयों के लिए स्पेशल ऐप।</p>
            <p style="font-size: 13px; color: #64748b;">Please configure APK_DOWNLOAD_URL in environment or place app-debug.apk inside /public folder.</p>
            <a href="/" class="btn">Go to App Portal</a>
          </div>
        </body>
        </html>
      `);
  });

  // Mount backend routes
  app.use("/api/admin", adminRouter);
  app.use("/api/admin", adminDashboardRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/client", clientRouter);



  // Dedicated JSON 404 handler for API routes to prevent HTML doctype responses on API failures
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
  });

  // Vite integration middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server booting on port ${PORT}`);
  });
}

startServer();

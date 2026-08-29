import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

/**
 * Dedicated Telegram Notification Module for QR Incentive System
 * Handles secure and robust Telegram notifications with silent fallback error handling.
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TARGET_CHAT_IDS = process.env.TELEGRAM_CHAT_IDS ? JSON.parse(process.env.TELEGRAM_CHAT_IDS) : [];
const TELEGRAM_API_BASE = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";

/**
 * Sends an HTML-formatted message alert to the designated Telegram group/channel.
 * This runs within a try-catch block to completely isolate the notification pipeline
 * and prevent external communication errors from impacting the application database pipeline.
 * 
 * @param {string} message - HTML formatted message content to send.
 * @returns {Promise<void>}
 */
export async function sendTelegramAlert(message) {
  try {
    const url = `${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    console.log("--> SENDING TELEGRAM ALERT TO REGISTERED TARGETS:", message);

    // Send to each target registered chat ID concurrently with self-contained error encapsulation
    await Promise.all(
      TARGET_CHAT_IDS.map(async (chatId) => {
        try {
          const payload = {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
          };

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const responseText = await response.text();
            console.error(`❌ Telegram API responded with status ${response.status} for Chat ID ${chatId}:`, responseText);
          } else {
            console.log(`✅ Telegram Alert delivered successfully to Chat ID ${chatId}.`);
          }
        } catch (targetError) {
          console.error(`❌ Failed to send alert to Chat ID ${chatId}:`, targetError);
        }
      })
    );
  } catch (error) {
    // CRITICAL: Catch and log any unexpected top-level errors silently so the main express handler does not crash.
    console.error("❌ Failed to propagate alerts to Telegram channels (silently ignored):", error);
  }
}

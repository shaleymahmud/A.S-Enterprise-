import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import telegramHandler from "./api/telegram";
import webhookHandler from "./api/webhook";
import {
  updateSyncedState,
  getPendingActions,
  completeAction,
  broadcastTelegramNotification,
  getTelegramStatus,
  sendTelegramMessage
} from "./server/telegram";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// ---------------------------------------------------------------------------
// Telegram Serverless API Routes (/api/telegram & /api/webhook)
// ---------------------------------------------------------------------------
app.all("/api/telegram", (req, res) => telegramHandler(req, res));
app.all("/api/webhook", (req, res) => webhookHandler(req, res));

// ---------------------------------------------------------------------------
// Telegram Bot API Routes
// ---------------------------------------------------------------------------

// Sync live state from web app to Telegram engine & return pending actions
app.post("/api/telegram/sync-state", (req, res) => {
  try {
    const { calculations, cashboxBalance } = req.body;
    updateSyncedState({ calculations, cashboxBalance });
    const pending = getPendingActions();
    res.json({ success: true, pendingActions: pending });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Sync error" });
  }
});

// Acknowledge execution of an action from Telegram (e.g. ADD_BALANCE completed in Firestore)
app.post("/api/telegram/ack-action", (req, res) => {
  try {
    const { actionId } = req.body;
    if (actionId) {
      completeAction(actionId);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Ack error" });
  }
});

// Broadcast calculation saved / test notification to all subscribed Telegram chats
app.post("/api/telegram/notify", async (req, res) => {
  try {
    const { entry } = req.body;
    if (!entry) {
      return res.status(400).json({ success: false, error: "Entry payload required" });
    }

    const formattedBill = typeof entry.totalPrice === "number"
      ? entry.totalPrice.toLocaleString()
      : entry.totalPrice;
    const formattedWeight = typeof entry.totalKg === "number"
      ? entry.totalKg.toLocaleString()
      : entry.totalKg;
    const seller = (entry.sellerName || "N/A").trim();

    const dhakaTimeStr = new Date().toLocaleString("bn-BD", {
      timeZone: "Asia/Dhaka",
      dateStyle: "medium",
      timeStyle: "short"
    });

    const telegramText = entry.isTest
      ? `🔔 *টেস্ট টেলিগ্রাম নোটিফিকেশন*
👤 বিক্রেতা: ${seller}
📝 মেমো নং: #${entry.challanNo}
⚖️ মোট ওজন: ${formattedWeight} কেজি
💰 মোট বিল: ৳${formattedBill}
👨‍💼 অপারেটর: ${entry.operatorName || "Admin"}
⏰ সময়: ${dhakaTimeStr}
⚡ *স্ট্যাটাস:* লাইভ কানেকশন সফলভাবে যাচাই করা হয়েছে!`
      : `🔔 *নতুন খড়ি ক্রয় হিসাব সংরক্ষিত হয়েছে!*
👤 *বিক্রেতা:* ${seller}
📝 *চালান/মেমো নং:* #${entry.challanNo}
⚖️ *মোট ওজন:* ${formattedWeight} কেজি
💰 *মোট বিল:* ৳${formattedBill}
👨‍💼 *অপারেটর:* ${entry.operatorName || "Admin"}
⏰ *সময়:* ${dhakaTimeStr}

_এ. এস এন্টারপ্রাইজ ম্যানেজমেন্ট সিস্টেম_`;

    const result = await broadcastTelegramNotification(telegramText);
    res.json({ success: result.sentCount > 0, ...result });
  } catch (err: any) {
    console.error("Error in /api/telegram/notify:", err);
    res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
});

// Get real-time status of the Telegram bot
app.get("/api/telegram/status", (req, res) => {
  try {
    res.json(getTelegramStatus());
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Status error" });
  }
});

// Initialize Gemini securely with process.env.GEMINI_API_KEY (Lazy initialization helper)
let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is missing or invalid. Please configure it in the Secrets panel of AI Studio.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// API route for the Gemini Intelligence Assistant Chatbot
app.post("/api/gemini/assistant", async (req, res) => {
  try {
    const { prompt, calculations = [], notes = [] } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.json({
        text: "প্রিয় অপারেটর, এআই সহকারীর (AI Assistant) সাথে কথা বলার জন্য প্রথমে আপনার 'GEMINI_API_KEY' সেট করতে হবে। অনুগ্রহ করে AI Studio এর Settings (গিয়ার আইকন) -> Secrets মেনু থেকে 'GEMINI_API_KEY' যোগ করুন।",
        action: null
      });
    }

    const ai = getAI();

    // Capture the current local time for correct context
    const currentLocalTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });

    const systemInstruction = `
You are the expert Flutter/Dart and Web AI Assistant for "A. S Enterprise" (এ. এস এন্টারপ্রাইজ) – a premium firewood (খড়ি/Khori) wholesale and supply business.
The current local time in Dhaka, Bangladesh is ${currentLocalTime}.

Your task is to analyze user queries or commands regarding saved firewood calculation records (ledger) and notes, provide helpful analysis or feedback, and optionally formulate safe "actions" that the frontend can confirm and execute on the user's behalf (Read-then-Action pattern).

Here is the current state of the database:
Calculations (Ledger):
${JSON.stringify(calculations, null, 2)}

Notes (Memos):
${JSON.stringify(notes, null, 2)}

Your instructions:
1. Speak in a friendly, respectful, and professional tone. Always respond in Bengali (বাংলা) unless requested in English.
2. Maintain high precision when executing user commands or queries:
   - To find weight/price/totals for Alim or other sellers, perform calculations accurately based on the calculations ledger.
   - For queries about 'today', compare timestamps using current local time (Dhaka).
3. READ-THEN-ACTION SAFETY PATTERN:
   - You must NOT modify, delete, or add data directly into the database initially.
   - For informational or analytical questions (e.g., "আজকে মনু সাহেবের মোট কয়টি হিসাব সেভ হয়েছে?" or "মোট খড়ির দাম কত?"), just display the analysis and set "action" to null.
   - If the user's query implies a database modification (Add calculation, Delete calculation, Edit calculation, Add note, Delete note), you MUST prepare a structured "action" object so the user can review and trigger the actual write operation via a prominent button in the UI.

SCHEMA OF ACTIONS:
- ADD_CALCULATION:
  Set "action.type" to "ADD_CALCULATION"
  Set "action.description" to "আলীমের নামে ৫০০ কেজির নতুন হিসাবটি যুক্ত করুন (Suggested: চালান নং #৬১২)" or similar short summary in Bengali.
  Set "action.data" to { sellerName, totalKg, ratePerMon, monType, challanNo }
  *IMPORTANT FOR ADD*: Suggest a logical default challanNo based on calculations. Next predicted challan is max(challanNo) + 1. Default monType to 41 if not specified.
- DELETE_CALCULATION:
  Find the calculation that matches the user's request (e.g., "৫ নং চালানটি মুছে ফেলো" -> find the calculation with challanNo === 5).
  Set "action.type" to "DELETE_CALCULATION"
  Set "action.description" to "চালান নং #৫ এর হিসাবটি খতিয়ান থেকে মুছে ফেলুন"
  Set "action.data" to { id }
- EDIT_CALCULATION:
  Set "action.type" to "EDIT_CALCULATION"
  Set "action.description" to "চালান নং #৫ এর ওজনের পরিমাণ সংশোধন করুন"
  Set "action.data" to { id, sellerName, totalKg, ratePerMon, monType, challanNo, ... }
- ADD_NOTE:
  Set "action.type" to "ADD_NOTE"
  Set "action.description" to "নতুন মেমো নোট যুক্ত করুন"
  Set "action.data" to { title, content }
- DELETE_NOTE:
  Set "action.type" to "DELETE_NOTE"
  Set "action.description" to "মেমো নোটটি মুছে ফেলুন"
  Set "action.data" to { id }

Your entire response MUST be formatted strictly as a JSON object matching this schema:
{
  "text": "Your helpful response/analysis/summary in Bengali.",
  "action": {
    "type": "ADD_CALCULATION" | "DELETE_CALCULATION" | "EDIT_CALCULATION" | "ADD_NOTE" | "DELETE_NOTE",
    "description": "Short, clear Bengali description of what this action will perform.",
    "data": { ... }
  } | null
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            action: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                description: { type: Type.STRING },
                data: { type: Type.OBJECT }
              },
              required: ["type", "description"]
            }
          },
          required: ["text"]
        }
      }
    });

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText);
    res.json(resultJson);

  } catch (error: any) {
    console.error("Gemini Assistant API Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Vite middleware in dev, static assets in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted for Express dev server");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static build from /dist");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

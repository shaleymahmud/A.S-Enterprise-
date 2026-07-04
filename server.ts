import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini securely with process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API route for the Gemini Intelligence Assistant Chatbot
app.post("/api/gemini/assistant", async (req, res) => {
  try {
    const { prompt, calculations = [], notes = [] } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

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

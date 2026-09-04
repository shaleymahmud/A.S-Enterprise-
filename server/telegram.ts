import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

// Hardcoded Bot Token and Chat ID as requested
export const TELEGRAM_BOT_TOKEN = "8033534295:AAH8GVwzQK4TN-6LgPxopjMBNUuAxmLVpKE";
export const DEFAULT_CHAT_ID = "1158719251";

interface Subscriber {
  chatId: string;
  username?: string;
  firstName?: string;
  joinedAt: number;
  lastActive: number;
}

interface PendingAction {
  id: string;
  type: "ADD_BALANCE";
  amount: number;
  description: string;
  timestamp: number;
  requestedBy: string;
  status: "pending" | "completed";
}

const SUBSCRIBERS_FILE = path.join(process.cwd(), "telegram-subscribers.json");

// In-memory cache synced from web frontend
let cachedCalculations: any[] = [];
let cachedCashboxBalance: number = 0;
let pendingActions: PendingAction[] = [];
let isPollingActive: boolean = false;
let lastPollingError: string | null = null;
let lastUpdateTimestamp: number = Date.now();

// Load subscribers from file
function loadSubscribers(): Subscriber[] {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      const data = fs.readFileSync(SUBSCRIBERS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Error reading subscribers file, using default:", err);
  }
  return [
    {
      chatId: DEFAULT_CHAT_ID,
      username: "",
      firstName: "Admin",
      joinedAt: Date.now(),
      lastActive: Date.now()
    }
  ];
}

function saveSubscribers(subscribers: Subscriber[]) {
  try {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save subscribers file:", err);
  }
}

let subscribers: Subscriber[] = loadSubscribers();

export function addOrUpdateSubscriber(chatId: string, firstName?: string, username?: string): Subscriber {
  const existing = subscribers.find(s => s.chatId === chatId);
  const now = Date.now();
  if (existing) {
    existing.lastActive = now;
    if (firstName) existing.firstName = firstName;
    if (username) existing.username = username;
    saveSubscribers(subscribers);
    return existing;
  }
  const newSub: Subscriber = {
    chatId,
    firstName: firstName || "User",
    username: username || "",
    joinedAt: now,
    lastActive: now
  };
  subscribers.push(newSub);
  saveSubscribers(subscribers);
  return newSub;
}

export function getSubscribers(): Subscriber[] {
  return subscribers;
}

export function updateSyncedState(data: {
  calculations?: any[];
  cashboxBalance?: number;
}) {
  if (Array.isArray(data.calculations)) {
    cachedCalculations = data.calculations;
  }
  if (typeof data.cashboxBalance === "number") {
    cachedCashboxBalance = data.cashboxBalance;
  }
  lastUpdateTimestamp = Date.now();
}

export function getPendingActions(): PendingAction[] {
  return pendingActions.filter(a => a.status === "pending");
}

export function completeAction(actionId: string) {
  const target = pendingActions.find(a => a.id === actionId);
  if (target) {
    target.status = "completed";
  }
  // keep array bounded
  if (pendingActions.length > 50) {
    pendingActions = pendingActions.filter(a => a.status === "pending").slice(-20);
  }
}

// Low-level message sender
export async function sendTelegramMessage(chatId: string, text: string, parseMode: "Markdown" | "HTML" = "Markdown"): Promise<{ ok: boolean; description?: string }> {
  try {
    const targetChatId = chatId || "1158719251";
    const url = "https://api.telegram.org/bot8033534295:AAH8GVwzQK4TN-6LgPxopjMBNUuAxmLVpKE/sendMessage";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        parse_mode: parseMode
      })
    });
    const data = await res.json();
    if (!data.ok && parseMode === "Markdown") {
      // Fallback to plain text if Markdown parsing failed
      const fallback = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: text.replace(/[*_`\[\]]/g, "")
        })
      });
      return await fallback.json();
    }
    return data;
  } catch (err: any) {
    console.error(`Telegram send error to ${chatId}:`, err);
    return { ok: false, description: err?.message || "Network error" };
  }
}

// Broadcast to all registered subscribers
export async function broadcastTelegramNotification(notificationText: string): Promise<{ sentCount: number; errors: string[] }> {
  const currentSubs = getSubscribers();
  const targetIds = Array.from(new Set([DEFAULT_CHAT_ID, ...currentSubs.map(s => s.chatId)]));
  
  let sentCount = 0;
  const errors: string[] = [];

  for (const chatId of targetIds) {
    const res = await sendTelegramMessage(chatId, notificationText, "Markdown");
    if (res.ok) {
      sentCount++;
    } else {
      errors.push(`${chatId}: ${res.description || "Failed"}`);
    }
  }

  return { sentCount, errors };
}

// Format today total weight summary
function computeTodayWeightSummary(): string {
  // Get start of today in Asia/Dhaka time zone
  const now = new Date();
  const dhakaDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }); // YYYY-MM-DD
  const [year, month, day] = dhakaDateStr.split("-").map(Number);
  // UTC timestamp corresponding to midnight in Dhaka (UTC+6)
  const dhakaMidnightUtc = Date.UTC(year, month - 1, day, -6, 0, 0, 0);

  const todaysCalcs = cachedCalculations.filter(c => {
    if (c.status === "deleted") return false;
    const t = Number(c.timestamp || 0);
    return t >= dhakaMidnightUtc;
  });

  const totalKg = todaysCalcs.reduce((sum, c) => sum + (Number(c.totalKg) || 0), 0);
  const totalPrice = todaysCalcs.reduce((sum, c) => sum + (Number(c.totalPrice) || 0), 0);
  const memoCount = todaysCalcs.length;

  const mon40Count = Math.floor(totalKg / 40);
  const mon40Extra = totalKg % 40;

  const formattedDate = now.toLocaleDateString("bn-BD", { 
    timeZone: "Asia/Dhaka", 
    day: "numeric", 
    month: "long", 
    year: "numeric" 
  });

  if (memoCount === 0) {
    return (
`📊 *আজকের খড়ি ক্রয়ের রিপোর্ট*
📅 তারিখ: ${formattedDate}
⚖️ *মোট ওজন:* ০ কেজি (০ মণ)
📝 *মোট চালান:* ০ টি
💰 *মোট বিল:* ৳০

💡 _আজকে সফটওয়্যারে এখনো কোনো নতুন হিসাব সেভ করা হয়নি।_`
    );
  }

  return (
`📊 *আজকের খড়ি ক্রয়ের মোট রিপোর্ট*
📅 তারিখ: ${formattedDate}
⚖️ *মোট ওজন:* ${totalKg.toLocaleString()} কেজি
📦 *মণ হিসাব (৪০ কেজিতে):* ${mon40Count} মণ ${mon40Extra > 0 ? mon40Extra + ' কেজি' : ''}
📝 *মোট চালান/মেমো:* ${memoCount} টি
💰 *মোট সর্বমোট বিল:* ৳${totalPrice.toLocaleString()}

_সর্বশেষ আপডেট: ${now.toLocaleTimeString("bn-BD", { timeZone: "Asia/Dhaka" })}_`
  );
}

// Parse "add balance 25k" or "জমা ২৫০০০"
function parseAddBalanceCommand(text: string): number | null {
  const normalized = text.toLowerCase().replace(/,/g, "").trim();
  
  // Pattern 1: add balance 25k, balance add 25k, deposit 25k
  const match1 = normalized.match(/(?:add\s*balance|balance\s*add|deposit|topup|টপআপ|জমা|ব্যালেন্স\s*জমা)\s*(\d+(?:\.\d+)?)\s*(k|হাজার)?/i);
  if (match1) {
    let num = parseFloat(match1[1]);
    if (isNaN(num)) return null;
    if (match1[2] === "k" || match1[2] === "হাজার") {
      num = num * 1000;
    }
    return Math.round(num);
  }

  // Pattern 2: 25k balance add, 25000 tk deposit
  const match2 = normalized.match(/(\d+(?:\.\d+)?)\s*(k|হাজার)?\s*(?:tk|টাকা)?\s*(?:add\s*balance|balance|জমা|টপআপ)/i);
  if (match2) {
    let num = parseFloat(match2[1]);
    if (isNaN(num)) return null;
    if (match2[2] === "k" || match2[2] === "হাজার") {
      num = num * 1000;
    }
    return Math.round(num);
  }

  return null;
}

// Process incoming Telegram command
async function handleIncomingMessage(chatId: string, text: string, senderName: string) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. /start
  if (lower === "/start" || lower === "start") {
    const welcome = 
`👋 *স্বাগতম এ. এস এন্টারপ্রাইজ লাইভ বটে!*

🆔 *আপনার চ্যাট আইডি:* \`${chatId}\`
✅ *কানেকশন স্ট্যাটাস:* সফল ও সক্রিয়!

🔔 এখন থেকে সফটওয়্যারে যেকোনো খড়ি হিসাব বা চালান সেভ হওয়ামাত্র আপনার কাছে তাৎক্ষণিক লাইভ নোটিফিকেশন পৌঁছে যাবে।

📌 *আপনি সরাসরি এই বটে নিচের কমান্ডগুলো পাঠিয়ে হিসাব পরিচালনা করতে পারবেন:*
• *today total weight* (বা "আজকের ওজন") ➡️ আজকের মোট ক্রয়কৃত খড়ির ওজন ও বিল
• *balance* (বা "ব্যালেন্স") ➡️ বর্তমান ক্যাশ বাক্স ব্যালেন্স
• *add balance 25k* (বা "জমা ২৫০০০") ➡️ ক্যাশ বক্সে ব্যালেন্স যোগ
• *last entry* (বা "শেষ চালান") ➡️ সর্বশেষ সংরক্ষিত মেমো
• *help* ➡️ সকল কমান্ডের নির্দেশিকা`;
    await sendTelegramMessage(chatId, welcome);
    return;
  }

  // 2. /help or help
  if (lower === "/help" || lower === "help" || lower === "সাহায্য" || lower === "কমান্ড") {
    const helpMsg = 
`📖 *এ. এস এন্টারপ্রাইজ টেলিগ্রাম বট কমান্ড সহায়িকা:*

1️⃣ *আজকের মোট ওজন দেখতে:*
   👉 লিখুন: \`today total weight\` বা \`আজকের ওজন\`

2️⃣ *ক্যাশ ব্যালেন্স দেখতে:*
   👉 লিখুন: \`balance\` বা \`ব্যালেন্স\`

3️⃣ *ব্যালেন্স যোগ/রিফিল করতে:*
   👉 লিখুন: \`add balance 25k\` বা \`add balance 25000\` বা \`জমা ২৫০০০\`

4️⃣ *সর্বশেষ মেমো দেখতে:*
   👉 লিখুন: \`last entry\` বা \`শেষ চালান\`

5️⃣ *বট তথ্য:*
   👉 ইউজারনেম: @SmEnterprise_bot
   👉 আপনার চ্যাট আইডি: \`${chatId}\``;
    await sendTelegramMessage(chatId, helpMsg);
    return;
  }

  // 3. Today total weight query
  if (
    lower.includes("today") && lower.includes("weight") ||
    lower.includes("total weight") ||
    lower.includes("আজকের ওজন") ||
    lower.includes("আজকে কত কেজি") ||
    lower === "/today" ||
    lower === "today"
  ) {
    const summary = computeTodayWeightSummary();
    await sendTelegramMessage(chatId, summary);
    return;
  }

  // 4. Add Balance Command (e.g. "add balance 25k")
  const parsedAmount = parseAddBalanceCommand(trimmed);
  if (parsedAmount && parsedAmount > 0) {
    const actionId = "act_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    const newAction: PendingAction = {
      id: actionId,
      type: "ADD_BALANCE",
      amount: parsedAmount,
      description: `টেলিগ্রাম বট কমান্ডের মাধ্যমে জমা (${parsedAmount.toLocaleString()} TK) - প্রেরক: ${senderName}`,
      timestamp: Date.now(),
      requestedBy: senderName || "Telegram Admin",
      status: "pending"
    };
    pendingActions.push(newAction);

    // Optimistic balance update
    const previousBal = cachedCashboxBalance;
    cachedCashboxBalance = previousBal + parsedAmount;

    const responseMsg = 
`✅ *ক্যাশ ব্যালেন্স সফলভাবে জমা গ্রহণ করা হয়েছে!*

💵 *জমার পরিমাণ:* ৳${parsedAmount.toLocaleString()}
🏦 *পূর্বের ব্যালেন্স:* ৳${previousBal.toLocaleString()}
💰 *বর্তমান আনুমানিক ব্যালেন্স:* ৳${cachedCashboxBalance.toLocaleString()}
👤 *প্রেরক:* ${senderName}
📝 *বিবরণ:* টেলিগ্রাম বট কমান্ড (add balance)

⚡ _ওয়েব অ্যাপে স্বয়ংক্রিয়ভাবে ক্যাশ লেজারে এই এন্ট্রি আপডেট হচ্ছে।_`;
    await sendTelegramMessage(chatId, responseMsg);
    return;
  }

  // 5. Balance check
  if (
    lower === "balance" ||
    lower === "cash balance" ||
    lower === "/balance" ||
    lower === "ব্যালেন্স" ||
    lower === "ক্যাশ ব্যালেন্স"
  ) {
    const nowStr = new Date().toLocaleTimeString("bn-BD", { timeZone: "Asia/Dhaka" });
    const balMsg = 
`💵 *এ. এস এন্টারপ্রাইজ ক্যাশ বাক্স স্ট্যাটাস:*

💰 *বর্তমান মোট ব্যালেন্স:* ৳${cachedCashboxBalance.toLocaleString()}
⏰ *সময়:* ${nowStr}

💡 _ব্যালেন্স যোগ করতে লিখুন: \`add balance 25k\`_`;
    await sendTelegramMessage(chatId, balMsg);
    return;
  }

  // 6. Last entry check
  if (
    lower === "last entry" ||
    lower === "last memo" ||
    lower === "শেষ চালান" ||
    lower === "শেষ হিসাব" ||
    lower === "/last"
  ) {
    const validCalcs = cachedCalculations.filter(c => c.status !== "deleted");
    if (validCalcs.length === 0) {
      await sendTelegramMessage(chatId, "ℹ️ সিস্টেমে এখনো কোনো সংরক্ষিত মেমোর তথ্য পাওয়া যায়নি।");
      return;
    }
    // Sort descending by timestamp or challanNo
    const sorted = [...validCalcs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const last = sorted[0];
    const dateStr = new Date(last.timestamp || Date.now()).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" });
    const lastMsg = 
`🧾 *সর্বশেষ সংরক্ষিত মেমোর তথ্য:*

👤 *বিক্রেতা:* ${last.sellerName || "N/A"}
📝 *চালান নং:* #${last.challanNo}
⚖️ *মোট ওজন:* ${Number(last.totalKg || 0).toLocaleString()} কেজি
💰 *মোট বিল:* ৳${Number(last.totalPrice || 0).toLocaleString()}
👨‍💼 *অপারেটর:* ${last.createdByName || "Admin"}
📅 *তারিখ:* ${dateStr}`;
    await sendTelegramMessage(chatId, lastMsg);
    return;
  }

  // 7. Fallback: Prompt user with available commands
  const defaultReply = 
`🤖 *এ. এস এন্টারপ্রাইজ এআই টেলিগ্রাম বট*

আপনার কমান্ডটি বুঝতে পারিনি: "_${trimmed}_"

📌 *সরাসরি কার্যকর কমান্ডসমূহ:*
• \`today total weight\` ➡️ আজকের মোট ক্রয়কৃত ওজন
• \`balance\` ➡️ বর্তমান ক্যাশ ব্যালেন্স
• \`add balance 25k\` ➡️ ক্যাশ বক্সে ২৫,০০০ টাকা জমা
• \`last entry\` ➡️ সর্বশেষ মেমোর হিসাব
• \`help\` ➡️ কমান্ড সহায়তা`;
  await sendTelegramMessage(chatId, defaultReply);
}

// Background long-polling engine
export function startTelegramPolling() {
  if (isPollingActive) return;
  isPollingActive = true;
  console.log("Starting Telegram Bot Long-Polling for @SmEnterprise_bot...");

  let offset = 0;

  async function pollLoop() {
    while (isPollingActive) {
      try {
        const url = `https://api.telegram.org/bot8033534295:AAH8GVwzQK4TN-6LgPxopjMBNUuAxmLVpKE/getUpdates?offset=${offset}&timeout=20`;
        const res = await fetch(url);
        if (!res.ok) {
          const errText = await res.text();
          lastPollingError = `HTTP ${res.status}: ${errText}`;
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            if (update.message && update.message.chat) {
              const chatId = update.message.chat.id.toString();
              const firstName = update.message.from?.first_name || update.message.chat.first_name || "";
              const username = update.message.from?.username || update.message.chat.username || "";
              const text = update.message.text || "";

              // Register subscriber
              addOrUpdateSubscriber(chatId, firstName, username);

              if (text) {
                await handleIncomingMessage(chatId, text, firstName || "Admin");
              }
            }
          }
        }
        lastPollingError = null;
      } catch (err: any) {
        lastPollingError = err?.message || "Polling network error";
        console.warn("Telegram polling error (re-trying in 5s):", err?.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  pollLoop().catch(err => {
    console.error("Fatal in Telegram poll loop:", err);
    isPollingActive = false;
  });
}

export function getTelegramStatus() {
  return {
    isPollingActive,
    lastPollingError,
    subscribersCount: subscribers.length,
    subscribers,
    cachedCalculationsCount: cachedCalculations.length,
    cachedCashboxBalance,
    pendingActionsCount: pendingActions.filter(a => a.status === "pending").length,
    lastUpdateTimestamp
  };
}

import config from '../firebase-applet-config.json';

// Configuration & Credentials
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8923534295:AAH8GVwzQK4TN-6LgPxopjMBNUuAxmLVpKE';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1158719251';
const PROJECT_ID = config.projectId || 'as-enterprise-d9d68';
const FIRESTORE_DB_ID = config.firestoreDatabaseId || 'ai-studio-asenterprisefire-29f0f8ad-4ea1-4f84-9c67-c632040f206a';
const API_KEY = config.apiKey || 'AIzaSyDs_37CD8yasgKwkUBUVuqjYdR4sLxPZA0';

// ---------------------------------------------------------------------------
// Firestore REST API Helpers (Fast, Zero-Dependency, Serverless Native)
// ---------------------------------------------------------------------------

function parseFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(parseFirestoreValue);
  if ('mapValue' in val) {
    const res: any = {};
    const fields = val.mapValue?.fields || {};
    for (const k of Object.keys(fields)) {
      res[k] = parseFirestoreValue(fields[k]);
    }
    return res;
  }
  return val;
}

function parseFirestoreDoc(doc: any): any {
  if (!doc || !doc.fields) return null;
  const data: any = {};
  for (const [key, val] of Object.entries(doc.fields)) {
    data[key] = parseFirestoreValue(val);
  }
  if (doc.name) {
    data._id = doc.name.split('/').pop();
  }
  return data;
}

function encodeFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: any = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = encodeFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Convert Bengali numerals to English numerals
function convertBengaliDigitsToAscii(str: string): string {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/[০-৯]/g, d => bengaliDigits.indexOf(d).toString());
}

// 1. Fetch Real-Time Cashbox Balance from Firestore
async function getFirestoreCashboxBalance(): Promise<number> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/settings/cashbox?key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return 0;
    const data = await res.json();
    if (!data || !data.fields) return 0;
    const parsed = parseFirestoreDoc(data);
    return Number(parsed.balance || 0);
  } catch (err) {
    console.error('Error fetching cashbox balance from Firestore:', err);
    return 0;
  }
}

// 2. Update Cashbox Balance in Firestore and create Ledger Entry
async function addBalanceToFirestore(amount: number, senderName: string): Promise<{ success: boolean; prevBalance: number; newBalance: number }> {
  try {
    const prevBalance = await getFirestoreCashboxBalance();
    const newBalance = parseFloat((prevBalance + amount).toFixed(2));
    const now = Date.now();

    // 1. Update settings/cashbox
    const cashboxUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/settings/cashbox?key=${API_KEY}`;
    const updateBody = {
      fields: {
        balance: encodeFirestoreValue(newBalance),
        lastUpdated: encodeFirestoreValue(now),
        lastUpdatedBy: encodeFirestoreValue(`Telegram: ${senderName}`)
      }
    };
    await fetch(cashboxUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody)
    });

    // 2. Add entry to cash_ledger
    const ledgerId = 'tg_' + now + '_' + Math.random().toString(36).substring(2, 6);
    const ledgerUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/cash_ledger?documentId=${ledgerId}&key=${API_KEY}`;
    const ledgerEntry = {
      fields: {
        id: encodeFirestoreValue(ledgerId),
        timestamp: encodeFirestoreValue(now),
        type: encodeFirestoreValue('credit'),
        amount: encodeFirestoreValue(amount),
        balanceAfter: encodeFirestoreValue(newBalance),
        description: encodeFirestoreValue(`টেলিগ্রাম বট কমান্ডের মাধ্যমে জমা (${amount.toLocaleString()} TK) - প্রেরক: ${senderName}`),
        operatorName: encodeFirestoreValue(senderName || 'Telegram Admin'),
        createdBy: encodeFirestoreValue('Telegram Bot')
      }
    };
    await fetch(ledgerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ledgerEntry)
    });

    return { success: true, prevBalance, newBalance };
  } catch (err) {
    console.error('Error adding balance to Firestore:', err);
    return { success: false, prevBalance: 0, newBalance: 0 };
  }
}

// 3. Fetch All Calculations from Firestore
async function getFirestoreCalculations(): Promise<any[]> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents:runQuery?key=${API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'calculations' }]
        }
      })
    });
    if (!res.ok) return [];
    const results = await res.json();
    if (!Array.isArray(results)) return [];

    const calculations: any[] = [];
    for (const item of results) {
      if (item.document && item.document.fields) {
        const doc = parseFirestoreDoc(item.document);
        if (doc && !doc.isDeleted && doc.status !== 'deleted') {
          calculations.push(doc);
        }
      }
    }
    return calculations;
  } catch (err) {
    console.error('Error fetching calculations from Firestore:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Telegram Message Dispatcher
// ---------------------------------------------------------------------------

async function sendTelegramReply(chatId: string | number, text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown') {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok && parseMode === 'Markdown') {
      // Fallback without Markdown if parsing fails
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.replace(/[*_`\[\]]/g, '')
        })
      });
    }
    return data;
  } catch (err) {
    console.error('Failed to send Telegram reply:', err);
  }
}

// Parse "add balance 25k" or "জমা ২৫০০০" or "ব্যালেন্স জমা ২০০০০"
function parseAddBalanceCommand(text: string): number | null {
  const converted = convertBengaliDigitsToAscii(text);
  const normalized = converted.toLowerCase().replace(/,/g, '').trim();

  // Pattern 1: add balance 25k, balance add 25k, deposit 25k, জমা ২৫০০০
  const match1 = normalized.match(/(?:add\s*balance|balance\s*add|deposit|topup|টপআপ|জমা|ব্যালেন্স\s*জমা)\s*(\d+(?:\.\d+)?)\s*(k|হাজার)?/i);
  if (match1) {
    let num = parseFloat(match1[1]);
    if (isNaN(num)) return null;
    if (match1[2] === 'k' || match1[2] === 'হাজার') {
      num = num * 1000;
    }
    return Math.round(num);
  }

  // Pattern 2: 25k balance add, 25000 tk deposit
  const match2 = normalized.match(/(\d+(?:\.\d+)?)\s*(k|হাজার)?\s*(?:tk|টাকা)?\s*(?:add\s*balance|balance|জমা|টপআপ)/i);
  if (match2) {
    let num = parseFloat(match2[1]);
    if (isNaN(num)) return null;
    if (match2[2] === 'k' || match2[2] === 'হাজার') {
      num = num * 1000;
    }
    return Math.round(num);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Command Handler
// ---------------------------------------------------------------------------

export async function handleTelegramCommand(chatId: string | number, text: string, senderName: string = 'Admin') {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. /start
  if (lower === '/start' || lower === 'start') {
    const welcome = `👋 *স্বাগতম এ. এস এন্টারপ্রাইজ টেলিগ্রাম বটে!*

🆔 *আপনার চ্যাট আইডি:* \`${chatId}\`
✅ *সার্ভারলেস ওয়েবহুক কানেকশন:* সক্রিয় ও সংযুক্ত!

🔔 সফটওয়্যারে যেকোনো চালান বা খড়ির হিসাব সেভ হওয়ামাত্র আপনি তাৎক্ষণিক নোটিফিকেশন পাবেন।

📌 *আপনি সরাসরি এই বটে যেকোনো সময়ে নিচের কমান্ডগুলো পাঠাতে পারেন:*
• *today total weight* (বা "আজকের ওজন") ➡️ আজকের মোট ক্রয়কৃত ওজন ও বিল
• *balance* (বা "ব্যালেন্স") ➡️ বর্তমান ক্যাশ বাক্স ব্যালেন্স
• *add balance 25k* (বা "জমা ২৫০০০") ➡️ ক্যাশ বক্সে ব্যালেন্স জমা
• *last entry* (বা "শেষ চালান") ➡️ সর্বশেষ সংরক্ষিত মেমো
• *help* ➡️ সকল কমান্ডের তালিকা ও নির্দেশিকা`;
    await sendTelegramReply(chatId, welcome);
    return;
  }

  // 2. /help or help
  if (lower === '/help' || lower === 'help' || lower === 'সাহায্য' || lower === 'কমান্ড') {
    const helpMsg = `📖 *এ. এস এন্টারপ্রাইজ টেলিগ্রাম বট সহায়িকা:*

1️⃣ *আজকের মোট ওজন ও বিল দেখতে:*
   👉 লিখুন: \`today total weight\` বা \`আজকের ওজন\`

2️⃣ *ক্যাশ বাক্স ব্যালেন্স দেখতে:*
   👉 লিখুন: \`balance\` বা \`ব্যালেন্স\`

3️⃣ *ক্যাশ বক্সে ব্যালেন্স যোগ করতে:*
   👉 লিখুন: \`add balance 25k\` বা \`add balance 25000\` বা \`জমা ২৫০০০\`

4️⃣ *সর্বশেষ মেমোর হিসাব দেখতে:*
   👉 লিখুন: \`last entry\` বা \`শেষ চালান\`

5️⃣ *বটের তথ্য:*
   👉 ইউজারনেম: @SmEnterprise_bot
   👉 আপনার চ্যাট আইডি: \`${chatId}\``;
    await sendTelegramReply(chatId, helpMsg);
    return;
  }

  // 3. "today total weight" / "Total weight" / "আজকের ওজন"
  if (
    (lower.includes('today') && lower.includes('weight')) ||
    lower.includes('total weight') ||
    lower.includes('আজকের ওজন') ||
    lower.includes('আজকে কত কেজি') ||
    lower.includes('আজকের হিসাব') ||
    lower === '/today' ||
    lower === 'today'
  ) {
    const calculations = await getFirestoreCalculations();

    // Start of today in Asia/Dhaka time zone (UTC+6)
    const now = new Date();
    const dhakaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); // YYYY-MM-DD
    const [year, month, day] = dhakaDateStr.split('-').map(Number);
    const dhakaMidnightUtc = Date.UTC(year, month - 1, day, -6, 0, 0, 0);

    const todaysCalcs = calculations.filter(c => {
      const t = Number(c.timestamp || 0);
      return t >= dhakaMidnightUtc;
    });

    const totalKg = todaysCalcs.reduce((sum, c) => sum + (Number(c.totalKg) || 0), 0);
    const totalPrice = todaysCalcs.reduce((sum, c) => sum + (Number(c.totalPrice) || 0), 0);
    const memoCount = todaysCalcs.length;

    const mon40Count = Math.floor(totalKg / 40);
    const mon40Extra = Math.round((totalKg % 40) * 10) / 10;
    const monStr = mon40Count > 0
      ? (mon40Extra > 0 ? `${mon40Count} মণ ${mon40Extra} কেজি` : `${mon40Count} মণ`)
      : `${mon40Extra} কেজি`;

    const formattedDate = now.toLocaleDateString('bn-BD', {
      timeZone: 'Asia/Dhaka',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const formattedTime = now.toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });

    if (memoCount === 0) {
      const emptyMsg = `📊 *আজকের খড়ি ক্রয়ের রিপোর্ট*
📅 *তারিখ:* ${formattedDate}
⚖️ *মোট ওজন:* ০ কেজি (০ মণ)
📝 *মোট চালান:* ০ টি
💰 *মোট বিল:* ৳০

💡 _আজকে সফটওয়্যারে এখনো কোনো নতুন চালান সেভ করা হয়নি।_
_এ. এস এন্টারপ্রাইজ_`;
      await sendTelegramReply(chatId, emptyMsg);
      return;
    }

    const summaryMsg = `📊 *আজকের খড়ি ক্রয়ের মোট রিপোর্ট*
📅 *তারিখ:* ${formattedDate}
⚖️ *মোট ওজন:* ${totalKg.toLocaleString()} কেজি (${monStr})
📝 *মোট চালান/মেমো:* ${memoCount} টি
💰 *সর্বমোট ক্রয় বিল:* ৳${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
⏰ *সর্বশেষ আপডেট:* ${formattedTime}

_এ. এস এন্টারপ্রাইজ_`;
    await sendTelegramReply(chatId, summaryMsg);
    return;
  }

  // 4. "balance" / "ব্যালেন্স" / "ক্যাশ ব্যালেন্স"
  if (
    lower === 'balance' ||
    lower === 'cash balance' ||
    lower === '/balance' ||
    lower === 'ব্যালেন্স' ||
    lower === 'ক্যাশ ব্যালেন্স'
  ) {
    const balance = await getFirestoreCashboxBalance();
    const nowTimeStr = new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });

    const balMsg = `💵 *এ. এস এন্টারপ্রাইজ ক্যাশ বাক্স স্ট্যাটাস*

💰 *বর্তমান মোট ব্যালেন্স:* ৳${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
⏰ *সময়:* ${nowTimeStr}

💡 _ব্যালেন্স যোগ করতে লিখুন: \`add balance 25k\` বা \`জমা ২৫০০০\`_`;
    await sendTelegramReply(chatId, balMsg);
    return;
  }

  // 5. "add balance" / "জমা" (e.g. "add balance 25k")
  const parsedAmount = parseAddBalanceCommand(trimmed);
  if (parsedAmount && parsedAmount > 0) {
    const result = await addBalanceToFirestore(parsedAmount, senderName);

    if (result.success) {
      const responseMsg = `✅ *ক্যাশ ব্যালেন্স সফলভাবে জমা করা হয়েছে!*

💵 *জমার পরিমাণ:* ৳${parsedAmount.toLocaleString()}
🏦 *পূর্বের ব্যালেন্স:* ৳${result.prevBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
💰 *বর্তমান নতুন ব্যালেন্স:* ৳${result.newBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
👤 *প্রেরক:* ${senderName}
📝 *বিবরণ:* টেলিগ্রাম বট কমান্ড (add balance)

⚡ _সফটওয়্যার ড্যাশবোর্ড ও ক্যাশ লেজারে স্বয়ংক্রিয়ভাবে আপডেট সম্পন্ন হয়েছে।_`;
      await sendTelegramReply(chatId, responseMsg);
    } else {
      await sendTelegramReply(chatId, `❌ দুঃখিত, ফায়ারস্টোরে ব্যালেন্স আপডেট করতে সমস্যা হয়েছে। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।`);
    }
    return;
  }

  // 6. "last entry" / "শেষ চালান"
  if (
    lower === 'last entry' ||
    lower === 'last memo' ||
    lower === 'শেষ চালান' ||
    lower === 'শেষ হিসাব' ||
    lower === 'সর্বশেষ চালান' ||
    lower === '/last'
  ) {
    const calculations = await getFirestoreCalculations();
    if (calculations.length === 0) {
      await sendTelegramReply(chatId, 'ℹ️ সফটওয়্যারে এখনো কোনো সংরক্ষিত মেমোর তথ্য পাওয়া যায়নি।');
      return;
    }

    // Sort descending by timestamp or challanNo
    calculations.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
    const last = calculations[0];

    const totalKgNum = Number(last.totalKg) || 0;
    const monCount = Math.floor(totalKgNum / 40);
    const extraKg = Math.round((totalKgNum % 40) * 10) / 10;
    const monStr = monCount > 0
      ? (extraKg > 0 ? `${monCount} মণ ${extraKg} কেজি` : `${monCount} মণ`)
      : `${extraKg} কেজি`;

    const dateStr = new Date(Number(last.timestamp) || Date.now()).toLocaleString('bn-BD', {
      timeZone: 'Asia/Dhaka',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const billStr = Number(last.totalPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const lastMsg = `🧾 *সর্বশেষ সংরক্ষিত মেমোর হিসাব*

👤 *বিক্রেতা:* ${last.sellerName || 'N/A'}
📝 *চালান নং:* #${last.challanNo}
⚖️ *মোট ওজন:* ${totalKgNum.toLocaleString()} কেজি (${monStr})
💰 *মোট বিল:* ৳${billStr}
👨‍💼 *অপারেটর:* ${last.createdByName || 'Admin'}
📅 *তারিখ ও সময়:* ${dateStr}

_এ. এস এন্টারপ্রাইজ_`;
    await sendTelegramReply(chatId, lastMsg);
    return;
  }

  // 7. Unknown command fallback
  const defaultReply = `🤖 *এ. এস এন্টারপ্রাইজ টেলিগ্রাম বট*

আপনার কমান্ডটি বুঝতে পারিনি: "_${trimmed}_"

📌 *সরাসরি কার্যকর কমান্ডসমূহ:*
• \`today total weight\` ➡️ আজকের মোট ক্রয়কৃত ওজন ও বিল
• \`balance\` ➡️ বর্তমান ক্যাশ বাক্স ব্যালেন্স
• \`add balance 25k\` ➡️ ক্যাশ বক্সে ২৫,০০০ টাকা জমা
• \`last entry\` ➡️ সর্বশেষ মেমোর হিসাব
• \`help\` ➡️ কমান্ড সহায়তা`;
  await sendTelegramReply(chatId, defaultReply);
}

// ---------------------------------------------------------------------------
// Vercel Serverless Function Handler
// ---------------------------------------------------------------------------

export default async function handler(req: any, res: any) {
  // Support GET request for health check & webhook registration info
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      service: 'Telegram Webhook Serverless Handler',
      timestamp: new Date().toISOString(),
      bot: '@SmEnterprise_bot',
      instructions: `To register this webhook with Telegram, make a GET request to: https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=<YOUR_DOMAIN>/api/webhook`
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Quick 200 OK acknowledgment to prevent Telegram webhook timeout / retries
  try {
    const body = req.body || {};
    
    // Telegram sends message under body.message or body.channel_post or body.edited_message
    const message = body.message || body.channel_post || body.edited_message;

    if (!message) {
      // Return 200 OK even for non-message updates (e.g. inline query, poll) so Telegram acknowledges
      return res.status(200).json({ ok: true, note: 'No text message update to process' });
    }

    const text = message.text;
    const chatId = message.chat?.id || DEFAULT_CHAT_ID;
    const senderName = message.from?.first_name 
      ? `${message.from.first_name}${message.from.last_name ? ' ' + message.from.last_name : ''}`
      : (message.from?.username || 'Admin');

    if (!text || typeof text !== 'string') {
      return res.status(200).json({ ok: true, note: 'Message contains no text' });
    }

    // Process the command asynchronously & reply
    await handleTelegramCommand(chatId, text, senderName);

    return res.status(200).json({
      ok: true,
      handledCommand: text,
      chatId
    });
  } catch (err: any) {
    console.error('Error processing Telegram webhook request:', err);
    // Still return 200 OK to Telegram so it doesn't repeatedly retry failing payloads
    return res.status(200).json({
      ok: false,
      error: err?.message || 'Internal processing error'
    });
  }
}

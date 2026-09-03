export default async function handler(req: any, res: any) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Only POST requests are supported.'
    });
  }

  // Read Bot Token and Chat ID from environment variables (with default fallback for quick preview)
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '8923534295:AAH8GVwzQK4TN-6LgPxopjMBNUuAxmLVpKE';
  const defaultChatId = process.env.TELEGRAM_CHAT_ID || '1158719251';

  if (!botToken) {
    return res.status(500).json({
      success: false,
      error: 'Missing TELEGRAM_BOT_TOKEN environment variable.'
    });
  }

  try {
    const { text, parse_mode = 'Markdown', chat_id } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "text" must be a non-empty string.'
      });
    }

    const recipientChatId = chat_id || defaultChatId;
    if (!recipientChatId) {
      return res.status(400).json({
        success: false,
        error: 'Missing recipient chat ID. Please set TELEGRAM_CHAT_ID or provide chat_id in request body.'
      });
    }

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const telegramRes = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: recipientChatId,
        text,
        parse_mode
      })
    });

    const data = await telegramRes.json().catch(() => ({}));

    if (!telegramRes.ok) {
      // If Markdown formatting failed due to special characters, fallback to plain text
      if (telegramRes.status === 400 && data?.description && data.description.includes("can't parse entities")) {
        const fallbackRes = await fetch(telegramApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: recipientChatId,
            text: text.replace(/[*_`\[\]]/g, '')
          })
        });
        const fallbackData = await fallbackRes.json().catch(() => ({}));
        if (fallbackRes.ok) {
          return res.status(200).json({
            success: true,
            message: 'Telegram notification delivered successfully (plain text fallback)',
            result: fallbackData.result
          });
        }
      }

      let errorMsg = data?.description || `Telegram API error (${telegramRes.status})`;
      if (errorMsg.toLowerCase().includes('chat not found')) {
        errorMsg = "Chat not found: Please open @SmEnterprise_bot in Telegram and tap 'Start' to allow notifications.";
      } else if (errorMsg.toLowerCase().includes('bot was blocked')) {
        errorMsg = "Bot was blocked: Please unblock @SmEnterprise_bot in Telegram to receive notifications.";
      }

      return res.status(telegramRes.status >= 400 && telegramRes.status < 600 ? telegramRes.status : 500).json({
        success: false,
        error: errorMsg,
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Telegram notification delivered successfully',
      result: data.result
    });
  } catch (err: any) {
    console.error('Error in /api/telegram handler:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal Server Error while forwarding to Telegram'
    });
  }
}

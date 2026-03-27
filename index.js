const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeDigit = require('qrcode'); // New package for web display
const http = require('http');

let latestQrData = null; // Store QR here to show on webpage
const activeTimers = new Set();
let isBotReady = false; 

// --- 1. IMPROVED WEB SERVER ---
const port = process.env.PORT || 3000;
http.createServer(async (req, res) => {
    // If bot is ready, show a success message
    if (isBotReady) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>✅ Office Bot is LIVE</h1><p>The bot is running and listening for messages.</p>');
        return;
    }

    // If we have a QR code, show it as an image
    if (latestQrData) {
        try {
            const qrImage = await qrcodeDigit.toDataURL(latestQrData);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <div style="text-align:center; font-family:sans-serif; padding-top:50px;">
                    <h1>Scan this QR Code</h1>
                    <p>Open WhatsApp > Linked Devices > Link a Device</p>
                    <img src="${qrImage}" style="border: 20px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.1);" />
                    <p>Wait 15s after scanning for the bot to start.</p>
                    <script>setTimeout(() => location.reload(), 30000);</script>
                </div>
            `);
        } catch (err) {
            res.writeHead(500);
            res.end('Error generating QR image');
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot is starting or authenticating... Refresh in 10 seconds.');
    }
}).listen(port, '0.0.0.0', () => {
    console.log(`Web server listening on port ${port}`);
});

// --- 2. CLIENT CONFIGURATION ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--single-process'
        ]
    }
});

const officeLinks = [
    "📦 The Best of Dwight Schrute: https://www.youtube.com/watch?v=XnQG6Vj0y2o",
    "☕ Best of Michael Scott: https://www.youtube.com/watch?v=gO8N3L_aERg",
    "🏢 The Office - Top Pranks: https://www.youtube.com/watch?v=dYBS6QWio3k"
];

client.on('qr', qr => {
    latestQrData = qr; // Save for the web server
    qrcodeTerminal.generate(qr, { small: true }); // Still show in logs
    console.log('--- QR CODE GENERATED: Refresh your Render URL to scan ---');
});

client.on('ready', () => {
    latestQrData = null; // Clear QR data
    console.log('✅ Bot authenticated. Waiting 15s for sync to settle...');
    setTimeout(() => {
        isBotReady = true;
        console.log('🚀 LIVE: Listening for NEW messages now!');
    }, 15000); 
});

client.on('message', async (msg) => {
    try {
        if (!isBotReady) return;

        const chat = await msg.getChat();
        const text = msg.body ? msg.body.toLowerCase().trim() : "";

        if (text === 'office' && !chat.isGroup) {
            await msg.reply("Excellent choice. 'Identity theft is not a joke, Jim!' 👓\n\n" + officeLinks.join('\n\n'));
            return; 
        }

        if (msg.fromMe || chat.isGroup || activeTimers.has(msg.from)) return;

        activeTimers.add(msg.from);
        console.log(`[TIMER START] for ${chat.name || msg.from}`);

        setTimeout(async () => {
            try {
                const freshChat = await msg.getChat();
                const messages = await freshChat.fetchMessages({ limit: 1 });
                if (messages[0] && !messages[0].fromMe) {
                    await msg.reply("Please wait, the user will reply. Until then, go for a walk! 🚶‍♂️\n\nOr reply 'office' for highlights!");
                }
            } catch (err) {
                console.error("Timer error:", err);
            } finally {
                activeTimers.delete(msg.from);
            }
        }, 300000); // 5 Minutes

    } catch (e) {
        console.error("General error:", e);
    }
});

client.initialize().catch(err => console.error("Init error:", err));
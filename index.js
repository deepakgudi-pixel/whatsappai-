const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeDigit = require('qrcode');
const http = require('http');

let latestQrData = null;
let isBotReady = false; 
const activeTimers = new Set();

// --- 1. UPDATED WEB SERVER FOR HUGGING FACE (Port 7860) ---
const port = process.env.PORT || 7860; 

http.createServer(async (req, res) => {
    // Standard health check for Hugging Face
    if (isBotReady) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>✅ Office Bot is LIVE</h1><p>Running on 16GB RAM. Listening for messages...</p>');
        return;
    }

    if (latestQrData) {
        try {
            const qrImage = await qrcodeDigit.toDataURL(latestQrData);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <div style="text-align:center; font-family:sans-serif; padding-top:50px;">
                    <h1>Scan to Link WhatsApp</h1>
                    <img src="${qrImage}" style="border: 20px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.1);" />
                    <p>The status will update automatically once linked.</p>
                </div>
            `);
        } catch (err) {
            res.writeHead(500);
            res.end('Error generating QR');
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot starting... Please wait 30 seconds.');
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
            '--no-zygote'
        ]
    }
});

const officeLinks = [
    "📦 The Best of Dwight Schrute: https://www.youtube.com/watch?v=XnQG6Vj0y2o",
    "☕ Best of Michael Scott: https://www.youtube.com/watch?v=gO8N3L_aERg",
    "🏢 The Office - Top Pranks: https://www.youtube.com/watch?v=dYBS6QWio3k"
];

client.on('qr', qr => {
    latestQrData = qr;
    qrcodeTerminal.generate(qr, { small: true });
    console.log('--- QR CODE READY: Refresh the App tab to scan ---');
});

client.on('ready', () => {
    latestQrData = null;
    console.log('✅ Bot authenticated. Syncing...');
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

        // Keyword: Office
        if (text === 'office' && !chat.isGroup) {
            await msg.reply("Excellent choice. 'Identity theft is not a joke, Jim!' 👓\n\n" + officeLinks.join('\n\n'));
            return; 
        }

        // Filters
        if (msg.fromMe || chat.isGroup || activeTimers.has(msg.from)) return;

        // 5-Minute Timer Logic
        activeTimers.add(msg.from);
        console.log(`[TIMER START] for ${chat.name || msg.from}`);

        setTimeout(async () => {
            try {
                const freshChat = await msg.getChat();
                const messages = await freshChat.fetchMessages({ limit: 1 });
                if (messages[0] && !messages[0].fromMe) {
                    await msg.reply("Please wait, the user will reply. Until then, go for a walk! 🚶‍♂️\n\nOr reply 'office' for highlights!");
                    console.log(`[REPLY SENT] to ${chat.name || msg.from}`);
                }
            } catch (err) {
                console.error("Timer error:", err);
            } finally {
                activeTimers.delete(msg.from);
            }
        }, 300000); 

    } catch (e) {
        console.error("General error:", e);
    }
});

client.initialize().catch(err => console.error("Init error:", err));
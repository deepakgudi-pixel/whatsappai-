const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http');

// --- 1. RENDER HEALTH CHECK SERVER ---
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Office Bot is Online and Healthy!'); // Fixed the "Not Found" error
}).listen(port, '0.0.0.0', () => {
    console.log(`Web server listening on port ${port}`);
});

const activeTimers = new Set();
let isBotReady = false; 

// --- 2. UPDATED CLIENT FOR RENDER + POSTINSTALL ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        // We REMOVED executablePath so it finds the 'postinstall' Chrome automatically
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
    qrcode.generate(qr, { small: true });
    console.log('--- SCAN THE QR CODE ABOVE ---');
});

client.on('ready', () => {
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
            const response = "Excellent choice. 'Identity theft is not a joke, Jim!' 👓\n\n" + officeLinks.join('\n\n');
            await msg.reply(response);
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
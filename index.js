const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http');

// --- 1. RENDER HEALTH CHECK SERVER ---
// This keeps the Render port active and prevents the "Port 3000 not found" error.
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Office Bot is Active');
    res.end();
}).listen(port, () => {
    console.log(`Web server listening on port ${port}`);
});

const activeTimers = new Set();
let isBotReady = false; // Prevents the bot from responding to old messages on startup

// --- 2. OPTIMIZED WHATSAPP CLIENT FOR RENDER ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
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

// --- 3. STARTUP LOGIC ---
client.on('ready', () => {
    console.log('✅ Bot authenticated. Waiting 15s for sync to settle...');
    // We wait 15 seconds to ignore "ghost" messages from the sync process.
    setTimeout(() => {
        isBotReady = true;
        console.log('🚀 LIVE: Listening for NEW messages now!');
    }, 15000); 
});

client.on('message', async (msg) => {
    try {
        // Guard 1: Ignore everything until the 15s settle period is over
        if (!isBotReady) return;

        const chat = await msg.getChat();
        const text = msg.body ? msg.body.toLowerCase().trim() : "";

        // Guard 2: Instant "Office" Keyword
        if (text === 'office' && !chat.isGroup) {
            const response = "Excellent choice. 'Identity theft is not a joke, Jim!' 👓\n\nHere are some top Dunder Mifflin moments for your wait:\n\n" + officeLinks.join('\n\n');
            await msg.reply(response);
            console.log(`[INSTANT] Office clips sent to ${chat.name || msg.from}`);
            return; 
        }

        // Guard 3: Filters (No Groups, No "Me", No double timers)
        if (msg.fromMe || chat.isGroup || activeTimers.has(msg.from)) return;

        // --- THE 5-MINUTE TIMER LOGIC ---
        activeTimers.add(msg.from);
        const startTime = new Date().toLocaleTimeString();
        console.log(`[TIMER START] ${startTime} for ${chat.name || msg.from}`);

        // 300,000 ms = Exactly 5 Minutes
        setTimeout(async () => {
            try {
                const freshChat = await msg.getChat();
                const messages = await freshChat.fetchMessages({ limit: 1 });
                const lastMessage = messages[0];
                
                const checkTime = new Date().toLocaleTimeString();
                console.log(`[TIMER CHECK] ${checkTime} for ${chat.name || msg.from}`);

                // Only reply if the last message in the chat is still from THEM
                if (lastMessage && !lastMessage.fromMe) {
                    const walkMessage = 
                        "Please wait, the user will reply. Until then, go for a walk! 🚶‍♂️\n\n" +
                        "Or, if you'd rather stay inside, reply with 'office' to watch some Dunder Mifflin highlights!";
                    
                    await msg.reply(walkMessage);
                    console.log(`[REPLY SENT] Auto-response sent to ${chat.name || msg.from}`);
                } else {
                    console.log(`[CANCELLED] User already replied to ${chat.name || msg.from}`);
                }
            } catch (err) {
                console.error("Internal timer error:", err);
            } finally {
                activeTimers.delete(msg.from);
            }
        }, 300000); 

    } catch (e) {
        console.error("General message error:", e);
    }
});

client.initialize().catch(err => console.error("Init error:", err));
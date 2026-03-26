const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http');

// --- 1. RENDER HEALTH CHECK SERVER ---
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Office Bot is Active');
    res.end();
}).listen(port, () => {
    console.log(`Web server listening on port ${port}`);
});

const activeTimers = new Set();
// Initialize bootTime to a very high number so nothing processes until 'ready'
let bootTime = 2147483647; 

// --- 2. OPTIMIZED WHATSAPP CLIENT ---
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

// --- CRITICAL: Set bootTime ONLY when fully ready ---
client.on('ready', () => {
    bootTime = Math.floor(Date.now() / 1000);
    console.log('✅ The Office Auto-Responder is online and listening for NEW messages!');
});

client.on('message', async (msg) => {
    try {
        // --- THE FIX: Ignore any message sent before the bot was ready ---
        if (msg.timestamp < bootTime) {
            return; 
        }

        const chat = await msg.getChat();
        const text = msg.body ? msg.body.toLowerCase().trim() : "";

        // Part 1: Instant "Office" trigger
        if (text === 'office' && !chat.isGroup) {
            const response = "Excellent choice. 'Identity theft is not a joke, Jim!' 👓\n\nHere are some top Dunder Mifflin moments for your wait:\n\n" + officeLinks.join('\n\n');
            await msg.reply(response);
            return; 
        }

        // Part 2: The 5-Minute Logic
        if (msg.fromMe || chat.isGroup || activeTimers.has(msg.from)) return;

        activeTimers.add(msg.from);
        console.log(`Timer started for: ${chat.name || msg.from}`);

        setTimeout(async () => {
            try {
                const freshChat = await msg.getChat();
                const messages = await freshChat.fetchMessages({ limit: 1 });
                const lastMessage = messages[0];

                // Only send if the last message in the chat is still from them (they haven't been replied to)
                if (lastMessage && !lastMessage.fromMe) {
                    const walkMessage = 
                        "Please wait, the user will reply. Until then, go for a walk! 🚶‍♂️\n\n" +
                        "Or, if you'd rather stay inside, reply with 'office' to watch some Dunder Mifflin highlights!";
                    
                    await msg.reply(walkMessage);
                    console.log(`Timer triggered successfully for: ${chat.name || msg.from}`);
                }
            } catch (err) {
                console.error("Timer error:", err);
            } finally {
                activeTimers.delete(msg.from);
            }
        }, 300000); // 5 Minutes

    } catch (e) {
        console.error("Message handling error:", e);
    }
});

client.initialize().catch(err => console.error("Init error:", err));
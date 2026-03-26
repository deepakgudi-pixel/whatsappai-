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
let bootTime = Math.floor(Date.now() / 1000); // Capture start time in seconds

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

client.on('ready', () => {
    console.log('✅ The Office Auto-Responder is online!');
    // Update bootTime to exactly when the client is ready
    bootTime = Math.floor(Date.now() / 1000);
});

client.on('message', async (msg) => {
    try {
        // --- FIX: TIMESTAMP GUARD ---
        // If the message was sent before the bot was ready, ignore it.
        if (msg.timestamp < bootTime) return;

        const chat = await msg.getChat();
        const text = msg.body ? msg.body.toLowerCase().trim() : "";

        // --- PART 1: The "Office" Keyword Listener ---
        if (text === 'office' && !chat.isGroup) {
            const response = "Excellent choice. 'Identity theft is not a joke, Jim!' 👓\n\nHere are some top Dunder Mifflin moments for your wait:\n\n" + officeLinks.join('\n\n');
            await msg.reply(response);
            console.log(`Sent Office clips to ${chat.name || msg.from}`);
            return; 
        }

        // --- PART 2: The Logic ---
        if (msg.fromMe || chat.isGroup || activeTimers.has(msg.from)) return;

        activeTimers.add(msg.from);
        console.log(`Timer started for: ${chat.name || msg.from}`);

        // 300,000ms = 5 minutes
        setTimeout(async () => {
            try {
                const freshChat = await msg.getChat();
                const messages = await freshChat.fetchMessages({ limit: 1 });
                const lastMessage = messages[0];

                // Double check it's still their message at the top
                if (lastMessage && !lastMessage.fromMe) {
                    const walkMessage = 
                        "Please wait, the user will reply. Until then, go for a walk! 🚶‍♂️\n\n" +
                        "Or, if you'd rather stay inside, reply with 'office' to watch some Dunder Mifflin highlights!";
                    
                    await msg.reply(walkMessage);
                    console.log(`Sent "Walk + Office" offer to: ${chat.name || msg.from}`);
                }
            } catch (err) {
                console.error("Timeout logic error:", err);
            } finally {
                activeTimers.delete(msg.from);
            }
        }, 300000); 

    } catch (e) {
        console.error("Message handling error:", e);
    }
});

client.initialize().catch(err => {
    console.error("Failed to initialize client:", err);
});
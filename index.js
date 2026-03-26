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

client.on('ready', () => {
    bootTime = Math.floor(Date.now() / 1000);
    console.log(`✅ Bot ready. bootTime set to ${bootTime} (${new Date().toISOString()})`);
});

client.on('message', async (msg) => {
    try {
        console.log(`\n[MSG RECEIVED] from:${msg.from} | fromMe:${msg.fromMe} | timestamp:${msg.timestamp} | bootTime:${bootTime} | body:"${msg.body?.slice(0, 60)}"`);

        // Ignore messages before boot
        if (msg.timestamp < bootTime) {
            console.log(`[IGNORED] Message is older than boot time, skipping.`);
            return;
        }

        const chat = await msg.getChat();
        const text = msg.body ? msg.body.toLowerCase().trim() : "";

        console.log(`[CHAT INFO] name:"${chat.name}" | isGroup:${chat.isGroup} | activeTimers has sender:${activeTimers.has(msg.from)}`);

        // Part 1: Instant "Office" trigger
        if (text === 'office' && !chat.isGroup) {
            console.log(`[OFFICE TRIGGER] Sending office links to ${chat.name || msg.from}`);
            const response =
                "Excellent choice. 'Identity theft is not a joke, Jim!' 👓\n\n" +
                "Here are some top Dunder Mifflin moments for your wait:\n\n" +
                officeLinks.join('\n\n');
            await msg.reply(response);
            return;
        }

        // Part 2: The 5-Minute Logic
        if (msg.fromMe) {
            console.log(`[IGNORED] Message is from me.`);
            return;
        }
        if (chat.isGroup) {
            console.log(`[IGNORED] Message is from a group.`);
            return;
        }
        if (activeTimers.has(msg.from)) {
            console.log(`[IGNORED] Timer already active for ${msg.from}.`);
            return;
        }

        activeTimers.add(msg.from);
        console.log(`[TIMER START] ${chat.name || msg.from} at ${new Date().toISOString()} | activeTimers size: ${activeTimers.size}`);

        const timerStart = Date.now();

        setTimeout(async () => {
            const elapsed = Date.now() - timerStart;
            console.log(`\n[TIMER FIRED] ${chat.name || msg.from} — elapsed: ${Math.round(elapsed / 1000)}s at ${new Date().toISOString()}`);

            try {
                const freshChat = await msg.getChat();
                const messages = await freshChat.fetchMessages({ limit: 10 });

                console.log(`[MESSAGES] fetched ${messages.length} messages for ${chat.name || msg.from}:`);
                messages.forEach((m, i) => {
                    console.log(`  [${i}] fromMe:${m.fromMe} | timestamp:${m.timestamp} | body:"${m.body?.slice(0, 40)}"`);
                });

                const lastMessage = messages[messages.length - 1];
                console.log(`[LAST MSG CHECK] fromMe:${lastMessage?.fromMe} | body:"${lastMessage?.body?.slice(0, 40)}"`);

                if (lastMessage && !lastMessage.fromMe) {
                    console.log(`[SENDING] Auto-reply triggered for ${chat.name || msg.from}`);
                    const walkMessage =
                        "Please wait, the user will reply. Until then, go for a walk! 🚶‍♂️\n\n" +
                        "Or, if you'd rather stay inside, reply with 'office' to watch some Dunder Mifflin highlights!";
                    await msg.reply(walkMessage);
                    console.log(`[SENT] Auto-reply delivered to ${chat.name || msg.from}`);
                } else {
                    console.log(`[SKIPPED] Last message was from me — no auto-reply sent.`);
                }
            } catch (err) {
                console.error("[TIMER ERROR]", err);
            } finally {
                activeTimers.delete(msg.from);
                console.log(`[TIMER CLEARED] ${chat.name || msg.from} removed from activeTimers | size now: ${activeTimers.size}`);
            }
        }, 300000); // 5 minutes

    } catch (e) {
        console.error("[MESSAGE HANDLER ERROR]", e);
    }
});

client.initialize().catch(err => console.error("Init error:", err));
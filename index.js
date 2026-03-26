const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http'); // Required for Render health checks

// 1. KEEP RENDER AWAKE: Create a dummy server
// Render expects a web service to listen on a port.
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Office Bot is Running...');
    res.end();
}).listen(port, () => {
    console.log(`Web server listening on port ${port}`);
});

const activeTimers = new Set();

// 2. OPTIMIZED PUPPETEER: Crucial for low-RAM (512MB) hosting
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--single-process', // Reduces memory usage significantly
            '--disable-gpu'
        ]
    }
});

const officeLinks = [
    "📦 The Best of Dwight Schrute: https://www.youtube.com/watch?v=XnQG6Vj0y2o",
    "☕ Best of Michael Scott: https://www.youtube.com/watch?v=gO8N3L_aERg",
    "🏢 The Office - Top Pranks: https://www.youtube.com/watch?v=dYBS6QWio3k"
];

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('✅ The Office Auto-Responder is online!'));

client.on('message', async (msg) => {
    try {
        const chat = await msg.getChat();
        const text = msg.body ? msg.body.toLowerCase().trim() : "";

        // --- PART 1: The "Office" Keyword Listener ---
        if (text === 'office' && !chat.isGroup) {
            const response = "Excellent choice. 'Identity theft is not a joke, Jim!' 👓\n\nHere are some top Dunder Mifflin moments for your wait:\n\n" + officeLinks.join('\n\n');
            await msg.reply(response);
            console.log(`Sent Office clips to ${chat.name || msg.from}`);
            return; 
        }

        // --- PART 2: The 30-Minute Logic ---
        // Filters: No Groups, No "Me", No double timers
        if (msg.fromMe || chat.isGroup || activeTimers.has(msg.from)) return;

        activeTimers.add(msg.from);
        console.log(`Timer started for: ${chat.name || msg.from}`);

        setTimeout(async () => {
            try {
                const freshChat = await msg.getChat();
                const messages = await freshChat.fetchMessages({ limit: 1 });
                const lastMessage = messages[0];

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
        }, 30000); // Set to 30 minutes (1,800,000 ms) for production

    } catch (e) {
        console.error("Message handling error:", e);
    }
});

client.initialize();
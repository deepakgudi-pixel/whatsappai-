const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeDigit = require('qrcode');
const http = require('http');
const Groq = require('groq-sdk');

// --- 1. AI CONFIGURATION ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SYSTEM_PROMPT = "You are Deepak's personal AI assistant. Deepak is a Jedi master. He likes techno, sci-fi, and listening to doomgaze artists like Shedfromthebody while coding. Answer concisely and wittily. If someone asks where he is, say he is away but you can help.";

let latestQrData = null;
let isBotReady = false;
const mutedUsers = new Map(); // Tracks 24h timer lockouts

// --- 2. WEB SERVER FOR HUGGING FACE (Port 7860) ---
const port = process.env.PORT || 7860; 
http.createServer(async (req, res) => {
    if (isBotReady) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>✅ Deepak\'s AI Assistant is LIVE</h1><p>The Jedi brain is active and listening.</p>');
        return;
    }
    if (latestQrData) {
        try {
            const qrImage = await qrcodeDigit.toDataURL(latestQrData);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<div style="text-align:center;padding-top:50px;"><h1>Scan to Link AI</h1><img src="${qrImage}" style="border:20px solid white;" /></div>`);
        } catch (err) { res.writeHead(500); res.end('Error'); }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('System starting... please wait.');
    }
}).listen(port, '0.0.0.0');

// --- 3. WHATSAPP CLIENT ---

// 💥 THE FIX: Using the environment variable provided natively by the Puppeteer Docker Image
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "groq-bot" }), // Forces a fresh session
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, // Automatically set by Docker
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', qr => { 
    latestQrData = qr; 
    console.log('🔄 New QR Code Generated! Check the web endpoint to scan.');
});

client.on('ready', () => { 
    isBotReady = true; 
    latestQrData = null;
    console.log('🚀 AI Assistant Ready! (Jedi Master Edition)'); 
});

// 🛡️ DISCONNECT CATCHER
client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp Disconnected:', reason);
    isBotReady = false;
    client.destroy().then(() => {
        console.log('🔄 Rebooting server...');
        process.exit(0); // Forces Hugging Face to restart the app
    });
});

client.on('message', async (msg) => {
    try {
        const chat = await msg.getChat();
        const contactId = msg.from;

        // Ignore Status updates, Groups, Yourself, or Empty texts
        if (msg.from === 'status@broadcast' || chat.isGroup || msg.fromMe || !isBotReady) return;
        if (!msg.body || msg.body.trim() === "") return;

        const text = msg.body.toLowerCase().trim();
        const now = Date.now();

        // 24-Hour Lockout Check
        if (mutedUsers.has(contactId)) {
            if (now < mutedUsers.get(contactId)) return; 
            else mutedUsers.delete(contactId);
        }

        // --- COMMAND: EXIT ---
        if (text === 'exit' || text === 'stop') {
            mutedUsers.set(contactId, now + 24 * 60 * 60 * 1000);
            await msg.reply("Understood. I'll stay quiet for 24 hours. The Jedi Master will reply personally when he can. (Type 'start' to wake me up early!)");
            return;
        }

        // --- COMMAND: START ---
        if (text === 'start') {
            mutedUsers.delete(contactId);
            await msg.reply("I'm back! I am Deepak's AI Assistant. How can I help you?");
            return;
        }

        // --- AI RESPONSE LOGIC ---
        await chat.sendSeen(); // Shows Blue Ticks

        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: msg.body }
                ],
                model: "llama-3.1-8b-instant", 
                temperature: 0.7,
                max_tokens: 150
            });

            let aiText = chatCompletion.choices[0]?.message?.content || "_(System hiccup, try again!)_";
            await msg.reply(aiText + "\n\n_(Type 'exit' to mute me for 24h)_");

        } catch (aiError) {
            console.error("[GROQ ERROR]:", aiError.message);
            await msg.reply("_(System: My AI brain is taking a quick breather. Give me 60 seconds!)_");
        }

    } catch (e) {
        console.error("General error:", e);
    }
});

// 🛡️ HUMAN INTERVENTION KILL-SWITCH
client.on('message_create', async (msg) => {
    if (msg.fromMe && !msg.body.includes("Type 'exit' to mute me") && !msg.body.includes("System: My AI brain")) {
        const contactId = msg.to;
        mutedUsers.set(contactId, Date.now() + 24 * 60 * 60 * 1000);
        console.log(`[HUMAN TAKEOVER] You texted ${contactId}. AI locked for 24 hours.`);
    }
});

client.initialize().catch(err => console.error("Init error:", err));
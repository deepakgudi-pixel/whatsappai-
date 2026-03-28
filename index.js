const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeDigit = require('qrcode');
const http = require('http');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- 1. AI CONFIGURATION ---
// We use process.env so your key stays hidden in Hugging Face Settings
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-pro",
    systemInstruction: "You are Deepak's personal AI assistant. Deepak likes techno and sci-fi. Answer concisely and wittily. If someone asks where he is, say he is away but you can help. Always remind them they can type 'exit' to stop the AI."
});

let latestQrData = null;
let isBotReady = false;
const mutedUsers = new Set(); // Tracks people who typed 'exit'

// --- 2. WEB SERVER FOR HUGGING FACE (Port 7860) ---
const port = process.env.PORT || 7860; 
http.createServer(async (req, res) => {
    if (isBotReady) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>✅ Deepak\'s AI Assistant is LIVE</h1><p>The brain is active and listening.</p>');
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
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote']
    }
});

const officeLinks = [
    "📦 The Best of Dwight Schrute: https://www.youtube.com/watch?v=XnQG6Vj0y2o",
    "☕ Best of Michael Scott: https://www.youtube.com/watch?v=gO8N3L_aERg",
    "🏢 The Office - Top Pranks: https://www.youtube.com/watch?v=dYBS6QWio3k"
];

client.on('qr', qr => { latestQrData = qr; });
client.on('ready', () => { 
    isBotReady = true; 
    latestQrData = null;
    console.log('🚀 AI Assistant Ready!'); 
});

client.on('message', async (msg) => {
    try {
        const chat = await msg.getChat();
        if (msg.fromMe || chat.isGroup || !isBotReady) return;

        const text = msg.body ? msg.body.toLowerCase().trim() : "";

        // --- COMMAND: OFFICE ---
        if (text === 'office') {
            await msg.reply("Identity theft is not a joke, Jim! 👓\n\n" + officeLinks.join('\n\n'));
            return;
        }

        // --- COMMAND: EXIT ---
        if (text === 'exit' || text === 'stop') {
            mutedUsers.add(msg.from);
            await msg.reply("Understood. I'll stay quiet now. Deepak will reply personally when he can. (Type 'start' to talk to me again!)");
            return;
        }

        // --- COMMAND: START ---
        if (text === 'start') {
            mutedUsers.delete(msg.from);
            await msg.reply("I'm back! I am Deepak's AI Assistant. How can I help you?");
            return;
        }

        // --- AI RESPONSE LOGIC ---
        if (!mutedUsers.has(msg.from)) {
            // Trigger the Gemini Brain
            const result = await model.generateContent(msg.body);
            const response = await result.response;
            let aiText = response.text();
            
            // Append the "Exit" tip to the first AI reply
            await msg.reply(aiText + "\n\n_(Type 'exit' to end this AI chat)_");
        }

    } catch (e) {
        console.error("General error:", e);
    }
});

client.initialize().catch(err => console.error("Init error:", err));

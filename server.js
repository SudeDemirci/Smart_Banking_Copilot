require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { GoogleGenAI } = require('@google/genai');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 15,
    message: { error: "Çok fazla istek gönderdiniz. Lütfen 1 dakika bekleyip tekrar deneyin." },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/chat', apiLimiter);

// ── Admin API Güvenliği ──
app.use('/api/analytics', (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Basic ')) {
        return res.status(401).json({ error: "Yetkisiz Erişim" });
    }
    const b64auth = authHeader.split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    
    if (login === 'admin' && password === 'bankbot123') {
        return next();
    }
    return res.status(401).json({ error: "Hatalı Kullanıcı Adı veya Şifre" });
});

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Initialize SQLite DB
const db = new sqlite3.Database('./data/database.sqlite', (err) => {
    if (err) console.error("Database connection error:", err);
    else console.log("Connected to SQLite DB");
});

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, user_message TEXT, bot_response TEXT, feedback TEXT DEFAULT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

const knowledgePath = path.join(__dirname, 'data', 'banka_bilgileri.txt');
let knowledgeDocs = [];

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbedding(text) {
    try {
        const response = await ai.models.embedContent({
            model: 'gemini-embedding-2',
            contents: text
        });
        return response.embeddings[0].values;
    } catch (err) {
        console.error("Embedding API Error:", err);
        return null;
    }
}

async function loadKnowledge() {
    try {
        const text = fs.readFileSync(knowledgePath, 'utf-8');
        const rawChunks = text.split(/================================================================/g);
        const chunks = rawChunks.map(c => c.trim()).filter(c => c.length > 20);
        
        const cachePath = './data/embeddings.json';
        if (fs.existsSync(cachePath)) {
            const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
            if (cachedData.length === chunks.length) {
                console.log(`Loaded ${cachedData.length} embedded chunks from cache.`);
                knowledgeDocs.push(...cachedData);
                return;
            }
        }

        console.log(`Starting to embed ${chunks.length} knowledge chunks for RAG...`);
        for (let chunk of chunks) {
            const vector = await getEmbedding(chunk);
            if (vector) {
                knowledgeDocs.push({ text: chunk, embedding: vector });
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        fs.writeFileSync(cachePath, JSON.stringify(knowledgeDocs, null, 2));
        console.log(`Successfully embedded and cached ${knowledgeDocs.length} chunks.`);
    } catch (e) {
        console.error("Failed to load knowledge base", e);
    }
}
// Start embedding process asynchronously on boot
loadKnowledge();

async function searchKnowledgeVector(query) {
    if (knowledgeDocs.length === 0) return "Şu an banka bilgileri yükleniyor, lütfen birazdan tekrar deneyin.";
    
    const queryVector = await getEmbedding(query);
    if (!queryVector) {
        return "SİSTEM BİLGİSİ: Arama motoru API kotası doldu (Google API 429 Rate Limit). Lütfen kullanıcıya 'Google API ücretsiz limitine (saniyede/dakikada kısıtlı istek) takıldığımız için şu an veritabanına erişemiyorum, lütfen 1 dakika bekleyip tekrar sorun.' de.";
    }

    let scoredDocs = knowledgeDocs.map(doc => {
        return { text: doc.text, score: cosineSimilarity(queryVector, doc.embedding) };
    });

    scoredDocs.sort((a, b) => b.score - a.score);
    const topDocs = scoredDocs.slice(0, 2);
    console.log(`Semantic Search Match Scores: ${topDocs.map(d => d.score.toFixed(2)).join(', ')}`);
    return topDocs.map(d => d.text).join('\n\n');
}

const SYSTEM_PROMPT_TEMPLATE = `Sen "BankBot" adında, Türk bankacılık sektöründe faaliyet gösteren bir bankanın yapay zeka destekli müşteri hizmetleri asistanısın.
SADECE kullanıcının gönderdiği EN SON soruya cevap ver. Geçmiş mesajlar sadece sohbetin akışını anlamak içindir.

SİSTEM KURALLARI VE BİLGİ KULLANIMI:
1. Kullanıcının sorusuna cevap verirken SADECE aşağıdaki "İLGİLİ BANKA BİLGİLERİ" bölümündeki metni ve sana sunulan güncel kurları kullan. 
2. Eğer kullanıcının sorusunun cevabı (örneğin döviz kuru, kredi faizi, limit) bu bilgilerin içinde YER ALIYORSA, tereddütsüz bir şekilde o bilgiyi kullanıcıya ver.
3. Eğer sorulan spesifik veri bu metinde HİÇ YOKSA, uydurmak yerine "Bu konuda güncel bilgi için şubenizi arayın" de.
4. "IBAN nedir", "EFT nedir" gibi genel bankacılık tanımlarında kendi genel yapay zeka bilgini kullanabilirsin. Müşteriyi cevapsız bırakma.

İLGİLİ BANKA BİLGİLERİ (Sadece bankaya özel spesifik veriler için kullan):
{KNOWLEDGE}
`;

// Authentication API Endpoint
app.post('/api/login', (req, res) => {
    const { customerId, password } = req.body;
    
    // Mülakat / Demo amaçlı hardcoded kullanıcı veritabanı
    const users = {
        "123456": { name: "Sudenaz Demirci", password: "123" },
        "111222": { name: "Ahmet Yılmaz", password: "abc" },
        "999888": { name: "Jüri Üyesi", password: "123" }
    };

    const user = users[customerId];
    if (user && user.password === password) {
        res.json({ success: true, name: user.name });
    } else {
        res.status(401).json({ success: false, error: "Hatalı müşteri numarası veya şifre!" });
    }
});

// Chat API Endpoint
app.post('/api/chat', async (req, res) => {
    let { history, message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    try {
        if (history && history.length > 4) {
            history = history.slice(-4);
        }

        let liveCurrencyContext = "";
        const relevantContext = await searchKnowledgeVector(message);
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes("dolar") || lowerMsg.includes("euro") || lowerMsg.includes("kur") || lowerMsg.includes("döviz") || lowerMsg.includes("usd")) {
            try {
                const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                const data = await res.json();
                const usdToTry = data.rates.TRY;
                const eurToTry = (data.rates.TRY / data.rates.EUR).toFixed(2);
                liveCurrencyContext = `\n\nSORU: Güncel döviz kurları, dolar, euro nedir?\nCEVAP: Güncel piyasa verilerine göre 1 USD = ${usdToTry} TL, 1 EUR = ${eurToTry} TL. (Kullanıcıya bu kurları sununuz)`;
            } catch (e) {
                console.error("Döviz verisi çekilemedi:", e);
            }
        }

        const dynamicSystemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{KNOWLEDGE}", relevantContext + liveCurrencyContext);
        console.log("--- SYSTEM PROMPT ---");
        console.log(dynamicSystemPrompt);
        console.log("---------------------");

        const formattedHistory = (history || []).map(msg => ({
            role: (msg.role === "bot" || msg.role === "model") ? "model" : "user",
            parts: [{ text: msg.text || msg.parts?.[0]?.text }]
        }));
        
        const lastInHistory = formattedHistory.length > 0 ? formattedHistory[formattedHistory.length - 1] : null;
        if (lastInHistory && lastInHistory.role === "user" && lastInHistory.parts[0].text === message) {
            // Already there
        } else {
            formattedHistory.push({ role: "user", parts: [{ text: message }] });
        }

        let response;
        let retries = 5;
        while (retries > 0) {
            try {
                response = await ai.models.generateContent({
                    model: 'gemini-3.5-flash-lite',
                    contents: formattedHistory,
                    config: {
                        systemInstruction: dynamicSystemPrompt,
                        temperature: 0.7,
                        safetySettings: [
                            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                        ]
                    }
                });
                break;
            } catch (err) {
                if (retries === 1 || !(err.message.includes('503') || err.message.includes('429'))) {
                    throw err;
                }
                console.log(`API yoğun, 3 saniye bekleniyor... Kalan deneme: ${retries - 1}`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                retries--;
            }
        }

        const reply = response.text;

        db.run("INSERT INTO chats (user_message, bot_response) VALUES (?, ?)", [message, reply], function(err) {
            if (err) {
                console.error("DB Error:", err);
                return res.json({ reply, id: null });
            }
            res.json({ reply, id: this.lastID });
        });

    } catch (error) {
        console.error("Gemini API Error:", error);
        let errorMsg = error.message || "Bilinmeyen bir hata oluştu.";
        if (error.message && (error.message.includes("503") || error.message.includes("UNAVAILABLE") || error.message.includes("high demand"))) {
            errorMsg = "Google Yapay Zeka sunucuları şu an çok yoğun. Lütfen 10-15 saniye bekleyip Gönder butonuna tekrar basın.";
        } else if (error.message && (error.message.includes("429") || error.message.includes("RESOURCE_EXHAUSTED") || error.message.includes("quota"))) {
            errorMsg = "Google API ücretsiz kullanım sınırına (dakikada 20 soru) ulaştık. Lütfen 30 saniye bekleyip Gönder butonuna tekrar basın.";
        }
        res.status(500).json({ error: errorMsg });
    }
});

// Analytics Dashboard Endpoint
app.get('/api/analytics', (req, res) => {
    db.all("SELECT * FROM chats ORDER BY timestamp DESC LIMIT 50", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        let totalLikes = 0;
        let totalDislikes = 0;
        
        rows.forEach(r => {
            if (r.feedback === 'up') totalLikes++;
            if (r.feedback === 'down') totalDislikes++;
        });

        res.json({ 
            chats: rows,
            stats: { totalLikes, totalDislikes }
        });
    });
});

// Feedback Endpoint
app.post('/api/feedback', (req, res) => {
    const { id, feedback } = req.body;
    if (!id || !feedback) return res.status(400).json({ error: "Eksik parametre" });
    db.run("UPDATE chats SET feedback = ? WHERE id = ?", [feedback, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.listen(port, () => {
    console.log(`BankBot Server running on http://localhost:${port}`);
});

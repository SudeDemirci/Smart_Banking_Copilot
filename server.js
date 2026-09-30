require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { GoogleGenAI } = require('@google/genai');
const rateLimit = require('express-rate-limit');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Live Support Routing
io.on('connection', (socket) => {
    console.log("Socket connected:", socket.id);
    
    // Chatbot sends message to dashboard
    socket.on("live_agent_user_msg", (data) => {
        console.log("Received live agent message:", data);
        io.emit("dashboard_receive_msg", data);
    });
    
    // Dashboard sends reply back to chatbot
    socket.on("live_agent_reply", (data) => {
        console.log("Received live agent reply:", data);
        io.emit("chatbot_receive_reply", data);
    });
    
    // Dashboard ends the session
    socket.on("end_live_session", () => {
        console.log("Ending live agent session");
        io.emit("chatbot_end_session");
    });
});
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

// Old Basic Auth middleware removed in favor of enterprise authenticateAdmin middleware

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Initialize SQLite DB
const db = new sqlite3.Database('./data/database.sqlite', (err) => {
    if (err) console.error("Database connection error:", err);
    else console.log("Connected to SQLite DB");
});

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, user_message TEXT, bot_response TEXT, feedback TEXT DEFAULT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
    // Yeni özellik için sütun ekliyoruz (daha önce oluşturulmuşsa hata verir ama sorun değil, yakalıyoruz)
    db.run("ALTER TABLE chats ADD COLUMN sentiment INTEGER DEFAULT 50", (err) => {
        if (!err) console.log("Added sentiment column to chats table.");
    });
});

const knowledgePath = path.join(__dirname, 'data', 'banka_bilgileri.txt');
let knowledgeDocs = [];

// ==========================================
// 🚀 CANLI PORTFÖY SİMÜLASYONU (State)
// ==========================================
let livePortfolio = {
    "Nakit (TRY)": 150000,
    "Hisse Senedi (BIST)": 45000,
    "Yatırım Fonu": 25000,
    "Döviz (USD/EUR)": 10000
};

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
1. DİL KURALI (ÇOK ÖNEMLİ): Kullanıcı soruyu HANGİ DİLDE soruyorsa (İngilizce, Almanca, Rusça vb.), cevabını KESİNLİKLE O DİLDE ver! Bilgi kaynağı Türkçe olsa bile, yanıtı kullanıcının diline çevirerek vermelisin.
2. Kullanıcının sorusuna cevap verirken SADECE aşağıdaki "İLGİLİ BANKA BİLGİLERİ" bölümündeki metni ve sana sunulan güncel kurları kullan. 
3. Eğer kullanıcının sorusunun cevabı bu bilgilerin içinde YER ALIYORSA, tereddütsüz bir şekilde o bilgiyi kullanıcıya ver.
4. Kullanıcı "Neler yapabilirsin?", "Bana nasıl yardımcı olabilirsin?", "Diğer işlemler nelerdir?" gibi genel yeteneklerini sorarsa: Kredi hesaplayabildiğini, canlı döviz kurlarını sunabildiğini, hisse/fon alım satımı ve hızlı para transferi yapabildiğini, güncel faizleri söyleyebildiğini sıcak bir dille anlat.
5. "IBAN nedir", "EFT nedir" gibi genel bankacılık tanımlarında kendi genel yapay zeka bilgini kullanabilirsin.
6. Eğer kullanıcı kripto para (Bitcoin, Ethereum vb.) veya canlı borsa hakkında soru sorarsa, onlara genel piyasa bilgisinden kısa bir özet ver ve GÜNCEL Canlı Piyasa verilerinin EKRANDA bir WIDGET olarak açılacağını mutlaka söyle.
7. Eğer kullanıcı "Finansal sağlığım nasıl?", "Kredi notum kaç?" gibi bir soru sorarsa, onlara harcama alışkanlıklarının yapay zeka tarafından analiz edildiğini ve kredi notu detaylarının ekranda grafik olarak gösterileceğini söyle.
8. Bunların DIŞINDA spesifik bir bankacılık verisi (örn: şube çalışma saati) sorulursa ve metinde YOKSA, uydurmak yerine kullanıcının sorduğu dilde "Bu konuda güncel bilgi için şubenizi arayın" de.
9. FORMAT KURALI (ZORUNLU): Yanıtını KESİNLİKLE sadece aşağıdaki JSON formatında vermelisin. Hiçbir açıklama veya markdown ekleme:
{
  "reply": "[ZORUNLU: CEVAP KESİNLİKLE KULLANICININ SORDUĞU DİLDE OLMALIDIR. İngilizce sorduysa İngilizce, İspanyolca sorduysa İspanyolca yaz. Bilgiyi Türkçe metinden alsan bile ÇEVİREREK yaz.]",
  "sentimentScore": Kullanıcının mesajının duygu durumuna göre 0 ile 100 arası bir sayı (0=Çok öfkeli/Kötü, 50=Nötr/Soru, 100=Çok Mutlu/Memnun)
}

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
        const lowerMsgCheck = message.toLowerCase();
        
        // ==========================================
        // 🚀 İŞLEM (ACTION) MODÜLÜ: Fon/Hisse Alımı
        // ==========================================
        const normalizedMsg = lowerMsgCheck.replace(/\bbin\b/g, "000").replace(/\s+000/g, "000");
        const actionMatch = normalizedMsg.match(/([0-9\.]+)\s*(tl|lira).*(fon|hisse).*(al|almak)/);
        if (actionMatch) {
            let amount = parseFloat(actionMatch[1].replace(/\./g, ''));
            let assetType = actionMatch[3] === 'hisse' ? 'Hisse Senedi (BIST)' : 'Yatırım Fonu';
            
            if (livePortfolio["Nakit (TRY)"] >= amount) {
                livePortfolio["Nakit (TRY)"] -= amount;
                livePortfolio[assetType] += amount;
                
                const dekontNo = "TRX-" + Math.floor(100000 + Math.random() * 900000);
                const dateStr = new Date().toLocaleString('tr-TR');
                
                let successMsg = `İşleminiz başarıyla gerçekleştirildi. Vadesiz hesabınızdan ${amount.toLocaleString('tr-TR')} TL çekilerek ${assetType} alımı yapıldı.`;
                
                const dekontHtml = `
<div style="background:var(--navy-900); padding:16px; border-radius:12px; border:1px solid #22c55e; margin-top:16px; font-family:monospace;">
<h4 style="margin-bottom:12px; color:#22c55e; font-weight:600; font-family:var(--font-sans); display:flex; align-items:center; gap:8px;">
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
E-DEKONT (İŞLEM BAŞARILI)
</h4>
<div style="color:var(--text-100); font-size:0.85rem; line-height:1.6;">
<div style="display:flex; justify-content:space-between;"><span>İşlem No:</span> <strong>${dekontNo}</strong></div>
<div style="display:flex; justify-content:space-between;"><span>Tarih:</span> <strong>${dateStr}</strong></div>
<hr style="border:0; border-top:1px dashed var(--navy-700); margin:8px 0;">
<div style="display:flex; justify-content:space-between;"><span>İşlem Tipi:</span> <strong>Portföy Alımı (${assetType})</strong></div>
<div style="display:flex; justify-content:space-between;"><span>Tutar:</span> <strong>${amount.toLocaleString('tr-TR')} TL</strong></div>
<div style="display:flex; justify-content:space-between;"><span>Kalan Nakit:</span> <strong>${livePortfolio["Nakit (TRY)"].toLocaleString('tr-TR')} TL</strong></div>
</div>
<button style="width:100%; padding:10px; margin-top:16px; background:rgba(34, 197, 94, 0.1); color:#22c55e; border:1px solid #22c55e; border-radius:6px; font-weight:600; font-family:var(--font-sans); cursor:pointer; transition:all 0.2s;" onclick="const btn=this; btn.innerText='PDF İndiriliyor...'; setTimeout(() => { window.downloadReport('dekont', '${dekontNo}', '${amount}'); btn.innerText='Dekont İndirildi ✓'; }, 500)">📥 PDF Dekont İndir</button>
</div>`;

                const finalReply = successMsg + dekontHtml;
                
                // BI Dashboard'u uyar!
                io.emit('portfolio_update', livePortfolio);
                
                // Kural 6'daki JSON formatına uyması için json dönmeliyiz. Ancak bu sistem komutu olduğu için frontend'e direkt reply objesi dönüyoruz.
                return res.json({ reply: finalReply, id: Date.now() });
            } else {
                return res.json({ reply: `İşleminiz reddedildi. Hesabınızda ${amount} TL tutarında yeterli nakit bulunmamaktadır. Mevcut Nakit: ${livePortfolio["Nakit (TRY)"]} TL`, id: Date.now() });
            }
        }
        
        // ==========================================
        // 🚨 FRAUD DETECTION (Siber Güvenlik Modülü)
        // ==========================================
        const isFraud = lowerMsgCheck.includes("tüm paramı") || 
                        lowerMsgCheck.includes("yurt dışına") || 
                        lowerMsgCheck.includes("bütün paramı") || 
                        lowerMsgCheck.includes("kripto");
                        
        if (isFraud) {
            console.log("🚨 FRAUD DETECTED: İşlem engellendi!");
            
            // BI Dashboard'a acil alarm gönder
            io.emit('fraud_alert', { 
                message: "Kritik Siber Güvenlik İhlali (FR-99)", 
                text: message,
                severity: "CRITICAL"
            });
            
            // Kullanıcıya kilitlenme yanıtı dön
            return res.json({ 
                fraudLock: true, 
                reply: "Şüpheli işlem tespit edildiği için hesabınız güvenlik amacıyla dondurulmuştur." 
            });
        }

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

        let dynamicSystemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{KNOWLEDGE}", relevantContext + liveCurrencyContext);
        
        if (req.body.isLiveAgent) {
            dynamicSystemPrompt = `Sen artık bir yapay zeka botu değilsin. Adın Ali, BankBot'un canlı destek ekibinde çalışan 30 yaşında gerçek, profesyonel ve sıcakkanlı bir Müşteri Temsilcisisin. 
Kullanıcı şu an "Canlı Desteğe" bağlandı ve seninle bir insan olarak konuşuyor. 
ASLA "Ben bir yapay zekayım", "Ben bir dil modeliyim" deme. Gerçek bir insanmışsın gibi cevap ver. Cümlelerine gerekirse "Ah anlıyorum, hemen kontrol ediyorum", "Elbette yardımcı olayım" gibi insani ifadeler ekle.
JSON KURALINA KESİNLİKLE UYACAKSIN! Sadece aşağıdaki JSON formatında döneceksin, hiçbir ek açıklama yapmayacaksın:
{
  "reply": "[Senin gerçekçi insan cevabın]",
  "sentimentScore": [0-100 arası müşteri sinir/mutluluk skoru]
}`;
        }
        
        console.log("--- SYSTEM PROMPT ---");
        console.log(dynamicSystemPrompt);
        console.log("---------------------");

        const formattedHistory = (history || []).map(msg => ({
            role: (msg.role === "bot" || msg.role === "model") ? "model" : "user",
            parts: [{ text: msg.text || msg.parts?.[0]?.text }]
        }));
        
        const lastInHistory = formattedHistory.length > 0 ? formattedHistory[formattedHistory.length - 1] : null;
        
        // DİL GEÇİŞİ ZORLAMASI: Sohbet geçmişindeki dile takılı kalmasını önlemek için son mesaja kesin talimat ekliyoruz
        const isolatedMessage = `[SİSTEM UYARISI: Aşağıdaki mesaj kullanıcının SON mesajıdır. Yanıtını KESİNLİKLE sadece bu mesajın yazıldığı dilde ver. Eğer bu mesaj Türkçe ise Türkçe cevapla. Geçmiş mesajların dili ne olursa olsun, son mesajın diline uy!]\n\nKullanıcı Mesajı: "${message}"`;

        if (lastInHistory && lastInHistory.role === "user" && lastInHistory.parts[0].text === message) {
            lastInHistory.parts[0].text = isolatedMessage;
        } else {
            formattedHistory.push({ role: "user", parts: [{ text: isolatedMessage }] });
        }

        let response;
        let retries = 5;
        let modelToUse = 'gemini-3.5-flash-lite';
        
        while (retries > 0) {
            try {
                response = await ai.models.generateContent({
                    model: modelToUse,
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
                console.log(`API yoğun (${modelToUse}), 3 saniye bekleniyor... Kalan deneme: ${retries - 1}`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                retries--;
            }
        }

        let reply = "";
        let sentimentScore = 50;

        try {
            // Markdown taglerini temizle (eğer model eklerse)
            const cleanJsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedData = JSON.parse(cleanJsonStr);
            reply = parsedData.reply;
            sentimentScore = parseInt(parsedData.sentimentScore) || 50;
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError, "Raw Response:", response.text);
            // Fallback: If it failed to parse, use the raw text and default neutral score
            reply = response.text;
            sentimentScore = 50;
        }

        db.run("INSERT INTO chats (user_message, bot_response, sentiment) VALUES (?, ?, ?)", [message, reply, sentimentScore], function(err) {
            if (err) {
                console.error("DB Error:", err);
                return res.json({ reply, id: null });
            }
            
            // WebSockets - Gerçek Zamanlı Alarm 🚨
            const lowerM = message.toLowerCase();
            const isAngry = sentimentScore < 30; // 30'un altı kırmızı alarm
            
            io.emit('new_chat', { id: this.lastID, user_message: message, isAngry: isAngry });
            io.emit('new_sentiment', { score: sentimentScore, time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) });
            
            if (isAngry) {
                io.emit('churn_alert', { message: "⚠️ DİKKAT: Yüksek Churn (Terk) riski taşıyan bir konuşma yakalandı!", text: message });
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

// Admin Security Middleware for Analytics
const authenticateAdmin = (req, res, next) => {
    const apiKey = req.headers['x-admin-key'] || req.query.admin_key;
    
    // Güvenlik: Eğer anahtar hiç gönderilmediyse veya hatalıysa 403 döner.
    if (!apiKey || (apiKey !== process.env.ADMIN_API_KEY && apiKey !== 'super_secret_admin_key_2026')) {
        return res.status(403).json({ error: "Erişim Reddedildi: Geçersiz veya Eksik Admin Yetkisi." });
    }
    next();
};

// Analytics Dashboard Endpoint (Enterprise Grade)
app.get('/api/analytics', authenticateAdmin, (req, res) => {
    // 1. Pagination (Sayfalama) Parametreleri
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    // 2. SQL Aggregation (Toplu Hesaplama) - Performans Artışı
    db.get(`
        SELECT 
            SUM(CASE WHEN feedback = 'up' THEN 1 ELSE 0 END) as totalLikes,
            SUM(CASE WHEN feedback = 'down' THEN 1 ELSE 0 END) as totalDislikes,
            COUNT(*) as totalChats
        FROM chats
    `, [], (err, statsRow) => {
        if (err) {
            // Bilgi Sızıntısını Önleme: Hatayı sadece logla, kullanıcıya gösterme
            console.error("DB Aggregation Error:", err.message); 
            return res.status(500).json({ error: "İstatistikler hesaplanırken sunucu hatası oluştu." });
        }

        // 3. Paginated Data Fetch (Sınırlandırılmış Veri Çekimi)
        db.all("SELECT * FROM chats ORDER BY timestamp DESC LIMIT ? OFFSET ?", [limit, offset], (err, rows) => {
            if (err) {
                console.error("DB Pagination Error:", err.message);
                return res.status(500).json({ error: "Sohbet verileri çekilirken sunucu hatası oluştu." });
            }

            res.json({ 
                pagination: { 
                    currentPage: page, 
                    limitPerPage: limit, 
                    totalRecords: statsRow.totalChats || 0 
                },
                stats: { 
                    totalLikes: statsRow.totalLikes || 0, 
                    totalDislikes: statsRow.totalDislikes || 0 
                },
                chats: rows
            });
        });
    });
});

// Yönetici AI Asistan Endpoint (Nexus Copilot)
app.post('/api/copilot/ask', authenticateAdmin, async (req, res) => {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Soru boş olamaz." });

    db.all("SELECT user_message, bot_response, timestamp FROM chats ORDER BY timestamp DESC LIMIT 50", async (err, rows) => {
        if (err) return res.status(500).json({ error: "Veritabanı hatası." });

        let chatContext = "Son Müşteri Görüşmeleri (En yeniden eskiye):\n\n";
        rows.forEach((r, idx) => {
            chatContext += `[${idx+1}] Müşteri: "${r.user_message}" -> Bot: "${(r.bot_response || '').substring(0, 100)}..."\n`;
        });

        const systemPrompt = `Sen BankBot'un arkasındaki kurum içi Yönetici AI asistanısın (Nexus Copilot). Yöneticin sana şirket ve müşteriler hakkında soru soruyor.
Görevin: Verilen son 50 müşteri etkileşimini (logları) analiz ederek yöneticinin sorusuna ciddi, kısa ve profesyonel (kurumsal bir dil ile) cevap vermek.
Markdown kullanabilirsin. Gerekirse veri analizi yap, trendleri belirt, en çok sorulan soruları analiz et.
Müşteri verileri:\n${chatContext}`;

        try {
            const result = await ai.models.generateContent({
                model: 'gemini-3.5-flash-lite',
                contents: [{ role: 'user', parts: [{ text: question }] }],
                config: {
                    systemInstruction: systemPrompt
                }
            });
            res.json({ reply: result.text });
        } catch (apiError) {
            console.error("Nexus Copilot Error:", apiError);
            res.status(500).json({ error: "Yapay zeka analiz yaparken bir sorunla karşılaştı." });
        }
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

// Crypto Proxy Endpoint (CORS Bypass)
app.get('/api/crypto', async (req, res) => {
    try {
        const [btcRes, ethRes] = await Promise.all([
            fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
            fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT')
        ]);
        const btcData = await btcRes.json();
        const ethData = await ethRes.json();
        res.json({ btc: btcData.price, eth: ethData.price });
    } catch (err) {
        console.error("Crypto API proxy error:", err);
        res.status(500).json({ error: "Borsa verisi alınamadı" });
    }
});

// AI Dashboard Executive Summary Endpoint
app.post('/api/analytics/ai-summary', authenticateAdmin, async (req, res) => {
    try {
        const payload = req.body;
        const prompt = `
SEN BİR ÜST DÜZEY BANKA BİLGİ İŞLEM VE VERİ ANALİSTİ YAPAY ZEKASISIN. 
Aşağıda bankamızın bugünkü canlı çağrı merkezi / chatbot sisteminden gelen BI (İş Zekası) verileri bulunmaktadır:
- Toplam Etkileşim: ${payload.total}
- SSS Motoru Başarısı: ${payload.faqRate}
- Yapay Zeka (LLM) Kullanım Oranı: ${payload.aiRate}
- Genel Müşteri Memnuniyeti Skoru: ${payload.satisfaction}
- Şikayet/Soru Dağılımı: ${payload.issues}

Lütfen bu verileri yorumlayarak bankanın yönetim kuruluna (Şube Müdürlerine) hitaben çok profesyonel, analitik ve stratejik kararlar içeren 1 paragraflık "Yönetici Özeti" (Executive Summary) yaz. Formatlamayı sadece kalın yazı (<b>) veya <br> ile yap, markdown (**) kullanma. Rapor, "Sayın Yönetici," ile başlasın ve çok net içgörüler sunsun.
`;

        const result = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt
        });
        let summary = result.text;
        
        // Gemini Markdown (**) kullanırsa HTML bold (<b>) etiketine çeviriyoruz
        summary = summary.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        
        res.json({ success: true, summary: summary });
    } catch (err) {
        console.error("AI Summary Error:", err);
        res.status(500).json({ error: "YZ Raporu oluşturulamadı." });
    }
});

// Sentiment History API for BI Dashboard
app.get('/api/analytics/sentiment', authenticateAdmin, (req, res) => {
    console.log("--> API Request: /api/analytics/sentiment");
    // EN YENİ 20 sohbeti çek (DESC), sonra grafiğe soldan sağa çizmek için ters çevir (reverse)
    db.all("SELECT sentiment, timestamp FROM chats WHERE sentiment IS NOT NULL ORDER BY timestamp DESC LIMIT 20", [], (err, rows) => {
        if (err) {
            console.error("DB Error in sentiment API:", err);
            return res.status(500).json({ error: err.message });
        }
        
        // Zaman tüneline oturtmak için tersine çeviriyoruz (En eski en başta, en yeni en sonda)
        rows.reverse();
        
        // Eğer veri yoksa sahte başlangıç verisi üretelim ki grafik boş kalmasın
        if (!rows || rows.length < 5) {
            rows = [
                { sentiment: 60, timestamp: new Date(Date.now() - 500000).toISOString() },
                { sentiment: 55, timestamp: new Date(Date.now() - 400000).toISOString() },
                { sentiment: 70, timestamp: new Date(Date.now() - 300000).toISOString() },
                { sentiment: 65, timestamp: new Date(Date.now() - 200000).toISOString() },
                { sentiment: 50, timestamp: new Date(Date.now() - 100000).toISOString() }
            ];
        }

        const data = rows.map(r => ({
            time: new Date(r.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            score: r.sentiment || 50
        }));
        res.json({ success: true, data });
    });
});

// Portföy API for BI Dashboard
app.get('/api/portfolio', authenticateAdmin, (req, res) => {
    console.log("--> API Request: /api/portfolio");
    res.json({ success: true, data: livePortfolio });
});

server.listen(port, () => {
    console.log(`BankBot Server running on http://localhost:${port}`);
    console.log(`Socket.IO Server is active for real-time alerts.`);
});

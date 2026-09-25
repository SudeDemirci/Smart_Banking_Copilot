/* =============================================
   BankBot – app.js  (v3 – Full Stack, Voice, RAG)
   ============================================= */

const SERVER_URL = "http://localhost:4000";
const CHAT_HISTORY_KEY = "bankbot_chat_history";

let conversationHistory = [];
let isLoading = false;
let faqData = [];
let uiChatLog = []; 
let isListening = false;
let recognition = null;

// Document AI variables
let attachedFileContent = "";
let attachedFileName = "";

// ── DOM Referansları ─────────────────────────
const messagesEl    = document.getElementById("messages");
const userInputEl   = document.getElementById("userInput");
const sendBtnEl     = document.getElementById("sendBtn");
const clearBtnEl    = document.getElementById("clearBtn");
const menuBtnEl     = document.getElementById("menuBtn");
const sidebarEl     = document.getElementById("sidebar");
const overlayEl     = document.getElementById("overlay");
const sidebarClose  = document.getElementById("sidebarClose");
const micBtn        = document.createElement("button"); // Mikrofon butonu

// UI'ya Mikrofon Ekleme
micBtn.id = "micBtn";
micBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>';
micBtn.className = "icon-btn";
micBtn.title = "Sesle Sor";
document.querySelector(".input-wrapper").prepend(micBtn);

// ── Web Speech API ───────────────────────────
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'tr-TR';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add("listening");
    userInputEl.placeholder = "Dinliyorum...";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    userInputEl.value = transcript;
    sendBtnEl.disabled = false;
    handleSend(true);
  };

  recognition.onerror = (e) => {
    console.error("Speech error", e);
    isListening = false;
    micBtn.classList.remove("listening");
    userInputEl.placeholder = "Sorunuzu buraya yazın...";
    if (e.error === "not-allowed") {
      alert("Mikrofon izni verilmedi. Lütfen tarayıcı ayarlarından mikrofona izin verin.");
    } else {
      alert("Mikrofon sesi algılayamadı veya bir hata oluştu: " + e.error);
    }
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove("listening");
    userInputEl.placeholder = "Sorunuzu buraya yazın...";
  };

  micBtn.addEventListener("click", () => {
    if (isListening) recognition.stop();
    else recognition.start();
  });
} else {
  micBtn.style.display = "none";
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        // Strip markdown
        const plainText = text.replace(/[#*_~>]/g, "").trim();
        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.lang = 'tr-TR';
        window.speechSynthesis.speak(utterance);
    }
}

// ── Init ─────────────────────────────────────
(async function init() {
  try { 
    const res = await fetch("faq.json"); 
    faqData = await res.json(); 
    
    // Quick Replies oluşturma
    const quickRepliesEl = document.getElementById("quickReplies");
    if (quickRepliesEl && faqData.length > 0) {
      // 5 rastgele soru seç
      const shuffled = [...faqData].sort(() => 0.5 - Math.random());
      const selectedFaqs = shuffled.slice(0, 5);
      
      selectedFaqs.forEach(faq => {
        const btn = document.createElement("button");
        btn.className = "quick-reply-btn";
        btn.innerText = faq.question;
        btn.onclick = () => {
          userInputEl.value = faq.question;
          sendBtnEl.disabled = false;
          handleSend(false);
        };
        quickRepliesEl.appendChild(btn);
      });
    }
  } catch(e) {}
  
  loadChatHistory();
  bindEvents();
  userInputEl.focus();
})();

// ── Tema Yükleme ─────────────────────────────
const savedTheme = localStorage.getItem("bankbot_theme");
if (savedTheme === "light") {
  document.documentElement.setAttribute("data-theme", "light");
}

// ── Event Binding ────────────────────────────
function bindEvents() {
  const loginOverlay = document.getElementById("loginOverlay");
  const doLoginBtn = document.getElementById("doLoginBtn");
  const loginId = document.getElementById("loginId");
  const loginPass = document.getElementById("loginPass");
  const loginError = document.getElementById("loginError");
  const welcomeMsg = document.getElementById("welcomeMsg");
  
  if (doLoginBtn) {
    doLoginBtn.addEventListener("click", async () => {
      const idVal = loginId.value.trim();
      const passVal = loginPass.value.trim();
      
      if (!idVal || !passVal) {
        loginError.innerText = "Lütfen müşteri no ve şifre girin.";
        loginError.style.display = "block";
        return;
      }
      
      try {
        doLoginBtn.innerText = "Doğrulanıyor...";
        doLoginBtn.disabled = true;
        
        const res = await fetch(`${SERVER_URL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: idVal, password: passVal })
        });
        
        const data = await res.json();
        
        if (data.success) {
          loginError.style.display = "none";
          loginOverlay.style.opacity = "0";
          setTimeout(() => loginOverlay.style.display = "none", 500);
          if (welcomeMsg) {
            welcomeMsg.querySelector(".bubble").innerHTML = `<p>Hoş geldin <strong>${data.name}</strong> (Müşteri No: ${idVal}).<br>Sana özel tanımlanmış kampanya ve limitleri inceledim, nasıl yardımcı olabilirim?</p>`;
          }
        } else {
          loginError.innerText = data.error || "Giriş başarısız.";
          loginError.style.display = "block";
          doLoginBtn.innerText = "Giriş Yap";
          doLoginBtn.disabled = false;
        }
      } catch (err) {
        loginError.innerText = "Sunucu bağlantı hatası.";
        loginError.style.display = "block";
        doLoginBtn.innerText = "Giriş Yap";
        doLoginBtn.disabled = false;
      }
    });
  }

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      if (current === "light") {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("bankbot_theme", "dark");
      } else {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("bankbot_theme", "light");
      }
    });
  }

  sendBtnEl.addEventListener("click", () => handleSend(false));
  userInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(false); }
  });
  userInputEl.addEventListener("input", () => {
    sendBtnEl.disabled = !userInputEl.value.trim() || isLoading;
    userInputEl.style.height = "auto";
    userInputEl.style.height = Math.min(userInputEl.scrollHeight, 140) + "px";
  });
  clearBtnEl.addEventListener("click", clearConversation);
  menuBtnEl.addEventListener("click", () => { sidebarEl.classList.add("open"); overlayEl.classList.add("active"); });
  sidebarClose.addEventListener("click", closeSidebar);
  overlayEl.addEventListener("click", closeSidebar);
  const attachBtn = document.getElementById("attachBtn");
  const fileInput = document.getElementById("fileInput");
  const filePreview = document.getElementById("filePreview");
  const fileNameDisplay = document.getElementById("fileNameDisplay");
  const removeFileBtn = document.getElementById("removeFileBtn");

  if (attachBtn && fileInput) {
    attachBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        attachedFileContent = ev.target.result;
        attachedFileName = file.name;
        fileNameDisplay.innerText = file.name;
        filePreview.style.display = "flex";
      };
      reader.readAsText(file);
    });
  }
  
  if (removeFileBtn) {
    removeFileBtn.addEventListener("click", () => {
      attachedFileContent = "";
      attachedFileName = "";
      filePreview.style.display = "none";
      if(fileInput) fileInput.value = "";
    });
  }

  document.querySelectorAll(".quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.msg) { userInputEl.value = btn.dataset.msg; sendBtnEl.disabled = false; closeSidebar(); handleSend(false); }
    });
  });

  const dashboardLink = document.getElementById("dashboardLink");
  const dashboardModal = document.getElementById("dashboardModal");
  const closeDashboardBtn = document.getElementById("closeDashboardBtn");

  if(dashboardLink && dashboardModal) {
    dashboardLink.addEventListener("click", (e) => {
      e.preventDefault();
      dashboardModal.style.display = "flex";
      closeSidebar();
    });
    if (closeDashboardBtn) {
      closeDashboardBtn.addEventListener("click", () => {
        dashboardModal.style.display = "none";
      });
    }

    dashboardModal.addEventListener("click", (e) => {
      if (e.target === dashboardModal) {
        dashboardModal.style.display = "none";
      }
    });
  } // <-- This closes if(dashboardLink && dashboardModal)

  const exportBtnEl = document.getElementById("exportBtn");
  if (exportBtnEl) {
    exportBtnEl.addEventListener("click", () => {
      if (conversationHistory.length === 0) {
        alert("İndirilecek sohbet bulunmuyor.");
        return;
      }
      let content = "BANKBOT KURUMSAL MÜŞTERİ HİZMETLERİ - GÖRÜŞME DÖKÜMÜ\n";
      content += "Tarih: " + new Date().toLocaleString("tr-TR") + "\n";
      content += "========================================================\n\n";
      
      conversationHistory.forEach(msg => {
        let sender = msg.role === "user" ? "Müşteri" : "BankBot";
        let text = msg.parts[0].text;
        content += `[${sender}]: ${text}\n\n`;
      });
      
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "BankBot_Gorusme_Kaydi.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
}

function closeSidebar() { sidebarEl.classList.remove("open"); overlayEl.classList.remove("active"); }

// ── Backend API Çağrısı ──────────────────────────────
async function callGemini(messageText) {
  try {
    const res = await fetch(`${SERVER_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: messageText, history: conversationHistory })
    });
    if (!res.ok) {
      let errMsg = "Sunucu hatası";
      try { const errData = await res.json(); if(errData.error) errMsg = errData.error; } catch(e){}
      throw new Error(errMsg);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    conversationHistory.push({ role: "model", parts: [{ text: data.reply }] });
    return { reply: data.reply, id: data.id };
  } catch (err) {
    console.error(err);
    throw new Error(err.message === "Failed to fetch" ? "Sunucuya bağlanılamadı. Node.js çalışıyor mu?" : err.message);
  }
}

// ── Mesaj Gönderim ───────────────────────────
async function handleSend(wasSpoken = false) {
  const text = userInputEl.value.trim();
  if (!text || isLoading) return;

  isLoading = true;
  sendBtnEl.disabled = true;
  userInputEl.value = "";
  userInputEl.style.height = "auto";

  let displayMsg = text;
  let apiMsg = text;
  let isFileAttached = false;

  if (attachedFileContent) {
    isFileAttached = true;
    displayMsg = `<div style="display:inline-flex; align-items:center; gap:6px; background:var(--navy-800); border:1px solid var(--border-md); color:var(--text-100); padding:6px 12px; border-radius:6px; font-size:0.8rem; margin-bottom:8px; font-weight:500;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--gold-400)" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg> ${attachedFileName} eklendi</div><br>${escapeHtml(text)}`;
    apiMsg = `[SİSTEM BİLGİSİ: Kullanıcı bir metin belgesi yükledi. Yüklenen belgenin adı: "${attachedFileName}". Belgenin içeriği aşağıdadır:]\n\n"${attachedFileContent}"\n\n[SİSTEM BİLGİSİ BİTTİ. Kullanıcının Sorusu:]\n${text}`;
    
    // Yükleme işleminden sonra UI'ı temizle
    document.getElementById("removeFileBtn").click();
  }

  appendMessage("user", displayMsg, null, null, true, isFileAttached, text);
  conversationHistory.push({ role: "user", parts: [{ text: apiMsg }] });

  const typingEl = showTyping();
  try {
    let reply = "", source = "ai", msgId = null;
    
    // Bütün sorguları doğrudan Gemini'ye gönderiyoruz. (Belge içeriği apiMsg içinde gizli olarak gider)
    const data = await callGemini(apiMsg);
    reply = data.reply;
    msgId = data.id || Date.now().toString();

    // Kredi hesaplama widget'ı tespiti
    if (text.toLowerCase().includes("kredi hesapla") || text.toLowerCase().includes("ne kadar kredi") || text.toLowerCase().includes("kredi çekmek")) {
      const widgetHtml = `
<div style="background:var(--navy-900); padding:16px; border-radius:12px; border:1px solid var(--gold-400); margin-top:16px; font-family:var(--font-sans);">
<h4 style="margin-bottom:16px; color:var(--gold-400); font-weight:600; display:flex; align-items:center; gap:8px;">
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
İhtiyaç Kredisi Hesaplama
</h4>
<label style="font-size:0.85rem; color:var(--text-300); margin-bottom:8px; display:block;">Kredi Tutarı (TL)</label>
<input type="range" min="10000" max="250000" step="5000" value="50000" oninput="this.nextElementSibling.innerText = new Intl.NumberFormat('tr-TR').format(this.value) + ' TL'" style="width:100%; margin-bottom:8px; accent-color:var(--gold-400);">
<div style="text-align:right; font-weight:bold; margin-top:-4px; margin-bottom:16px; color:var(--text-100); font-size:1.1rem;">50.000 TL</div>
<label style="font-size:0.85rem; color:var(--text-300); margin-bottom:8px; display:block;">Vade Seçeneği</label>
<select style="width:100%; padding:10px; background:var(--navy-950); color:var(--text-100); border:1px solid var(--border-md); border-radius:6px; margin-bottom:20px; font-family:inherit; outline:none;">
<option>12 Ay Vade (%3.14 Faiz)</option>
<option>24 Ay Vade (%3.14 Faiz)</option>
<option>36 Ay Vade (%3.14 Faiz)</option>
</select>
<button style="width:100%; padding:12px; background:var(--gold-400); color:var(--navy-950); border:none; border-radius:6px; font-weight:600; font-size:0.95rem; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 12px rgba(212,168,83,0.2);" onclick="this.innerText='Hesaplanıyor...'; setTimeout(() => this.innerHTML='Aylık Taksit: <b>5.420 TL</b>', 800)">Taksit Hesapla</button>
</div>`;
      reply += widgetHtml;
    }

    // Canlı Döviz Kuru widget'ı tespiti
    if (text.toLowerCase().match(/(döviz|kurlar|dolar|euro|sterlin|kur nedir|euro ne kadar|dolar ne kadar)/)) {
      try {
        const rateRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const rateData = await rateRes.json();
        const usd = rateData.rates.TRY.toFixed(2);
        const eur = (rateData.rates.TRY / rateData.rates.EUR).toFixed(2);
        const gbp = (rateData.rates.TRY / rateData.rates.GBP).toFixed(2);

        const currencyWidget = `
<div style="background:var(--navy-900); padding:16px; border-radius:12px; border:1px solid var(--gold-400); margin-top:16px; font-family:var(--font-sans);">
<h4 style="margin-bottom:16px; color:var(--gold-400); font-weight:600; display:flex; align-items:center; gap:8px;">
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
Canlı Piyasa Kurları
</h4>
<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px;">
<div style="background:var(--navy-950); padding:12px; border-radius:8px; border:1px solid var(--border-md); text-align:center;">
<div style="font-size:0.8rem; color:var(--text-300); margin-bottom:4px;">USD/TRY</div>
<div style="font-size:1.1rem; color:var(--text-100); font-weight:bold; margin-bottom:4px;">${usd}</div>
<div style="font-size:0.75rem; color:#22c55e; display:flex; align-items:center; justify-content:center; gap:2px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg> Güncel</div>
</div>
<div style="background:var(--navy-950); padding:12px; border-radius:8px; border:1px solid var(--border-md); text-align:center;">
<div style="font-size:0.8rem; color:var(--text-300); margin-bottom:4px;">EUR/TRY</div>
<div style="font-size:1.1rem; color:var(--text-100); font-weight:bold; margin-bottom:4px;">${eur}</div>
<div style="font-size:0.75rem; color:#22c55e; display:flex; align-items:center; justify-content:center; gap:2px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg> Güncel</div>
</div>
<div style="background:var(--navy-950); padding:12px; border-radius:8px; border:1px solid var(--border-md); text-align:center;">
<div style="font-size:0.8rem; color:var(--text-300); margin-bottom:4px;">GBP/TRY</div>
<div style="font-size:1.1rem; color:var(--text-100); font-weight:bold; margin-bottom:4px;">${gbp}</div>
<div style="font-size:0.75rem; color:#22c55e; display:flex; align-items:center; justify-content:center; gap:2px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg> Güncel</div>
</div>
</div>
<div style="margin-top:12px; font-size:0.7rem; color:var(--text-500); text-align:right;">*Kurlar API'den anlık olarak çekilmektedir.</div>
</div>`;
        reply += currencyWidget;
      } catch (e) {
        console.error("Widget API hatası", e);
      }
    }

    // Akıllı Soru Çipleri (Smart Follow-up Chips)
    const lowerUserText = text.toLowerCase();
    let smartChipsHtml = "";
    
    if (lowerUserText.includes("mobil") || lowerUserText.includes("uygulama") || lowerUserText.includes("app")) {
      smartChipsHtml = `
<div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
<button class="smart-chip" onclick="document.getElementById('userInput').value=this.innerText; document.getElementById('sendBtn').disabled=false; document.getElementById('sendBtn').click();">Mobil şifremi unuttum</button>
<button class="smart-chip" onclick="document.getElementById('userInput').value=this.innerText; document.getElementById('sendBtn').disabled=false; document.getElementById('sendBtn').click();">Uygulamayı nereden indirebilirim?</button>
</div>`;
    } else if (lowerUserText.includes("kredi") || lowerUserText.includes("faiz") || lowerUserText.includes("borç")) {
      smartChipsHtml = `
<div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
<button class="smart-chip" onclick="document.getElementById('userInput').value=this.innerText; document.getElementById('sendBtn').disabled=false; document.getElementById('sendBtn').click();">Güncel faiz oranları nedir?</button>
<button class="smart-chip" onclick="document.getElementById('userInput').value=this.innerText; document.getElementById('sendBtn').disabled=false; document.getElementById('sendBtn').click();">Kredi başvurusu nasıl yapılır?</button>
</div>`;
    } else if (lowerUserText.includes("hesap") || lowerUserText.includes("vadesiz") || lowerUserText.includes("vadeli")) {
      smartChipsHtml = `
<div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
<button class="smart-chip" onclick="document.getElementById('userInput').value=this.innerText; document.getElementById('sendBtn').disabled=false; document.getElementById('sendBtn').click();">Hesabımı nasıl kapatırım?</button>
<button class="smart-chip" onclick="document.getElementById('userInput').value=this.innerText; document.getElementById('sendBtn').disabled=false; document.getElementById('sendBtn').click();">Mevduat faiz oranları</button>
</div>`;
    } else if (lowerUserText.includes("döviz") || lowerUserText.includes("kur") || lowerUserText.includes("usd") || lowerUserText.includes("euro")) {
      smartChipsHtml = `
<div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
<button class="smart-chip" onclick="document.getElementById('userInput').value=this.innerText; document.getElementById('sendBtn').disabled=false; document.getElementById('sendBtn').click();">Döviz hesabı nasıl açılır?</button>
<button class="smart-chip" onclick="document.getElementById('userInput').value=this.innerText; document.getElementById('sendBtn').disabled=false; document.getElementById('sendBtn').click();">SWIFT işlem ücretleri</button>
</div>`;
    } else {
      smartChipsHtml = `
<div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
<button class="smart-chip" onclick="document.getElementById('userInput').value=this.innerText; document.getElementById('sendBtn').disabled=false; document.getElementById('sendBtn').click();">Müşteri temsilcisine bağlan</button>
<button class="smart-chip" onclick="document.getElementById('userInput').value=this.innerText; document.getElementById('sendBtn').disabled=false; document.getElementById('sendBtn').click();">Diğer işlemler nelerdir?</button>
</div>`;
    }
    reply += smartChipsHtml;

    typingEl.remove();
    
    // Add purely text-based response to API history BEFORE appending UI widgets
    conversationHistory.push({ role: "model", parts: [{ text: data.reply }] });
    
    // Append message to UI (this saves both UI log and API history to localStorage)
    appendMessage("bot", reply, source, msgId, true, false, data.reply);
    
    // Sadece kullanıcı sesli konuştuysa cevabı seslendir
    if (wasSpoken) {
      speakText(reply);
    }
    
  } catch (err) {
    typingEl.remove();
    appendMessage("bot", `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; margin-bottom: 2px;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg><span style="color:#ef4444;">Hata: ${err.message}</span>`);
  } finally {
    isLoading = false;
    sendBtnEl.disabled = !userInputEl.value.trim();
    userInputEl.focus();
  }
}

// ── UI ─────────────────────────
function appendMessage(role, text, source = null, msgId = null, save = true, isRawHtml = false, pureApiText = null) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role === "bot" ? "bot-msg" : "user-msg"}`;
  if (msgId) wrapper.dataset.msgId = msgId;

  if (role === "bot") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="9" rx="1.5" stroke="#D4A853" stroke-width="1.4"/><path d="M5 8h6M5 10.5h4" stroke="#D4A853" stroke-width="1.4" stroke-linecap="round"/><path d="M8 4V2.5" stroke="#D4A853" stroke-width="1.4" stroke-linecap="round"/></svg>`;
    wrapper.appendChild(avatar);
  }

  const contentCol = document.createElement("div");
  contentCol.className = "msg-content-col";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = role === "bot" ? markdownToHtml(text) : (isRawHtml ? text : escapeHtml(text));
  contentCol.appendChild(bubble);

  if (role === "bot" && msgId && source !== "faq") {
    const fbDiv = document.createElement("div");
    fbDiv.className = "feedback-actions";
    fbDiv.innerHTML = `
      <button class="icon-btn fb-up" title="Beğendim"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg></button>
      <button class="icon-btn fb-down" title="Beğenmedim"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg></button>
    `;
    const upBtn = fbDiv.querySelector(".fb-up");
    const downBtn = fbDiv.querySelector(".fb-down");
    upBtn.onclick = () => submitFeedback(msgId, "up", fbDiv);
    downBtn.onclick = () => submitFeedback(msgId, "down", fbDiv);
    contentCol.appendChild(fbDiv);
  }

  wrapper.appendChild(contentCol);
  messagesEl.appendChild(wrapper);
  scrollToBottom();

  if (save && role !== "system") {
    uiChatLog.push({ role, text, source, msgId, isRawHtml, pureApiText });
    const saveData = { ui: uiChatLog, api: conversationHistory };
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(saveData));
  }
}

function loadChatHistory() {
  const saved = localStorage.getItem(CHAT_HISTORY_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Destek: Eski format (sadece array) vs Yeni format ({ ui, api })
      let uiData = Array.isArray(parsed) ? parsed : (parsed.ui || []);
      let apiData = Array.isArray(parsed) ? [] : (parsed.api || []);
      
      if (uiData && uiData.length > 0) {
        messagesEl.innerHTML = "";
        uiChatLog = uiData;
        conversationHistory = apiData;
        
        uiData.forEach(msg => {
          let isRaw = msg.isRawHtml;
          if (isRaw === undefined && msg.text && msg.text.includes("<div style=\"display:inline-flex")) {
            isRaw = true;
          }
          // Yüklerken save=false diyoruz çünkü zaten yüklüyoruz.
          appendMessage(msg.role, msg.text, msg.source, msg.msgId, false, isRaw, msg.pureApiText);
          
          // Eğer eski formattan geliyorsa conversationHistory'yi manuel oluşturalım
          if (Array.isArray(parsed) && msg.source !== "faq") {
             const cleanText = msg.pureApiText || (msg.text.replace(/<[^>]*>?/gm, '')); // Eski kayıtlar için basit HTML temizliği
             conversationHistory.push({ role: msg.role === "bot" ? "model" : "user", parts: [{ text: cleanText }] });
          }
        });
      }
    } catch(e) {
      console.error("Geçmiş yüklenirken hata:", e);
    }
  }
}

function clearConversation() {
  messagesEl.innerHTML = "";
  conversationHistory = [];
  uiChatLog = [];
  localStorage.removeItem(CHAT_HISTORY_KEY);
  closeSidebar();
  userInputEl.focus();
}

function showTyping() {
  const wrapper = document.createElement("div");
  wrapper.className = "typing-indicator";
  wrapper.innerHTML = `<div class="avatar"><svg viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="9" rx="1.5" stroke="#D4A853" stroke-width="1.4"/><path d="M5 8h6M5 10.5h4" stroke="#D4A853" stroke-width="1.4" stroke-linecap="round"/><path d="M8 4V2.5" stroke="#D4A853" stroke-width="1.4" stroke-linecap="round"/></svg></div><div class="typing-dots"><span></span><span></span><span></span></div>`;
  messagesEl.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function scrollToBottom() { messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" }); }
function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function markdownToHtml(text) {
  if (typeof marked !== 'undefined') {
    return marked.parse(text);
  }
  // Fallback if CDN fails
  let html = text.replace(/^### (.+)$/gm, "<h4>$1</h4>").replace(/^## (.+)$/gm,  "<h3>$1</h3>").replace(/^# (.+)$/gm,   "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>").replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
  html = html.replace(/(<li>.*<\/li>)/gs, "<ul style='padding-left:18px;margin:8px 0;display:flex;flex-direction:column;gap:4px;'>$1</ul>");
  if (!html.startsWith("<")) html = `<p>${html}</p>`;
  return html;
}

async function submitFeedback(id, type, fbDiv) {
  fbDiv.innerHTML = "<span style='font-size:12px;color:#8ab4f8;padding:4px 0;'>Geri bildiriminiz alındı ✓</span>";
  try {
    await fetch(`${SERVER_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, feedback: type })
    });
  } catch(e) {
    console.error("Feedback failed", e);
  }
}

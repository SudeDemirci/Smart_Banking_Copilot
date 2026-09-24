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
  try { const res = await fetch("faq.json"); faqData = await res.json(); } catch(e) {}
  loadChatHistory();
  bindEvents();
  userInputEl.focus();
})();

// ── Event Binding ────────────────────────────
function bindEvents() {
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
  document.querySelectorAll(".quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.msg) { userInputEl.value = btn.dataset.msg; sendBtnEl.disabled = false; closeSidebar(); handleSend(false); }
    });
  });
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

  appendMessage("user", text);
  conversationHistory.push({ role: "user", parts: [{ text }] });

  const typingEl = showTyping();
  try {
    let reply = "", source = "ai", msgId = null;
    
    // Bütün sorguları doğrudan Gemini'ye (RAG sistemine) gönderiyoruz.
    // Frontend SSS yönlendirmesi iptal edildi çünkü anlamsal arama (Semantic Search) çok daha başarılı.
    const data = await callGemini(text);
    reply = data.reply;
    msgId = data.id || Date.now().toString();
    typingEl.remove();
    appendMessage("bot", reply, source, msgId);
    
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
function appendMessage(role, text, source = null, msgId = null, save = true) {
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
  bubble.innerHTML = role === "bot" ? markdownToHtml(text) : escapeHtml(text);
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
    uiChatLog.push({ role, text, source, msgId });
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(uiChatLog));
  }
}

function loadChatHistory() {
  const saved = localStorage.getItem(CHAT_HISTORY_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.length > 0) {
        messagesEl.innerHTML = "";
        uiChatLog = parsed;
        parsed.forEach(msg => {
          appendMessage(msg.role, msg.text, msg.source, msg.msgId, false);
          if (msg.source !== "faq") conversationHistory.push({ role: msg.role === "bot" ? "model" : "user", parts: [{ text: msg.text }] });
        });
      }
    } catch(e) {}
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

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
let isLiveAgentMode = false;

if (typeof io !== 'undefined') {
    window.socket = io(SERVER_URL);
    window.socket.on("chatbot_receive_reply", (data) => {
        // Remove ALL typing indicators to prevent stacking
        document.querySelectorAll(".typing-indicator").forEach(el => el.remove());
        
        // Append human agent's reply
        appendMessage("bot", data.reply);
        
        // Unlock UI for next message
        isLoading = false;
        const sendBtnEl = document.getElementById("sendBtn");
        if (sendBtnEl) sendBtnEl.disabled = false;
    });

    window.socket.on("chatbot_end_session", () => {
        if (!isLiveAgentMode) return;
        isLiveAgentMode = false;
        
        // Remove ALL typing indicators
        document.querySelectorAll(".typing-indicator").forEach(el => el.remove());
        
        // Restore AI Header
        const topbarTitle = document.querySelector(".topbar-name");
        const topbarStatus = document.querySelector(".topbar-status");
        const topbarIcon = document.querySelector(".bot-avatar-sm svg");
        const topbarHeader = document.querySelector(".topbar");
        
        if(topbarTitle) topbarTitle.innerText = "BankBot";
        if(topbarStatus) topbarStatus.innerHTML = "<span class='pulse'></span>Aktif (Kurumsal)";
        if(topbarIcon) topbarIcon.innerHTML = `<rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line>`;
        if(topbarHeader) {
            topbarHeader.style.background = ""; // Restore to default CSS
            topbarHeader.style.borderBottom = "";
        }
        
        appendMessage("bot", "<div style='background:rgba(212, 168, 83, 0.1); color:var(--gold-400); padding:12px; border-radius:8px; text-align:center; border:1px dashed var(--gold-400);'>Müşteri hizmetleri ile görüşmeniz sonlandırılmıştır. Ben BankBot, size nasıl yardımcı olabilirim?</div>");
        
        // Unlock UI
        isLoading = false;
        const sendBtnEl = document.getElementById("sendBtn");
        if (sendBtnEl) sendBtnEl.disabled = false;
    });
}

// Document AI variables
let attachedFileContent = "";
let attachedFileName = "";

window.downloadReport = function(type, param1, param2) {
    try {
        if (typeof html2pdf === 'undefined') {
            alert("PDF motoru yükleniyor, lütfen birazdan tekrar deneyin.");
            return;
        }

        const container = document.createElement("div");
        container.style.padding = "40px";
        container.style.fontFamily = "Arial, sans-serif";
        container.style.color = "#333";
        container.style.background = "#fff";
        
        let amountRowHtml = "";
        if (param2) {
            const formattedAmount = Number(param2).toLocaleString('tr-TR');
            amountRowHtml = `
            <tr>
                <td style="padding: 14px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: bold;">İşlem Tutarı</td>
                <td style="padding: 14px; border: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${formattedAmount} TL</td>
            </tr>`;
        }

        container.innerHTML = `
            <div style="border-bottom: 2px solid #D4A853; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: 1px;">BANKBOT</div>
                    <div style="font-size: 12px; color: #D4A853; font-weight: bold; margin-top: 2px;">KURUMSAL DİJİTAL ASİSTAN</div>
                </div>
                <div style="text-align: right; font-size: 14px; color: #64748b;">
                    Tarih: ${new Date().toLocaleDateString('tr-TR')}<br>
                    Saat: ${new Date().toLocaleTimeString('tr-TR')}
                </div>
            </div>
            <h2 style="text-align: center; margin-bottom: 30px; color: #1e293b; text-transform: uppercase;">${type === 'credit' ? 'Kredi Risk Raporu' : 'İşlem Dekontu'}</h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 15px;">
                <tr>
                    <td style="padding: 14px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: bold; width: 40%;">Belge Tipi</td>
                    <td style="padding: 14px; border: 1px solid #e2e8f0; color: #0f172a;">${type === 'credit' ? 'Risk Skor Raporu' : 'Menkul Kıymet İşlemi (Hisse/Fon)'}</td>
                </tr>
                <tr>
                    <td style="padding: 14px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: bold;">Referans Numarası</td>
                    <td style="padding: 14px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 16px; color: #0f172a;">${param1 || 'TRX-' + Math.floor(Math.random()*100000)}</td>
                </tr>
                ${amountRowHtml}
                <tr>
                    <td style="padding: 14px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: bold;">Müşteri Türü</td>
                    <td style="padding: 14px; border: 1px solid #e2e8f0; color: #0f172a;">Kurumsal (A-Tipi)</td>
                </tr>
                <tr>
                    <td style="padding: 14px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: bold;">İşlem Durumu</td>
                    <td style="padding: 14px; border: 1px solid #e2e8f0; color: #16a34a; font-weight: 800;">BAŞARILI ONAYLANDI</td>
                </tr>
            </table>
            
            <div style="font-size: 12px; color: #64748b; text-align: center; margin-top: 60px; padding-top: 20px; border-top: 1px dashed #cbd5e1;">
                Bu belge dijital ortamda üretilmiştir, ıslak imza gerektirmez.<br>
                <strong>BankBot Kurumsal Sistemleri</strong>
            </div>
        `;

        const opt = {
          margin:       0.5,
          filename:     (type === 'credit' ? 'Kredi_Raporu_' : 'Dekont_') + (param1 || '101') + '.pdf',
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2 },
          jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(container).save();
    } catch (e) {
        console.error("PDF hatası:", e);
        alert("PDF oluşturulamadı: " + e.message);
    }
};

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
const voiceOverlay = document.getElementById("voiceOverlay");
const cancelVoiceBtn = document.getElementById("cancelVoiceBtn");

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
    if (voiceOverlay) voiceOverlay.classList.add("active"); // Animasyonu Göster
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    userInputEl.value = transcript;
    sendBtnEl.disabled = false;
    handleSend(true);
    if (voiceOverlay) voiceOverlay.classList.remove("active"); // Animasyonu Kapat
  };

  recognition.onerror = (e) => {
    console.error("Speech error", e);
    isListening = false;
    micBtn.classList.remove("listening");
    userInputEl.placeholder = "Sorunuzu buraya yazın...";
    if (voiceOverlay) voiceOverlay.classList.remove("active");
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
    if (voiceOverlay) voiceOverlay.classList.remove("active");
  };

  micBtn.addEventListener("click", () => {
    if (isListening) recognition.stop();
    else recognition.start();
  });

  if(cancelVoiceBtn) {
    cancelVoiceBtn.addEventListener("click", () => {
      if (isListening) recognition.stop();
      if (voiceOverlay) voiceOverlay.classList.remove("active");
    });
  }

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
          localStorage.setItem("bankbot_logged_in", "true");
          localStorage.setItem("bankbot_user_name", data.name);
          localStorage.setItem("bankbot_user_id", idVal);
          
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

  // Session Check on Load
  if (localStorage.getItem("bankbot_logged_in") === "true") {
    loginOverlay.style.display = "none";
    const name = localStorage.getItem("bankbot_user_name") || "Müşteri";
    const id = localStorage.getItem("bankbot_user_id") || "";
    if (welcomeMsg) {
      welcomeMsg.querySelector(".bubble").innerHTML = `<p>Hoş geldin <strong>${name}</strong> (Müşteri No: ${id}).<br>Sana özel tanımlanmış kampanya ve limitleri inceledim, nasıl yardımcı olabilirim?</p>`;
    }
    loadChatHistory();
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("bankbot_logged_in");
      localStorage.removeItem("bankbot_user_name");
      localStorage.removeItem("bankbot_user_id");
      clearConversation();
      location.reload();
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

  if (attachBtn) {
    attachBtn.addEventListener("click", () => {
      // Hızlı Belge Yükle Simülasyon Modalı
      const modal = document.createElement("div");
      modal.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:9999;">
          <div style="background:var(--navy-900); padding:24px; border-radius:12px; width:340px; border:1px solid var(--border-md); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h4 style="margin-bottom:8px; color:var(--text-100); text-align:center; font-size:1.2rem;">Akıllı Belge Yükleme</h4>
            <p style="color:var(--text-400); font-size:0.85rem; text-align:center; margin-bottom:20px;">Yapay zeka OCR (Optik Karakter Tanıma) testi için yüklenecek belgeyi seçin:</p>
            
            <button id="simBordroBtn" style="width:100%; padding:14px; margin-bottom:12px; background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.4); border-radius:8px; color:#ef4444; font-weight:600; display:flex; align-items:center; gap:12px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'">
              <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="2"></polyline></svg>
              Maaş Bordrosu (Eylül 2026)
            </button>
            
            <button id="simKimlikBtn" style="width:100%; padding:14px; margin-bottom:16px; background:rgba(59, 130, 246, 0.1); border:1px solid rgba(59, 130, 246, 0.4); border-radius:8px; color:#3b82f6; font-weight:600; display:flex; align-items:center; gap:12px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(59, 130, 246, 0.2)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.1)'">
              <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect><circle cx="8.5" cy="10.5" r="2.5"></circle><path d="M14 16h-11v-1.5c0-2.2 4-3.5 5.5-3.5s5.5 1.3 5.5 3.5V16z"></path><line x1="15" y1="10" x2="21" y2="10"></line><line x1="15" y1="14" x2="21" y2="14"></line></svg>
              Kimlik Kartı Fotokopisi
            </button>
            
            <button id="realUploadBtn" style="width:100%; padding:14px; margin-bottom:16px; background:rgba(255, 255, 255, 0.05); border:1px solid rgba(255, 255, 255, 0.2); border-radius:8px; color:var(--text-100); font-weight:600; display:flex; align-items:center; gap:12px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
              <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              Gerçek Belge Seç (TXT)
            </button>
            
            <button id="simCancelBtn" style="width:100%; padding:12px; background:transparent; border:none; color:var(--text-400); cursor:pointer; font-weight:600;">İptal Et</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById("simCancelBtn").onclick = () => modal.remove();
      
      document.getElementById("realUploadBtn").onclick = () => {
        modal.remove();
        if(fileInput) fileInput.click();
      };
      
      document.getElementById("simBordroBtn").onclick = () => {
        modal.remove();
        appendMessage("user", `
          <div style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(239, 68, 68, 0.05); border-radius:8px; border:1px solid rgba(239, 68, 68, 0.3);">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#ef4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:#ef4444;">Eylul_2026_Maas_Bordrosu.pdf</div>
              <div style="font-size:0.8rem; color:var(--text-400);">Resmi SGK Belgeleri - 215 KB</div>
            </div>
          </div>
        `, null, null, true, true, "Bordro yüklendi");

        const ocrPrompt = "[SİSTEM BİLGİSİ - KULLANICIYA YANSITMA, SADECE BUNA GÖRE CEVAP VER]: Kullanıcı 'Eylül 2026 Maaş Bordrosu' PDF dosyasını yükledi. Sistemdeki OCR (Yapay Zeka Okuyucu) taramasına göre müşterinin resmi belgelenmiş net geliri: 115.000 TL olarak doğrulandı. Bu belgeyi okuduğunu belirt. Ve bankacılık dilinde çok profesyonelce şöyle de: 'Bordronuz başarıyla analiz edildi. Belgelenen 115.000 TL net geliriniz göz önüne alındığında, size anında kullanabileceğiniz 1.250.000 TL Ön Onaylı İhtiyaç Kredisi veya 4.500.000 TL Konut Kredisi sağlayabiliriz. Başvurmak ister misiniz?'";
        processGeminiRequest(ocrPrompt, "Maaş bordromu yükledim, kredi limitim nedir?");
      };

      document.getElementById("simKimlikBtn").onclick = () => {
        modal.remove();
        appendMessage("user", `
          <div style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(59, 130, 246, 0.05); border-radius:8px; border:1px solid rgba(59, 130, 246, 0.3);">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect><circle cx="8.5" cy="10.5" r="2.5"></circle><path d="M14 16h-11v-1.5c0-2.2 4-3.5 5.5-3.5s5.5 1.3 5.5 3.5V16z"></path><line x1="15" y1="10" x2="21" y2="10"></line><line x1="15" y1="14" x2="21" y2="14"></line></svg>
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:#3b82f6;">TC_Kimlik_OnYuz.jpg</div>
              <div style="font-size:0.8rem; color:var(--text-400);">Görsel / Hologram Taraması - 1.2 MB</div>
            </div>
          </div>
        `, null, null, true, true, "Kimlik yüklendi");
        
        const ocrPrompt = "[SİSTEM BİLGİSİ]: Kullanıcı T.C. Kimlik Kartı görseli yükledi. YZ analiziyle MERNİS sisteminden isim, soyisim ve T.C. doğrulandı. Yüz tanıma ve hologram güvenlik testleri başarılı (Skor: %99.8). Lütfen kimliğin başarıyla doğrulandığını ve yüksek güvenlikli işlemler için kilitlerin açıldığını, EFT limitinin 5.000.000 TL'ye yükseltildiğini resmi ve nazik bir bankacı diliyle bildir.";
        processGeminiRequest(ocrPrompt, "Kimliğimi doğrulattım, limitimi artırır mısınız?");
      };
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
      
      exportBtnEl.innerText = "PDF Hazırlanıyor...";
      
      // Create a hidden container for PDF generation
      const pdfContainer = document.createElement("div");
      pdfContainer.style.padding = "40px";
      pdfContainer.style.fontFamily = "Arial, sans-serif";
      pdfContainer.style.color = "#333";
      
      let html = `
        <div style="border-bottom: 2px solid #D4A853; padding-bottom: 15px; margin-bottom: 25px; display: flex; align-items: center; gap: 15px;">
            <div style="background: #081428; padding: 10px; border-radius: 8px;">
                <svg viewBox="0 0 28 28" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="12" width="24" height="2" fill="#D4A853"/>
                    <rect x="4" y="14" width="2" height="10" fill="#D4A853" opacity=".7"/>
                    <rect x="8" y="14" width="2" height="10" fill="#D4A853" opacity=".7"/>
                    <rect x="13" y="14" width="2" height="10" fill="#D4A853" opacity=".7"/>
                    <rect x="18" y="14" width="2" height="10" fill="#D4A853" opacity=".7"/>
                    <rect x="22" y="14" width="2" height="10" fill="#D4A853" opacity=".7"/>
                    <rect x="2" y="24" width="24" height="2" fill="#D4A853"/>
                    <polygon points="14,2 2,10 26,10" fill="#D4A853"/>
                </svg>
            </div>
            <div>
                <h2 style="margin: 0; color: #081428; font-size: 24px;">BANKBOT A.Ş.</h2>
                <div style="color: #666; font-size: 12px; margin-top: 4px;">Resmi Müşteri İletişim Dekontu</div>
            </div>
            <div style="margin-left: auto; text-align: right; font-size: 11px; color: #777;">
                Tarih: ${new Date().toLocaleString("tr-TR")}<br>
                Müşteri ID: ${localStorage.getItem('bankbot_user_id') || 'GUEST-123'}
            </div>
        </div>
        <div style="font-size: 13px; line-height: 1.6;">
      `;
      
      conversationHistory.forEach(msg => {
        let isUser = msg.role === "user";
        let sender = isUser ? (localStorage.getItem("bankbot_user_name") || "Müşteri") : "BankBot (Yapay Zeka)";
        let bgColor = isUser ? "#f4f4f5" : "#ebf5ff";
        let borderColor = isUser ? "#e4e4e7" : "#bfdbfe";
        let titleColor = isUser ? "#52525b" : "#1d4ed8";
        
        let text = msg.parts[0].text;
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/\n/g, '<br>');
        
        html += `
          <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 12px 15px; margin-bottom: 12px; border-radius: 8px;">
              <strong style="color: ${titleColor}; display: block; margin-bottom: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">${sender}</strong>
              <div>${text}</div>
          </div>
        `;
      });
      
      html += `
        </div>
        <div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #eee; font-size: 10px; color: #999; text-align: center;">
            Bu belge yapay zeka destekli BankBot sistemi tarafından otomatik olarak üretilmiştir. <br>
            Kayıt Tarihi: ${new Date().toLocaleString("tr-TR")}
        </div>
      `;
      
      pdfContainer.innerHTML = html;
      
      const opt = {
          margin:       0.5,
          filename:     'BankBot_Resmi_Dekont.pdf',
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2 },
          jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
      };
      
      if (typeof html2pdf === "undefined") {
          alert("PDF kütüphanesi yüklenemedi. Lütfen sayfayı yenileyin.");
          exportBtnEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>Sohbeti Kaydet`;
          return;
      }
      
      html2pdf().set(opt).from(pdfContainer).save().then(() => {
          exportBtnEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>Sohbeti Kaydet`;
      });
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
      body: JSON.stringify({ message: messageText, history: conversationHistory, isLiveAgent: isLiveAgentMode })
    });
    if (!res.ok) {
      let errMsg = "Sunucu hatası";
      try { const errData = await res.json(); if(errData.error) errMsg = errData.error; } catch(e){}
      throw new Error(errMsg);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (data.fraudLock) {
        return { fraudLock: true, reply: data.reply, id: null };
    }
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

  // Canlı Destek Tespiti
  const lowerText = text.toLowerCase();
  if (!isLiveAgentMode && (lowerText.includes("müşteri temsilcisi") || lowerText.includes("insana bağlan") || lowerText.includes("gerçek insan"))) {
      isLiveAgentMode = true;
      
      const typingEl = showTyping();
      setTimeout(() => {
          typingEl.remove();
          
          // Header Arayüzünü İnsan Temsilciye Çevir
          const topbarTitle = document.querySelector(".topbar-name");
          const topbarStatus = document.querySelector(".topbar-status");
          const topbarIcon = document.querySelector(".bot-avatar-sm svg");
          const topbarHeader = document.querySelector(".topbar");
          
          if(topbarTitle) topbarTitle.innerText = "Ali Yılmaz";
          if(topbarStatus) topbarStatus.innerHTML = "<span class='pulse' style='background:#22c55e'></span>Sizinle ilgileniyor";
          if(topbarIcon) topbarIcon.innerHTML = `<circle cx="9" cy="6" r="4" stroke="#22c55e" stroke-width="1.5"/><path d="M3 16c0-3.3 2.7-6 6-6h0c3.3 0 6 2.7 6 6" stroke="#22c55e" stroke-width="1.5"/>`;
          if(topbarHeader) {
              topbarHeader.style.background = "var(--navy-800)";
              topbarHeader.style.borderBottom = "2px solid #22c55e";
          }
          
          appendMessage("bot", "<div style='background:rgba(34, 197, 94, 0.1); color:#22c55e; padding:12px; border-radius:8px; text-align:center; border:1px dashed #22c55e;'>Sizi müşteri temsilcisine aktardım. Ali Bey şu an sohbete bağlandı. Lütfen sorunuzu yazın.</div>");
          
          isLoading = false;
          sendBtnEl.disabled = false;
          // IMPORTANT: Do NOT send the trigger keyword to the socket. Wait for their next real message.
      }, 1500);
      return;
  }

  processGeminiRequest(apiMsg, text);
}

async function processGeminiRequest(apiMsg, text) {
  const typingEl = showTyping();
  
  if (isLiveAgentMode) {
      // Gerçek insan modunda AI'yi tamamen bypass et ve mesajı Dashboard'a yolla
      if (window.socket) {
          window.socket.emit("live_agent_user_msg", { message: text });
      }
      return; // Typing simülasyonu dashboard'dan cevap gelene kadar ekranda kalacak
  }
  
  try {
    let reply = "", source = "ai", msgId = null;
    
    // Normal AI Modu
    const data = await callGemini(apiMsg);
    
    // Siber Güvenlik Kilidi Kontrolü
    if (data.fraudLock) {
        typingEl.remove();
        
        // Arayüzü Kalıcı Olarak Kilitle
        userInputEl.disabled = true;
        sendBtnEl.disabled = true;
        if(micBtn) micBtn.style.display = "none";
        if(attachBtn) attachBtn.style.display = "none";
        
        const lockHtml = `
            <div style="background: rgba(220, 38, 38, 0.15); border: 2px solid #ef4444; padding: 20px; border-radius: 12px; text-align: center; color: #ef4444; margin-top: 20px;">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 12px;">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3 style="margin: 0 0 10px 0; font-size: 1.2rem;">HESAP BLOKE EDİLDİ</h3>
                <p style="margin: 0; color: #fca5a5; font-size: 0.9rem;">${data.reply}</p>
                <p style="margin-top: 15px; font-size: 0.8rem; color: #94a3b8;">Hata Kodu: ERR_FR_99</p>
            </div>
        `;
        appendMessage("bot", lockHtml, null, null, true, true);
        return; // İşlemi tamamen sonlandır
    }
    
    reply = data.reply;
    msgId = data.id || Date.now().toString();

    // Kredi hesaplama widget'ı tespiti
    if (/(kredi.*hesapla|kredi.*çek|[iİıI]htiya[çc].*kredi|kredi.*ne kadar)/i.test(text)) {
      const widgetHtml = `
<div style="background:var(--navy-900); padding:16px; border-radius:12px; border:1px solid var(--gold-400); margin-top:16px; font-family:var(--font-sans);">
  <h4 style="margin-bottom:16px; color:var(--gold-400); font-weight:600; display:flex; align-items:center; gap:8px;">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
    Akıllı Kredi Hesaplama
  </h4>
  <label style="font-size:0.85rem; color:var(--text-300); margin-bottom:8px; display:block;">Kredi Tutarı (TL)</label>
  <input class="loan-amount-input" type="range" min="10000" max="500000" step="5000" value="50000" 
         oninput="this.nextElementSibling.innerText = new Intl.NumberFormat('tr-TR').format(this.value) + ' TL'" 
         style="width:100%; margin-bottom:8px; accent-color:var(--gold-400);">
  <div class="loan-amount-text" style="text-align:right; font-weight:bold; margin-top:-4px; margin-bottom:16px; color:var(--text-100); font-size:1.1rem;">50.000 TL</div>
  <label style="font-size:0.85rem; color:var(--text-300); margin-bottom:8px; display:block;">Vade Seçeneği</label>
  <select class="loan-months-select" style="width:100%; padding:10px; background:var(--navy-950); color:var(--text-100); border:1px solid var(--border-md); border-radius:6px; margin-bottom:20px; font-family:inherit; outline:none;">
    <option value="12">12 Ay Vade (%3.14 Faiz)</option>
    <option value="24">24 Ay Vade (%3.14 Faiz)</option>
    <option value="36">36 Ay Vade (%3.14 Faiz)</option>
    <option value="48">48 Ay Vade (%3.14 Faiz)</option>
  </select>
  <button style="width:100%; padding:12px; background:var(--gold-400); color:var(--navy-950); border:none; border-radius:6px; font-weight:600; font-size:0.95rem; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 12px rgba(212,168,83,0.2); margin-bottom: 8px;" 
          onclick="
            const parent = this.parentElement;
            const P = parseFloat(parent.querySelector('.loan-amount-input').value);
            const n = parseFloat(parent.querySelector('.loan-months-select').value);
            const r = 0.0314;
            const pmt = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            this.innerText='Hesaplanıyor...';
            setTimeout(() => {
              this.innerHTML='Aylık Taksit: <b>' + new Intl.NumberFormat('tr-TR').format(Math.round(pmt)) + ' TL</b>';
            }, 600);
          ">Taksit Hesapla</button>
  <button style="width:100%; padding:12px; background:transparent; color:var(--gold-400); border:1px solid var(--gold-400); border-radius:6px; font-weight:600; font-size:0.95rem; cursor:pointer; transition:all 0.2s;" 
          onclick="
            this.innerHTML='Başvurunuz Alındı ✅';
            this.style.background='var(--gold-400)';
            this.style.color='var(--navy-950)';
          ">Hemen Başvur</button>
</div>`;
      reply += widgetHtml;
    }

    // Hızlı Para Transferi ve Anti-Fraud Güvenlik Duvarı tespiti
    if (/(para.*gönder|havale|eft|'e.*gönder|'a.*gönder)/i.test(text)) {
      const nameMatch = text.match(/([a-zA-ZğüşıöçĞÜŞİÖÇ]+)(?:'ye|'ya|'e|'a)\s+(?:para|havale|eft)/i) || text.match(/(?:para.*gönder.*)([a-zA-ZğüşıöçĞÜŞİÖÇ]+)/i);
      let targetName = nameMatch ? nameMatch[1].trim() : "Kayıtlı Kişi";
      targetName = targetName.charAt(0).toUpperCase() + targetName.slice(1).toLowerCase();
      const initial = targetName.charAt(0);
      
      // Yüksek tutar algılaması (Sahtekarlık Önleme Simülasyonu)
      const isHighRisk = /(500\.000|500000|500 bin|yüz bin|100\.000|büyük|yüklü)/i.test(text);

      if (isHighRisk) {
          const fraudHtml = `
<div style="background:var(--navy-900); padding:20px; border-radius:12px; border:2px solid #ef4444; margin-top:16px; font-family:var(--font-sans); box-shadow: 0 4px 20px rgba(239, 68, 68, 0.2); animation: pulse-red 2s infinite;">
  <h4 style="margin-bottom:12px; color:#ef4444; font-weight:800; display:flex; align-items:center; gap:10px; font-size:1.1rem; text-transform:uppercase; letter-spacing:0.5px;">
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    GÜVENLİK DUVARI: RİSKLİ İŞLEM!
  </h4>
  
  <p style="color:var(--text-200); font-size:0.9rem; line-height:1.5; margin-bottom:16px;">
    Sistemlerimiz, <strong>${targetName}</strong> adlı alıcıya yapılmak istenen bu işlemi "Sıra Dışı İşlem Hacmi (Anti-Fraud)" olarak sınıflandırmıştır. Güvenliğiniz için işleminiz geçici olarak durduruldu.
  </p>

  <div style="background:rgba(239, 68, 68, 0.1); padding:12px; border-radius:8px; border:1px dashed rgba(239, 68, 68, 0.3); margin-bottom:16px;">
    <div style="font-size:0.8rem; color:var(--text-300); margin-bottom:6px;">Lütfen telefonunuza gönderilen 6 haneli güvenlik kodunu girin:</div>
    <div style="display:flex; gap:8px; justify-content:center;">
        <input type="text" maxlength="1" style="width:40px; height:45px; text-align:center; font-size:1.2rem; font-weight:bold; background:var(--navy-950); border:1px solid #ef4444; color:white; border-radius:6px; outline:none;" onkeyup="if(this.value.length===1) this.nextElementSibling?.focus()">
        <input type="text" maxlength="1" style="width:40px; height:45px; text-align:center; font-size:1.2rem; font-weight:bold; background:var(--navy-950); border:1px solid #ef4444; color:white; border-radius:6px; outline:none;" onkeyup="if(this.value.length===1) this.nextElementSibling?.focus()">
        <input type="text" maxlength="1" style="width:40px; height:45px; text-align:center; font-size:1.2rem; font-weight:bold; background:var(--navy-950); border:1px solid #ef4444; color:white; border-radius:6px; outline:none;" onkeyup="if(this.value.length===1) this.nextElementSibling?.focus()">
        <input type="text" maxlength="1" style="width:40px; height:45px; text-align:center; font-size:1.2rem; font-weight:bold; background:var(--navy-950); border:1px solid #ef4444; color:white; border-radius:6px; outline:none;" onkeyup="if(this.value.length===1) this.nextElementSibling?.focus()">
        <input type="text" maxlength="1" style="width:40px; height:45px; text-align:center; font-size:1.2rem; font-weight:bold; background:var(--navy-950); border:1px solid #ef4444; color:white; border-radius:6px; outline:none;" onkeyup="if(this.value.length===1) this.nextElementSibling?.focus()">
        <input type="text" maxlength="1" style="width:40px; height:45px; text-align:center; font-size:1.2rem; font-weight:bold; background:var(--navy-950); border:1px solid #ef4444; color:white; border-radius:6px; outline:none;">
    </div>
  </div>

  <button style="width:100%; padding:12px; background:#ef4444; color:white; border:none; border-radius:6px; font-weight:bold; font-size:1rem; cursor:pointer; transition:all 0.2s;" 
          onclick="
            this.innerText='Doğrulanıyor...';
            this.style.background='var(--navy-800)';
            setTimeout(() => {
              this.innerHTML='KİMLİK DOĞRULANDI ✅ İşlem Devam Ediyor...';
              this.style.background='#22c55e';
              setTimeout(() => { this.closest('div').style.display = 'none'; }, 2000);
            }, 1500);
          ">Şifreyi Doğrula</button>
</div>
<style>
@keyframes pulse-red {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}
</style>`;
          reply += fraudHtml;
      } else {
          // Normal Havale Widget
          const transferHtml = `
<div class="transfer-widget" style="background:var(--navy-900); padding:16px; border-radius:12px; border:1px solid #3b82f6; margin-top:16px; font-family:var(--font-sans);">
  <h4 style="margin-bottom:16px; color:#3b82f6; font-weight:600; display:flex; align-items:center; gap:8px;">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
    Hızlı Para Transferi (Havale)
  </h4>
  
  <div style="display:flex; align-items:center; gap:12px; background:var(--navy-950); padding:12px; border-radius:8px; margin-bottom:16px; border:1px solid var(--border-md);">
    <div style="width:40px; height:40px; border-radius:50%; background:#3b82f6; color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px;">${initial}</div>
    <div>
        <div style="color:var(--text-100); font-weight:600;">${targetName}</div>
        <div style="color:var(--text-300); font-size:0.8rem; font-family:monospace;">TR12 0006 1000 8593 1111 2222</div>
    </div>
  </div>

  <label style="font-size:0.85rem; color:var(--text-300); margin-bottom:8px; display:block;">Gönderilecek Tutar (TL)</label>
  <div style="position:relative; margin-bottom:16px;">
    <input class="transfer-amount-input" type="number" placeholder="0.00" style="width:100%; padding:12px 12px 12px 35px; background:var(--navy-950); color:var(--text-100); border:1px solid var(--border-md); border-radius:6px; font-family:inherit; outline:none; font-size:1.1rem; font-weight:bold;">
    <span style="position:absolute; left:12px; top:12px; color:var(--text-400); font-size:1.1rem; font-weight:bold;">₺</span>
  </div>
  
  <button style="width:100%; padding:12px; background:#3b82f6; color:white; border:none; border-radius:6px; font-weight:600; font-size:0.95rem; cursor:pointer; transition:all 0.2s;" 
          onclick="
            const widget = this.closest('.transfer-widget') || document;
            const input = widget.querySelector('.transfer-amount-input').value;
            if(!input || input <= 0) { alert('Lütfen geçerli bir tutar girin.'); return; }
            this.innerText='Güvenlik Doğrulanıyor...';
            this.style.background='var(--navy-800)';
            setTimeout(() => {
              this.innerHTML='Transfer Başarılı ✅';
              this.style.background='#22c55e';
              setTimeout(() => { window.downloadReport('dekont', 'TRX-' + Math.floor(Math.random()*900000), input); }, 800);
            }, 1200);
          ">Transferi Onayla</button>
</div>`;
          reply += transferHtml;
      }
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

    // Akıllı Birikim / Hedef Widget'ı
    if (/(hedef|birikim|kumbar|araba|ev almak|biriktir)/i.test(text)) {
      const goalName = text.match(/araba/i) ? "Yeni Araç Peşinatı" : (text.match(/ev/i) ? "Yeni Ev Peşinatı" : "Akıllı Birikim Hedefi");
      const targetAmount = 500000;
      const currentAmount = 145000;
      const percent = Math.round((currentAmount / targetAmount) * 100);
      
      const savingsHtml = `
<div style="background:var(--navy-900); padding:16px; border-radius:12px; border:1px solid #a855f7; margin-top:16px; font-family:var(--font-sans);">
  <h4 style="margin-bottom:16px; color:#a855f7; font-weight:600; display:flex; align-items:center; gap:8px;">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
    Akıllı Kumbara (Hedef Takibi)
  </h4>
  <div style="margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center;">
    <strong style="color:var(--text-100); font-size:1rem;">${goalName}</strong>
    <span style="color:#a855f7; font-weight:bold;">%${percent}</span>
  </div>
  
  <div style="width:100%; background:var(--navy-800); border-radius:10px; height:12px; margin-bottom:12px; overflow:hidden;">
    <div style="height:100%; width:${percent}%; background:linear-gradient(90deg, #9333ea, #a855f7); border-radius:10px; transition:width 1.5s ease-in-out;"></div>
  </div>
  
  <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-300); margin-bottom:16px;">
    <div>Biriken: <strong style="color:var(--text-100);">${new Intl.NumberFormat('tr-TR').format(currentAmount)} TL</strong></div>
    <div>Hedef: <strong style="color:var(--text-100);">${new Intl.NumberFormat('tr-TR').format(targetAmount)} TL</strong></div>
  </div>
  
  <div style="background:rgba(168, 85, 247, 0.1); padding:12px; border-radius:8px; border:1px dashed rgba(168, 85, 247, 0.3); font-size:0.85rem; color:var(--text-300); line-height:1.5;">
    💡 <strong style="color:#a855f7;">YZ Önerisi:</strong> Aylık 15.000 TL düzenli yatırımla ve mevcut "Teknoloji Fonu" sepetinizle hedefinize <strong>14 ay erken</strong> ulaşabilirsiniz!
  </div>
  
  <button style="width:100%; padding:10px; margin-top:16px; background:var(--navy-800); color:#a855f7; border:1px solid rgba(168,85,247,0.5); border-radius:6px; font-weight:600; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(168,85,247,0.1)'" onmouseout="this.style.background='var(--navy-800)'" onclick="this.innerHTML='Aylık Talimat Oluşturuldu ✅'; this.style.color='#22c55e'; this.style.borderColor='#22c55e';">Otomatik Yatırım Talimatı Ver</button>
</div>`;
      reply += savingsHtml;
    }
    // Yatırım Portföyü Widget'ı
    if (/(portföy|yatırım|varlık|durum)/i.test(text)) {
      const chartId = 'portfolioChart_' + Date.now();
      const totalPortfolioValue = new Intl.NumberFormat('tr-TR').format(124500) + " TL";
      const portfolioWidgetHtml = `
<div style="background:var(--navy-900); padding:16px; border-radius:12px; border:1px solid #eab308; margin-top:16px; font-family:var(--font-sans); box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
  <h4 style="margin-bottom:16px; color:#eab308; font-weight:600; display:flex; align-items:center; justify-content:space-between;">
    <div style="display:flex; align-items:center; gap:8px;">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
      Akıllı Portföyüm
    </div>
    <span style="font-size:0.75rem; background:rgba(234, 179, 8, 0.1); color:#eab308; padding:4px 8px; border-radius:12px; border:1px solid rgba(234, 179, 8, 0.3);">Anlık Veri</span>
  </h4>
  
  <div style="text-align:center; margin-bottom:16px;">
      <div style="font-size:0.85rem; color:var(--text-400); margin-bottom:4px;">Toplam Varlık Değeri</div>
      <div style="font-size:1.8rem; font-weight:800; color:var(--text-100);">${totalPortfolioValue}</div>
      <div style="font-size:0.85rem; color:#22c55e; display:flex; align-items:center; justify-content:center; gap:4px; margin-top:4px;">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
        +12.4% (Son 1 Ay)
      </div>
  </div>

  <div style="position:relative; width: 100%; height: 220px; margin-bottom: 20px;">
      <canvas id="${chartId}"></canvas>
  </div>
  
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      <button style="padding:12px 10px; background:#eab308; color:var(--navy-950); border:none; border-radius:6px; font-weight:600; font-size:0.9rem; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'" onclick="alert('Alım Satım menüsüne yönlendiriliyorsunuz...')">Hisse Al/Sat</button>
      <button style="padding:12px 10px; background:var(--navy-800); color:var(--text-100); border:1px solid var(--border-md); border-radius:6px; font-weight:600; font-size:0.9rem; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='var(--navy-700)'" onmouseout="this.style.background='var(--navy-800)'" onclick="window.downloadReport('dekont', 'PORTFOY-' + Math.floor(Math.random()*900000), 124500);">Rapor İndir</button>
  </div>
</div>`;
      reply += portfolioWidgetHtml;

      // Çizimi DOM render olduktan sonra yap
      setTimeout(() => {
        const ctx = document.getElementById(chartId);
        if (ctx) {
          new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
              labels: ['Hisse Senedi', 'Altın (Gram)', 'Döviz (USD)', 'Yatırım Fonu'],
              datasets: [{
                data: [45, 25, 20, 10],
                backgroundColor: ['#eab308', '#f59e0b', '#3b82f6', '#10b981'],
                borderWidth: 0,
                hoverOffset: 12
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '75%',
              plugins: {
                legend: { position: 'bottom', labels: { color: '#a1a1aa', font: { family: "'Inter', sans-serif", size: 11 }, padding: 15, usePointStyle: true, pointStyle: 'circle' } },
                tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', titleColor: '#fff', bodyColor: '#fff', borderColor: '#334155', borderWidth: 1 }
              },
              animation: { animateScale: true, animateRotate: true, duration: 1500, easing: 'easeOutQuart' }
            }
          });
        }
      }, 150);
    }
    // Kripto Para / Borsa Canlı Widget'ı
    if (/(bitcoin|kripto|btc|ethereum|eth|coin)/i.test(text)) {
      const widgetId = 'cryptoWidget-' + Date.now();
      const cryptoWidgetHtml = `
<div id="${widgetId}" style="background:linear-gradient(135deg, #1e293b, #0f172a); padding:16px; border-radius:12px; border:1px solid #3b82f6; margin-top:16px; font-family:var(--font-sans); box-shadow: 0 4px 20px rgba(59, 130, 246, 0.2); position:relative; overflow:hidden;">
  <div style="position:absolute; top:0; right:0; width:100px; height:100px; background:radial-gradient(circle, rgba(59,130,246,0.2) 0%, rgba(0,0,0,0) 70%); border-radius:50%; transform:translate(30%, -30%);"></div>
  
  <h4 style="margin-bottom:12px; color:#60a5fa; font-weight:600; display:flex; align-items:center; justify-content:space-between; position:relative; z-index:2;">
    <div style="display:flex; align-items:center; gap:8px;">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
      Canlı Kripto Piyasası
    </div>
    <div style="display:flex; align-items:center; gap:4px; font-size:0.75rem; background:rgba(34, 197, 94, 0.1); color:#22c55e; padding:4px 8px; border-radius:12px; border:1px solid rgba(34, 197, 94, 0.3);">
      <span class="pulse-dot" style="width:6px; height:6px; background:#22c55e; border-radius:50%; display:inline-block; animation: pulse 1.5s infinite;"></span> CANLI
    </div>
  </h4>
  
  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(15, 23, 42, 0.6); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:12px; position:relative; z-index:2; transition:transform 0.2s; cursor:default;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
    <div style="display:flex; align-items:center; gap:10px;">
      <img src="https://cryptologos.cc/logos/bitcoin-btc-logo.png" style="width:32px; height:32px;" alt="BTC">
      <div>
        <div style="font-weight:700; color:#f8fafc; font-size:1.1rem;">Bitcoin</div>
        <div style="color:#94a3b8; font-size:0.8rem;">BTC/USDT</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div id="${widgetId}-btc-price" style="font-size:1.3rem; font-weight:800; color:#f1f5f9;">Yükleniyor...</div>
    </div>
  </div>

  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(15, 23, 42, 0.6); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); position:relative; z-index:2; transition:transform 0.2s; cursor:default;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
    <div style="display:flex; align-items:center; gap:10px;">
      <img src="https://cryptologos.cc/logos/ethereum-eth-logo.png" style="width:32px; height:32px;" alt="ETH">
      <div>
        <div style="font-weight:700; color:#f8fafc; font-size:1.1rem;">Ethereum</div>
        <div style="color:#94a3b8; font-size:0.8rem;">ETH/USDT</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div id="${widgetId}-eth-price" style="font-size:1.3rem; font-weight:800; color:#f1f5f9;">Yükleniyor...</div>
    </div>
  </div>
</div>
<style>
@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}
</style>`;
      reply += cryptoWidgetHtml;

      // API'den canlı veri çek (Backend Proxy üzerinden)
      setTimeout(async () => {
        try {
          const res = await fetch('http://localhost:4000/api/crypto');
          const data = await res.json();
          
          const btcElem = document.getElementById(widgetId + '-btc-price');
          if(btcElem) btcElem.innerText = "$" + parseFloat(data.btc).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

          const ethElem = document.getElementById(widgetId + '-eth-price');
          if(ethElem) ethElem.innerText = "$" + parseFloat(data.eth).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        } catch (e) {
          console.error("Crypto API error:", e);
          const btcElem = document.getElementById(widgetId + '-btc-price');
          if(btcElem) btcElem.innerText = "Bağlantı Hatası";
          const ethElem = document.getElementById(widgetId + '-eth-price');
          if(ethElem) ethElem.innerText = "Bağlantı Hatası";
        }
      }, 150);
    }

    // Finansal Sağlık Skoru Widget'ı
    if (/(finansal sağlık|kredi notu|kredi skoru|sağlık skor)/i.test(text)) {
      const gaugeId = 'healthGauge-' + Date.now();
      const score = Math.floor(Math.random() * (1900 - 1300) + 1300); // 1300 ile 1900 arası skor
      
      let statusText = "Riskli";
      let statusColor = "#ef4444";
      if(score > 1500) { statusText = "İyi"; statusColor = "#f59e0b"; }
      if(score > 1700) { statusText = "Çok İyi"; statusColor = "#22c55e"; }

      const gaugeWidgetHtml = `
<div style="background:linear-gradient(135deg, #1e293b, #0f172a); padding:16px; border-radius:12px; border:1px solid #6366f1; margin-top:16px; font-family:var(--font-sans); box-shadow: 0 4px 20px rgba(99, 102, 241, 0.2);">
  <h4 style="margin-bottom:8px; color:#818cf8; font-weight:600; display:flex; align-items:center; gap:8px;">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
    Finansal Sağlık Skorunuz
  </h4>
  <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:16px;">Yapay zeka, bankacılık geçmişinizi ve harcama alışkanlıklarınızı analiz etti.</p>
  
  <div style="position:relative; width: 100%; height: 160px; display:flex; justify-content:center;">
      <canvas id="${gaugeId}"></canvas>
      <div style="position:absolute; top:75%; left:50%; transform:translate(-50%, -50%); text-align:center;">
          <div style="font-size:2.5rem; font-weight:900; color:#f8fafc; line-height:1;">${score}</div>
          <div style="font-size:1rem; font-weight:700; color:${statusColor}; margin-top:4px;">${statusText}</div>
      </div>
  </div>
  
  <div style="background:rgba(99, 102, 241, 0.1); border:1px solid rgba(99, 102, 241, 0.3); color:#818cf8; padding:12px; border-radius:8px; font-size:0.85rem; margin-top:16px;">
      <strong style="display:block; margin-bottom:4px; color:#a5b4fc;">YZ Tavsiyesi:</strong> 
      Kredi kartı asgari ödemelerinizi düzenli yaptığınız için skorunuz yükseliş trendinde. Gelecek ay harcamalarınızı %10 kısarsanız skorunuz "Mükemmel" seviyesine çıkabilir!
  </div>
</div>`;
      reply += gaugeWidgetHtml;

      setTimeout(() => {
        const ctx = document.getElementById(gaugeId);
        if (ctx) {
          new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
              labels: ['Riskli (0-1500)', 'İyi (1501-1700)', 'Çok İyi (1701-1900)'],
              datasets: [{
                data: [1500, 200, 200], // Gauge dilimleri
                backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
                borderWidth: 0,
                hoverOffset: 4
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              rotation: -90, // Yarım daire görünümü için
              circumference: 180, // Sadece yarım daire
              cutout: '80%',
              plugins: {
                legend: { display: false },
                tooltip: { 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    titleColor: '#fff', 
                    bodyColor: '#fff', 
                    borderColor: '#334155', 
                    borderWidth: 1 
                }
              },
              animation: { animateScale: true, animateRotate: true, duration: 2000, easing: 'easeOutQuart' }
            }
          });
        }
      }, 150);
    }

    // Harcama Analizi Widget'ı
    if (text.toLowerCase().includes("harcama") || text.toLowerCase().includes("gider") || text.toLowerCase().includes("analiz")) {
      const chartId = 'expenseChart_' + Date.now();
      const expenseWidgetHtml = `
<div style="background:var(--navy-900); padding:16px; border-radius:12px; border:1px solid var(--gold-400); margin-top:16px; font-family:var(--font-sans);">
<h4 style="margin-bottom:16px; color:var(--gold-400); font-weight:600; display:flex; align-items:center; gap:8px;">
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
Aylık Harcama Analizi
</h4>
<div style="position:relative; width: 100%; height: 200px; margin-bottom: 12px;">
    <canvas id="${chartId}"></canvas>
</div>
<div style="background:rgba(34, 197, 94, 0.1); border:1px solid #22c55e; color:#22c55e; padding:10px; border-radius:6px; text-align:center; font-size:0.85rem; margin-bottom:12px;">
    <strong style="display:block; margin-bottom:4px;">TAVSİYE</strong>
    Market harcamalarınız bu ay %15 artış göstermiştir.
</div>
</div>`;
      reply += expenseWidgetHtml;

      // Çizimi setTimeout ile DOM'a eklendikten sonra yap
      setTimeout(() => {
        const ctx = document.getElementById(chartId);
        if (ctx) {
          new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
              labels: ['Market', 'Giyim', 'Restoran', 'Fatura', 'Akaryakıt'],
              datasets: [{
                data: [4500, 2300, 1800, 1200, 2000],
                backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
                borderWidth: 0
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '70%',
              plugins: {
                legend: { position: 'right', labels: { color: '#a1a1aa', font: { family: "'Inter', sans-serif", size: 11 }, boxWidth: 10 } }
              }
            }
          });
        }
      }, 100);
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
  bubble.innerHTML = isRawHtml ? text : (role === "bot" ? markdownToHtml(text) : escapeHtml(text));
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

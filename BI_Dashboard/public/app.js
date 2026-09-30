document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        initDashboard(data);
    } catch (error) {
        console.error("Data load failed:", error);
    }
});

Chart.defaults.color = '#a1a1aa';
Chart.defaults.font.family = "'Inter', sans-serif";

function formatCurrency(val) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);
}

function initDashboard(data) {
    // KPI Math
    const totalCustomers = data.length;
    const totalBalance = data.reduce((sum, curr) => sum + curr.balance, 0);
    const avgCredit = data.reduce((sum, curr) => sum + curr.creditScore, 0) / totalCustomers;
    
    const highRiskCount = data.filter(c => c.churnRisk === 'Yüksek').length;
    const highRiskPercent = ((highRiskCount / totalCustomers) * 100).toFixed(1);

    // Update KPI Elements
    document.getElementById('kpi-total-customers').innerText = new Intl.NumberFormat('en-US').format(totalCustomers);
    document.getElementById('kpi-total-balance').innerText = '₺' + (totalBalance / 1000000).toFixed(2) + ' M';
    document.getElementById('kpi-avg-credit').innerText = Math.round(avgCredit);
    document.getElementById('kpi-churn-risk').innerText = highRiskPercent + '%';

    // Chart 1: Live Sentiment Trend (Line)
    const ctxSentiment = document.getElementById('sentimentChart').getContext('2d');
    let sentimentChart = new Chart(ctxSentiment, {
        type: 'line',
        data: { 
            labels: [], 
            datasets: [{
                label: 'Müşteri Memnuniyeti Skoru (AI)',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#10b981',
                pointRadius: 4
            }] 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    grid: { color: '#27272a' },
                    min: 0, max: 100,
                    ticks: { color: '#a1a1aa' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#a1a1aa' }
                }
            }
        }
    });

    // API'den geçmiş sentiment verisini çek
    fetch('http://localhost:4000/api/analytics/sentiment', {
        headers: { 'x-admin-key': 'super_secret_admin_key_2026' }
    })
    .then(r => r.json())
    .then(res => {
        if(res.success && res.data) {
            sentimentChart.data.labels = res.data.map(d => d.time);
            sentimentChart.data.datasets[0].data = res.data.map(d => d.score);
            sentimentChart.update();
        }
    })
    .catch(err => console.error("Sentiment API hatası:", err));

    window.sentimentChart = sentimentChart;

    // Chart 2: Canlı Portföy Dağılımı (Doughnut)
    const ctxPortfolio = document.getElementById('portfolioChart').getContext('2d');
    let portfolioChart = new Chart(ctxPortfolio, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'], // Yeşil, Mavi, Sarı, Mor
                borderWidth: 2,
                borderColor: '#121212'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, color: '#a1a1aa' } }
            }
        }
    });

    // API'den başlangıç portföy verisini çek
    fetch('http://localhost:4000/api/portfolio', {
        headers: { 'x-admin-key': 'super_secret_admin_key_2026' }
    })
    .then(r => r.json())
    .then(res => {
        if (res.success && res.data) {
            portfolioChart.data.labels = Object.keys(res.data);
            portfolioChart.data.datasets[0].data = Object.values(res.data);
            portfolioChart.update();
        }
    })
    .catch(err => console.error("Portfolio API hatası:", err));
    
    window.portfolioChart = portfolioChart;

    // Data Table: Select a mix of High, Medium, and Low risk accounts
    const tbody = document.getElementById('table-body');
    
    const highRisks = data.filter(c => c.churnRisk === 'Yüksek').slice(0, 5);
    const medRisks = data.filter(c => c.churnRisk === 'Orta').slice(0, 5);
    const lowRisks = data.filter(c => c.churnRisk === 'Düşük').slice(0, 5);
    
    // Combine and shuffle slightly (or just list them)
    const displayUsers = [...highRisks, ...medRisks, ...lowRisks].sort(() => Math.random() - 0.5);

    displayUsers.forEach(user => {
        let badgeClass = '';
        let badgeText = '';
        
        if (user.churnRisk === 'Yüksek') {
            badgeClass = 'risk-yüksek';
            badgeText = 'HIGH RISK';
        } else if (user.churnRisk === 'Orta') {
            badgeClass = 'risk-orta';
            badgeText = 'MED RISK';
        } else {
            badgeClass = 'risk-düşük';
            badgeText = 'LOW RISK';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="mono" style="color:var(--text-tertiary);">${user.id.substring(0,8)}</td>
            <td style="font-weight:500; color:var(--text-primary);">${user.firstName} ${user.lastName}</td>
            <td>${user.city}</td>
            <td>${user.segment}</td>
            <td class="mono">${user.creditScore}</td>
            <td class="mono" style="color:var(--text-primary);">${formatCurrency(user.balance)}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        `;
        tbody.appendChild(tr);
    });

    // Risk Simulator Logic
    document.getElementById('btn-simulate').addEventListener('click', () => {
        const age = parseInt(document.getElementById('sim-age').value);
        const balance = parseFloat(document.getElementById('sim-balance').value);
        const credit = parseInt(document.getElementById('sim-credit').value);
        const segment = document.getElementById('sim-segment').value;

        let riskScore = 0;
        if (balance <= 5000) riskScore += 30;
        if (credit < 1000) riskScore += 40;
        if (age < 25) riskScore += 20;
        if (segment === "Özel (VIP)") riskScore -= 50;
        
        let riskText = "LOW RISK";
        let color = "var(--risk-low)";
        
        if (riskScore >= 60) {
            riskText = "HIGH RISK";
            color = "var(--risk-high)";
        } else if (riskScore >= 30) {
            riskText = "MEDIUM RISK";
            color = "var(--risk-med)";
        }

        const resBox = document.getElementById('sim-result');
        const resVal = document.getElementById('sim-result-value');
        
        resBox.style.display = 'block';
        resBox.style.borderColor = color;
        resVal.style.color = color;
        resVal.innerText = riskText + " (" + riskScore + " pts)";
    });
}

/* ============================================================
   REAL-TIME WEBSOCKETS (SOCKET.IO)
   ============================================================ */
// Bağlantıyı başlat (Chatbot'un çalıştığı port: 4000)
const socket = io("http://localhost:4000");

socket.on("connect", () => {
    console.log("WebSocket bağlantısı başarılı. Dinleniyor...");
});

// Churn Alert Geldiğinde Toast Bildirimi Göster
socket.on("churn_alert", (data) => {
    console.log("🚨 YENİ ALARM GELDİ:", data);
    
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";
    
    toast.innerHTML = `
        <div class="toast-header">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            SYSTEM ALERT
        </div>
        <div style="margin-bottom: 4px;">${data.message}</div>
        <div style="color:var(--text-secondary); font-style:italic;">Müşteri Mesajı: "${data.text}"</div>
    `;
    
    container.appendChild(toast);
    
    // Animasyonu tetikle
    setTimeout(() => toast.classList.add("show"), 100);
    
    // 6 saniye sonra kaybol
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 6000);
    
    // Üstteki Notification Badge'i de arttır (görsellik)
    const amlBadge = document.querySelector(".nav-link:nth-child(2) span");
    if(amlBadge) {
        amlBadge.innerText = parseInt(amlBadge.innerText || 3) + 1;
    }
});

// Siber Güvenlik / Dolandırıcılık Alarmı
socket.on("fraud_alert", (data) => {
    console.log("🚨 SİBER GÜVENLİK ALARMI:", data);
    
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";
    // Daha tehlikeli bir görünüm için kırmızı arkaplan ve beyaz metin
    toast.style.backgroundColor = "rgba(220, 38, 38, 0.95)";
    toast.style.color = "#ffffff";
    toast.style.border = "2px solid #ff0000";
    toast.style.boxShadow = "0 0 20px rgba(220, 38, 38, 0.8)";
    
    toast.innerHTML = `
        <div class="toast-header" style="color:#ffffff; font-size:1.1rem; text-transform:uppercase;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            ${data.severity} ALERT
        </div>
        <div style="margin-bottom: 6px; font-weight:600; font-size:1.05rem;">${data.message}</div>
        <div style="font-style:italic; font-size:0.95rem; opacity:0.9;">Tespit Edilen Mesaj: "${data.text}"</div>
    `;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 100);
    
    // Yüksek riskli olduğu için ekranda daha uzun kalır (10 sn)
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 10000);
    
    // Sağlık durumunu boz
    const sysHealth = document.querySelector(".nav-link:nth-child(3)");
    if(sysHealth) {
        sysHealth.innerHTML = `System Health <span style="margin-left:auto; color:var(--risk-high); font-weight:bold;">CRITICAL</span>`;
        sysHealth.style.animation = "pulseText 1s infinite";
    }
});

// Canlı Duygu Analizi Grafiği Güncellemesi
socket.on("new_sentiment", (data) => {
    if (window.sentimentChart) {
        const chart = window.sentimentChart;
        
        // Yeni veriyi ekle
        chart.data.labels.push(data.time);
        chart.data.datasets[0].data.push(data.score);
        
        // Grafik çok dolarsa baştan sil
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        
        // Renk dinamikleri (Kötüye gidiyorsa kırmızılaşsın)
        if (data.score < 40) {
            chart.data.datasets[0].borderColor = '#ef4444'; // Red
            chart.data.datasets[0].backgroundColor = 'rgba(239, 68, 68, 0.15)';
            chart.data.datasets[0].pointBackgroundColor = '#ef4444';
        } else if (data.score > 60) {
            chart.data.datasets[0].borderColor = '#10b981'; // Green
            chart.data.datasets[0].backgroundColor = 'rgba(16, 185, 129, 0.15)';
            chart.data.datasets[0].pointBackgroundColor = '#10b981';
        } else {
            chart.data.datasets[0].borderColor = '#f59e0b'; // Yellow (Neutral)
            chart.data.datasets[0].backgroundColor = 'rgba(245, 158, 11, 0.15)';
            chart.data.datasets[0].pointBackgroundColor = '#f59e0b';
        }

        chart.update();
    }
});

// Portföy Grafiği Güncellemesi (Alım/Satım İşlemleri)
socket.on("portfolio_update", (portfolioData) => {
    console.log("💰 Portföy Güncellendi:", portfolioData);
    if (window.portfolioChart) {
        window.portfolioChart.data.labels = Object.keys(portfolioData);
        window.portfolioChart.data.datasets[0].data = Object.values(portfolioData);
        window.portfolioChart.update();
        
        // İşlem yapıldığını gösteren küçük bir sistem uyarısı çıkart
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.style.backgroundColor = "rgba(34, 197, 94, 0.9)";
        toast.style.border = "2px solid #16a34a";
        toast.innerHTML = `
            <div class="toast-header" style="color:white; font-size:1rem;">
                📈 TRADE EXECUTED
            </div>
            <div style="font-weight:600; color:white; font-size:0.95rem;">Müşteri portföyünde işlem gerçekleştirildi. Pasta grafik güncellendi.</div>
        `;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add("show"), 100);
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    }
});

/* ============================================================
   PDF REPORT GENERATION
   ============================================================ */
const btnPdf = document.getElementById("btn-pdf");
if(btnPdf) {
    btnPdf.addEventListener("click", (e) => {
        e.preventDefault();
        const element = document.getElementById("report-content");
        
        // Koyu temadan dolayı PDF'in arka planını düzeltmek için ufak bir stil enjeksiyonu yapıyoruz
        const opt = {
            margin:       0.5,
            filename:     'nexus_risk_report.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, backgroundColor: '#0f172a' },
            jsPDF:        { unit: 'in', format: 'a3', orientation: 'landscape' }
        };

        // İndirme işlemi
        html2pdf().set(opt).from(element).save();
    });
}

// ── Live Agent Socket Logic ───────────────────
if (typeof io !== 'undefined') {
    const socket = io("http://localhost:4000");
    const liveAgentModal = document.getElementById("liveAgentModal");
    const liveAgentChat = document.getElementById("liveAgentChat");
    const liveAgentInput = document.getElementById("liveAgentInput");
    const liveAgentSend = document.getElementById("liveAgentSend");

    // Canlı Destek panelini kapatırken oturumu sonlandır
    const closeBtn = document.querySelector("#liveAgentModal button");
    if (closeBtn) {
        closeBtn.onclick = () => {
            liveAgentModal.style.display = 'none';
            socket.emit('end_live_session');
            if (liveAgentChat) liveAgentChat.innerHTML = '<div style="font-size:0.85rem; color:#888; text-align:center;">Yeni bağlantı bekleniyor...</div>';
        };
    }

    // Yardımcı fonksiyon (HTML escape)
    function escHtml(t) {
        return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }

    // Listen for incoming messages from Chatbot User
    socket.on("dashboard_receive_msg", (data) => {
        if(liveAgentModal) liveAgentModal.style.display = "flex";
        
        // Remove empty state message if it's there
        if (liveAgentChat && liveAgentChat.innerHTML.includes("Yeni bağlantı bekleniyor...")) {
            liveAgentChat.innerHTML = "";
        }
        
        // Render user message
        if (liveAgentChat) {
            const msgDiv = document.createElement("div");
            msgDiv.style.background = "rgba(255, 255, 255, 0.05)";
            msgDiv.style.padding = "8px 12px";
            msgDiv.style.borderRadius = "8px";
            msgDiv.style.fontSize = "0.9rem";
            msgDiv.style.alignSelf = "flex-start";
            msgDiv.style.borderLeft = "3px solid #888";
            msgDiv.innerHTML = `<strong>Müşteri:</strong> ${escHtml(data.message)}`;
            liveAgentChat.appendChild(msgDiv);
            liveAgentChat.scrollTop = liveAgentChat.scrollHeight;
        }
    });

    // 🚨 Siber Güvenlik / Fraud Alert Listener
    socket.on('fraud_alert', (data) => {
        const fraudModal = document.getElementById("fraudAlertModal");
        const fraudText = document.getElementById("fraudAlertText");
        if (fraudModal && fraudText) {
            fraudText.innerText = `"${data.text}"`;
            fraudModal.style.display = "block";
        }
    });

    // Send reply to Chatbot User
    function sendLiveReply() {
        if (!liveAgentInput) return;
        const text = liveAgentInput.value.trim();
        if (!text) return;
        
        // Render agent message in dashboard
        if (liveAgentChat) {
            const msgDiv = document.createElement("div");
            msgDiv.style.background = "rgba(34, 197, 94, 0.1)";
            msgDiv.style.padding = "8px 12px";
            msgDiv.style.borderRadius = "8px";
            msgDiv.style.fontSize = "0.9rem";
            msgDiv.style.alignSelf = "flex-end";
            msgDiv.style.borderRight = "3px solid #22c55e";
            msgDiv.innerHTML = `<strong>Sen:</strong> ${escHtml(text)}`;
            liveAgentChat.appendChild(msgDiv);
            liveAgentChat.scrollTop = liveAgentChat.scrollHeight;
        }
        
        // Emit to server
        socket.emit("live_agent_reply", { reply: text });
        liveAgentInput.value = "";
    }
    
    if(liveAgentSend) liveAgentSend.addEventListener("click", sendLiveReply);
    if(liveAgentInput) {
        liveAgentInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") sendLiveReply();
        });
    }

    // ── Manager AI (Nexus Copilot) Logic ──
    const managerAiInput = document.getElementById("managerAiInput");
    const managerAiSend = document.getElementById("managerAiSend");
    const managerAiChat = document.getElementById("managerAiChat");

    async function sendManagerAiMsg() {
        if (!managerAiInput) return;
        const text = managerAiInput.value.trim();
        if (!text) return;

        // Render user message
        const msgDiv = document.createElement("div");
        msgDiv.style.background = "rgba(255, 255, 255, 0.05)";
        msgDiv.style.padding = "10px 14px";
        msgDiv.style.borderRadius = "8px";
        msgDiv.style.fontSize = "0.9rem";
        msgDiv.style.alignSelf = "flex-end";
        msgDiv.style.borderRight = "3px solid #888";
        msgDiv.style.color = "#fff";
        msgDiv.innerText = text;
        managerAiChat.appendChild(msgDiv);
        managerAiChat.scrollTop = managerAiChat.scrollHeight;
        
        managerAiInput.value = "";
        managerAiInput.disabled = true;
        managerAiSend.disabled = true;

        // Add loading indicator
        const loadingDiv = document.createElement("div");
        loadingDiv.style.color = "var(--accent-gold)";
        loadingDiv.style.fontSize = "0.85rem";
        loadingDiv.innerText = "Yapay zeka analiz ediyor...";
        managerAiChat.appendChild(loadingDiv);
        managerAiChat.scrollTop = managerAiChat.scrollHeight;

        try {
            const res = await fetch("http://localhost:4000/api/copilot/ask", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "x-admin-key": "super_secret_admin_key_2026"
                },
                body: JSON.stringify({ question: text })
            });
            const data = await res.json();
            
            loadingDiv.remove();

            // Render AI Reply
            const aiDiv = document.createElement("div");
            aiDiv.style.background = "rgba(212,168,83,0.1)";
            aiDiv.style.border = "1px solid var(--accent-gold)";
            aiDiv.style.padding = "12px 14px";
            aiDiv.style.borderRadius = "8px";
            aiDiv.style.fontSize = "0.9rem";
            aiDiv.style.alignSelf = "flex-start";
            aiDiv.style.color = "#e5e5e5";
            
            // Simple markdown parser for bold and newlines
            let formattedHtml = data.reply || data.error;
            formattedHtml = formattedHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            formattedHtml = formattedHtml.replace(/\n/g, '<br>');
            
            aiDiv.innerHTML = formattedHtml;
            managerAiChat.appendChild(aiDiv);
        } catch (err) {
            loadingDiv.remove();
            const errDiv = document.createElement("div");
            errDiv.style.color = "#ef4444";
            errDiv.innerText = `Bağlantı hatası: ${err.message}`;
            managerAiChat.appendChild(errDiv);
            console.error("Fetch Error:", err);
        } finally {
            managerAiChat.scrollTop = managerAiChat.scrollHeight;
            managerAiInput.disabled = false;
            managerAiSend.disabled = false;
            managerAiInput.focus();
        }
    }

    if(managerAiSend) managerAiSend.addEventListener("click", sendManagerAiMsg);
    if(managerAiInput) {
        managerAiInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") sendManagerAiMsg();
        });
    }

    // ── AI Executive Summary Trigger ──
    const aiReportBtn = document.getElementById("aiReportBtn");
    const aiSummaryContainer = document.getElementById("aiSummaryContainer");
    const aiSummaryContent = document.getElementById("aiSummaryContent");

    if (aiReportBtn) {
        aiReportBtn.addEventListener("click", async () => {
            aiSummaryContainer.style.display = "block";
            aiSummaryContent.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; color:var(--text-secondary);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                    AI Agent is analyzing real-time data for Executive Summary...
                </div>
            `;
            aiReportBtn.disabled = true;
            aiReportBtn.style.opacity = "0.5";

            try {
                // Collect Nexus BI Data
                const payload = {
                    total: parseInt(document.getElementById("kpi-total-customers").innerText.replace(/,/g, '') || 5000),
                    faqRate: "N/A", 
                    aiRate: "High Usage",
                    satisfaction: document.getElementById("kpi-avg-credit").innerText,
                    issues: "Risk analysis and churn probability algorithms are active."
                };

                // Request from port 4000 (Main BankBot Server)
                const res = await fetch("http://localhost:4000/api/analytics/ai-summary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-admin-key": "super_secret_admin_key_2026" },
                    body: JSON.stringify(payload)
                });
                
                if (!res.ok) throw new Error("API Error");
                const data = await res.json();
                
                aiSummaryContent.innerHTML = data.summary;
            } catch (err) {
                console.error(err);
                aiSummaryContent.innerHTML = "<span style='color:var(--risk-high);'>Connection error to AI Services. Please check if Main Server (Port 4000) is running.</span>";
            } finally {
                aiReportBtn.disabled = false;
                aiReportBtn.style.opacity = "1";
            }
        });
    }
}

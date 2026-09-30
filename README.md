# BankBot & Nexus BI - Kurumsal Yapay Zeka Çözümleri

![BankBot Banner](https://img.shields.io/badge/BankBot-Enterprise_AI-081428?style=for-the-badge&logo=google-gemini)
![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=nodedotjs)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite)
![Jest](https://img.shields.io/badge/Jest-Tested-C21325?style=for-the-badge&logo=jest)

**BankBot**, kurumsal bankacılık müşterileri için geliştirilmiş, **Google Gemini 2.5 Pro / 3.5 Flash** modelleriyle güçlendirilmiş entegre bir yapay zeka ve İş Zekası (BI) projesidir. Sistem, hem müşterilere 7/24 hizmet veren akıllı bir dijital asistan (Chatbot), hem de banka yöneticilerine anlık raporlama sunan bir **Yönetici Paneli (Nexus BI)** modüllerinden oluşur.

---

## Öne Çıkan Özellikler

### 1. NLP Destekli Müşteri Asistanı
Geleneksel Sık Sorulan Sorular (SSS) botlarının aksine, doğrudan doğal dil işleyerek (NLP) bankacılık verilerini yorumlar. Kredi ve faiz hesaplamaları, kredi kartı başvuruları ve şube bilgileri gibi sorulara anında kurumsal dille cevap verir.

### 2. Anti-Fraud (Sahtekarlık Önleme) Güvenlik Duvarı
Sistemdeki işlemleri analiz eder. Müşteri yüksek riskli veya sıra dışı meblağlı bir işlem talep ettiğinde, sistem işlemi dondurarak **Riskli İşlem** uyarısı verir ve ekranda 2 Faktörlü SMS doğrulama simülasyonu başlatır.

### 3. Nexus BI - Akıllı Yönetici Paneli
Banka yöneticileri için geliştirilmiş ve port 4001 üzerinde çalışan İş Zekası (BI) panelidir.
- **Canlı Veri:** O an chatbot üzerinden yapılan konuşmaları, memnuniyet (Sentiment) analizini ve aktif müşteri sayısını gösterir.
- **YZ Raporu Al:** Tek bir tıkla, o anki tüm banka metriklerini Gemini modeline analiz ettirerek "Üst Düzey Yönetici Özeti (Executive Summary)" çıkarır.

### 4. Akıllı Kumbara (Oyunlaştırma)
Müşteri sohbette "Ev almak istiyorum" veya "Araba birikimi" dediğinde, sistem niyeti anlar ve chat ekranında interaktif bir **İlerleme Çubuğu (Progress Bar)** widget'ı oluşturarak otomatik fon yönlendirmesi yapar.

### 5. Resmi PDF Dekont Dökümü
Müşterilerin banka ile yaptığı tüm görüşmeler, tek bir butonla banka logolu, resmi ve tarih damgalı bir PDF belgesine çevrilerek indirilebilir. Yasal log kaydı niteliği taşır.

### 6. Canlı Borsa ve Kripto Kurları API
Sistem arka planda Proxy API aracılığıyla harici borsa servislerine bağlanarak anlık USD, EUR ve Kripto verilerini çeker.

---

## Kullanılan Teknolojiler

- **Backend:** Node.js, Express.js
- **Yapay Zeka:** Google Gemini SDK (@google/genai)
- **Veritabanı:** SQLite3
- **Frontend (UI):** Vanilla JavaScript, HTML5, CSS3 (Zero-Dependency)
- **Gerçek Zamanlı İletişim:** Socket.IO
- **Yazılım Testleri:** Jest, Supertest
- **Araçlar:** html2pdf (PDF Çıktısı), Chart.js (Grafikler)

---

## Kurulum ve Çalıştırma

### 1. Depoyu Klonlayın
\`\`\`bash
git clone https://github.com/SudeDemirci/bankbot-nexus.git
cd bankbot-nexus
\`\`\`

### 2. Bağımlılıkları Yükleyin
\`\`\`bash
npm install
\`\`\`

### 3. Çevre Değişkenlerini Ayarlayın
Proje kök dizinine bir \`.env\` dosyası oluşturun ve Gemini API anahtarınızı girin:
\`\`\`env
PORT=4000
GEMINI_API_KEY=sizin_api_anahtariniz
ADMIN_API_KEY=super_secret_admin_key_2026
\`\`\`

### 4. Sunucuyu Başlatın
\`\`\`bash
npm start
\`\`\`
- Chatbot Arayüzü: http://localhost:4000
- Nexus BI Dashboard: Ayrı bir terminalde \`BI_Dashboard\` klasörüne gidip \`npx serve\` komutu ile başlatın (Genelde port 4001).

### 5. Testleri Çalıştırın
Sistemin güvenliğini ve API uçlarını test etmek için:
\`\`\`bash
npm test
\`\`\`

---

## Güvenlik Uyarıları
- Bu proje konsept ve sunum amaçlı geliştirilmiştir. 
- Gerçek bankacılık sistemlerine entegre edilirken (Core Banking), simüle edilmiş verilerin REST/SOAP banka API'leri ile değiştirilmesi gerekmektedir.
- \`x-admin-key\` başlığı olmadan Analytics API'sine dışarıdan erişilemez.

---
*Geliştirici: Sudenaz Demirci | 2026 Kurumsal Yazılım Staj Projesi*

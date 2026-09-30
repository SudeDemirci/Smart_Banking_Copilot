const http = require('http');

const SERVER_URL = 'http://localhost:4000/api/analytics';

function makeRequest(path, headers = {}, description) {
    return new Promise((resolve) => {
        console.log(`\n=========================================`);
        console.log(`🧪 TEST: ${description}`);
        console.log(`👉 GET ${path}`);
        
        const options = {
            method: 'GET',
            headers: headers
        };

        const req = http.request(SERVER_URL + path, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`✅ Status Kodu: ${res.statusCode}`);
                try {
                    const json = JSON.parse(data);
                    if(json.chats) {
                        console.log(`📦 Gelen Veri Sayısı: ${json.chats.length}`);
                        console.log(`📊 İstatistikler: Toplam Like: ${json.stats.totalLikes}, Dislike: ${json.stats.totalDislikes}`);
                        console.log(`📄 Sayfalama Bilgisi: Sayfa ${json.pagination.currentPage}, Toplam Kayıt: ${json.pagination.totalRecords}`);
                    } else {
                        console.log(`📩 Gelen Cevap:`, json);
                    }
                } catch (e) {
                    console.log(`📩 Gelen Cevap:`, data);
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Hata: ${e.message}`);
            resolve();
        });

        req.end();
    });
}

async function runTests() {
    console.log("🚀 ANALITIK ENDPOINT TESTLERI BASLIYOR...");

    // Test 1: Yetkisiz Giriş (Anahtar Yok)
    await makeRequest('', {}, 'Yetkisiz Giriş Denemesi (API Key Yok)');

    // Test 2: Yanlış Yetki (Hatalı Anahtar)
    await makeRequest('', { 'x-admin-key': 'yanlis_sifre_123' }, 'Hatalı Anahtar İle Giriş Denemesi');

    // Test 3: Doğru Yetki ve Varsayılan Veri Çekimi
    await makeRequest('', { 'x-admin-key': 'super_secret_admin_key_2026' }, 'Doğru Anahtar İle Başarılı Giriş');

    // Test 4: Sayfalama (Pagination) Testi - Sayfa 1, Limit 2
    await makeRequest('?page=1&limit=2', { 'x-admin-key': 'super_secret_admin_key_2026' }, 'Sayfalama (Sayfa 1, Sadece 2 Kayıt)');

    // Test 5: Sayfalama (Pagination) Testi - Sayfa 2, Limit 2
    await makeRequest('?page=2&limit=2', { 'x-admin-key': 'super_secret_admin_key_2026' }, 'Sayfalama (Sayfa 2, Sonraki 2 Kayıt)');

    console.log(`\n✅ TESTLER TAMAMLANDI!`);
}

runTests();

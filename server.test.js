const request = require('supertest');

// Biz doğrudan arka planda çalışan (localhost:4000) sunucumuzu test edeceğiz
const SERVER_URL = 'http://localhost:4000';

describe('BankBot API Testleri (Güvenlik ve İstikrar)', () => {

    test('1. Sunucu Ana Sayfası (Frontend) Ayakta mı?', async () => {
        const response = await request(SERVER_URL).get('/');
        expect(response.status).toBe(200);
        expect(response.text).toMatch(/BankBot/i); // HTML içinde BankBot geçmeli
    });

    test('2. Kripto Para Proxy API Borsadan Veri Çekebiliyor mu?', async () => {
        const response = await request(SERVER_URL).get('/api/crypto');
        expect(response.status).toBe(200);
        // JSON yanıtı içinde btc ve eth fiyatları olmalı
        expect(response.body).toHaveProperty('btc');
        expect(response.body).toHaveProperty('eth');
    });

    test('3. GÜVENLİK TESTİ: Analytics paneline şifresiz erişim engelleniyor mu?', async () => {
        // Güvenlik şifresi (x-admin-key) göndermeden API'ye sızmaya çalışıyoruz
        const response = await request(SERVER_URL).get('/api/analytics');
        expect(response.status).toBe(403); // 403 Forbidden (Yasak) dönmeli
        expect(response.body.error).toMatch(/Erişim Reddedildi/i);
    });

    test('4. GÜVENLİK TESTİ: Analytics paneline doğru şifreyle erişim sağlanıyor mu?', async () => {
        // Doğru güvenlik şifresini (Header) ekleyerek istek atıyoruz
        const response = await request(SERVER_URL)
            .get('/api/analytics')
            .set('x-admin-key', 'super_secret_admin_key_2026');
        
        expect(response.status).toBe(200); // 200 OK dönmeli
        expect(response.body).toHaveProperty('stats'); // İstatistikler geri gelmeli
    });

});

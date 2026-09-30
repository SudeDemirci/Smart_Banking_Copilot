const fs = require('fs');
const { fakerTR } = require('@faker-js/faker');

const NUM_CUSTOMERS = 5000;
const cities = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Kocaeli", "Gaziantep", "Mersin"];
const segments = [
    { name: "Bireysel (Retail)", weight: 60 },
    { name: "KOBİ (SME)", weight: 25 },
    { name: "Kurumsal (Corporate)", weight: 10 },
    { name: "Özel (VIP)", weight: 5 }
];

function getRandomSegment() {
    const rand = Math.random() * 100;
    let sum = 0;
    for (const seg of segments) {
        sum += seg.weight;
        if (rand <= sum) return seg.name;
    }
    return "Bireysel (Retail)";
}

function calculateChurnRisk(age, balance, creditScore, segment) {
    let riskScore = 0;
    if (balance < 5000) riskScore += 30;
    if (creditScore < 1000) riskScore += 40;
    if (age < 25) riskScore += 20;
    if (segment === "Özel (VIP)") riskScore -= 50; 
    
    if (riskScore > 60) return "Yüksek";
    if (riskScore > 30) return "Orta";
    return "Düşük";
}

const customers = [];

for (let i = 0; i < NUM_CUSTOMERS; i++) {
    const age = fakerTR.number.int({ min: 18, max: 75 });
    const segment = getRandomSegment();
    
    let balanceMin = 1000;
    let balanceMax = 50000;
    let incomeMin = 17000; // Asgari
    let incomeMax = 60000;

    if (segment === "KOBİ (SME)") { balanceMin = 50000; balanceMax = 500000; incomeMin = 80000; incomeMax = 300000; }
    if (segment === "Kurumsal (Corporate)") { balanceMin = 500000; balanceMax = 10000000; incomeMin = 500000; incomeMax = 5000000; }
    if (segment === "Özel (VIP)") { balanceMin = 1000000; balanceMax = 50000000; incomeMin = 200000; incomeMax = 1000000; }

    const balance = fakerTR.number.float({ min: balanceMin, max: balanceMax, fractionDigits: 2 });
    const monthlyIncome = fakerTR.number.float({ min: incomeMin, max: incomeMax, fractionDigits: 2 });
    const creditScore = fakerTR.number.int({ min: 600, max: 1900 });
    
    const customer = {
        id: fakerTR.string.uuid(),
        firstName: fakerTR.person.firstName(),
        lastName: fakerTR.person.lastName(),
        age: age,
        city: fakerTR.helpers.arrayElement(cities),
        segment: segment,
        balance: balance,
        monthlyIncome: monthlyIncome,
        creditScore: creditScore,
        churnRisk: calculateChurnRisk(age, balance, creditScore, segment),
        hasActiveLoan: fakerTR.datatype.boolean({ probability: 0.4 }),
        joinDate: fakerTR.date.past({ years: 10 }).toISOString().split('T')[0]
    };
    
    customers.push(customer);
}

fs.writeFileSync('public/data.json', JSON.stringify(customers, null, 2));
console.log(`✅ ${NUM_CUSTOMERS} adet sentetik müşteri verisi başarıyla 'public/data.json' dosyasına üretildi!`);

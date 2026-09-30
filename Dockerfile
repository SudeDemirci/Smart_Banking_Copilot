# Temel imaj olarak hafif ve güvenli Alpine tabanlı Node.js 20 kullanıyoruz
FROM node:20-alpine

# Çalışma dizinini belirliyoruz
WORKDIR /usr/src/app

# Önce sadece bağımlılık tanımlarını (package.json) kopyalıyoruz
# Bu sayede Docker önbelleklemesini (caching) efektif kullanmış oluyoruz
COPY package*.json ./

# Bağımlılıkları kuruyoruz (Sadece production için olanları)
RUN npm install --only=production

# Projenin tüm kodlarını çalışma dizinine kopyalıyoruz
COPY . .

# Konteynerin dışarıya açacağı port (BankBot ana portumuz)
EXPOSE 4000

# Docker başlatıldığında çalıştırılacak komut
CMD ["npm", "start"]

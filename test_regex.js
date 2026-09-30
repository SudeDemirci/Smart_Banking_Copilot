const str = "10 bin TL'lik THYAO hissesi al".toLowerCase();
const normalized = str.replace(/\bbin\b/g, '000').replace(/\s+000/g, '000');
console.log('Normalized:', normalized);
const match = normalized.match(/([0-9\.]+)\s*(tl|lira).*(fon|hisse).*(al|almak)/);
console.log('Match:', match ? match[0] : 'null');

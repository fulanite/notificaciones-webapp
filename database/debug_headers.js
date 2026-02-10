const fs = require('fs');
const path = require('path');

const visitasFile = path.join(__dirname, '..', 'e9c740.visitas.csv');

function readCsvHead(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    return headers;
}

try {
    const headers = readCsvHead(visitasFile);
    console.log("HEADERS FOUND:");
    headers.forEach((h, i) => console.log(`${i}: [${h}]`));
} catch (e) { console.error(e); }

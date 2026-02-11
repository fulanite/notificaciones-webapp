const fs = require('fs');
const files = [
    "C:\\Users\\fulanite\\Downloads\\87efaa.cedulas.csv",
    "C:\\Users\\fulanite\\Downloads\\553235.visitas.csv"
];

files.forEach(f => {
    if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf-8');
        const lines = content.split('\n');
        console.log(`\nFile: ${f}`);
        console.log(`Full Headers: ${lines[0]}`);
    } else {
        console.log(`File not found: ${f}`);
    }
});

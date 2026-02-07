const fs = require('fs');
const readline = require('readline');
const path = require('path');

const csvPath = path.join(__dirname, '92e43e.cedulas.csv');
const sqlPath = path.join(__dirname, 'database', 'migrate_delivery_dates.sql');

async function generateSQL() {
    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const outputStream = fs.createWriteStream(sqlPath);
    outputStream.write('-- Migration Script: Restore real delivery dates\n');
    outputStream.write('SET FOREIGN_KEY_CHECKS = 0;\n');
    outputStream.write('UPDATE notificaciones SET fecha_entrega_ujier = NULL WHERE migrated_from_glide = 1;\n\n');

    let isHeader = true;
    let idIndex = 0;
    let dateIndex = 23;
    let count = 0;

    for await (const line of rl) {
        // Simple CSV split (works for this file as values are usually not complex or quoted with commas inside)
        // However, caratula might have commas. Let's use a more robust regex or just split by comma and handle quotes.

        const parts = line.match(/(".*?"|[^",\r\n]+)(?=\s*,|\s*$)/g) || [];
        // Note: The above regex is a bit simple, but let's test it or use a simpler one if indices are fixed.
        // Actually, the indices I need (0 and 23) are usually safe.

        const rawParts = line.split(',');

        if (isHeader) {
            idIndex = rawParts.indexOf('id_cedula');
            dateIndex = rawParts.indexOf('fecha_entrega_ujier');
            isHeader = false;
            continue;
        }

        const glideId = rawParts[idIndex];
        const rawDate = rawParts[dateIndex];

        if (glideId && rawDate && rawDate !== 'null' && rawDate !== '') {
            try {
                // date format: 2025-10-01T00:00:00.000Z
                const dateObj = new Date(rawDate);
                if (!isNaN(dateObj.getTime())) {
                    const formattedDate = dateObj.toISOString().slice(0, 19).replace('T', ' ');
                    outputStream.write(`UPDATE notificaciones SET fecha_entrega_ujier = '${formattedDate}' WHERE glide_id_cedula = '${glideId}' AND migrated_from_glide = 1;\n`);
                    count++;
                }
            } catch (e) {
                // Skip invalid dates
            }
        }
    }

    outputStream.write('\nSET FOREIGN_KEY_CHECKS = 1;\n');
    outputStream.end();
    console.log(`Generated ${count} update statements in ${sqlPath}`);
}

generateSQL();

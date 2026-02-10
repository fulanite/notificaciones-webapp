const fs = require('fs');
const path = require('path');

const csvFile = path.join(__dirname, '..', '92e43e.cedulas.csv');
const outputFile = path.join(__dirname, 'repair_notification_types.sql');

function mapTipoNotificacion(valor) {
    if (!valor) return 'cedulas';
    const v = valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const clean = v.replace(/[^a-z0-9]/g, '');
    if (clean.includes('22172')) return 'cedulas_mandamientos_22172';
    if (v.includes('correspondencia')) return 'cedulas_correspondencia';

    if (v.includes('urgente')) {
        if (v.includes('norte')) return 'cedulas_urgentes_norte';
        if (v.includes('sur')) return 'cedulas_urgentes_sur';
    }

    if (v.includes('mandamiento')) {
        if (v.includes('habilitacion') || v.includes('sur') || v.includes('norte')) {
            if (v.includes('sur')) return 'mandamientos_habilitacion_sur';
            if (v.includes('norte')) return 'mandamientos_habilitacion_norte';
        }
        return 'mandamientos';
    }

    return 'cedulas';
}

async function readCsvFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rows = [];
    let header = null;
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let lineBuffer = '';
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (i === 0 && line.charCodeAt(0) === 0xFEFF) line = line.slice(1);

        if (inQuotes) lineBuffer += '\n' + line;
        else lineBuffer = line;

        for (let j = (inQuotes ? lineBuffer.lastIndexOf('\n') + 1 : 0); j < lineBuffer.length; j++) {
            const char = lineBuffer[j];
            const nextChar = lineBuffer[j + 1];
            if (char === '"') {
                if (!inQuotes) inQuotes = true;
                else if (nextChar === '"') { currentField += '"'; j++; }
                else inQuotes = false;
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
        if (!inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
            lineBuffer = '';
            if (!header) {
                header = currentRow.map(h => h.replace(/^"|"$/g, '').trim());
            } else if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
                const row = {};
                header.forEach((col, idx) => row[col] = (currentRow[idx] || '').replace(/^"|"$/g, ''));
                rows.push(row);
            }
            currentRow = [];
        }
    }
    return rows;
}

async function generate() {
    console.log('Reading CSV...');
    const data = await readCsvFile(csvFile);
    console.log(`Processing ${data.length} rows...`);

    const sqlLines = [
        '-- SQL Repair Script: Update notification types from CSV data',
        'SET FOREIGN_KEY_CHECKS = 0;',
        ''
    ];

    data.forEach(row => {
        const idCedula = row['id_cedula'];
        const rawType = row['tipo_not'];
        if (!idCedula || !rawType) return;

        const mappedType = mapTipoNotificacion(rawType);

        // We only generate UPDATE if it's NOT a default 'cedulas' or if we want to be 100% sure
        // But since they are all 'cedula' now, we only care about those that should be different.
        if (mappedType !== 'cedulas') {
            sqlLines.push(`UPDATE notificaciones SET tipo_notificacion = '${mappedType}' WHERE glide_id_cedula = '${idCedula}';`);
        }
    });

    sqlLines.push('');
    sqlLines.push('SET FOREIGN_KEY_CHECKS = 1;');

    fs.writeFileSync(outputFile, sqlLines.join('\n'));
    console.log(`Generated ${outputFile} with ${sqlLines.length - 4} updates.`);
}

generate();

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const VISITAS_FILE = path.join(__dirname, '..', 'e9c740.visitas.csv');
const ID_MAPPING_FILE = path.join(__dirname, 'id_mapping.json');
const OUTPUT_FILE = path.join(__dirname, 'fix_visitas_ujier_id.sql');

console.log('SGND - Fix Missing Ujier IDs in Visitas');
console.log('=======================================');

// 1. Load ID Mapping
if (!fs.existsSync(ID_MAPPING_FILE)) {
    console.error('Error: id_mapping.json not found!');
    process.exit(1);
}
const idMapping = JSON.parse(fs.readFileSync(ID_MAPPING_FILE, 'utf8'));
console.log(`Loaded ${Object.keys(idMapping).length} notification mappings.`);

// 2. Read Visitas CSV and Generate SQL
if (!fs.existsSync(VISITAS_FILE)) {
    console.error(`Error: Visitas file not found at ${VISITAS_FILE}`);
    process.exit(1);
}

const updates = [];
let processedCount = 0;
let skippedCount = 0;

const fileStream = fs.createReadStream(VISITAS_FILE);
const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
});

let headers = [];

rl.on('line', (line) => {
    // Basic CSV parsing (not robust for quoted commas, but sufficient for this specific file structure usually)
    // Using a regex to handle quoted fields correctly if needed, or simple split if simple.
    // The previous migration script used simple split, so let's try to be slightly more robust here or reuse logic.

    // Simple split for now as we just need IDs
    // But wait, CSV parsing is tricky. Let's use a regex splitter.
    const row = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    // Actually, simple split by comma is risky. Let's assume standard CSV.
    // Let's use a simpler approach: strict split, remove quotes.

    // Better approach: Use the same regex that likely worked before or a proven one.
    // Matches: "quoted field" OR non-comma-field
    let matches = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            matches.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    matches.push(current);

    // Clean quotes
    const cols = matches.map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

    if (headers.length === 0) {
        headers = cols;
        return;
    }

    const rowObj = {};
    headers.forEach((h, i) => {
        rowObj[h] = cols[i];
    });

    const idCedula = rowObj['ID_cedula'];
    const idUjier = rowObj['id_ujier'];

    // We need columns to match unique visit. 
    // Fecha is key.
    const fechaRaw = rowObj['fecha_hora_visita'];

    if (!idCedula || !idMapping[idCedula] || !idUjier || !fechaRaw) {
        skippedCount++;
        return;
    }

    const notificacionId = idMapping[idCedula];

    // Parse fecha to match MySQL format if possible
    // Input format example: 12/28/2025 5:32:00 PM
    // Or YYYY-MM-DD
    let fechaSql = 'NULL';
    let fechaVal = new Date(fechaRaw);

    if (!isNaN(fechaVal.getTime())) {
        // Format to YYYY-MM-DD HH:MM:SS for strict matching
        // Note: JS Date parsing assumes local time or UTC properly?
        // Let's rely on date part mainly or LIKE

        // Actually, matching by date is risky due to TZ. 
        // Strategy: UPDATE all visits for this notification id that have NO ujier_id
        // LIMIT 1? No.

        // Safer Strategy:
        // Update records for this notification_id where fecha is "close enough" OR simply update all NULLs for this notification 
        // IF we assume 1 notification = 1 ujier generally.

        // But what if multiple ujieres visited the same cedula?
        // We really should try to match the date.

        const yyyy = fechaVal.getFullYear();
        const mm = String(fechaVal.getMonth() + 1).padStart(2, '0');
        const dd = String(fechaVal.getDate()).padStart(2, '0');
        const hh = String(fechaVal.getHours()).padStart(2, '0');
        const min = String(fechaVal.getMinutes()).padStart(2, '0');
        // Seconds might be off.

        // MySQL format: '2025-01-20 15:30:00'
        const fechaStr = `${yyyy}-${mm}-${dd} ${hh}:${min}`;

        // Update query using LIKE for date to ignore seconds diff
        // Ujier ID from CSV is likely Glide ID or email/name based ID. 
        // We stores this in a TEMP column first, then match with usuarios table in SQL.
        updates.push(`UPDATE visitas SET temp_ujier_glide_id = '${idUjier.replace(/'/g, "\\'")}' WHERE notificacion_id = '${notificacionId}' AND fecha LIKE '${fechaStr}%';`);
        processedCount++;
    } else {
        skippedCount++;
    }
});


rl.on('close', () => {
    const finalSql = [];

    // Header
    finalSql.push('-- ==============================================');
    finalSql.push('-- FIX VISITAS UJIER ID (FULL SCRIPT)');
    finalSql.push('-- ==============================================');
    finalSql.push('SET SQL_SAFE_UPDATES = 0;');
    finalSql.push('ALTER TABLE visitas ADD COLUMN IF NOT EXISTS temp_ujier_glide_id VARCHAR(50);');
    finalSql.push('');

    // Updates
    finalSql.push(...updates);

    // Footer - Match and Update
    finalSql.push('');
    finalSql.push('-- Match with usuarios table');
    // Try matching by Glide ID first, then Email, then Name if possible (usually DNI or Glide ID in CSV)
    finalSql.push(`
        UPDATE visitas v 
        JOIN usuarios u ON (v.temp_ujier_glide_id = u.glide_id OR v.temp_ujier_glide_id = u.dni OR u.email LIKE CONCAT(v.temp_ujier_glide_id, '%'))
        SET v.ujier_id = u.id
        WHERE v.ujier_id IS NULL;
    `);

    finalSql.push('');
    finalSql.push('ALTER TABLE visitas DROP COLUMN temp_ujier_glide_id;');
    finalSql.push('SET SQL_SAFE_UPDATES = 1;');

    fs.writeFileSync(OUTPUT_FILE, finalSql.join('\\n'), 'utf-8');
    console.log(`Generated ${updates.length} raw updates.`);
    console.log(`Skipped ${skippedCount} rows.`);
    console.log(`FULL SQL saved to ${OUTPUT_FILE}`);
});

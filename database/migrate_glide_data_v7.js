/**
 * ================================================
 * SGND - Glide Data Migration Script (v7 - Visits Only)
 * ================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const config = {
    visitasFile: "/Users/matiascardozo/Downloads/b31f83.visitas.csv",
    outputDir: __dirname,
};

// ------------------------------------
// Helper Functions
// ------------------------------------

function getDeterministicUuid(sourceId, namespace = 'sgnd') {
    if (!sourceId) return '00000000-0000-0000-0000-000000000000';
    // If it's already a UUID, normalize it
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) {
        return sourceId.toLowerCase();
    }
    const hash = crypto.createHash('sha1').update(namespace + ':' + sourceId).digest('hex');
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '5' + hash.substring(13, 16),
        (parseInt(hash.substring(16, 17), 16) & 0x3 | 0x8).toString(16) + hash.substring(17, 20),
        hash.substring(20, 32)
    ].join('-');
}

function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    const trimmed = dateStr.trim();
    // DD/MM/YYYY HH:mm:ss
    const euroMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2})?:?(\d{2})?:?(\d{2})?$/);
    if (euroMatch) {
        const [, day, month, year, hour = '0', minute = '0', second = '0'] = euroMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
    }
    // ISO YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s*(\d{2})?:?(\d{2})?:?(\d{2})?$/);
    if (isoMatch) {
        const [, year, month, day, hour = '0', minute = '0', second = '0'] = isoMatch;
        return `${year}-${month}-${day} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
    }
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
        return date.toISOString().replace('T', ' ').substring(0, 19);
    }
    return null;
}

function parseCoordinates(location) {
    if (!location || location.trim() === '') return { lat: null, lng: null };
    const coordMatch = location.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (coordMatch) return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
    const mapsMatch = location.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (mapsMatch) return { lat: parseFloat(mapsMatch[1]), lng: parseFloat(mapsMatch[2]) };
    return { lat: null, lng: null };
}

function cleanString(value) {
    if (!value) return null;
    const cleaned = value.trim();
    return cleaned === '' ? null : cleaned;
}

function escapeSQL(value) {
    if (value === null || value === undefined || value === 'NULL') return 'NULL';
    if (typeof value === 'number') return value.toString();
    const escaped = String(value).replace(/'/g, "''").replace(/\\/g, '\\\\');
    return `'${escaped}'`;
}

async function readCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            console.warn(`WARN: File not found at ${filePath}`);
            resolve([]);
            return;
        }
        try {
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
            resolve(rows);
        } catch (err) { reject(err); }
    });
}

// ------------------------------------
// Main Migration Logic
// ------------------------------------

async function migrate() {
    try {
        console.log('INIT: Loading CSV data from Downloads...');
        const visitas = await readCsvFile(config.visitasFile);

        if (visitas.length === 0) {
            console.error("ERROR: No visitas found. Check path:", config.visitasFile);
            return;
        }

        console.log(`\nProcessing ${visitas.length} Visitas...`);
        const visitasSql = [`-- SGND Visitas (Deterministic V7)`];
        // Disable foreign key checks to allow importing visits even if notifications haven't been migrated yet (though they should exist ideally)
        // Or strictly enforce it? For migration scripts, users often prefer disabling checks.
        visitasSql.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

        visitas.forEach(v => {
            const idCedula = v['ID_cedula'];
            if (!idCedula) {
                console.warn('Skipping visit without ID_cedula:', v);
                return;
            }

            // Deterministic UUID for notification (assuming same logic as v6)
            const notifUuid = getDeterministicUuid(idCedula, 'cedula');

            // Deterministic Visit ID
            const rowId = v['Row ID'] || v['$Row ID'] || (idCedula + '_' + v['fecha_hora_visita']);
            const visitUuid = getDeterministicUuid(rowId, 'visita');

            const fecha = parseDate(v['fecha_hora_visita']);
            const coords = parseCoordinates(v['ubicacion_ujier']);

            // Clean transcription field (check all possible column names)
            const transcripcion = cleanString(v['transcripción_observación'] || v['transcripcion_observacion'] || v['transcripción observación']);
            const observaciones = cleanString(v['observaciones_ujier']);
            const resultado = cleanString(v['estado_notificacion']);

            // Handle Ujier ID (ID or Name fallback)
            const ujierId = v['id_ujier'] || v['nombre_ujier'];

            const sql = `INSERT INTO visitas (
                id, notificacion_id, ujier_id, migrated_from_glide,
                resultado, observaciones, transcripcion_audio, ubicacion_lat, ubicacion_lng,
                foto_url, fecha
            ) VALUES (
                ${escapeSQL(visitUuid)}, ${escapeSQL(notifUuid)}, ${escapeSQL(ujierId)}, 1,
                ${escapeSQL(resultado)}, ${escapeSQL(observaciones)}, ${escapeSQL(transcripcion)},
                ${coords.lat || 'NULL'}, ${coords.lng || 'NULL'},
                ${escapeSQL(cleanString(v['foto_domicilio']))}, ${escapeSQL(fecha) || 'NOW()'}
            ) ON DUPLICATE KEY UPDATE
                ujier_id=VALUES(ujier_id),
                resultado=VALUES(resultado),
                observaciones=VALUES(observaciones),
                transcripcion_audio=VALUES(transcripcion_audio),
                fecha=VALUES(fecha),
                ubicacion_lat=VALUES(ubicacion_lat),
                ubicacion_lng=VALUES(ubicacion_lng),
                foto_url=VALUES(foto_url);`;

            visitasSql.push(sql);
        });

        visitasSql.push('SET FOREIGN_KEY_CHECKS = 1;');
        fs.writeFileSync(path.join(config.outputDir, 'import_visitas_v7.sql'), visitasSql.join('\n'));

        console.log(`\nDONE! Generated v7 script: import_visitas_v7.sql`);

    } catch (e) {
        console.error("Error:", e);
    }
}

migrate();

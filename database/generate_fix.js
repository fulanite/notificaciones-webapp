/**
 * ============================================================
 * SGND - Fix Data Script (Corrects v3 import errors)
 * ============================================================
 * 
 * Generates SQL UPDATE statements to correct specific fields
 * using deterministic IDs to locate records.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = {
    usersFile: path.join(__dirname, '..', 'users_v3.csv'),
    cedulasFile: path.join(__dirname, '..', '92e43e.cedulas.csv'),
    visitasFile: path.join(__dirname, '..', 'e9c740.visitas.csv'),
    outputDir: __dirname,
};

// ------------------------------------
// Deterministic UUID Logic (MUST MATCH MIGRATION SCRIPT)
// ------------------------------------
function getDeterministicUuid(sourceId, namespace = 'sgnd') {
    if (!sourceId) return '00000000-0000-0000-0000-000000000000';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) return sourceId.toLowerCase();
    const hash = crypto.createHash('sha1').update(namespace + ':' + sourceId).digest('hex');
    return [
        hash.substring(0, 8), hash.substring(8, 12), '5' + hash.substring(13, 16),
        (parseInt(hash.substring(16, 17), 16) & 0x3 | 0x8).toString(16) + hash.substring(17, 20),
        hash.substring(20, 32)
    ].join('-');
}

// ------------------------------------
// Helpers
// ------------------------------------
function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    const trimmed = dateStr.trim();
    const euroMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2})?:?(\d{2})?:?(\d{2})?$/);
    if (euroMatch) {
        const [, day, month, year, hour = '0', minute = '0', second = '0'] = euroMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
    }
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s*(\d{2})?:?(\d{2})?:?(\d{2})?$/);
    if (isoMatch) {
        const [, year, month, day, hour = '0', minute = '0', second = '0'] = isoMatch;
        return `${year}-${month}-${day} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
    }
    const date = new Date(trimmed);
    return !isNaN(date.getTime()) ? date.toISOString().replace('T', ' ').substring(0, 19) : null;
}

function cleanString(value) {
    if (!value) return null;
    const cleaned = value.trim();
    return cleaned === '' ? null : cleaned;
}

function mapDestinoEspecial(valor) {
    if (!valor) return null;
    const v = valor.toLowerCase();
    if (v.includes('carcel') || v.includes('penitenciaria')) return 'carcel';
    if (v.includes('hospital')) return 'hospital';
    if (v.includes('extraña')) return 'extraña_jurisdiccion';
    return null;
}

function escapeSQL(value) {
    if (value === null || value === undefined || value === 'NULL') return 'NULL';
    if (typeof value === 'number') return value.toString();
    const escaped = String(value).replace(/'/g, "''").replace(/\\/g, '\\\\');
    return `'${escaped}'`;
}

async function readCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) { resolve([]); return; }
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
                if (inQuotes) lineBuffer += '\n' + line; else lineBuffer = line;
                for (let j = (inQuotes ? lineBuffer.lastIndexOf('\n') + 1 : 0); j < lineBuffer.length; j++) {
                    const char = lineBuffer[j];
                    const nextChar = lineBuffer[j + 1];
                    if (char === '"') {
                        if (!inQuotes) inQuotes = true; else if (nextChar === '"') { currentField += '"'; j++; } else inQuotes = false;
                    } else if (char === ',' && !inQuotes) { currentRow.push(currentField.trim()); currentField = ''; } else { currentField += char; }
                }
                if (!inQuotes) {
                    currentRow.push(currentField.trim()); currentField = ''; lineBuffer = '';
                    if (!header) header = currentRow.map(h => h.replace(/^"|"$/g, '').trim());
                    else if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
                        const row = {}; header.forEach((col, idx) => row[col] = (currentRow[idx] || '').replace(/^"|"$/g, '')); rows.push(row);
                    }
                    currentRow = [];
                }
            }
            resolve(rows);
        } catch (err) { reject(err); }
    });
}

// ------------------------------------
// Main Logic
// ------------------------------------

async function generateFix() {
    try {
        console.log('Loading CSVs...');
        const users = await readCsvFile(config.usersFile);
        const cedulas = await readCsvFile(config.cedulasFile);
        const visitas = await readCsvFile(config.visitasFile);

        // 1. Build User Map (DNI centric)
        const userMap = new Map();
        users.forEach(u => {
            const rowId = u['Row ID'] || u['$Row ID'];
            const dni = cleanString(u['dni_usuario']);
            const email = cleanString(u['Email']);
            const name = cleanString(u['Name']);
            if (!rowId && !dni && !email) return;

            let uuid;
            if (dni) uuid = getDeterministicUuid(dni, 'user-dni');
            else if (rowId) uuid = getDeterministicUuid(rowId, 'user');
            else uuid = getDeterministicUuid(email, 'user-email');

            if (rowId) userMap.set(rowId, uuid);
            if (email) userMap.set(email.toLowerCase(), uuid);
            if (dni) userMap.set(dni, uuid);
            if (name) userMap.set(name, uuid);
        });

        const sql = [`-- FIX MISSING/INCORRECT DATA (Generated ${new Date().toISOString()})`];
        sql.push('SET FOREIGN_KEY_CHECKS = 0;');

        // Relax schema to accept raw values from CSV
        sql.push('ALTER TABLE notificaciones MODIFY COLUMN destinatario_especial VARCHAR(100);');

        // 2. Notificaciones Fixes
        console.log(`Fixing ${cedulas.length} Notificaciones...`);
        cedulas.forEach(c => {
            const idCedula = c['id_cedula'];
            if (!idCedula) return;
            const uuid = getDeterministicUuid(idCedula, 'cedula');

            // Fields to fix
            const usuarioCarga = cleanString(c['id_usuario_carga']) || cleanString(c['cargado_por']);
            const fechaEntrega = parseDate(c['fecha_entrega_ujier']);
            const devuelta = (c['devuelta_por_ujier'] || '').toLowerCase() === 'true' ? 1 : 0;
            const destEspecial = (c['destino_especial'] || '').toLowerCase() === 'true' ? '1' : '0'; // Map boolean to '1'/'0' string

            const asignadoRaw = cleanString(c['Ujier_asignado']);
            let asignadoUuid = asignadoRaw && userMap.has(asignadoRaw) ? userMap.get(asignadoRaw) : 'NULL';

            sql.push(`UPDATE notificaciones SET 
                usuario_carga = ${escapeSQL(usuarioCarga)},
                fecha_entrega_ujier = ${escapeSQL(fechaEntrega)},
                devuelta_por_ujier = ${devuelta},
                destinatario_especial = ${escapeSQL(destEspecial)},
                asignado_a = ${escapeSQL(asignadoUuid)}
            WHERE id = ${escapeSQL(uuid)};`);
        });

        // 3. Visitas Fixes
        console.log(`Fixing ${visitas.length} Visitas...`);
        visitas.forEach(v => {
            const idCedula = v['ID_cedula'];
            if (!idCedula) return;
            const rowId = v['Row ID'] || v['$Row ID'] || (idCedula + '_' + v['fecha_hora_visita']);
            const uuid = getDeterministicUuid(rowId, 'visita');

            // Fields to fix
            const ujierRaw = cleanString(v['id_ujier']) || cleanString(v['nombre_ujier']);
            let ujierUuid = ujierRaw && userMap.has(ujierRaw) ? userMap.get(ujierRaw) : 'NULL';

            if (ujierRaw && !userMap.has(ujierRaw)) {
                console.log(`WARN: Ujier '${ujierRaw}' not found in UserMap.`);
            }

            const transcripcion = cleanString(v['transcripción_observación']);
            if (transcripcion) {
                console.log(`DEBUG: Transcripcion found: '${transcripcion.substring(0, 20)}...'`);
            }

            sql.push(`UPDATE visitas SET 
                ujier_id = ${escapeSQL(ujierUuid)},
                transcripcion_audio = ${escapeSQL(transcripcion)}
            WHERE id = ${escapeSQL(uuid)};`);
        });

        sql.push('SET FOREIGN_KEY_CHECKS = 1;');
        fs.writeFileSync(path.join(config.outputDir, 'fix_data_final.sql'), sql.join('\n'));
        console.log('DONE: fix_data_final.sql generated.');

    } catch (e) {
        console.error(e);
    }
}

generateFix();

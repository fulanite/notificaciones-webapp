/**
 * ================================================
 * SGND - Glide Data Migration Script (Deterministic v3)
 * ================================================
 * 
 * Features:
 * - Deterministic UUIDs: Generates consistent IDs based on source data.
 *   Allows re-running the script without generating duplicates.
 * - Incremental Import: Uses INSERT ... ON DUPLICATE KEY UPDATE.
 * - Full User Integration: Imports users from users_v3.csv and links them.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

// Configuration
const config = {
    usersFile: path.join(__dirname, '..', 'users_v3.csv'),
    cedulasFile: path.join(__dirname, '..', '92e43e.cedulas.csv'),
    visitasFile: path.join(__dirname, '..', 'e9c740.visitas.csv'),
    outputDir: __dirname,
};

// ------------------------------------
// Helper Functions
// ------------------------------------

function getDeterministicUuid(sourceId, namespace = 'sgnd') {
    if (!sourceId) return '00000000-0000-0000-0000-000000000000';
    // If sourceId is already a valid UUID, return it normalized
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) {
        return sourceId.toLowerCase();
    }
    // Generate version 5-like UUID from hash (SHA-1)
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

function parseDecimal(value) {
    if (!value || value.trim() === '') return 0.0;
    const cleaned = value.replace(',', '.').replace(/[^0-9.\-]/g, '');
    return parseFloat(cleaned) || 0.0;
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

function mapEstado(estado) {
    const normalized = (estado || '').toLowerCase().trim();
    if (normalized.includes('positiv') || normalized === 'notificado') return 'notificado';
    if (normalized.includes('negativ') || normalized === 'no notificado' || normalized === 'devuelta') return 'devuelta';
    return 'pendiente';
}

function mapDestinoEspecial(valor) {
    if (!valor) return null;
    const v = valor.toLowerCase();
    if (v.includes('carcel') || v.includes('penitenciaria')) return 'carcel';
    if (v.includes('hospital')) return 'hospital';
    if (v.includes('extraña')) return 'extraña_jurisdiccion';
    return null;
}

function mapMedioPago(valor) {
    if (!valor) return 'gratuito';
    const v = valor.toLowerCase();
    if (v.includes('efectivo')) return 'efectivo';
    if (v.includes('transferencia')) return 'transferencia';
    if (v.includes('qr')) return 'qr';
    return 'gratuito';
}

function mapTipoNotificacion(valor) {
    if (!valor) return 'cedulas';
    const v = valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (v.includes('22172')) return 'cedulas_mandamientos_22172';
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
            resolve([]); // Return empty if optional file missing
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
        console.log('INIT: Loading CSV data...');
        const users = await readCsvFile(config.usersFile);
        const cedulas = await readCsvFile(config.cedulasFile);
        const visitas = await readCsvFile(config.visitasFile);

        // ------------------------------------
        // Step 1: Users (The Foundation)
        // ------------------------------------
        console.log(`\nStep 1: Processing ${users.length} Users...`);
        const userMap = new Map(); // identifier -> uuid
        const usersSql = [`-- SGND Usuarios (Deterministic V3)`];
        usersSql.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

        users.forEach(u => {
            const rowId = u['Row ID'] || u['$Row ID'];
            const dni = cleanString(u['dni_usuario']);
            const email = cleanString(u['Email']);
            const name = cleanString(u['Name']);

            if (!rowId && !dni && !email) return; // Skip invalid rows

            // PRIORIDAD 1: DNI como fuente de verdad y ID LITERAL
            let uuid;
            if (dni) {
                uuid = dni; // ID ES EL DNI (Raw Value)
            } else if (rowId) {
                uuid = getDeterministicUuid(rowId, 'user');
            } else {
                uuid = getDeterministicUuid(email, 'user-email');
            }

            // Map all possible identifiers to this UUID
            if (rowId) userMap.set(rowId, uuid);
            if (email) userMap.set(email.toLowerCase(), uuid);
            if (dni) userMap.set(dni, uuid);
            if (name) userMap.set(name, uuid);

            // Determine role
            let rol = 'ujier';
            if ((u['Role'] || '').toLowerCase().includes('admin')) rol = 'admin';
            if ((u['Role'] || '').toLowerCase().includes('oficina')) rol = 'oficina';

            const emailFinal = email || (cleanString(name).replace(/\s+/g, '.').toLowerCase() + '@generated.com');

            const sql = `INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES (${escapeSQL(uuid)}, ${escapeSQL(rowId)}, ${escapeSQL(dni)}, ${escapeSQL(emailFinal)}, ${escapeSQL(u['Name'])}, ${escapeSQL(rol)}, ${escapeSQL(u['Photo'])}, 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);`;

            usersSql.push(sql);
        });
        usersSql.push('SET FOREIGN_KEY_CHECKS = 1;');
        fs.writeFileSync(path.join(config.outputDir, 'import_usuarios_v3.sql'), usersSql.join('\n'));


        // ------------------------------------
        // Step 2: Notificaciones
        // ------------------------------------
        console.log(`\nStep 2: Processing ${cedulas.length} Notificaciones...`);
        const notifMap = new Map(); // glide_id_cedula -> deterministic_uuid
        const notifSql = [`-- SGND Notificaciones (Deterministic V3)`];
        notifSql.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

        // AUTO-FIX SCHEMA to support new data formats
        notifSql.push('ALTER TABLE notificaciones MODIFY COLUMN destinatario_especial VARCHAR(50);');
        notifSql.push('ALTER TABLE notificaciones MODIFY COLUMN usuario_carga VARCHAR(100);');

        cedulas.forEach(c => {
            const idCedula = c['id_cedula'];
            if (!idCedula) return;

            const uuid = getDeterministicUuid(idCedula, 'cedula');
            notifMap.set(idCedula, uuid);

            // Resolve Foreign Keys using userMap
            const asignadoRaw = cleanString(c['Ujier_asignado']); // Name or ID
            let asignadoUuid = asignadoRaw && userMap.has(asignadoRaw) ? userMap.get(asignadoRaw) : 'NULL';

            // Direct mapping for usuario_carga (no lookup, just raw value)
            const usuarioCargaVal = cleanString(c['id_usuario_carga']) || cleanString(c['cargado_por']);

            // Column Mappings
            const fecha = parseDate(c['fecha_carga']);
            const fechaEntrega = parseDate(c['fecha_entrega_ujier']);
            const devuelta = (c['devuelta_por_ujier'] || '').toLowerCase() === 'true' ? 1 : 0; // Assuming 'true' string from Glide
            const destEspecial = (c['destino_especial'] || '').toLowerCase() === 'true' ? '1' : '0'; // Boolean explicit mapping

            const costo = parseDecimal(c['costo']);
            const nTroquel = c['troquel'] ? parseInt(c['troquel']) : null;

            const sql = `INSERT INTO notificaciones (
                id, glide_id_cedula, migrated_from_glide, fecha_carga, fecha_entrega_ujier, devuelta_por_ujier, usuario_carga,
                estado, tipo_notificacion, n_expediente, caratula, origen, letrado,
                destinatario_especial, destinatario_nombre, domicilio, zona,
                tipo_troquel, n_troquel, medio_pago, costo, observaciones_iniciales, asignado_a, created_at
            ) VALUES (
                ${escapeSQL(uuid)}, ${escapeSQL(idCedula)}, 1, ${escapeSQL(fecha)}, ${escapeSQL(fechaEntrega)}, ${devuelta}, ${escapeSQL(usuarioCargaVal)},
                ${escapeSQL(mapEstado(c['estado_notificacion']))}, ${escapeSQL(mapTipoNotificacion(c['tipo_not']))}, ${escapeSQL(c['n_exp'])}, ${escapeSQL(c['caratula'])},
                ${escapeSQL(c['origen'])}, ${escapeSQL(c['letrado'])}, ${escapeSQL(destEspecial)},
                ${escapeSQL(c['destinatario'])}, ${escapeSQL(c['domicilio'])}, ${escapeSQL(c['zona_cedula'])},
                ${escapeSQL(c['troquel_categoria'])}, ${nTroquel || 'NULL'}, ${escapeSQL(mapMedioPago(c['Medio de pago']))},
                ${costo}, ${escapeSQL(c['observaciones'])}, ${escapeSQL(asignadoUuid)}, ${escapeSQL(fecha) || 'NOW()'}
            ) ON DUPLICATE KEY UPDATE 
                migrated_from_glide=1,
                estado=VALUES(estado),
                asignado_a=VALUES(asignado_a),
                fecha_entrega_ujier=VALUES(fecha_entrega_ujier),
                devuelta_por_ujier=VALUES(devuelta_por_ujier),
                domicilio=VALUES(domicilio);`;

            notifSql.push(sql);
        });
        notifSql.push('SET FOREIGN_KEY_CHECKS = 1;');
        fs.writeFileSync(path.join(config.outputDir, 'import_notificaciones_v3.sql'), notifSql.join('\n'));


        // ------------------------------------
        // Step 3: Visitas
        // ------------------------------------
        console.log(`\nStep 3: Processing ${visitas.length} Visitas...`);
        const visitasSql = [`-- SGND Visitas (Deterministic V3)`];
        visitasSql.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

        visitas.forEach(v => {
            const idCedula = v['ID_cedula'];
            if (!notifMap.has(idCedula)) return;

            const notifUuid = notifMap.get(idCedula);

            // Deterministic Visit ID
            const rowId = v['Row ID'] || v['$Row ID'] || (idCedula + '_' + v['fecha_hora_visita']);
            const visitUuid = getDeterministicUuid(rowId, 'visita');

            // Resolve Ujier
            const ujierRaw = cleanString(v['id_ujier']) || cleanString(v['nombre_ujier']);
            let ujierUuid = ujierRaw && userMap.has(ujierRaw) ? userMap.get(ujierRaw) : 'NULL';

            const fecha = parseDate(v['fecha_hora_visita']);
            const coords = parseCoordinates(v['ubicacion_ujier']);
            const transcripcion = cleanString(v['transcripción_observación']);

            const sql = `INSERT INTO visitas (
                id, notificacion_id, ujier_id, migrated_from_glide,
                resultado, observaciones, transcripcion_audio, ubicacion_lat, ubicacion_lng,
                foto_url, fecha
            ) VALUES (
                ${escapeSQL(visitUuid)}, ${escapeSQL(notifUuid)}, ${escapeSQL(ujierUuid)}, 1,
                ${escapeSQL(cleanString(v['estado_notificacion']))}, ${escapeSQL(cleanString(v['observaciones_ujier']))}, ${escapeSQL(transcripcion)},
                ${coords.lat || 'NULL'}, ${coords.lng || 'NULL'},
                ${escapeSQL(cleanString(v['foto_domicilio']))}, ${escapeSQL(fecha) || 'NOW()'}
            ) ON DUPLICATE KEY UPDATE
                ujier_id=VALUES(ujier_id),
                resultado=VALUES(resultado),
                observaciones=VALUES(observaciones),
                transcripcion_audio=VALUES(transcripcion_audio),
                fecha=VALUES(fecha);`;

            visitasSql.push(sql);
        });

        visitasSql.push('SET FOREIGN_KEY_CHECKS = 1;');
        fs.writeFileSync(path.join(config.outputDir, 'import_visitas_v3.sql'), visitasSql.join('\n'));

        console.log(`\nDONE! Generated v3 scripts including Users.`);

    } catch (e) {
        console.error("Error:", e);
    }
}

migrate();

/**
 * ================================================
 * SGND - Glide Data Migration Script (Node.js)
 * ================================================
 * 
 * This script migrates historical data from the old Glide system
 * into the new SGND MySQL database.
 * 
 * CSV Files:
 * - 92e43e.cedulas.csv -> notificaciones table
 * - e9c740.visitas.csv -> visitas table
 * 
 * Usage: node migrate_glide_data.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const config = {
    cedulasFile: path.join(__dirname, '..', '92e43e.cedulas.csv'),
    visitasFile: path.join(__dirname, '..', 'e9c740.visitas.csv'),
    outputDir: __dirname,
};

// Check for dry run mode
const dryRun = process.argv.includes('--dry-run');

console.log('================================================');
console.log('SGND - Glide Data Migration Script (Node.js)');
console.log('================================================');
console.log(`Mode: ${dryRun ? 'DRY RUN (analysis only)' : 'LIVE'}\n`);

// ------------------------------------
// Helper Functions
// ------------------------------------

function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;

    const trimmed = dateStr.trim();

    // Try DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm
    const euroMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2})?:?(\d{2})?:?(\d{2})?$/);
    if (euroMatch) {
        const [, day, month, year, hour = '0', minute = '0', second = '0'] = euroMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
    }

    // Try ISO format YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s*(\d{2})?:?(\d{2})?:?(\d{2})?$/);
    if (isoMatch) {
        const [, year, month, day, hour = '0', minute = '0', second = '0'] = isoMatch;
        return `${year}-${month}-${day} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
    }

    // Try native Date parsing as fallback
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
        return date.toISOString().replace('T', ' ').substring(0, 19);
    }

    return null;
}

function parseDecimal(value) {
    if (!value || value.trim() === '') return 0.0;
    // Handle comma as decimal separator
    const cleaned = value.replace(',', '.').replace(/[^0-9.\-]/g, '');
    return parseFloat(cleaned) || 0.0;
}

function parseCoordinates(location) {
    if (!location || location.trim() === '') {
        return { lat: null, lng: null };
    }

    // Parse "lat, lng" format
    const coordMatch = location.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (coordMatch) {
        return {
            lat: parseFloat(coordMatch[1]),
            lng: parseFloat(coordMatch[2])
        };
    }

    // Try Google Maps URL format
    const mapsMatch = location.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (mapsMatch) {
        return {
            lat: parseFloat(mapsMatch[1]),
            lng: parseFloat(mapsMatch[2])
        };
    }

    return { lat: null, lng: null };
}

function mapEstado(estado) {
    const normalized = (estado || '').toLowerCase().trim();

    const mapping = {
        'pendiente': 'pendiente',
        'asignada': 'pendiente',
        'diligenciada': 'diligenciada',
        'notificada': 'diligenciada',
        'completada': 'diligenciada',
        'diferida': 'diferida',
        'devuelta': 'diferida',
    };

    return mapping[normalized] || 'pendiente';
}

function mapMedioPago(medio) {
    const normalized = (medio || '').toLowerCase().trim();

    const mapping = {
        'gratuito': 'gratuito',
        'gratis': 'gratuito',
        'efectivo': 'efectivo',
        'cash': 'efectivo',
        'transferencia': 'transferencia',
        'banco': 'transferencia',
        'qr': 'qr',
    };

    return mapping[normalized] || null;
}

function mapDestinoEspecial(destino) {
    const normalized = (destino || '').toLowerCase().trim();

    if (normalized.includes('estrado')) return 'estrados';
    if (normalized.includes('arcat')) return 'arcat';

    return null;
}

function cleanString(value) {
    if (!value) return null;
    const cleaned = value.trim();
    return cleaned === '' ? null : cleaned;
}

function escapeSQL(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return value.toString();
    // Escape single quotes for SQL
    const escaped = String(value).replace(/'/g, "''");
    return `'${escaped}'`;
}

async function readCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            reject(new Error(`File not found: ${filePath}`));
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

                // Remove BOM
                if (i === 0 && line.charCodeAt(0) === 0xFEFF) {
                    line = line.slice(1);
                }

                if (inQuotes) {
                    lineBuffer += '\n' + line;
                } else {
                    lineBuffer = line;
                }

                for (let j = (inQuotes ? lineBuffer.lastIndexOf('\n') + 1 : 0); j < lineBuffer.length; j++) {
                    const char = lineBuffer[j];
                    const nextChar = lineBuffer[j + 1];

                    if (char === '"') {
                        if (!inQuotes) {
                            inQuotes = true;
                        } else if (nextChar === '"') {
                            currentField += '"';
                            j++;
                        } else {
                            inQuotes = false;
                        }
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
                        header = currentRow;
                    } else if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
                        const row = {};
                        header.forEach((col, idx) => {
                            row[col] = currentRow[idx] || '';
                        });
                        rows.push(row);
                    }
                    currentRow = [];
                }
            }
            resolve(rows);
        } catch (err) {
            reject(err);
        }
    });
}

// ------------------------------------
// Main Migration Logic
// ------------------------------------

async function migrate() {
    try {
        // ------------------------------------
        // Step 1: Read and Analyze Cédulas
        // ------------------------------------
        console.log('Step 1: Analyzing Cédulas (Notificaciones)');
        console.log('------------------------------------------');

        const cedulas = await readCsvFile(config.cedulasFile);
        console.log(`Found ${cedulas.length} cédulas to migrate\n`);

        // Track ID mapping for visitas migration
        const idMapping = {}; // old_id_cedula => new_uuid

        // Generate SQL inserts for notificaciones
        const notificacionesSql = [];
        const errors = [];

        notificacionesSql.push(`-- ================================================`);
        notificacionesSql.push(`-- SGND - Migrated Notificaciones from Glide`);
        notificacionesSql.push(`-- Generated: ${new Date().toISOString()}`);
        notificacionesSql.push(`-- Total records: ${cedulas.length}`);
        notificacionesSql.push(`-- ================================================\n`);

        notificacionesSql.push(`-- Disable foreign key checks during import`);
        notificacionesSql.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

        cedulas.forEach((cedula, index) => {
            try {
                const idCedula = cedula['id_cedula'] || '';
                if (!idCedula) {
                    errors.push(`Row ${index}: Missing id_cedula`);
                    return;
                }

                const newId = generateUuid();
                idMapping[idCedula] = newId;

                const fechaCarga = parseDate(cedula['fecha_carga']);
                const estado = mapEstado(cedula['estado_notificacion']);
                const tipoNotificacion = cleanString(cedula['tipo_not']) || 'cedulas';
                const nExpediente = cleanString(cedula['n_exp']) || 'SIN EXPEDIENTE';
                const caratula = cleanString(cedula['caratula']) || 'SIN CARÁTULA';
                const origen = cleanString(cedula['origen']) || 'SIN ORIGEN';
                const letrado = cleanString(cedula['letrado']);
                const destinatarioEspecial = mapDestinoEspecial(cedula['destino_especial']);
                const destinatarioNombre = cleanString(cedula['destinatario']) || 'SIN DESTINATARIO';
                const domicilio = cleanString(cedula['domicilio']) || 'SIN DOMICILIO';
                const zona = cleanString(cedula['zona_cedula']) || 'sin_zona';
                const tipoTroquel = (cleanString(cedula['troquel_categoria']) || 'X').charAt(0);
                const nTroquel = cedula['troquel'] ? parseInt(cedula['troquel']) : null;
                const medioPago = mapMedioPago(cedula['Medio de pago']);
                const costo = parseDecimal(cedula['costo']);
                const observaciones = cleanString(cedula['observaciones']);
                // Usamos el ID de usuario (DNI) como usuario_carga principal
                const usuarioCarga = cleanString(cedula['id_usuario_carga']) || cleanString(cedula['cargado_por']);
                const asignadoA = cleanString(cedula['Ujier_asignado']);

                const sql = `INSERT INTO notificaciones (id, glide_id_cedula, migrated_from_glide, fecha_carga, usuario_carga, estado, tipo_notificacion, n_expediente, caratula, origen, letrado, destinatario_especial, destinatario_nombre, domicilio, zona, tipo_troquel, n_troquel, medio_pago, costo, observaciones_iniciales, asignado_a, created_at) 
VALUES (${escapeSQL(newId)}, ${escapeSQL(idCedula)}, 1, ${escapeSQL(fechaCarga)}, ${escapeSQL(usuarioCarga)}, ${escapeSQL(estado)}, ${escapeSQL(tipoNotificacion)}, ${escapeSQL(nExpediente)}, ${escapeSQL(caratula)}, ${escapeSQL(origen)}, ${escapeSQL(letrado)}, ${escapeSQL(destinatarioEspecial)}, ${escapeSQL(destinatarioNombre)}, ${escapeSQL(domicilio)}, ${escapeSQL(zona)}, ${escapeSQL(tipoTroquel)}, ${nTroquel || 'NULL'}, ${escapeSQL(medioPago)}, ${costo}, ${escapeSQL(observaciones)}, ${escapeSQL(asignadoA)}, ${escapeSQL(fechaCarga) || 'NOW()'})
ON DUPLICATE KEY UPDATE 
fecha_carga = VALUES(fecha_carga), 
usuario_carga = VALUES(usuario_carga), 
estado = VALUES(estado), 
tipo_notificacion = VALUES(tipo_notificacion), 
caratula = VALUES(caratula), 
asignado_a = VALUES(asignado_a),
observaciones_iniciales = VALUES(observaciones_iniciales);`;

                notificacionesSql.push(sql);

            } catch (e) {
                errors.push(`Row ${index}: ${e.message}`);
            }
        });

        notificacionesSql.push(`\n-- Re-enable foreign key checks`);
        notificacionesSql.push(`SET FOREIGN_KEY_CHECKS = 1;`);

        console.log(`✓ Generated SQL for ${cedulas.length - errors.length} notificaciones`);
        if (errors.length > 0) {
            console.log(`  Errors: ${errors.length}`);
            errors.slice(0, 5).forEach(e => console.log(`    • ${e}`));
        }

        // Save SQL file
        const notificacionesSqlFile = path.join(config.outputDir, 'import_notificaciones.sql');
        fs.writeFileSync(notificacionesSqlFile, notificacionesSql.join('\n'), 'utf-8');
        console.log(`→ SQL saved to: ${notificacionesSqlFile}\n`);

        // ------------------------------------
        // Step 2: Read and Analyze Visitas
        // ------------------------------------
        console.log('Step 2: Analyzing Visitas');
        console.log('-------------------------');

        const visitas = await readCsvFile(config.visitasFile);
        console.log(`Found ${visitas.length} visitas to migrate\n`);

        const visitasSql = [];
        const visitasErrors = [];
        let skippedCount = 0;

        visitasSql.push(`-- ================================================`);
        visitasSql.push(`-- SGND - Migrated Visitas from Glide`);
        visitasSql.push(`-- Generated: ${new Date().toISOString()}`);
        visitasSql.push(`-- Total records: ${visitas.length}`);
        visitasSql.push(`-- ================================================\n`);

        visitasSql.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

        visitas.forEach((visita, index) => {
            try {
                const idCedula = visita['ID_cedula'] || '';

                // Check if parent notificacion exists
                if (!idMapping[idCedula]) {
                    skippedCount++;
                    return;
                }

                const notificacionId = idMapping[idCedula];
                const newId = generateUuid();
                const coords = parseCoordinates(visita['ubicacion_ujier']);

                const fecha = parseDate(visita['fecha_hora_visita']);
                const resultado = cleanString(visita['estado_notificacion']);
                const observaciones = cleanString(visita['observaciones_ujier']);
                const fotoUrl = cleanString(visita['foto_domicilio']);

                const sql = `INSERT INTO visitas (id, notificacion_id, migrated_from_glide, resultado, observaciones, ubicacion_lat, ubicacion_lng, foto_url, fecha) VALUES (${escapeSQL(newId)}, ${escapeSQL(notificacionId)}, 1, ${escapeSQL(resultado)}, ${escapeSQL(observaciones)}, ${coords.lat || 'NULL'}, ${coords.lng || 'NULL'}, ${escapeSQL(fotoUrl)}, ${escapeSQL(fecha) || 'NOW()'});`;

                visitasSql.push(sql);

            } catch (e) {
                visitasErrors.push(`Row ${index}: ${e.message}`);
            }
        });

        visitasSql.push(`\nSET FOREIGN_KEY_CHECKS = 1;`);

        console.log(`✓ Generated SQL for ${visitas.length - skippedCount - visitasErrors.length} visitas`);
        console.log(`  Skipped (orphaned): ${skippedCount}`);
        if (visitasErrors.length > 0) {
            console.log(`  Errors: ${visitasErrors.length}`);
        }

        // Save SQL file
        const visitasSqlFile = path.join(config.outputDir, 'import_visitas.sql');
        fs.writeFileSync(visitasSqlFile, visitasSql.join('\n'), 'utf-8');
        console.log(`→ SQL saved to: ${visitasSqlFile}\n`);

        // ------------------------------------
        // Step 3: Extract Unique Users (Ujieres)
        // ------------------------------------
        console.log('Step 3: Extracting Unique Ujieres');
        console.log('---------------------------------');

        const ujieres = new Map();
        visitas.forEach(visita => {
            const idUjier = visita['id_ujier'] || '';
            const nombreUjier = visita['nombre_ujier'] || '';

            if (idUjier && !ujieres.has(idUjier)) {
                ujieres.set(idUjier, {
                    glide_id: idUjier,
                    nombre: nombreUjier,
                });
            }
        });

        console.log(`Found ${ujieres.size} unique ujieres\n`);

        // Generate ujieres insert SQL
        const ujieresSql = [];
        ujieresSql.push(`-- ================================================`);
        ujieresSql.push(`-- SGND - Ujieres to Import`);
        ujieresSql.push(`-- Review and update email addresses before running`);
        ujieresSql.push(`-- ================================================\n`);

        ujieres.forEach((ujier) => {
            const newId = generateUuid();
            const emailSugerido = ujier.nombre
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, '.')
                .replace(/[^a-z0-9.]/g, '') + '@sgnd.gob.ar';

            ujieresSql.push(`-- Ujier: ${ujier.nombre} (Glide ID: ${ujier.glide_id})`);
            ujieresSql.push(`INSERT INTO usuarios (id, glide_id, email, nombre, rol, activo) VALUES (${escapeSQL(newId)}, ${escapeSQL(ujier.glide_id)}, ${escapeSQL(emailSugerido)}, ${escapeSQL(ujier.nombre)}, 'ujier', 1);`);
            ujieresSql.push('');
        });

        const ujieresSqlFile = path.join(config.outputDir, 'import_ujieres.sql');
        fs.writeFileSync(ujieresSqlFile, ujieresSql.join('\n'), 'utf-8');
        console.log(`→ Ujieres SQL saved to: ${ujieresSqlFile}\n`);

        // Save ID mapping
        const mappingFile = path.join(config.outputDir, 'id_mapping.json');
        fs.writeFileSync(mappingFile, JSON.stringify(idMapping, null, 2), 'utf-8');
        console.log(`→ ID mapping saved to: ${mappingFile}\n`);

        // ------------------------------------
        // Summary
        // ------------------------------------
        console.log('================================================');
        console.log('MIGRATION ANALYSIS COMPLETE');
        console.log('================================================');
        console.log(`\nGenerated files:`);
        console.log(`  1. ${notificacionesSqlFile}`);
        console.log(`  2. ${visitasSqlFile}`);
        console.log(`  3. ${ujieresSqlFile}`);
        console.log(`  4. ${mappingFile}`);
        console.log(`\nNext steps:`);
        console.log(`  1. Run migration_glide_tracking.sql to add tracking columns`);
        console.log(`  2. Review and run import_ujieres.sql to create user accounts`);
        console.log(`  3. Run import_notificaciones.sql to import cédulas`);
        console.log(`  4. Run import_visitas.sql to import visit records`);
        console.log(`  5. Update visitas.ujier_id with proper user mappings`);

    } catch (error) {
        console.error(`\n✗ ERROR: ${error.message}`);
        process.exit(1);
    }
}

// Run migration
migrate();

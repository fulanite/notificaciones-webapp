/**
 * ================================================
 * SGND - Glide Data Migration Script V2 (Tolerante)
 * ================================================
 * 
 * Parser mejorado que maneja:
 * - Saltos de línea dentro de campos
 * - Comas dentro de campos entrecomillados
 * - Campos con columnas extras o faltantes
 */

const fs = require('fs');
const path = require('path');

const config = {
    cedulasFile: path.join(__dirname, '..', '92e43e.cedulas.csv'),
    visitasFile: path.join(__dirname, '..', 'e9c740.visitas.csv'),
    outputDir: __dirname,
};

console.log('================================================');
console.log('SGND - Migración V2 (Parser Tolerante)');
console.log('================================================\n');

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
    if (!location || location.trim() === '') {
        return { lat: null, lng: null };
    }

    const coordMatch = location.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (coordMatch) {
        return {
            lat: parseFloat(coordMatch[1]),
            lng: parseFloat(coordMatch[2])
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
    // Limpiar saltos de línea y espacios extras
    const cleaned = value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned === '' ? null : cleaned;
}

function escapeSQL(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return value.toString();
    const escaped = String(value).replace(/'/g, "''").replace(/\\/g, '\\\\');
    return `'${escaped}'`;
}

/**
 * Parser CSV tolerante que maneja campos multilínea
 */
function parseCSVTolerant(content, expectedColumns) {
    const rows = [];
    const lines = content.split('\n');
    let header = null;
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let lineBuffer = '';

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Remover BOM si existe
        if (i === 0 && line.charCodeAt(0) === 0xFEFF) {
            line = line.slice(1);
        }

        // Si estamos en medio de un campo entrecomillado, agregar la línea
        if (inQuotes) {
            lineBuffer += '\n' + line;
        } else {
            lineBuffer = line;
        }

        // Procesar el buffer caracter por caracter
        for (let j = (inQuotes ? lineBuffer.lastIndexOf('\n') + 1 : 0); j < lineBuffer.length; j++) {
            const char = lineBuffer[j];
            const nextChar = lineBuffer[j + 1];

            if (char === '"') {
                if (!inQuotes) {
                    inQuotes = true;
                } else if (nextChar === '"') {
                    currentField += '"';
                    j++; // Saltar la siguiente comilla
                } else {
                    inQuotes = false;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentField.trim());
                currentField = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                // Ignorar CR/LF fuera de comillas
            } else {
                currentField += char;
            }
        }

        // Si no estamos en comillas, la fila está completa
        if (!inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
            lineBuffer = '';

            // Procesar la fila
            if (!header) {
                header = currentRow;
                console.log(`Header encontrado con ${header.length} columnas`);
            } else if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
                // Ajustar el número de columnas si es necesario
                if (currentRow.length < expectedColumns) {
                    // Rellenar con valores vacíos
                    while (currentRow.length < expectedColumns) {
                        currentRow.push('');
                    }
                } else if (currentRow.length > expectedColumns) {
                    // Combinar columnas extras en la última columna válida
                    // (asumiendo que el problema está en observaciones/caratula)
                    const extras = currentRow.slice(expectedColumns - 1);
                    currentRow = currentRow.slice(0, expectedColumns - 1);
                    currentRow.push(extras.join(' '));
                }

                // Crear objeto con header
                const rowObj = {};
                header.forEach((col, idx) => {
                    rowObj[col] = currentRow[idx] || '';
                });
                rows.push(rowObj);
            }

            currentRow = [];
        }
    }

    return { header, rows };
}

// ------------------------------------
// Main Migration Logic
// ------------------------------------

async function migrate() {
    try {
        // ------------------------------------
        // Migrar Cédulas
        // ------------------------------------
        console.log('\n📋 Procesando CÉDULAS...\n');

        const cedulasContent = fs.readFileSync(config.cedulasFile, 'utf-8');
        const { rows: cedulas } = parseCSVTolerant(cedulasContent, 25);
        console.log(`Registros parseados: ${cedulas.length}\n`);

        const idMapping = {};
        const notificacionesSql = [];
        let cedulasOk = 0;
        let cedulasError = 0;

        notificacionesSql.push(`-- ================================================`);
        notificacionesSql.push(`-- SGND - Notificaciones Migradas V2 (Tolerante)`);
        notificacionesSql.push(`-- Generado: ${new Date().toISOString()}`);
        notificacionesSql.push(`-- Total registros: ${cedulas.length}`);
        notificacionesSql.push(`-- ================================================\n`);
        notificacionesSql.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

        cedulas.forEach((cedula, index) => {
            try {
                const idCedula = cedula['id_cedula'] || '';
                if (!idCedula) {
                    cedulasError++;
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
                const usuarioCarga = cleanString(cedula['cargado_por']);

                const sql = `INSERT INTO notificaciones (id, glide_id_cedula, migrated_from_glide, fecha_carga, usuario_carga, estado, tipo_notificacion, n_expediente, caratula, origen, letrado, destinatario_especial, destinatario_nombre, domicilio, zona, tipo_troquel, n_troquel, medio_pago, costo, observaciones_iniciales, created_at) VALUES (${escapeSQL(newId)}, ${escapeSQL(idCedula)}, 1, ${escapeSQL(fechaCarga)}, ${escapeSQL(usuarioCarga)}, ${escapeSQL(estado)}, ${escapeSQL(tipoNotificacion)}, ${escapeSQL(nExpediente)}, ${escapeSQL(caratula)}, ${escapeSQL(origen)}, ${escapeSQL(letrado)}, ${escapeSQL(destinatarioEspecial)}, ${escapeSQL(destinatarioNombre)}, ${escapeSQL(domicilio)}, ${escapeSQL(zona)}, ${escapeSQL(tipoTroquel)}, ${nTroquel || 'NULL'}, ${escapeSQL(medioPago)}, ${costo}, ${escapeSQL(observaciones)}, ${escapeSQL(fechaCarga) || 'NOW()'});`;

                notificacionesSql.push(sql);
                cedulasOk++;

            } catch (e) {
                cedulasError++;
            }
        });

        notificacionesSql.push(`\nSET FOREIGN_KEY_CHECKS = 1;`);

        console.log(`✓ Cédulas procesadas: ${cedulasOk}`);
        console.log(`✗ Cédulas con error: ${cedulasError}`);

        // Guardar SQL
        const notificacionesSqlFile = path.join(config.outputDir, 'import_notificaciones_v2.sql');
        fs.writeFileSync(notificacionesSqlFile, notificacionesSql.join('\n'), 'utf-8');
        console.log(`→ SQL guardado: ${notificacionesSqlFile}\n`);

        // ------------------------------------
        // Migrar Visitas
        // ------------------------------------
        console.log('\n📋 Procesando VISITAS...\n');

        const visitasContent = fs.readFileSync(config.visitasFile, 'utf-8');
        const { rows: visitas } = parseCSVTolerant(visitasContent, 23);
        console.log(`Registros parseados: ${visitas.length}\n`);

        const visitasSql = [];
        let visitasOk = 0;
        let visitasSkipped = 0;
        let visitasError = 0;

        visitasSql.push(`-- ================================================`);
        visitasSql.push(`-- SGND - Visitas Migradas V2 (Tolerante)`);
        visitasSql.push(`-- Generado: ${new Date().toISOString()}`);
        visitasSql.push(`-- Total registros: ${visitas.length}`);
        visitasSql.push(`-- ================================================\n`);
        visitasSql.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

        visitas.forEach((visita, index) => {
            try {
                const idCedula = visita['ID_cedula'] || '';

                if (!idMapping[idCedula]) {
                    visitasSkipped++;
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
                visitasOk++;

            } catch (e) {
                visitasError++;
            }
        });

        visitasSql.push(`\nSET FOREIGN_KEY_CHECKS = 1;`);

        console.log(`✓ Visitas procesadas: ${visitasOk}`);
        console.log(`⊘ Visitas sin cédula padre: ${visitasSkipped}`);
        console.log(`✗ Visitas con error: ${visitasError}`);

        // Guardar SQL
        const visitasSqlFile = path.join(config.outputDir, 'import_visitas_v2.sql');
        fs.writeFileSync(visitasSqlFile, visitasSql.join('\n'), 'utf-8');
        console.log(`→ SQL guardado: ${visitasSqlFile}\n`);

        // Guardar mapping
        const mappingFile = path.join(config.outputDir, 'id_mapping_v2.json');
        fs.writeFileSync(mappingFile, JSON.stringify(idMapping, null, 2), 'utf-8');

        // ------------------------------------
        // Resumen
        // ------------------------------------
        console.log('\n================================================');
        console.log('MIGRACIÓN V2 COMPLETADA');
        console.log('================================================');
        console.log(`\nArchivos generados:`);
        console.log(`  1. ${notificacionesSqlFile}`);
        console.log(`  2. ${visitasSqlFile}`);
        console.log(`\nResumen:`);
        console.log(`  Cédulas: ${cedulasOk} de ${cedulas.length} (${(cedulasOk / cedulas.length * 100).toFixed(1)}%)`);
        console.log(`  Visitas: ${visitasOk} de ${visitas.length} (${(visitasOk / visitas.length * 100).toFixed(1)}%)`);

    } catch (error) {
        console.error(`\n✗ ERROR: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

migrate();

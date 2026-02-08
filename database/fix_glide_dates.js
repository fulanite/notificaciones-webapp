const fs = require('fs');
const path = require('path');

const config = {
    cedulasFile: path.join(__dirname, '..', '92e43e.cedulas.csv'),
    outputDir: __dirname,
};

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

function escapeSQL(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return value.toString();
    const escaped = String(value).replace(/'/g, "''").replace(/\\/g, '\\\\');
    return `'${escaped}'`;
}

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

async function generateFix() {
    try {
        console.log('\n📋 Generando SQL para corregir fechas de entrega...\n');

        const cedulasContent = fs.readFileSync(config.cedulasFile, 'utf-8');
        const { rows: cedulas } = parseCSVTolerant(cedulasContent, 25);

        console.log(`Registros parseados: ${cedulas.length}\n`);

        const sqlStatements = [];
        let updatesCount = 0;

        sqlStatements.push('-- Corrección de fechas de entrega migración Glide');
        sqlStatements.push(`-- Generado: ${new Date().toISOString()}`);
        sqlStatements.push('SET SQL_SAFE_UPDATES = 0;');

        const missingDates = [];

        cedulas.forEach(cedula => {
            const idCedula = cedula['id_cedula'];
            const fechaEntregaStr = cedula['fecha_entrega_ujier'];
            const fechaEntrega = parseDate(fechaEntregaStr);

            if (idCedula) {
                if (fechaEntrega) {
                    const sql = `UPDATE notificaciones SET fecha_entrega_ujier = ${escapeSQL(fechaEntrega)} WHERE glide_id_cedula = ${escapeSQL(idCedula)};`;
                    sqlStatements.push(sql);
                    updatesCount++;
                } else {
                    missingDates.push({ id: idCedula, raw: fechaEntregaStr });
                }
            }
        });

        sqlStatements.push('SET SQL_SAFE_UPDATES = 1;');

        // Agregar consulta de auditoría al final del script SQL
        sqlStatements.push('\n-- Auditoría: Verificar si quedaron filas sin fecha de entrega (que no estaban en el CSV o fallaron)');
        sqlStatements.push('SELECT id, glide_id_cedula, fecha_carga, fecha_entrega_ujier FROM notificaciones WHERE fecha_entrega_ujier IS NULL AND migrated_from_glide = 1;');

        const outputFile = path.join(config.outputDir, 'fix_fechas_entrega.sql');
        fs.writeFileSync(outputFile, sqlStatements.join('\n'), 'utf-8');

        console.log(`✓ Se generaron ${updatesCount} sentencias UPDATE.`);

        if (missingDates.length > 0) {
            console.log(`\n⚠ ATENCIÓN: Se encontraron ${missingDates.length} registros sin fecha de entrega en el CSV:`);
            console.log('Estos registros NO se actualizarán y quedarán con fecha NULL si no se corrige manualmenten.');
            // Mostrar los primeros 10 como ejemplo
            missingDates.slice(0, 10).forEach(m => console.log(`  - ID: ${m.id} (Valor original: "${m.raw || ''}")`));
            if (missingDates.length > 10) console.log(`  ... y ${missingDates.length - 10} más.`);
        } else {
            console.log('\n✓ Todos los registros en el CSV tienen fecha de entrega válida.');
        }

        console.log(`\n→ Archivo SQL guardado en: ${outputFile}\n`);
        console.log('Nota: El archivo SQL incluye al final una consulta SELECT para listar cualquier fila que quede con fecha NULL después de correr el script.');

    } catch (error) {
        console.error('Error:', error);
    }
}

generateFix();

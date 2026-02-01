/**
 * Diagnóstico de Migración - Encuentra registros omitidos
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const config = {
    cedulasFile: path.join(__dirname, '..', '92e43e.cedulas.csv'),
    visitasFile: path.join(__dirname, '..', 'e9c740.visitas.csv'),
};

console.log('================================================');
console.log('DIAGNÓSTICO DE MIGRACIÓN');
console.log('================================================\n');

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

async function analyzeFile(filePath, idColumn, fileType) {
    return new Promise((resolve, reject) => {
        const stats = {
            totalLines: 0,
            validRows: 0,
            emptyId: 0,
            columnMismatch: 0,
            emptyLines: 0,
            problems: []
        };

        let header = null;
        let lineNumber = 0;

        const rl = readline.createInterface({
            input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            lineNumber++;

            // Línea vacía
            if (!line.trim()) {
                stats.emptyLines++;
                return;
            }

            if (!header) {
                header = parseCSVLine(line);
                console.log(`[${fileType}] Header tiene ${header.length} columnas`);
                console.log(`[${fileType}] Columnas: ${header.join(', ')}\n`);
                return;
            }

            stats.totalLines++;
            const values = parseCSVLine(line);

            // Verificar si coincide el número de columnas
            if (values.length !== header.length) {
                stats.columnMismatch++;
                if (stats.problems.length < 10) {
                    stats.problems.push({
                        line: lineNumber,
                        reason: `Columnas: esperadas ${header.length}, encontradas ${values.length}`,
                        preview: line.substring(0, 100) + '...'
                    });
                }
                return;
            }

            // Crear objeto para verificar ID
            const row = {};
            header.forEach((col, idx) => {
                row[col] = values[idx];
            });

            // Verificar si tiene ID
            const id = row[idColumn];
            if (!id || id.trim() === '') {
                stats.emptyId++;
                if (stats.problems.length < 10) {
                    stats.problems.push({
                        line: lineNumber,
                        reason: `ID vacío (${idColumn})`,
                        preview: line.substring(0, 100) + '...'
                    });
                }
                return;
            }

            stats.validRows++;
        });

        rl.on('close', () => resolve(stats));
        rl.on('error', reject);
    });
}

async function runDiagnostic() {
    try {
        // Analizar Cédulas
        console.log('📋 Analizando CÉDULAS...\n');
        const cedulasStats = await analyzeFile(config.cedulasFile, 'id_cedula', 'Cédulas');

        console.log('Resultados Cédulas:');
        console.log(`  - Total líneas de datos: ${cedulasStats.totalLines}`);
        console.log(`  - Filas válidas: ${cedulasStats.validRows}`);
        console.log(`  - IDs vacíos: ${cedulasStats.emptyId}`);
        console.log(`  - Columnas incorrectas: ${cedulasStats.columnMismatch}`);
        console.log(`  - Líneas vacías: ${cedulasStats.emptyLines}`);

        if (cedulasStats.problems.length > 0) {
            console.log('\n  Problemas encontrados:');
            cedulasStats.problems.forEach(p => {
                console.log(`    Línea ${p.line}: ${p.reason}`);
            });
        }

        // Analizar Visitas
        console.log('\n\n📋 Analizando VISITAS...\n');
        const visitasStats = await analyzeFile(config.visitasFile, 'ID_cedula', 'Visitas');

        console.log('Resultados Visitas:');
        console.log(`  - Total líneas de datos: ${visitasStats.totalLines}`);
        console.log(`  - Filas válidas: ${visitasStats.validRows}`);
        console.log(`  - IDs vacíos: ${visitasStats.emptyId}`);
        console.log(`  - Columnas incorrectas: ${visitasStats.columnMismatch}`);
        console.log(`  - Líneas vacías: ${visitasStats.emptyLines}`);

        if (visitasStats.problems.length > 0) {
            console.log('\n  Problemas encontrados:');
            visitasStats.problems.forEach(p => {
                console.log(`    Línea ${p.line}: ${p.reason}`);
            });
        }

        // Resumen
        console.log('\n\n================================================');
        console.log('RESUMEN');
        console.log('================================================');
        console.log(`\nCédulas:`);
        console.log(`  CSV original: ${cedulasStats.totalLines + 1} líneas (incluyendo header)`);
        console.log(`  Registros migrados: ${cedulasStats.validRows}`);
        console.log(`  Diferencia: ${cedulasStats.totalLines - cedulasStats.validRows} registros omitidos`);

        console.log(`\nVisitas:`);
        console.log(`  CSV original: ${visitasStats.totalLines + 1} líneas (incluyendo header)`);
        console.log(`  Registros válidos para migrar: ${visitasStats.validRows}`);
        console.log(`  Diferencia: ${visitasStats.totalLines - visitasStats.validRows} registros omitidos`);

        console.log('\n\nNota: Las visitas también pueden omitirse si su ID_cedula');
        console.log('no existe en la tabla de cédulas (visitas huérfanas).');

    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

runDiagnostic();

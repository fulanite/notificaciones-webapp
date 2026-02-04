/**
 * Generar SQL para vincular notificaciones con ujieres
 * Usando glide_id_cedula y DNI
 */

const fs = require('fs');
const path = require('path');

const csvFile = path.join(__dirname, '..', '92e43e.cedulas.csv');
const outputFile = path.join(__dirname, 'vincular_ujier_directo.sql');

// Parser CSV
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

// Leer CSV
const content = fs.readFileSync(csvFile, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());

console.log('Generando SQL de vinculación...\n');

// Agrupar por DNI de ujier
const porDni = {};
for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const idCedula = values[0];  // id_cedula
    const ujierDni = values[21]; // Ujier_asignado

    if (idCedula && ujierDni && ujierDni.trim() !== '' && ujierDni.length > 5) {
        if (!porDni[ujierDni]) {
            porDni[ujierDni] = [];
        }
        porDni[ujierDni].push(idCedula);
    }
}

// Generar SQL
const sql = [];
sql.push('-- ================================================');
sql.push('-- Vincular Notificaciones con Ujieres por DNI');
sql.push(`-- Generado: ${new Date().toISOString()}`);
sql.push('-- ================================================\n');

// Por cada DNI de ujier, hacer un UPDATE
Object.entries(porDni).forEach(([dni, cedulas]) => {
    console.log(`DNI ${dni}: ${cedulas.length} cédulas`);

    // Dividir en batches de 50
    for (let i = 0; i < cedulas.length; i += 50) {
        const batch = cedulas.slice(i, i + 50);
        const lista = batch.map(c => `'${c}'`).join(',');

        sql.push(`-- Ujier DNI: ${dni}`);
        sql.push(`UPDATE notificaciones`);
        sql.push(`SET asignado_a = (SELECT id FROM usuarios WHERE dni = '${dni}' LIMIT 1)`);
        sql.push(`WHERE glide_id_cedula IN (${lista});`);
        sql.push('');
    }
});

sql.push('-- Verificar resultado');
sql.push(`SELECT u.nombre, COUNT(*) as asignadas
FROM notificaciones n
INNER JOIN usuarios u ON n.asignado_a = u.id
WHERE n.migrated_from_glide = 1
GROUP BY u.nombre
ORDER BY asignadas DESC;`);

fs.writeFileSync(outputFile, sql.join('\n'), 'utf-8');

console.log(`\n✓ Generado: ${outputFile}`);
console.log(`Total DNIs: ${Object.keys(porDni).length}`);
console.log(`Total cédulas con ujier: ${Object.values(porDni).flat().length}`);

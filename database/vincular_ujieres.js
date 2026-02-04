/**
 * Script para vincular notificaciones con ujieres asignados
 * Usando Ujier_asignado (DNI) del CSV de cédulas
 */

const fs = require('fs');
const path = require('path');

const csvFile = path.join(__dirname, '..', '92e43e.cedulas.csv');
const outputFile = path.join(__dirname, 'update_ujier_asignado.sql');

console.log('================================================');
console.log('Vinculando Notificaciones con Ujieres');
console.log('================================================\n');

// Parser CSV simple
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

const header = parseCSVLine(lines[0]);
console.log('Columnas relevantes:');
console.log('  - id_cedula (índice 0)');
console.log('  - Ujier_asignado (índice 21)');
console.log('');

// Encontrar índices
const idxIdCedula = header.indexOf('id_cedula');
const idxUjierAsignado = header.indexOf('Ujier_asignado');

console.log(`Índice id_cedula: ${idxIdCedula}`);
console.log(`Índice Ujier_asignado: ${idxUjierAsignado}`);
console.log('');

// Extraer asignaciones
const asignaciones = [];
for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const idCedula = values[idxIdCedula];
    const ujierDni = values[idxUjierAsignado];

    if (idCedula && ujierDni && ujierDni.trim() !== '') {
        asignaciones.push({
            id_cedula: idCedula.trim(),
            ujier_dni: ujierDni.trim()
        });
    }
}

console.log(`Cédulas con ujier asignado: ${asignaciones.length}`);

// Contar por ujier
const porUjier = {};
asignaciones.forEach(a => {
    porUjier[a.ujier_dni] = (porUjier[a.ujier_dni] || 0) + 1;
});

console.log('\nAsignaciones por ujier (DNI):');
Object.entries(porUjier).sort((a, b) => b[1] - a[1]).forEach(([dni, count]) => {
    console.log(`  ${dni}: ${count} cédulas`);
});

// Generar SQL
const sql = [];
sql.push('-- ================================================');
sql.push('-- SGND - Vincular Notificaciones con Ujieres Asignados');
sql.push(`-- Generado: ${new Date().toISOString()}`);
sql.push(`-- Total asignaciones: ${asignaciones.length}`);
sql.push('-- ================================================\n');

// Primero, cambiar estado a VARCHAR y actualizar estados
sql.push('-- PASO 1: Cambiar campo estado a VARCHAR');
sql.push('ALTER TABLE notificaciones MODIFY COLUMN estado VARCHAR(50) DEFAULT \'Pendiente\';');
sql.push('');

// Normalizar visitas
sql.push('-- PASO 2: Normalizar resultados en visitas');
sql.push("UPDATE visitas SET resultado = 'Atiende' WHERE resultado = 'Entregado';");
sql.push("UPDATE visitas SET resultado = 'No Atiende' WHERE resultado LIKE '%No Atiende%';");
sql.push('');

// Actualizar estado desde visitas
sql.push('-- PASO 3: Actualizar estado desde última visita');
sql.push(`UPDATE notificaciones n
INNER JOIN (
    SELECT v1.notificacion_id, v1.resultado, v1.fecha
    FROM visitas v1
    INNER JOIN (
        SELECT notificacion_id, MAX(fecha) as max_fecha
        FROM visitas GROUP BY notificacion_id
    ) v2 ON v1.notificacion_id = v2.notificacion_id AND v1.fecha = v2.max_fecha
    WHERE v1.resultado IS NOT NULL AND v1.resultado != ''
) ultima ON n.id = ultima.notificacion_id
SET n.estado = ultima.resultado, n.fecha_diligencia = ultima.fecha
WHERE n.migrated_from_glide = 1;`);
sql.push('');

sql.push("UPDATE notificaciones SET estado = 'Pendiente' WHERE (estado IS NULL OR estado = '' OR estado = 'pendiente') AND migrated_from_glide = 1;");
sql.push('');

// Actualizar asignado_a
sql.push('-- PASO 4: Vincular asignado_a con usuarios por DNI');
sql.push('-- Crear tabla temporal con el mapeo');
sql.push('');

// Agrupar por DNI para hacer updates en batch
const dniList = [...new Set(asignaciones.map(a => a.ujier_dni))];

dniList.forEach(dni => {
    const cedulas = asignaciones.filter(a => a.ujier_dni === dni).map(a => `'${a.id_cedula}'`);

    // Dividir en batches de 100 para evitar queries muy largos
    for (let i = 0; i < cedulas.length; i += 100) {
        const batch = cedulas.slice(i, i + 100);
        sql.push(`-- Ujier DNI: ${dni} (batch ${Math.floor(i / 100) + 1})`);
        sql.push(`UPDATE notificaciones n
SET n.asignado_a = (SELECT id FROM usuarios WHERE dni = '${dni}' OR glide_id = '${dni}' LIMIT 1)
WHERE n.glide_id_cedula IN (${batch.join(',')});`);
        sql.push('');
    }
});

sql.push('-- PASO 5: Verificar resultados');
sql.push(`SELECT 
    estado,
    COUNT(*) as cantidad
FROM notificaciones
WHERE migrated_from_glide = 1
GROUP BY estado
ORDER BY cantidad DESC;`);
sql.push('');

sql.push(`SELECT 
    IFNULL(u.nombre, 'Sin asignar') as ujier,
    COUNT(*) as asignadas
FROM notificaciones n
LEFT JOIN usuarios u ON n.asignado_a = u.id
WHERE n.migrated_from_glide = 1
GROUP BY u.nombre
ORDER BY asignadas DESC;`);

// Guardar
fs.writeFileSync(outputFile, sql.join('\n'), 'utf-8');

console.log(`\n✓ SQL generado: ${outputFile}`);
console.log('\n📋 Importá este archivo en phpMyAdmin');

/**
 * Script para actualizar TODAS las columnas faltantes en visitas
 * Busca por notificacion_id (que viene de notificaciones.glide_id_cedula)
 */

const fs = require('fs');
const path = require('path');

const csvFile = path.join(__dirname, '..', 'e9c740.visitas.csv');
const outputFile = path.join(__dirname, 'update_visitas_completas.sql');

console.log('================================================');
console.log('Actualizando Datos Completos de Visitas');
console.log('================================================\n');

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

function escapeSql(str) {
    if (!str) return null;
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

// Leer CSV
const content = fs.readFileSync(csvFile, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());

console.log(`Total visitas: ${lines.length - 1}`);

const sql = [];
sql.push('-- ================================================');
sql.push('-- Actualizar Datos Completos de Visitas Migradas');
sql.push(`-- Generado: ${new Date().toISOString()}`);
sql.push('-- Columnas: ubicacion, foto, observaciones, transcripcion, carga_diferida');
sql.push('-- ================================================\n');

// Agregar columnas faltantes
sql.push('-- Agregar columnas faltantes si no existen');
sql.push('ALTER TABLE visitas ADD COLUMN IF NOT EXISTS audio_transcripcion TEXT;');
sql.push('ALTER TABLE visitas ADD COLUMN IF NOT EXISTS carga_diferida BOOLEAN DEFAULT 0;');
sql.push('');

let count = 0;
let stats = {
    ubicacion: 0,
    foto: 0,
    observaciones: 0,
    transcripcion: 0,
    cargaDiferida: 0
};

for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    const idCedula = values[1]; // ID_cedula (es el glide_id_cedula de la notificación)
    const fechaVisita = values[2]; // fecha_hora_visita
    const fotoDomicilio = values[5]; // foto_domicilio
    const ubicacion = values[6]; // ubicacion_ujier
    const observaciones = values[8]; // observaciones_ujier
    const transcripcion = values[21]; // transcripción_observación
    const cargaDiferida = values[22]; // carga_diferida

    if (!idCedula) continue;

    const updates = [];

    // Parse ubicación - formato: "-28.4725851, -65.1234567"
    if (ubicacion && ubicacion.trim()) {
        const ubicacionClean = ubicacion.replace(/"/g, '').trim();
        const match = ubicacionClean.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
        if (match) {
            updates.push(`v.ubicacion_lat = ${parseFloat(match[1])}`);
            updates.push(`v.ubicacion_lng = ${parseFloat(match[2])}`);
            stats.ubicacion++;
        }
    }

    // Foto
    if (fotoDomicilio && fotoDomicilio.trim() && fotoDomicilio.includes('http')) {
        const fotoClean = fotoDomicilio.replace(/"/g, '').trim();
        updates.push(`v.foto_url = '${escapeSql(fotoClean)}'`);
        stats.foto++;
    }

    // Observaciones
    if (observaciones && observaciones.trim()) {
        const obsClean = observaciones.replace(/"/g, '').trim();
        if (obsClean.length > 0) {
            updates.push(`v.observaciones = '${escapeSql(obsClean)}'`);
            stats.observaciones++;
        }
    }

    // Transcripción
    if (transcripcion && transcripcion.trim()) {
        const transClean = transcripcion.replace(/"/g, '').trim();
        if (transClean.length > 0) {
            updates.push(`v.audio_transcripcion = '${escapeSql(transClean)}'`);
            stats.transcripcion++;
        }
    }

    // Carga diferida
    if (cargaDiferida && (cargaDiferida.toLowerCase() === 'true' || cargaDiferida === '1')) {
        updates.push(`v.carga_diferida = 1`);
        stats.cargaDiferida++;
    }

    if (updates.length > 0) {
        const fechaFormatted = fechaVisita.replace('T', ' ').substring(0, 19);
        // Buscar por notificacion_id que coincida con la notificación que tiene glide_id_cedula = idCedula
        sql.push(`UPDATE visitas v 
INNER JOIN notificaciones n ON v.notificacion_id = n.id 
SET ${updates.join(', ')} 
WHERE n.glide_id_cedula = '${idCedula}' AND DATE(v.fecha) = DATE('${fechaFormatted}');`);
        count++;
    }
}

sql.push('');
sql.push('-- Verificar resultados');
sql.push('SELECT COUNT(*) as con_ubicacion FROM visitas WHERE ubicacion_lat IS NOT NULL;');
sql.push('SELECT COUNT(*) as con_foto FROM visitas WHERE foto_url IS NOT NULL AND foto_url != \'\';');
sql.push('SELECT COUNT(*) as con_observaciones FROM visitas WHERE observaciones IS NOT NULL AND observaciones != \'\';');

fs.writeFileSync(outputFile, sql.join('\n'), 'utf-8');

console.log('\nEstadísticas de datos encontrados:');
console.log(`  📍 Con ubicación GPS: ${stats.ubicacion}`);
console.log(`  📸 Con foto: ${stats.foto}`);
console.log(`  📝 Con observaciones: ${stats.observaciones}`);
console.log(`  🎤 Con transcripción: ${stats.transcripcion}`);
console.log(`  ⏰ Carga diferida: ${stats.cargaDiferida}`);
console.log(`\n✓ Total updates generados: ${count}`);
console.log(`✓ SQL generado: ${outputFile}`);

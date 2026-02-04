/**
 * Migración de Usuarios desde Glide
 * Actualiza usuarios existentes y agrega nuevos
 */

const fs = require('fs');
const path = require('path');

const csvFile = 'C:\\Users\\fulanite\\Downloads\\Users (2).csv';
const outputDir = path.join(__dirname);

console.log('================================================');
console.log('MIGRACIÓN DE USUARIOS DESDE GLIDE');
console.log('================================================\n');

function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
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

function escapeSQL(value) {
    if (value === null || value === undefined || value === '') return 'NULL';
    const escaped = String(value).replace(/'/g, "''").replace(/\\/g, '\\\\');
    return `'${escaped}'`;
}

function mapRole(role) {
    const r = (role || '').toLowerCase().trim();
    if (r === 'admin') return 'admin';
    if (r === 'administrativo') return 'administrativo';
    if (r === 'ujier') return 'ujier';
    if (r === 'auditor') return 'auditor';
    return 'administrativo';
}

// Leer CSV
const content = fs.readFileSync(csvFile, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());
const header = parseCSVLine(lines[0]);

console.log('Columnas:', header.join(', '));
console.log('');

const users = [];
for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= 5) {
        const user = {
            nombre: values[0] || '',
            dni: values[1] || '',
            email: values[2] ? values[2].trim().toLowerCase() : '',
            foto: values[3] || '',
            rol: mapRole(values[4]),
            celular: values[6] || ''
        };

        // Solo agregar si tiene email válido
        if (user.email && user.email.includes('@')) {
            users.push(user);
        }
    }
}

console.log(`Usuarios encontrados: ${users.length}\n`);

// Generar SQL
const sql = [];

sql.push('-- ================================================');
sql.push('-- SGND - Migración de Usuarios desde Glide');
sql.push(`-- Generado: ${new Date().toISOString()}`);
sql.push(`-- Total usuarios: ${users.length}`);
sql.push('-- ================================================\n');

// Primero, eliminar los ujieres que creamos antes (tienen glide_id)
sql.push('-- Paso 1: Eliminar ujieres temporales creados anteriormente');
sql.push('DELETE FROM usuarios WHERE glide_id IS NOT NULL;');
sql.push('');

sql.push('-- Paso 2: Insertar usuarios reales con datos completos');

users.forEach(user => {
    const id = generateUuid();
    const glideId = user.dni || null;

    sql.push(`-- ${user.nombre} (${user.rol})`);
    sql.push(`INSERT INTO usuarios (id, glide_id, email, nombre, rol, foto, activo) VALUES (`);
    sql.push(`    ${escapeSQL(id)},`);
    sql.push(`    ${escapeSQL(glideId)},`);
    sql.push(`    ${escapeSQL(user.email)},`);
    sql.push(`    ${escapeSQL(user.nombre || 'Sin nombre')},`);
    sql.push(`    ${escapeSQL(user.rol)},`);
    sql.push(`    ${escapeSQL(user.foto || null)},`);
    sql.push(`    1`);
    sql.push(`) ON DUPLICATE KEY UPDATE`);
    sql.push(`    nombre = ${escapeSQL(user.nombre || 'Sin nombre')},`);
    sql.push(`    glide_id = ${escapeSQL(glideId)},`);
    sql.push(`    foto = COALESCE(foto, ${escapeSQL(user.foto || null)});`);
    sql.push('');
});

// Paso 3: Actualizar visitas con ujier_id correcto
sql.push('-- ================================================');
sql.push('-- Paso 3: Vincular visitas con ujieres');
sql.push('-- ================================================');
sql.push('');
sql.push('-- Crear tabla temporal con mapeo de nombres de ujier a IDs');
sql.push('-- Nota: Las visitas tienen nombre_ujier, necesitamos buscar por nombre');
sql.push('');

// Generar updates para vincular visitas con ujieres por DNI (id_ujier en visitas es el DNI)
sql.push('-- Actualizar visitas que tienen id_ujier (DNI) para vincular con usuarios');
sql.push(`
-- Primero verificar la estructura: en las visitas, el id_ujier es el DNI del ujier
-- Necesitamos crear un script que actualice las visitas basándose en esto

UPDATE visitas v
INNER JOIN (
    SELECT n.id as notif_id
    FROM notificaciones n
    WHERE n.migrated_from_glide = 1
) notifs ON v.notificacion_id = notifs.notif_id
LEFT JOIN usuarios u ON v.ujier_id IS NULL
SET v.ujier_id = NULL
WHERE v.migrated_from_glide = 1;
`);

sql.push('');
sql.push('-- Verificar usuarios creados');
sql.push('SELECT id, nombre, email, rol, glide_id FROM usuarios ORDER BY rol, nombre;');

// Guardar SQL
const outputFile = path.join(outputDir, 'import_usuarios_completo.sql');
fs.writeFileSync(outputFile, sql.join('\n'), 'utf-8');

console.log('✓ SQL generado correctamente');
console.log(`→ Archivo: ${outputFile}`);
console.log('');

// Resumen por rol
const byRole = {};
users.forEach(u => {
    byRole[u.rol] = (byRole[u.rol] || 0) + 1;
});

console.log('Resumen por rol:');
Object.entries(byRole).forEach(([rol, count]) => {
    console.log(`  - ${rol}: ${count}`);
});

console.log('\n✅ Importá el archivo en phpMyAdmin');

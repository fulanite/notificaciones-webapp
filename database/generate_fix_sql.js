const fs = require('fs');
const path = require('path');

const mappingPath = path.join(__dirname, 'id_mapping_v2.json');
const visitasPath = path.join(__dirname, '..', 'e9c740.visitas.csv');
const outputPath = path.join(__dirname, 'corregir_ujieres_visitas.sql');

console.log('Generando SQL de corrección...');

try {
    const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    const visitasContent = fs.readFileSync(visitasPath, 'utf8');

    // Simple CSV parser for this specific file
    const lines = visitasContent.split('\n');
    const header = lines[0].split(',');

    const idxIdCedula = header.indexOf('ID_cedula');
    const idxIdUjier = header.indexOf('id_ujier');

    if (idxIdCedula === -1 || idxIdUjier === -1) {
        throw new Error('Columnas ID_cedula o id_ujier no encontradas');
    }

    const sqlUpdates = [
        '-- SQL para corregir ujier_id en visitas migradas',
        'SET FOREIGN_KEY_CHECKS = 0;',
        ''
    ];

    let count = 0;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple split for this specific CSV structure
        const row = line.split(',');

        if (row.length <= Math.max(idxIdCedula, idxIdUjier)) continue;

        const glideId = (row[idxIdCedula] || '').replace(/"/g, '').trim();
        const ujierId = (row[idxIdUjier] || '').replace(/"/g, '').trim();

        if (!glideId || !ujierId) continue;

        const uuid = mapping[glideId];

        if (uuid) {
            sqlUpdates.push(`UPDATE visitas SET ujier_id = '${ujierId}' WHERE notificacion_id = '${uuid}' AND ujier_id IS NULL AND migrated_from_glide = 1;`);
            count++;
        }
    }

    sqlUpdates.push('');
    sqlUpdates.push('SET FOREIGN_KEY_CHECKS = 1;');

    fs.writeFileSync(outputPath, sqlUpdates.join('\n'));
    console.log(`✓ SQL generado con éxito: ${outputPath}`);
    console.log(`✓ Total de sentencias UPDATE: ${count}`);

} catch (err) {
    console.error('Error:', err.message);
}

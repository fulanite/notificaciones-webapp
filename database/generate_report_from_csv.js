const fs = require('fs');
const path = require('path');

// Mapas de categorización (copiados del código de Glide)
const JUZGADOS_PENALES_MAP = new Map([
    ['Fiscalía de Instrucción', [/^Fiscalía de Instrucción/i]],
    ['Fiscalía Penal Juvenil', [/^Fiscalía Penal Juvenil$/i]],
    ['Fiscalía Penal de Violencia Familiar y de Género', [/^Fiscalía Penal de Violencia Familiar y de Género$/i]],
    ['Cámaras Penales', [/^Cámara de Apelaciones Penal y de Exhorto$/i, /^Cámara en lo Criminal/i]],
    ['Juzgados Correcionales', [/^Juzgado Correcional/i]],
    ['Control y garantías', [/^Juzgado de Garantías/i]],
    ['Ejecución Penal', [/^Juzgado de Ejecución Penal/i]],
]);

const DEMAS_JUZGADOS_MAP = new Map([
    ['Corte de justicia', [/^Corte de Justicia - Secretaría/i]],
    ['Cámara de apelaciones', [/^Cámara Civil/i]],
    ['Civiles', [/^Juzgado Civil/i]],
    ['Comercial y Ejecución', [/^Juzgado Comercial/i]],
    ['Ejecución Fiscal', [/^Ejecución Fiscal$/i]],
    ['Electoral y Minas', [/^Juzgado Electoral y Minas$/i]],
    ['Familia', [/^Juzgado de Familia/i]],
    ['Centro de Mediación Judicial', [/^Centro de Mediación Judicial$/i]],
    ['Defensorías Civiles', [/^Defensoría Civil/i]],
    ['Juzgados del interior', [/^Andalgalá$/i, /^Belén$/i, /^Tinogasta$/i, /^Santa Maria$/i, /^Recreo$/i]],
    ['De otras provincias', [/^(Buenos Aires|Catamarca|Chaco|Chubut|Ciudad Autónoma de Buenos Aires \(CABA\)|Córdoba|Corrientes|Entre Ríos|Formosa|Jujuy|La Pampa|La Rioja|Mendoza|Misiones|Neuquén|Río Negro|Salta|San Juan|San Luis|Santa Cruz|Santa Fe|Santiago del Estero|Tierra del Fuego, Antártida e Islas del Atlántico Sur|Tucumán)$/i]],
    ['Asesorías de menores', [/^Asesoría de Menores e Incapaces$/i]],
    ['Tribunal Penal Juvenil', [/^Tribunal de Responsabilidad Penal Juvenil/i]],
    ['Laborales', [/^Juzgado Laboral/i]],
    ['Ministerio Público', [/^Ministerio Público$/i]],
    ['Procuración', [/^Procuración$/i]],
]);

function getCategory(origen, categoryMap) {
    for (const [category, patterns] of categoryMap.entries()) {
        for (const pattern of patterns) {
            if (pattern.test(origen)) {
                return category;
            }
        }
    }
    return null;
}

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        header.forEach((col, idx) => {
            row[col] = values[idx] || '';
        });
        rows.push(row);
    }
    return rows;
}

// Leer CSV
const csvPath = path.join(__dirname, '..', '92e43e.cedulas.csv');
const cedulas = parseCSV(csvPath);

// Filtrar diciembre 2025 por fecha_entrega_ujier
const diciembre = cedulas.filter(c => {
    const fecha = c.fecha_entrega_ujier || '';
    return fecha.includes('2025-12') || fecha.includes('12/2025') || fecha.includes('/12/2025');
});

console.log('=== INFORME MENSUAL DICIEMBRE 2025 ===\n');
console.log(`Total de notificaciones: ${diciembre.length}\n`);

// Categorizar
const counts = {
    tipos: new Map(),
    juzgadosPenales: new Map(),
    demasJuzgados: new Map(),
    particulares: new Map(),
};

diciembre.forEach(row => {
    const tipoNot = (row.tipo_not || '').trim() || 'No especificado';
    counts.tipos.set(tipoNot, (counts.tipos.get(tipoNot) || 0) + 1);

    const origen = (row.origen || '').trim();
    
    // Check for troquel (both cédulas and mandamientos)
    const normInput = tipoNot.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tieneTroquel = row.n_troquel || (row.sin_troquel == '0' && row.tipo_troquel);

    if (tieneTroquel) {
        let label = 'Otros con Troquel';
        if (row.tipo_troquel === 'C' || normInput.includes('cedula')) {
            label = 'Cédulas con Troquel (C)';
        } else if (row.tipo_troquel === 'M' || normInput.includes('mandamiento')) {
            label = 'Mandamientos con Troquel (M)';
        }
        counts.particulares.set(label, (counts.particulares.get(label) || 0) + 1);
    }

    let category = getCategory(origen, JUZGADOS_PENALES_MAP);
    if (category) {
        counts.juzgadosPenales.set(category, (counts.juzgadosPenales.get(category) || 0) + 1);
        return;
    }

    category = getCategory(origen, DEMAS_JUZGADOS_MAP);
    if (category) {
        counts.demasJuzgados.set(category, (counts.demasJuzgados.get(category) || 0) + 1);
    }
});

// Mostrar resultados
console.log('TIPOS DE NOTIFICACIÓN:');
const tiposSorted = Array.from(counts.tipos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
tiposSorted.forEach(([tipo, count]) => {
    console.log(`  ${tipo}: ${count}`);
});

console.log('\nJUZGADOS PENALES:');
const penalesSorted = Array.from(counts.juzgadosPenales.entries()).sort((a, b) => a[0].localeCompare(b[0]));
penalesSorted.forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
});

console.log('\nDEMÁS JUZGADOS:');
const demasSorted = Array.from(counts.demasJuzgados.entries()).sort((a, b) => a[0].localeCompare(b[0]));
demasSorted.forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
});

console.log('\nPARTICULARES / CON TROQUEL:');
const particularesSorted = Array.from(counts.particulares.entries()).sort((a, b) => a[0].localeCompare(b[0]));
particularesSorted.forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
});

const totalGeneral = Array.from(counts.tipos.values()).reduce((sum, count) => sum + count, 0);
console.log(`\nTOTAL GENERAL DE DILIGENCIAS: ${totalGeneral}`);

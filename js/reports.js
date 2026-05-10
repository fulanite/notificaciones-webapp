/**
 * SGND - Reports Module
 */

const CORTE_Y_MEDIACION_MAP = new Map([
    ['Corte de Justicia', [/^Corte de Justicia/i]],
    ['Centro de Mediación Judicial', [/^Centro de Mediación Judicial$/i]]
]);

const CAMARAS_MAP = new Map([
    ['Cámaras Penales', [/^Cámara de Apelaciones Penal y de Exhorto/i, /^Cámara en lo Criminal/i]],
    ['Cámaras de Apelación Civil', [/^Cámara Civil/i]],
    ['Civiles', [/^Juzgado Civil/i]],
    ['Comerciales y de Ejecución', [/^Juzgado Comercial/i]]
]);

const JUZGADOS_MAP = new Map([
    ['Laborales', [/^Juzgado Laboral/i]],
    ['Correccionales', [/^Juzgado Correccional/i]],
    ['Control de Garantías', [/^Juzgado de Garantías/i]],
    ['Ejecución Penal', [/^Juzgado de Ejecución Penal/i]],
    ['Ejecución Fiscal', [/^Ejecución Fiscal/i]],
    ['Electoral y Minas', [/^Juzgado Electoral y Minas/i]],
    ['Familia', [/^Juzgado de Familia/i]],
    ['Responsabilidad Penal Juvenil', [/^Tribunal de Responsabilidad Penal Juvenil/i]],
    ['Fiscalía Penal Juvenil', [/^Fiscalía Penal Juvenil$/i]],
    ['Fiscalía Penal de Violencia Familiar y de Género', [/^Fiscalía Penal de Violencia Familiar y de Género$/i]]
]);

const MINISTERIO_PUBLICO_MAP = new Map([
    ['Ministerio Público', [/^Ministerio Público/i, /^Procuración/i]],
    ['Fiscalías de Instrucción', [/^Fiscalía de Instrucción/i]],
    ['Asesoría de Menores', [/^Asesoría de Menores e Incapaces/i]],
    ['Defensorías Civiles', [/^Defensoría Civil/i]]
]);

const OTROS_MAP = new Map([
    // Queda vacío u opcional para futuros mapeos
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

function categorizeAndCount(rows) {
    const counts = {
        tipos: new Map(),
        corteYMediacion: new Map(),
        camaras: new Map(),
        juzgados: new Map(),
        ministerioPublico: new Map(),
        interior: new Map(),
        provincias: new Map(),
        particulares: new Map(),
        otros: new Map()
    };

    rows.forEach(row => {
        // Dynamic categorization based on 'tipo_notificacion'
        const tipoNot = (row.tipo_notificacion || '').trim();
        const normInput = utils.normalizeLabel(tipoNot);

        // Find match in official types by value or label normalized
        const officialType = SGND_DATA.TIPOS_NOTIFICACION.find(t =>
            utils.normalizeLabel(t.value) === normInput ||
            utils.normalizeLabel(t.label) === normInput
        );

        let displayTipo = officialType ? officialType.label : (tipoNot || 'No especificado');

        if (normInput === 'cedulas') displayTipo = 'Cédulas';
        if (normInput === 'mandamientos') displayTipo = 'Mandamientos';

        // Capitalize first letter if it's still raw text
        if (!officialType && displayTipo !== 'No especificado') {
            displayTipo = displayTipo.charAt(0).toUpperCase() + displayTipo.slice(1);
        }

        counts.tipos.set(displayTipo, (counts.tipos.get(displayTipo) || 0) + 1);

        // Categorization by 'origen'
        const origen = (row.origen || '').trim();

        // Check if it's a cédula with troquel
        const tieneTroquel = row.n_troquel || (row.sin_troquel == 0 && row.tipo_troquel);
        const isCedula = normInput.includes('cedula') || normInput === 'cedulas';

        if (isCedula && tieneTroquel) {
            counts.particulares.set('Cédulas Particulares / Con Troquel', (counts.particulares.get('Cédulas Particulares / Con Troquel') || 0) + 1);
        }

        // 1. Check Maps
        let category = getCategory(origen, CORTE_Y_MEDIACION_MAP);
        if (category) { counts.corteYMediacion.set(category, (counts.corteYMediacion.get(category) || 0) + 1); return; }

        category = getCategory(origen, CAMARAS_MAP);
        if (category) { counts.camaras.set(category, (counts.camaras.get(category) || 0) + 1); return; }

        category = getCategory(origen, JUZGADOS_MAP);
        if (category) { counts.juzgados.set(category, (counts.juzgados.get(category) || 0) + 1); return; }

        category = getCategory(origen, MINISTERIO_PUBLICO_MAP);
        if (category) { counts.ministerioPublico.set(category, (counts.ministerioPublico.get(category) || 0) + 1); return; }

        // 2. Extraer a los cuadros correspondientes de Interior y Provincias
        const esProvincia = tipoNot === 'cedulas_mandamientos_22172' || 
            /^(Buenos Aires|Catamarca|Chaco|Chubut|Ciudad Autónoma de Buenos Aires \(CABA\)|Córdoba|Corrientes|Entre Ríos|Formosa|Jujuy|La Pampa|La Rioja|Mendoza|Misiones|Neuquén|Río Negro|Salta|San Juan|San Luis|Santa Cruz|Santa Fe|Santiago del Estero|Tierra del Fuego, Antártida e Islas del Atlántico Sur|Tucumán)$/i.test(origen) ||
            /^Cédulas o Mandamientos Ley 22172$/i.test(origen);

        const esInterior = tipoNot === 'cedulas_correspondencia' || 
            tipoNot === 'mandamientos_interior' ||
            /^(Andalgalá|Belén|Tinogasta|Santa Maria|Recreo|Cédulas por Correspondencia)$/i.test(origen);

        if (esProvincia) {
            counts.provincias.set(origen || 'Sin especificar', (counts.provincias.get(origen || 'Sin especificar') || 0) + 1);
            return;
        }

        if (esInterior) {
            counts.interior.set(origen || 'Sin especificar', (counts.interior.get(origen || 'Sin especificar') || 0) + 1);
            return;
        }

        // 3. Fallbacks
        if (!category) {
            category = getCategory(origen, OTROS_MAP) || origen || 'Otros / No clasificados';
        }

        counts.otros.set(category, (counts.otros.get(category) || 0) + 1);
    });

    return counts;
}

function getMonthInfo(yyyy_mm) {
    const [year, month] = yyyy_mm.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 15);
    const monthName = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(date);
    return { monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1), year };
}

const reports = {
    initialized: false,
    // Initialize reports module
    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.setDefaultDates();
        this.initialized = true;
    },

    // Setup event listeners
    setupEventListeners() {
        const btnMonthly = document.getElementById('btn-report-monthly');
        console.log('🔍 Reports: Buscando botón btn-report-monthly:', btnMonthly);

        if (btnMonthly) {
            console.log('✅ Reports: Botón encontrado, agregando listener');
            btnMonthly.addEventListener('click', () => {
                console.log('🖱️ Reports: Click detectado en btn-report-monthly');
                this.generateMonthlyReport();
            });
        } else {
            console.warn('⚠️ Reports: Botón btn-report-monthly NO encontrado en el DOM');
        }
    },

    // Set default dates
    setDefaultDates() {
        const dateInput = document.getElementById('report-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const monthSelect = document.getElementById('report-select-month');
        const yearSelect = document.getElementById('report-select-year');

        if (monthSelect && yearSelect) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');

            monthSelect.value = mm;
            yearSelect.value = yyyy.toString();
        }
    },

    // Generate monthly report (PDF)
    async generateMonthlyReport() {
        console.log('📊 Reports: Ejecutando generateMonthlyReport()');

        const monthSelect = document.getElementById('report-select-month');
        const yearSelect = document.getElementById('report-select-year');

        const month = parseInt(monthSelect?.value || '0');
        const year = parseInt(yearSelect?.value || '0');

        console.log('📅 Reports: Mes seleccionado:', month, 'Año:', year);

        if (!month || !year) {
            utils.showToast('Seleccione un mes y año válidos', 'warning');
            return;
        }

        const yyyy_mm = `${year}-${String(month).padStart(2, '0')}`;

        utils.showLoading('Generando estadística mensual...');

        // Get all notifications for the month
        // We filter by 'fecha_entrega_ujier' as per user requirement "tomas las notificaciones que tienen fecha de entrega de ese mes"
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month

        // Fetch all (filtering locally for simplicity, or use API range filter if available, assume getNotifications returns all for simplicity then filter)
        // Ideally API should support range, but 'api-client.js' seems simple. 
        // We'll fetch a larger set or filter on client side if API doesn't support date range directly on 'fecha_entrega_ujier'.
        // 'db.getNotifications' supports 'fecha' param which usually filters by specific date.
        // Let's assume we fetch all and filter client side for now to be safe with complex logic.
        // OR better: use the dateField logic we implemented recently if available, but passing a range is tricky without range support.
        // Let's rely on fetching reasonable amount of data. The user mentions "tomas las notificaciones que tienen fecha de entrega de ese mes".

        // Fetch only the relevant month/year from API
        const { data, error } = await db.getNotifications({
            year: year,
            month: month,
            limit: 5000
        });

        if (error) {
            utils.showToast('Error al obtener datos', 'error');
            return;
        }

        // Filter by month on fecha_entrega_ujier (Criterio real de trabajo entregado)
        const monthData = (data || []).filter(n => {
            // Skip deleted notifications
            if (n.eliminada == 1) return false;

            // Strict filter on fecha_entrega_ujier as per user request
            if (!n.fecha_entrega_ujier) return false;
            // fecha_entrega_ujier comes as 'YYYY-MM-DD'
            return n.fecha_entrega_ujier.startsWith(yyyy_mm);
        });

        if (monthData.length === 0) {
            utils.showToast('No hay datos para el mes seleccionado', 'warning');
            return;
        }

        // --- PDF Generation Logic ---
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
        const { monthName, year: reportYear } = getMonthInfo(yyyy_mm);
        const today = new Intl.DateTimeFormat("es-AR", {
            timeZone: "America/Argentina/Buenos_Aires",
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(new Date());

        const pageHeight = doc.internal.pageSize.getHeight();
        let finalY = 0;

        // --- HEADER ---
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(`San Fernando del Valle de Catamarca, ${today}`, 40, 50);

        // --- ADDRESSEE ---
        doc.setFont("helvetica", "bold");
        doc.text("OFICINA DE MANDAMIENTOS Y NOTIFICACIONES", 40, 100);
        doc.text("SAN FERNANDO DEL VALLE DE CATAMARCA", 40, 115);
        doc.setFont("helvetica", "normal");
        doc.text("SEÑOR SECRETARIO", 40, 150);
        doc.text("DE PLANEAMIENTO DE LA CORTE DE JUSTICIA", 40, 165);
        doc.setFont("helvetica", "bold");
        doc.text("SU DESPACHO:", 40, 180);

        // --- BODY ---
        doc.setFont("helvetica", "normal");
        const introText = `Me dirijo a Ud. a los efectos de remitir la Estadística Mensual de las diligencias realizadas en esta Oficina de Mandamientos y Notificaciones durante el mes de ${monthName} de ${reportYear}.`;
        const splitIntro = doc.splitTextToSize(introText, 480);
        doc.text(splitIntro, 50, 220);

        const counts = categorizeAndCount(monthData);
        const tableOptions = {
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 5, font: "helvetica" },
            headStyles: { fillColor: [238, 238, 238], textColor: 20, fontStyle: "bold" },
            margin: { left: 50, right: 50 },
            columnStyles: { 0: { fontStyle: 'bold' } },
            rowPageBreak: 'avoid',
        };

        // --- TABLE 1: Dynamic Notification Types ---
        const tiposBody = Array.from(counts.tipos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        doc.autoTable({
            ...tableOptions,
            startY: 260,
            head: [['Tipo de Notificación', 'Cantidad']],
            body: tiposBody,
        });
        finalY = doc.lastAutoTable.finalY;

        // --- HELPER PARA TABLAS ---
        const renderTable = (title, mapData) => {
            if (mapData.size > 0) {
                const bodyArray = Array.from(mapData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                if (finalY + (bodyArray.length * 25) > pageHeight - 50) {
                    doc.addPage();
                    finalY = 50;
                }
                doc.autoTable({
                    ...tableOptions,
                    startY: finalY + 20,
                    head: [[title, 'Cantidad']],
                    body: bodyArray,
                });
                finalY = doc.lastAutoTable.finalY;
            }
        };

        // --- RENDERIZADO DE TABLAS NUEVAS ---
        renderTable('CORTE DE JUSTICIA Y CENTRO DE MEDIACIÓN JUDICIAL', counts.corteYMediacion);
        renderTable('CÁMARAS', counts.camaras);
        renderTable('JUZGADOS', counts.juzgados);
        renderTable('MINISTERIO PÚBLICO', counts.ministerioPublico);
        renderTable('JUZGADOS DEL INTERIOR', counts.interior);
        renderTable('OTRAS PROVINCIAS', counts.provincias);
        renderTable('CÉDULAS PARTICULARES / CON TROQUEL', counts.particulares);

        // --- FINAL TOTAL ---
        if (finalY > pageHeight - 50) {
            doc.addPage();
            finalY = 50;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        const totalGeneral = Array.from(counts.tipos.values()).reduce((sum, count) => sum + count, 0);
        doc.text(`TOTAL GENERAL DE DILIGENCIAS: ${totalGeneral}`, doc.internal.pageSize.getWidth() / 2, finalY + 40, { align: "center" });

        const filename = `informe_mensual_${yyyy_mm}.pdf`;
        doc.save(filename);

        utils.hideLoading();
        utils.showToast('Informe mensual generado con éxito', 'success');
    },

};

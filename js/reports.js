/**
 * SGND - Reports Module
 */

const JUZGADOS_PENALES_MAP = new Map([
    ['Fiscalía de Instrucción', [/^Fiscalía de Instrucción/i]],
    ['Fiscalía Penal Juvenil', [/^Fiscalía Penal Juvenil$/i]],
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
    ['Ley 22.172 / Otras Provincias', [/^Cédulas o Mandamientos Ley 22172$/i]],
    ['Interior / Otras Jurisdicciones', [/^Andalgalá$/i, /^Belén$/i, /^Tinogasta$/i, /^Santa Maria$/i, /^Recreo$/i, /^Cédulas por Correspondencia/i]],
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
        juzgadosPenales: new Map(),
        demasJuzgados: new Map(),
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

        // Normalización final de visualización para agrupar variantes que escaparon al match
        // Ej: si en la base dice "cedula" y no matcheó con "Cédulas"
        if (normInput === 'cedulas') displayTipo = 'Cédulas';
        if (normInput === 'mandamientos') displayTipo = 'Mandamientos';

        // Capitalize first letter if it's still raw text
        if (!officialType && displayTipo !== 'No especificado') {
            displayTipo = displayTipo.charAt(0).toUpperCase() + displayTipo.slice(1);
        }

        counts.tipos.set(displayTipo, (counts.tipos.get(displayTipo) || 0) + 1);

        // Categorization by 'origen'
        const origen = (row.origen || '').trim();

        // 1. Check if it belongs to Juzgados Penales (Prioridad Base)
        let category = getCategory(origen, JUZGADOS_PENALES_MAP);
        if (category) {
            counts.juzgadosPenales.set(category, (counts.juzgadosPenales.get(category) || 0) + 1);
            return;
        }

        // 2. Special Logic for Specific Notification Types (Overrides Generic Maps)
        if (tipoNot === 'cedulas_mandamientos_22172') {
            // Agrupar por el texto exacto del Origen (Provincia)
            category = origen || 'Otras Provincias (Ley 22.172 - Sin especificar)';
        } else if (tipoNot === 'cedulas_correspondencia' || tipoNot === 'mandamientos_interior') {
            // Agrupar todo bajo 'Juzgados del interior'
            category = 'Juzgados del interior';
        }

        // 3. If not handled by special logic, use Generic Map for Demas Juzgados
        if (!category) {
            category = getCategory(origen, DEMAS_JUZGADOS_MAP);
        }

        // 4. Fallback
        if (!category) {
            category = origen || 'Otros / No clasificados';
        }

        counts.demasJuzgados.set(category, (counts.demasJuzgados.get(category) || 0) + 1);
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

        // --- TABLE 2: Juzgados Penales ---
        if (counts.juzgadosPenales.size > 0) {
            doc.autoTable({
                ...tableOptions,
                startY: finalY + 20,
                head: [['JUZGADOS PENALES', 'Cantidad']],
                body: Array.from(counts.juzgadosPenales.entries()).sort((a, b) => a[0].localeCompare(b[0])),
            });
            finalY = doc.lastAutoTable.finalY;
        }

        // --- TABLE 3: Demás Juzgados ---
        if (counts.demasJuzgados.size > 0) {
            const demasBody = Array.from(counts.demasJuzgados.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            if (finalY + (demasBody.length * 25) > pageHeight - 50) {
                doc.addPage();
                finalY = 50;
            }

            doc.autoTable({
                ...tableOptions,
                startY: finalY + 20,
                head: [['DEMÁS JUZGADOS', 'Cantidad']],
                body: demasBody,
            });
            finalY = doc.lastAutoTable.finalY;
        }

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

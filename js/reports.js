/**
 * SGND - Reports Module
 */

const reports = {
    // Initialize reports module
    init() {
        this.setupEventListeners();
        this.setDefaultDates();
        this.loadUjiersForReport();
    },

    // Setup event listeners
    setupEventListeners() {
        document.getElementById('btn-report-daily')?.addEventListener('click', () => this.generateDailyReport());
        document.getElementById('btn-report-monthly')?.addEventListener('click', () => this.generateMonthlyReport());
        document.getElementById('btn-report-ujier')?.addEventListener('click', () => this.generateUjierReport());
        document.getElementById('btn-report-deferred')?.addEventListener('click', () => this.generateDeferredReport());
    },

    // Set default dates
    setDefaultDates() {
        const dateInput = document.getElementById('report-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const monthSelect = document.getElementById('report-month');
        if (monthSelect) {
            monthSelect.value = String(new Date().getMonth() + 1).padStart(2, '0');
        }
    },

    // Load ujieres for report selector
    async loadUjiersForReport() {
        const select = document.getElementById('report-ujier');
        if (!select) return;

        const { data: ujiers } = await db.getUsersByRole('ujier');

        if (ujiers && ujiers.length > 0) {
            const options = ujiers.map(u =>
                `<option value="${u.id}">${u.nombre}</option>`
            ).join('');

            select.innerHTML = `
                <option value="all">Todos los ujieres</option>
                ${options}
            `;
        }
    },

    // Generate daily report (CSV)
    async generateDailyReport() {
        const dateInput = document.getElementById('report-date');
        const date = dateInput?.value || new Date().toISOString().split('T')[0];

        utils.showToast('Generando planilla diaria...', 'info');

        const { data, error } = await db.getNotifications({ fecha: date });

        if (error) {
            utils.showToast('Error al generar reporte', 'error');
            return;
        }

        if (!data || data.length === 0) {
            utils.showToast('No hay datos para la fecha seleccionada', 'warning');
            return;
        }

        // Transform data for CSV
        const csvData = data.map(notif => ({
            'Fecha': utils.formatDate(notif.fecha_carga),
            'Tipo': CONFIG.NOTIFICATION_TYPES[notif.tipo_notificacion] || notif.tipo_notificacion,
            'N° Expediente': notif.n_expediente,
            'Carátula': notif.caratula,
            'Origen': notif.origen,
            'Destinatario': notif.destinatario_nombre,
            'Domicilio': notif.domicilio,
            'Zona': notif.zona,
            'Estado': notif.estado,
            'Ujier Asignado': notif.usuarios?.nombre || 'Sin asignar',
            'Resultado': CONFIG.RESULT_OPTIONS[notif.resultado_diligencia] || '-',
            'Fecha Diligencia': notif.fecha_diligencia ? utils.formatDateTime(notif.fecha_diligencia) : '-'
        }));

        const filename = `planilla_diaria_${date}.csv`;
        utils.exportToCSV(csvData, filename);

        utils.showToast('Planilla diaria descargada', 'success');
    },

    // Generate monthly report (PDF)
    async generateMonthlyReport() {
        const monthSelect = document.getElementById('report-month');
        const month = monthSelect?.value || '01';
        const year = new Date().getFullYear();

        utils.showToast('Generando informe mensual...', 'info');

        // Get all notifications for the month
        const startDate = new Date(year, parseInt(month) - 1, 1);
        const endDate = new Date(year, parseInt(month), 0);

        const { data } = await db.getNotifications({});

        // Filter for the month
        const monthData = (data || []).filter(n => {
            const date = new Date(n.fecha_carga);
            return date >= startDate && date <= endDate;
        });

        // Generate PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setTextColor(30, 58, 95);
        doc.text('SGND - Informe Mensual', 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(100);
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        doc.text(`${monthNames[parseInt(month) - 1]} ${year}`, 105, 30, { align: 'center' });

        // Statistics
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text('Resumen Estadístico', 14, 45);

        const total = monthData.length;
        const pendientes = monthData.filter(n => n.estado === 'pendiente').length;
        const diligenciadas = monthData.filter(n => n.estado === 'diligenciada').length;
        const diferidas = monthData.filter(n => n.estado === 'diferida').length;

        doc.setFontSize(11);
        doc.text(`Total de Notificaciones: ${total}`, 14, 55);
        doc.text(`Pendientes: ${pendientes}`, 14, 62);
        doc.text(`Diligenciadas: ${diligenciadas}`, 14, 69);
        doc.text(`Diferidas: ${diferidas}`, 14, 76);

        // Results breakdown
        const results = {};
        monthData.forEach(n => {
            if (n.resultado_diligencia) {
                results[n.resultado_diligencia] = (results[n.resultado_diligencia] || 0) + 1;
            }
        });

        doc.text('Resultados de Diligencias:', 14, 90);
        let yPos = 97;
        Object.entries(results).forEach(([key, count]) => {
            doc.text(`  • ${CONFIG.RESULT_OPTIONS[key] || key}: ${count}`, 14, yPos);
            yPos += 7;
        });

        // Table with notifications
        if (monthData.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.text('Detalle de Notificaciones', 14, 20);

            const tableData = monthData.map(n => [
                utils.formatDate(n.fecha_carga),
                utils.truncate(CONFIG.NOTIFICATION_TYPES[n.tipo_notificacion] || '', 20),
                utils.truncate(n.n_expediente || '', 15),
                utils.truncate(n.destinatario_nombre || '', 20),
                n.estado
            ]);

            doc.autoTable({
                startY: 30,
                head: [['Fecha', 'Tipo', 'Expediente', 'Destinatario', 'Estado']],
                body: tableData,
                styles: {
                    fontSize: 8,
                    cellPadding: 3
                },
                headStyles: {
                    fillColor: [30, 58, 95],
                    textColor: 255
                },
                alternateRowStyles: {
                    fillColor: [245, 247, 250]
                }
            });
        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                `Generado el ${utils.formatDateTime(new Date())} - Página ${i} de ${pageCount}`,
                105,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            );
        }

        doc.save(`informe_mensual_${month}_${year}.pdf`);
        utils.showToast('Informe mensual descargado', 'success');
    },

    // Generate ujier performance report
    async generateUjierReport() {
        const select = document.getElementById('report-ujier');
        const ujierId = select?.value;

        utils.showToast('Generando reporte de rendimiento...', 'info');

        let performance = await db.getUjierPerformance();

        if (ujierId !== 'all') {
            performance = performance.filter(p => p.id === ujierId);
        }

        if (performance.length === 0) {
            utils.showToast('No hay datos de rendimiento', 'warning');
            return;
        }

        const csvData = performance.map(p => ({
            'Ujier': p.nombre,
            'Total Asignaciones': p.total,
            'Completadas': p.completed,
            'Porcentaje': `${p.percentage}%`
        }));

        utils.exportToCSV(csvData, `rendimiento_ujieres_${utils.formatDate(new Date()).replace(/\//g, '-')}.csv`);
        utils.showToast('Reporte de rendimiento descargado', 'success');
    },

    // Generate deferred loads report
    async generateDeferredReport() {
        utils.showToast('Generando reporte de cargas diferidas...', 'info');

        const { data } = await db.getNotifications({ estado: 'diferida' });

        if (!data || data.length === 0) {
            utils.showToast('No hay cargas diferidas registradas', 'info');
            return;
        }

        const csvData = data.map(n => ({
            'Fecha Carga': utils.formatDate(n.fecha_carga),
            'Tipo': CONFIG.NOTIFICATION_TYPES[n.tipo_notificacion] || n.tipo_notificacion,
            'Expediente': n.n_expediente,
            'Destinatario': n.destinatario_nombre,
            'Domicilio': n.domicilio,
            'Ujier': n.usuarios?.nombre || '-',
            'Motivo Falla': CONFIG.FAILURE_REASONS[n.motivo_falla_senal] || n.motivo_falla_senal || '-',
            'Fecha Diligencia': n.fecha_diligencia ? utils.formatDateTime(n.fecha_diligencia) : '-'
        }));

        utils.exportToCSV(csvData, `cargas_diferidas_${utils.formatDate(new Date()).replace(/\//g, '-')}.csv`);
        utils.showToast('Reporte de cargas diferidas descargado', 'success');
    }
};

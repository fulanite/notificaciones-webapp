/**
 * SGND - Module for generating execution sheets (Planillas de Trabajo)
 */

const planillas = {
    listenersAttached: false,

    init() {
        this.setupEventListeners();
        // this.setDefaultDate(); // Removed: user wants it blank by default
        this.populateZones();
    },

    // Switch between tabs (Planilla Diaria / Informe Mensual)
    switchTab(tabName, buttonElement) {
        // Update tab buttons
        document.querySelectorAll('[data-planilla-tab]').forEach(btn => {
            btn.classList.remove('active');
        });
        buttonElement.classList.add('active');

        // Show/hide tab content
        const diariaContent = document.getElementById('planilla-diaria-content');
        const mensualContent = document.getElementById('planilla-mensual-content');

        if (tabName === 'diaria') {
            diariaContent.style.display = 'block';
            mensualContent.style.display = 'none';
        } else if (tabName === 'mensual') {
            diariaContent.style.display = 'none';
            mensualContent.style.display = 'block';
            document.getElementById('planilla-qr-content').style.display = 'none';
        } else if (tabName === 'qr') {
            diariaContent.style.display = 'none';
            mensualContent.style.display = 'none';
            document.getElementById('planilla-qr-content').style.display = 'block';
            this.loadUjieresForQR();
        }
    },

    setupEventListeners() {
        if (this.listenersAttached) return;

        document.getElementById('btn-generar-planilla')?.addEventListener('click', () => this.generatePDF());

        // Update preview on filter change
        ['planilla-zona', 'planilla-fecha'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.updatePreview());
        });

        // QR Report Listeners
        document.getElementById('btn-generate-qr-report')?.addEventListener('click', () => this.generateQRReport());
        document.getElementById('btn-download-qr-pdf')?.addEventListener('click', () => this.downloadQRPDF());

        this.listenersAttached = true;
    },

    setDefaultDate() {
        // ... (rest of function unchanged, just context for match)
        const dateInput = document.getElementById('planilla-fecha');
        if (dateInput) {
            const today = new Date();
            // Format to YYYY-MM-DD in local time
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}`;
        }
    },

    populateZones() {
        const select = document.getElementById('planilla-zona');
        if (!select) return;

        // Detailed zones list from user request
        const zones = {
            'Zona A': [
                'A1 - Cédulas', 'A1 - Mandamientos',
                'A2 - Cédulas', 'A2 - Mandamientos'
            ],
            'Zona B': [
                'B1 - Cédulas', 'B1 - Mandamientos',
                'B2 - Cédulas', 'B2 - Mandamientos'
            ],
            'Zona C': [
                'C1 - Cédulas', 'C1 - Mandamientos',
                'C2 - Cédulas', 'C2 - Mandamientos'
            ],
            'Zona D': [
                'D1 - Cédulas', 'D1 - Mandamientos',
                'D2 - Cédulas', 'D2 - Mandamientos'
            ],
            'Urgentes': [
                'Urgente SUR - Cédulas', 'Urgente SUR - Mandamientos',
                'Urgente NORTE - Cédulas', 'Urgente NORTE - Mandamientos'
            ],
            'Fuera de Radio': [
                'Fuera de Radio NORTE - Cédulas', 'Fuera de Radio NORTE - Mandamientos',
                'Fuera de Radio SUR - Cédulas', 'Fuera de Radio SUR - Mandamientos'
            ]
        };

        let html = '<option value="">Todas las Zonas</option>';

        Object.entries(zones).forEach(([group, items]) => {
            html += `<optgroup label="${group}">`;
            items.forEach(item => {
                html += `<option value="${item}">${item}</option>`;
            });
            html += `</optgroup>`;
        });

        select.innerHTML = html;
        // Listener removed here as it is handled in setupEventListeners
    },

    async fetchData() {
        const zona = document.getElementById('planilla-zona').value;
        const fecha = document.getElementById('planilla-fecha')?.value;

        if (!fecha) {
            return null;
        }

        const filters = {
            fecha: fecha,
            limit: 1000,
            dateField: 'fecha_entrega_ujier' // Filter by delivery date, not creation date
        };

        const { data, error } = await db.getNotifications(filters);

        if (error) {
            utils.showToast('Error obteniendo datos', 'error');
            return null;
        }

        let filteredData = (data || []).filter(n => n.eliminada != 1);

        // Client-side filtering
        if (zona) {
            filteredData = filteredData.filter(n => {
                if (!n.zona) return false;
                // Exact match or contains for flexibility incase of minor typos in DB vs List
                return n.zona.toLowerCase().includes(zona.toLowerCase());
            });
        }

        // Sort by fecha_carga ascending (oldest first)
        filteredData.sort((a, b) => {
            const dateA = new Date(a.fecha_carga || 0);
            const dateB = new Date(b.fecha_carga || 0);
            return dateA - dateB;
        });

        return filteredData;
    },

    async updatePreview() {
        const fecha = document.getElementById('planilla-fecha')?.value;
        const tbody = document.querySelector('#tabla-planillas-preview tbody');

        if (!fecha) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">Seleccione una fecha para ver la vista previa</td></tr>';
            return;
        }

        const data = await this.fetchData();
        if (!data) return;

        if (!tbody) return;

        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay datos para los filtros seleccionados</td></tr>';
            return;
        }

        // Group data by Zona
        const groupedData = data.reduce((acc, item) => {
            const z = item.zona || 'Sin Zona';
            if (!acc[z]) acc[z] = [];
            acc[z].push(item);
            return acc;
        }, {});

        // Sort zones alphabetically for display
        const sortedZones = Object.keys(groupedData).sort();

        sortedZones.forEach(zonaName => {
            const items = groupedData[zonaName];

            // Separar items normales de destinos especiales
            const specialDestinations = ['estrados', 'arcat', 'secretaria', 'juzgado'];

            const normalItems = [];
            const specialItems = [];

            items.forEach(item => {
                const isSpecial = utils.isSpecialDestination(item.destinatario_especial) ||
                    (item.destinatario_nombre && specialDestinations.includes(item.destinatario_nombre.toLowerCase()));
                if (isSpecial) {
                    specialItems.push(item);
                } else {
                    normalItems.push(item);
                }
            });

            // Add Group Header with Count
            const headerRow = `
                <tr style="background-color: var(--bg-hover); font-weight: bold;">
                    <td colspan="9" style="padding: 10px;">
                        📂 ${zonaName} <span class="badge" style="margin-left: 10px; font-size: 0.8em;">${items.length} items</span>
                    </td>
                </tr>
            `;
            tbody.innerHTML += headerRow;

            let zoneIndex = 1;

            const renderRows = (itemList) => {
                itemList.forEach(item => {
                    const row = `
                        <tr>
                            <td style="padding-left: 20px;">${zoneIndex++}</td>
                            <td>${item.n_expediente || ''}</td>
                            <td>${item.caratula || ''}</td>
                            <td>${item.origen || ''}</td>
                            <td>${item.tipo_notificacion || ''}</td>
                            <td>${item.destinatario_nombre || ''}</td>
                            <td>${item.domicilio || ''}</td>
                            <td>${item.n_troquel || '-'}</td>
                            <td>${item.ujier_nombre || (item.usuarios ? item.usuarios.nombre : 'Sin asignar')}</td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            };

            // Render Items Normales
            renderRows(normalItems);

            // Render Destinos Especiales
            if (specialItems.length > 0) {
                const specialHeader = `
                    <tr style="background-color: #f0f0f0; font-weight: bold;">
                        <td colspan="9" style="padding: 8px 10px; text-align: left; color: #555;">
                            DESTINOS ESPECIALES
                        </td>
                    </tr>
                `;
                tbody.innerHTML += specialHeader;
                renderRows(specialItems);
            }
        });
    },

    async generatePDF() {
        utils.showLoading('Preparando planillas PDF...');
        const data = await this.fetchData();
        if (!data || data.length === 0) {
            utils.hideLoading();
            utils.showToast('No hay datos para generar la planilla', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const fecha = document.getElementById('planilla-fecha').value;
        const formattedDate = fecha.split('-').reverse().join('/');

        // Group data by Zona
        const groupedData = data.reduce((acc, item) => {
            const z = item.zona || 'Sin Zona';
            if (!acc[z]) acc[z] = [];
            acc[z].push(item);
            return acc;
        }, {});

        const sortedZones = Object.keys(groupedData).sort();

        sortedZones.forEach(zonaName => {
            const items = groupedData[zonaName];
            const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

            // Deduce Ujier for THIS zone
            const uniqueUjieres = new Set();
            items.forEach(item => {
                const name = item.ujier_nombre || (item.usuarios ? item.usuarios.nombre : null);
                if (name) uniqueUjieres.add(name);
            });

            let ujierName = 'Sin asignar';
            if (uniqueUjieres.size === 1) {
                ujierName = [...uniqueUjieres][0];
            } else if (uniqueUjieres.size > 1) {
                ujierName = 'Varios';
            }

            // --- HEADER ---
            doc.setTextColor(0, 0, 0); // Black
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('PODER JUDICIAL DE CATAMARCA', doc.internal.pageSize.width / 2, 12, { align: 'center' });

            doc.setFontSize(14);
            doc.text('OFICINA DE MANDAMIENTOS Y NOTIFICACIONES', doc.internal.pageSize.width / 2, 19, { align: 'center' });

            // Subheader Info
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');

            // "Zona: [Zona]" left aligned
            doc.text(`Zona: ${zonaName}`, 14, 30);

            // "Fecha: [Date]" right aligned
            doc.text(`Fecha: ${formattedDate}`, doc.internal.pageSize.width - 14, 30, { align: 'right' });

            // "Ujier: [Name]" left aligned below Zona
            doc.text(`Ujier: ${ujierName}`, 14, 36);

            // --- TABLE ---
            const tableBody = [];

            // Separar items normales de destinos especiales
            const specialDestinations = ['estrados', 'arcat', 'secretaria', 'juzgado'];

            const normalItems = [];
            const specialItems = [];

            items.forEach(item => {
                const isSpecial = utils.isSpecialDestination(item.destinatario_especial) ||
                    (item.destinatario_nombre && specialDestinations.includes(item.destinatario_nombre.toLowerCase()));

                if (isSpecial) {
                    specialItems.push(item);
                } else {
                    normalItems.push(item);
                }
            });

            let zoneIndex = 1;

            const addRows = (itemList) => {
                itemList.forEach(item => {
                    // Format "Tipo Not."
                    let tipo = item.tipo_notificacion || '';
                    if (tipo === 'cedulas') tipo = 'Cédulas';
                    if (tipo === 'mandamientos') tipo = 'Mandamientos';

                    // Format "Medio de Pago"
                    let pago = item.medio_pago || '';
                    if (pago) pago = pago.charAt(0).toUpperCase() + pago.slice(1);

                    // Devolver campo Observaciones correctamente
                    const obs = item.observaciones_iniciales || item.observaciones || '';

                    tableBody.push([
                        zoneIndex++,
                        item.n_expediente || '',
                        item.caratula || '',
                        item.origen || '',
                        tipo,
                        item.letrado || '',
                        item.destinatario_nombre || utils.getSpecialDestinationText(item) || '',
                        item.domicilio || '',
                        item.n_troquel || '',
                        item.costo ? `$${item.costo}` : '',
                        pago,
                        obs,
                        ''  // Devuelta
                    ]);
                });
            };

            // 1. Items Normales
            addRows(normalItems);

            // 2. Destinos Especiales
            if (specialItems.length > 0) {
                // Header "DESTINOS ESPECIALES"
                tableBody.push([{
                    content: 'DESTINOS ESPECIALES',
                    colSpan: 13,
                    styles: {
                        fillColor: [240, 240, 240], // Light gray background
                        textColor: [0, 0, 0],
                        fontStyle: 'bold',
                        halign: 'left',
                        fontSize: 10,
                        cellPadding: { top: 5, bottom: 2 }
                    }
                }]);

                // Repetir encabezados de columna - Manualmente agregar una fila que parezca header
                tableBody.push([
                    { content: 'Nº', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Nº expte.', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Carátula', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Origen', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Tipo Not.', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Letrado', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Destinatario', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Domicilio', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Troquel', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Costo', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Medio de pago', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Observaciones', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } },
                    { content: 'Devuelta', styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } }
                ]);

                addRows(specialItems);
            }

            doc.autoTable({
                startY: 42,
                head: [['Nº', 'Nº expte.', 'Carátula', 'Origen', 'Tipo Not.', 'Letrado', 'Destinatario', 'Domicilio', 'Troquel', 'Costo', 'Medio de pago', 'Observaciones', 'Devuelta']],
                body: tableBody,
                styles: {
                    fontSize: 7.5, // Reducido de 8 para mejor ajuste
                    cellPadding: 2,
                    textColor: [0, 0, 0], // Black text
                    lineColor: [200, 200, 200], // Light gray borders
                    lineWidth: 0.1,
                    overflow: 'linebreak', // Wrap text
                    valign: 'middle'
                },
                headStyles: {
                    fillColor: [255, 255, 255], // White background for header to save ink
                    textColor: [0, 0, 0], // Black text header
                    fontStyle: 'bold',
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0] // Black borders for header
                },
                columnStyles: {
                    0: { cellWidth: 7 },   // Nº - reducido de 8
                    1: { cellWidth: 16 },  // Nº expte - reducido de 18
                    2: { cellWidth: 32 },  // Carátula - reducido de 35
                    3: { cellWidth: 23 },  // Origen - reducido de 25
                    4: { cellWidth: 16 },  // Tipo Not - reducido de 18
                    5: { cellWidth: 20 },  // Letrado - reducido de 22
                    6: { cellWidth: 23 },  // Destinatario - reducido de 25
                    7: { cellWidth: 32 },  // Domicilio - reducido de 35
                    8: { cellWidth: 11 },  // Troquel - reducido de 12
                    9: { cellWidth: 13 },  // Costo - reducido de 15
                    10: { cellWidth: 18 }, // Medio de pago - reducido de 20
                    11: { cellWidth: 23 }, // Observaciones - reducido de 25
                    12: { cellWidth: 13, halign: 'center' } // Devuelta - reducido de 15
                },
                theme: 'grid', // Grid theme for borders
                rowPageBreak: 'avoid', // Prevent rows from being cut across pages
            });

            // --- FOOTER ---
            const finalY = doc.lastAutoTable.finalY || 40;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(`Total: ${items.length}`, 14, finalY + 10);

            // Signature line
            if (ujierName && ujierName !== 'Sin asignar' && ujierName !== 'Varios') {
                // If a specific, single Ujier was found in the data
                doc.text(`Firma (${ujierName}): ______________________________`, 14, finalY + 18);
            } else {
                doc.text(`Firma Ujier / Receptor: ______________________________`, 14, finalY + 18);
            }

            // Save PDF per zone
            // Clean filename
            const safeZonaName = zonaName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `planilla_${safeZonaName}_${formattedDate.replace(/\//g, '-')}.pdf`;
            doc.save(fileName);
        });

        utils.hideLoading();
        utils.showToast('Planillas generadas con éxito', 'success');
    },

    // QR Report Methods
    async loadUjieresForQR() {
        const select = document.getElementById('qr-ujier-select');
        if (!select || select.dataset.loaded === 'true') return;

        try {
            const { data } = await apiClient.get('usuarios.php', { rol: 'ujier' });
            if (data) {
                let html = '<option value="">👤 Todos los Ujieres</option>';
                data.forEach(u => html += `<option value="${u.id}">${u.nombre}</option>`);
                select.innerHTML = html;
                select.dataset.loaded = 'true';
            }
        } catch (e) {
            console.error('Error loading ujieres for QR report:', e);
        }
    },

    async generateQRReport() {
        const dateFrom = document.getElementById('qr-date-from').value;
        const dateTo = document.getElementById('qr-date-to').value;
        const ujierId = document.getElementById('qr-ujier-select').value;

        if (!dateFrom || !dateTo) {
            utils.showToast('Seleccioná un rango de fechas', 'warning');
            return;
        }

        document.getElementById('qr-report-loading').classList.remove('hidden');
        document.getElementById('qr-report-content').classList.add('hidden');
        document.getElementById('qr-report-empty').classList.add('hidden');

        try {
            // Fetch ALL notifications in date range
            // Note: Ideally API should support range filtering. 
            // For now, we'll fetch a wider range and filter on client or update API later if needed for perf.
            // Using a loose limit for now or existing filters.

            // Constructing a query. Since current API might not support ranges perfectly, 
            // we will fetch by dates or just use a custom query if we were modifying PHP.
            // However, based on available tools, let's filter purely client side after fetching by 'fecha_entrega' logic if possible
            // OR use the existing 'getNotifications' and filter manually.

            // To be precise with date range, we might scan a bit. 
            // Better strategy: Fetch with a high limit for the years involved.

            const params = {
                limit: 2000,
                // We'll filter date range strictly on client for accuracy
                // year: 2026 // Assumption, or dynamic based on date inputs year
            };

            // Optimization: determine years involved
            const startYear = new Date(dateFrom).getFullYear();
            const endYear = new Date(dateTo).getFullYear();

            let allData = [];

            // Fetch for involved years (usually just one)
            for (let y = startYear; y <= endYear; y++) {
                const { data } = await db.getNotifications({ ...params, year: y });
                if (data) allData = allData.concat(data);
            }

            // FILTER LOGIC
            // 1. Not Deleted
            // 2. Medio Pago = QR
            // 3. Date Range (fecha_entrega_ujier)
            // 4. Ujier (if selected)

            const fromTime = new Date(dateFrom + 'T00:00:00').getTime();
            const toTime = new Date(dateTo + 'T23:59:59').getTime();

            const filtered = allData.filter(n => {
                if (n.eliminada == 1) return false;
                if (!n.medio_pago || n.medio_pago.toLowerCase() !== 'qr') return false;
                if (!n.fecha_entrega_ujier) return false;

                const deliveryTime = new Date(n.fecha_entrega_ujier).getTime();
                if (deliveryTime < fromTime || deliveryTime > toTime) return false;

                if (ujierId && n.asignado_a != ujierId) return false;

                return true;
            });

            this.currentQRData = filtered; // Store for PDF generation
            this.renderQRReport(filtered);

        } catch (e) {
            console.error('Error generating QR report:', e);
            utils.showToast('Error generando el informe', 'error');
        } finally {
            document.getElementById('qr-report-loading').classList.add('hidden');
        }
    },

    renderQRReport(data) {
        const tbody = document.getElementById('qr-table-body');
        const countEl = document.getElementById('qr-stat-count');
        const totalEl = document.getElementById('qr-stat-total');
        const contentDiv = document.getElementById('qr-report-content');
        const emptyDiv = document.getElementById('qr-report-empty');

        if (!data || data.length === 0) {
            contentDiv.classList.add('hidden');
            emptyDiv.classList.remove('hidden');
            return;
        }

        // Calculate Totals
        let totalAmount = 0;
        let html = '';

        // Sort by date
        data.sort((a, b) => new Date(a.fecha_entrega_ujier) - new Date(b.fecha_entrega_ujier));

        data.forEach(item => {
            const costo = parseFloat(item.costo) || 0;
            totalAmount += costo;
            const fecha = new Date(item.fecha_entrega_ujier).toLocaleDateString();

            html += `
                <tr>
                    <td>${fecha}</td>
                    <td>${item.n_expediente || '-'}</td>
                    <td>${item.caratula || '-'}</td>
                    <td>${item.ujier_nombre || (item.usuarios ? item.usuarios.nombre : 'Sin asignar')}</td>
                    <td style="text-align: right; font-family: monospace; font-size: 1.1em;">$${utils.formatCurrency(costo)}</td>
                </tr>
            `;
        });

        // Summary Row by Date (Optional, per user request "sumatoria con totales por dia")
        // Note: For now, detail view is table. PDF will contain daily details.

        tbody.innerHTML = html;
        countEl.textContent = data.length;
        totalEl.textContent = `$${utils.formatCurrency(totalAmount)}`;

        // Footer Total
        const tfoot = document.getElementById('qr-table-footer');
        tfoot.innerHTML = `
            <tr style="background-color: var(--bg-hover); font-weight: bold;">
                <td colspan="4" style="text-align: right;">TOTAL:</td>
                <td style="text-align: right; color: var(--success);">$${utils.formatCurrency(totalAmount)}</td>
            </tr>
        `;

        emptyDiv.classList.add('hidden');
        contentDiv.classList.remove('hidden');
    },

    downloadQRPDF() {
        if (!this.currentQRData || this.currentQRData.length === 0) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const dateFrom = document.getElementById('qr-date-from').value.split('-').reverse().join('/');
        const dateTo = document.getElementById('qr-date-to').value.split('-').reverse().join('/');
        const ujierText = document.getElementById('qr-ujier-select').selectedOptions[0].text;

        // Header
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Informe de Recaudación - Pagos QR', 14, 20);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Período: ${dateFrom} al ${dateTo}`, 14, 28);
        doc.text(`Filtro Ujier: ${ujierText}`, 14, 34);
        doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 14, 40);

        // Group by Date for Subtotals
        const groupedByDate = this.currentQRData.reduce((acc, item) => {
            const dateKey = new Date(item.fecha_entrega_ujier).toLocaleDateString();
            if (!acc[dateKey]) acc[dateKey] = { items: [], total: 0 };
            acc[dateKey].items.push(item);
            acc[dateKey].total += parseFloat(item.costo || 0);
            return acc;
        }, {});

        const tableBody = [];
        let grandTotal = 0;

        Object.keys(groupedByDate).forEach(date => {
            const dayGroup = groupedByDate[date];

            // Date Header
            tableBody.push([{
                content: `Fecha: ${date} - Subtotal: $${utils.formatCurrency(dayGroup.total)}`,
                colSpan: 4,
                styles: { fillColor: [240, 240, 240], fontStyle: 'bold' }
            }]);

            dayGroup.items.forEach(item => {
                tableBody.push([
                    item.n_expediente || '',
                    item.caratula || '',
                    item.ujier_nombre || (item.usuarios ? item.usuarios.nombre : 'Sin asignar'),
                    `$${utils.formatCurrency(item.costo || 0)}`
                ]);
            });

            grandTotal += dayGroup.total;
        });

        // Add Grand Total Row
        tableBody.push([{
            content: `TOTAL GENERAL: $${utils.formatCurrency(grandTotal)}`,
            colSpan: 4,
            styles: {
                fillColor: [220, 255, 220],
                textColor: [0, 100, 0],
                fontStyle: 'bold',
                halign: 'right',
                fontSize: 12
            }
        }]);

        doc.autoTable({
            startY: 45,
            head: [['Expediente', 'Carátula', 'Ujier', 'Costo']],
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [50, 50, 50] },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 80 },
                2: { cellWidth: 50 },
                3: { cellWidth: 20, halign: 'right' }
            }
        });

        doc.save(`informe_qr_${dateFrom.replace(/\//g, '-')}_${dateTo.replace(/\//g, '-')}.pdf`);
    }

};

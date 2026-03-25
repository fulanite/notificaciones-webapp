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
        document.getElementById('btn-actualizar-planilla')?.addEventListener('click', () => {
            console.log('🔄 Click en actualizar planilla detectado');
            utils.showToast('Actualizando datos de la planilla...', 'info', 1500);
            this.updatePreview();
        });

        // Update preview on filter change
        ['planilla-zona', 'planilla-fecha'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.updatePreview());
        });

        // QR Report Listeners (Check existence to avoid errors if HTML not present)
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
            'Turno Permanente': [
                'Fuera de Radio NORTE - Cédulas', 'Turno permanente norte mandamientos',
                'Fuera de Radio SUR - Cédulas', 'Turno permanente sur mandamientos'
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

        const isTurnoPermanenteMandamientos = 
            zona === 'Turno permanente norte mandamientos' || 
            zona === 'Turno permanente sur mandamientos';

        if (!fecha && !isTurnoPermanenteMandamientos) {
            return null;
        }

        const filters = {
            limit: 1000
        };

        if (!isTurnoPermanenteMandamientos && fecha) {
            filters.fecha = fecha;
            filters.dateField = 'fecha_entrega_ujier'; // Filter by delivery date, not creation date
        }

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
        const zona = document.getElementById('planilla-zona')?.value;
        const tbody = document.querySelector('#tabla-planillas-preview tbody');

        const isTurnoPermanenteMandamientos = 
            zona === 'Turno permanente norte mandamientos' || 
            zona === 'Turno permanente sur mandamientos';

        if (!fecha && !isTurnoPermanenteMandamientos) {
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
                <tr style="background: #e2e8f0; font-weight: 700; color: #334155;">
                    <td colspan="11" style="padding: 12px 20px; border-top: 2px solid #cbd5e1;">
                        📂 ZONA: ${zonaName} <span class="badge-mini" style="background: var(--primary-600); color: white; margin-left: 10px;">${items.length} items</span>
                    </td>
                </tr>
            `;
            tbody.innerHTML += headerRow;

            let zoneIndex = 1;

            const renderRows = (itemList) => {
                itemList.forEach(item => {
                    const row = `
                        <tr class="row-hover-effect" style="cursor: pointer;" onclick="app.viewNotificationDetail('${item.id}')" title="Click para ver/editar detalles">
                            <td style="padding-left: 20px; color: var(--text-muted); font-size: 0.85rem;">${zoneIndex++}</td>
                            <td data-label="Expediente"><strong class="cell-primary">${item.n_expediente || 'S/N'}</strong></td>
                            <td data-label="Carátula" title="${item.caratula || ''}">${utils.truncate(item.caratula || '-', 30)}</td>
                            <td data-label="Tipo" style="font-size: 0.85rem; color: var(--text-secondary);">${item.tipo_notificacion || ''}</td>
                            <td data-label="Destinatario" class="cell-recipient">${item.destinatario_nombre || utils.getSpecialDestinationText(item) || '-'}</td>
                            <td data-label="Domicilio" title="${item.domicilio}">${utils.truncate(item.domicilio, 35)}</td>
                            <td data-label="Troquel" style="font-family: monospace; font-weight: 600; color: var(--primary-500);">${item.n_troquel || '-'}</td>
                            <td data-label="Ujier">${item.ujier_nombre ? item.ujier_nombre.split(' ')[0] : (item.usuarios ? item.usuarios.nombre.split(' ')[0] : '-')}</td>
                            <td data-label="Fecha">${item.fecha_entrega_ujier ? utils.formatDate(item.fecha_entrega_ujier) : '-'}</td>
                            <td class="text-center">
                                <button class="btn-icon-mini" onclick="event.stopPropagation(); app.viewNotificationDetail('${item.id}')">👁️</button>
                            </td>
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
                    <tr style="background: #f1f5f9; font-weight: 700; color: #64748b; font-size: 0.75rem;">
                        <td colspan="11" style="padding: 10px 20px; text-align: left; letter-spacing: 1px; border-top: 1px solid #e2e8f0;">
                            ✨ DESTINOS ESPECIALES
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
        const formattedDate = fecha ? fecha.split('-').reverse().join('/') : 'Sin Fecha';

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
                didDrawCell: (data) => {
                    // Draw square checkbox for 'Devuelta' column
                    if (data.section === 'body' && data.column.index === 12) {
                        // Avoid drawing on sub-headers (which have text content or object content)
                        const cellRaw = data.cell.raw;
                        // If it's a header object with content or non-empty string, skip
                        if (cellRaw && (typeof cellRaw === 'object' || (typeof cellRaw === 'string' && cellRaw.trim() !== ''))) {
                            return;
                        }

                        const size = 5; // Checkbox size
                        const x = data.cell.x + (data.cell.width - size) / 2;
                        const y = data.cell.y + (data.cell.height - size) / 2;

                        doc.setDrawColor(0); // Black border
                        doc.setLineWidth(0.1);
                        doc.rect(x, y, size, size);
                    }
                }
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

    // -------------------------------------------------------------------------
    // QR REPORT METHODS
    // -------------------------------------------------------------------------

    async loadUjieresForQR() {
        const select = document.getElementById('qr-ujier-select');
        // Check if element exists before proceeding (safety for user complaint)
        if (!select) {
            console.warn('QR Ujier Select not found');
            return;
        }
        if (select.dataset.loaded === 'true') return;

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
        const dateFromEl = document.getElementById('qr-date-from');
        const dateToEl = document.getElementById('qr-date-to');
        const ujierSelectEl = document.getElementById('qr-ujier-select');

        // Safety check
        if (!dateFromEl || !dateToEl) return;

        const dateFrom = dateFromEl.value;
        const dateTo = dateToEl.value;
        const ujierId = ujierSelectEl ? ujierSelectEl.value : '';

        if (!dateFrom || !dateTo) {
            utils.showToast('Seleccioná un rango de fechas', 'warning');
            return;
        }

        const loadingEl = document.getElementById('qr-report-loading');
        const contentEl = document.getElementById('qr-report-content');
        const emptyEl = document.getElementById('qr-report-empty');

        if (loadingEl) loadingEl.classList.remove('hidden');
        if (contentEl) contentEl.classList.add('hidden');
        if (emptyEl) emptyEl.classList.add('hidden');

        try {
            // Optimization: determine years involved
            const startYear = new Date(dateFrom).getFullYear();
            const endYear = new Date(dateTo).getFullYear();

            let allData = [];

            // Fetch for involved years (limit to 2000 per year)
            for (let y = startYear; y <= endYear; y++) {
                const params = { limit: 2000, year: y };
                const { data } = await db.getNotifications(params);
                if (data) allData = allData.concat(data);
            }

            // FILTER LOGIC:
            // 1. Not Deleted
            // 2. Medio Pago = QR
            // 3. Date Range (fecha_entrega_ujier)
            // 4. Ujier (if selected)

            // Adjust dates for comparison (start of day, end of day)
            const fromTime = new Date(dateFrom + 'T00:00:00').getTime();
            const toTime = new Date(dateTo + 'T23:59:59').getTime();

            const filtered = allData.filter(n => {
                if (n.eliminada == 1) return false;

                // Strict check for QR payment method
                if (!n.medio_pago || n.medio_pago.toLowerCase() !== 'qr') return false;

                // Must have delivery date
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
            if (loadingEl) loadingEl.classList.add('hidden');
        }
    },

    renderQRReport(data) {
        const tbody = document.getElementById('qr-table-body');
        const countEl = document.getElementById('qr-stat-count');
        const totalEl = document.getElementById('qr-stat-total');
        const contentDiv = document.getElementById('qr-report-content');
        const emptyDiv = document.getElementById('qr-report-empty');

        if (!tbody || !contentDiv) return;

        if (!data || data.length === 0) {
            contentDiv.classList.add('hidden');
            if (emptyDiv) emptyDiv.classList.remove('hidden');
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
            const fechaParts = item.fecha_entrega_ujier.split(' ')[0].split('-');
            const fechaDisplay = `${fechaParts[2]}/${fechaParts[1]}/${fechaParts[0]}`;

            html += `
                <tr class="row-hover-effect" style="cursor: pointer;" onclick="app.viewNotificationDetail('${item.id}')" title="Click para ver detalle">
                    <td data-label="Fecha">${fechaDisplay}</td>
                    <td data-label="Expediente"><strong class="cell-primary">${item.n_expediente || 'S/N'}</strong></td>
                    <td data-label="Carátula" title="${item.caratula || ''}">${utils.truncate(item.caratula || '-', 60)}</td>
                    <td data-label="Ujier">${item.ujier_nombre || (item.usuarios ? item.usuarios.nombre : '-')}</td>
                    <td data-label="Costo" style="text-align: right; font-family: monospace; font-weight: 600; color: var(--success-600);">$${utils.formatCurrency(costo)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        if (countEl) countEl.textContent = data.length;
        if (totalEl) totalEl.textContent = `$${utils.formatCurrency(totalAmount)}`;

        // Footer Total
        const tfoot = document.getElementById('qr-table-footer');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr style="background-color: var(--bg-hover); font-weight: bold;">
                    <td colspan="4" style="text-align: right;">TOTAL:</td>
                    <td style="text-align: right; color: var(--success);">$${utils.formatCurrency(totalAmount)}</td>
                </tr>
            `;
        }

        if (emptyDiv) emptyDiv.classList.add('hidden');
        contentDiv.classList.remove('hidden');
    },

    downloadQRPDF() {
        if (!this.currentQRData || this.currentQRData.length === 0) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const dateFromEl = document.getElementById('qr-date-from');
        const dateToEl = document.getElementById('qr-date-to');
        const ujierSelectEl = document.getElementById('qr-ujier-select');

        const dateFrom = dateFromEl.value.split('-').reverse().join('/');
        const dateTo = dateToEl.value.split('-').reverse().join('/');

        let ujierText = 'Todos';
        if (ujierSelectEl && ujierSelectEl.selectedIndex > 0) {
            ujierText = ujierSelectEl.options[ujierSelectEl.selectedIndex].text;
        }

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
            const dateKey = item.fecha_entrega_ujier.split(' ')[0]; // Key YYYY-MM-DD
            if (!acc[dateKey]) acc[dateKey] = { items: [], total: 0 };
            acc[dateKey].items.push(item);
            acc[dateKey].total += parseFloat(item.costo || 0);
            return acc;
        }, {});

        const tableBody = [];
        let grandTotal = 0;

        // Sort dates
        Object.keys(groupedByDate).sort().forEach(dateIso => {
            const dayGroup = groupedByDate[dateIso];
            const dateParts = dateIso.split('-');
            const dateDisplay = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

            // Date Header
            tableBody.push([{
                content: `Fecha: ${dateDisplay} - Subtotal: $${utils.formatCurrency(dayGroup.total)}`,
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

        const safeDateFrom = dateFrom.replace(/\//g, '-');
        const safeDateTo = dateTo.replace(/\//g, '-');
        doc.save(`informe_qr_${safeDateFrom}_${safeDateTo}.pdf`);
    }

};

/**
 * SGND - Module for generating execution sheets (Planillas de Trabajo)
 */

const planillas = {
    init() {
        this.setupEventListeners();
        this.loadUjieres();
        this.setDefaultDate();
        this.populateZones();
    },

    setupEventListeners() {
        document.getElementById('btn-generar-planilla')?.addEventListener('click', () => this.generatePDF());

        // Update preview on filter change
        ['planilla-zona', 'planilla-ujier', 'planilla-fecha'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.updatePreview());
        });
    },

    setDefaultDate() {
        // Set default date to today
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
                'Urgente NORTE - Cédulas', 'Urgente NORTE - Mandamiento'
            ],
            'Fuera de Radio': [
                'Fuera de Radio NORTE - Cèdula', 'Fuera de Radio NORTE - Mandamientos',
                'Fuera de Radio SUR - Cédula', 'Fuera de Radio SUR - Mandamientos'
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
        select.addEventListener('change', () => this.updatePreview());
    },

    async loadUjieres() {
        const select = document.getElementById('planilla-ujier');
        if (!select) return;

        try {
            const { data: ujieres } = await db.getUsersByRole('ujier');
            if (ujieres && ujieres.length > 0) {
                // Clear existing options except the first one "Todos los Ujieres"
                select.innerHTML = '<option value="">Todos los Ujieres</option>';

                const options = ujieres.map(u =>
                    `<option value="${u.id}">${u.nombre}</option>`
                ).join('');
                select.innerHTML += options;
            }
        } catch (error) {
            console.error('Error loading ujieres:', error);
            utils.showToast('Error cargando ujieres', 'error');
        }
    },

    async fetchData() {
        const zona = document.getElementById('planilla-zona').value;
        const ujierId = document.getElementById('planilla-ujier').value;
        const fecha = document.getElementById('planilla-fecha')?.value;

        if (!fecha) {
            utils.showToast('Seleccione una fecha', 'warning');
            return null;
        }

        const filters = {
            fecha: fecha,
            limit: 1000
        };

        const { data, error } = await db.getNotifications(filters);

        if (error) {
            utils.showToast('Error obteniendo datos', 'error');
            return null;
        }

        let filteredData = data || [];

        // Client-side filtering
        if (zona) {
            filteredData = filteredData.filter(n => {
                if (!n.zona) return false;
                // Exact match or contains for flexibility incase of minor typos in DB vs List
                return n.zona.toLowerCase().includes(zona.toLowerCase());
            });
        }
        if (ujierId) {
            filteredData = filteredData.filter(n => n.ujier_asignado_id == ujierId || (n.usuarios && n.usuarios.id == ujierId));
        }

        return filteredData;
    },

    async updatePreview() {
        const data = await this.fetchData();
        if (!data) return;

        const tbody = document.querySelector('#tabla-planillas-preview tbody');
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

            // Add Group Header with Count
            const headerRow = `
                <tr style="background-color: var(--bg-hover); font-weight: bold;">
                    <td colspan="9" style="padding: 10px;">
                        📂 ${zonaName} <span class="badge" style="margin-left: 10px; font-size: 0.8em;">${items.length} items</span>
                    </td>
                </tr>
            `;
            tbody.innerHTML += headerRow;

            // Add items for this zone
            items.forEach((item, index) => {
                const row = `
                    <tr>
                        <td style="padding-left: 20px;">${index + 1}</td>
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
        });
    },

    async generatePDF() {
        const data = await this.fetchData();
        if (!data || data.length === 0) {
            utils.showToast('No hay datos para generar la planilla', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

        const zona = document.getElementById('planilla-zona').value || 'Generales';
        const fecha = document.getElementById('planilla-fecha').value;
        const formattedDate = fecha.split('-').reverse().join('/');

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
        doc.text(`Zona: ${zona}`, 14, 30);

        // "Fecha: [Date]" right aligned
        doc.text(`Fecha: ${formattedDate}`, doc.internal.pageSize.width - 14, 30, { align: 'right' });

        // --- TABLE ---
        const tableBody = [];

        // Group data by Zona
        const groupedData = data.reduce((acc, item) => {
            const z = item.zona || 'Sin Zona';
            if (!acc[z]) acc[z] = [];
            acc[z].push(item);
            return acc;
        }, {});

        const sortedZones = Object.keys(groupedData).sort();

        sortedZones.forEach(zonaName => {
            // Add Separator Row for Zone
            tableBody.push([{ content: `${zonaName} (${groupedData[zonaName].length})`, colSpan: 13, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', halign: 'left' } }]);

            groupedData[zonaName].forEach((item, index) => {
                // Format "Tipo Not."
                let tipo = item.tipo_notificacion || '';
                if (tipo === 'cedulas') tipo = 'Cédulas';
                if (tipo === 'mandamientos') tipo = 'Mandamientos';

                // Format "Medio de Pago"
                let pago = item.medio_pago || '';
                if (pago) pago = pago.charAt(0).toUpperCase() + pago.slice(1);

                tableBody.push([
                    index + 1,
                    item.n_expediente || '',
                    item.caratula || '',
                    item.origen || '',
                    tipo,
                    item.letrado || '',
                    item.destinatario_nombre || '',
                    item.domicilio || '',
                    item.n_troquel || '',
                    item.costo ? `$${item.costo}` : '',
                    pago,
                    item.observaciones_iniciales || item.observaciones || '', // Observaciones
                    ''  // Devuelta
                ]);
            });
        });

        doc.autoTable({
            startY: 35,
            head: [['Nº', 'Nº expte.', 'Carátula', 'Origen', 'Tipo Not.', 'Letrado', 'Destinatario', 'Domicilio', 'Troquel', 'Costo', 'Medio de pago', 'Observaciones', 'Devuelta']],
            body: tableBody,
            styles: {
                fontSize: 8,
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
                0: { cellWidth: 8 },  // Nº
                1: { cellWidth: 18 }, // Nº expte
                2: { cellWidth: 35 }, // Carátula
                3: { cellWidth: 25 }, // Origen
                4: { cellWidth: 18 }, // Tipo Not
                5: { cellWidth: 22 }, // Letrado
                6: { cellWidth: 25 }, // Destinatario
                7: { cellWidth: 35 }, // Domicilio
                8: { cellWidth: 12 }, // Troquel
                9: { cellWidth: 15 }, // Costo
                10: { cellWidth: 20 }, // Medio de pago
                11: { cellWidth: 25 }, // Observaciones
                12: { cellWidth: 15, halign: 'center' } // Devuelta
            },
            theme: 'grid', // Grid theme for borders
            didDrawCell: (data) => {
                // Draw square checkbox for 'Devuelta' column
                if (data.section === 'body' && data.column.index === 12) {
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
        doc.text(`Total: ${data.length}`, 14, finalY + 10);

        // Get selected ujier name if any
        const ujierSelect = document.getElementById('planilla-ujier');
        const ujierName = ujierSelect.selectedIndex > 0 ? ujierSelect.options[ujierSelect.selectedIndex].text : '';

        if (ujierName) {
            doc.text(`Ujier / Receptor: ${ujierName}`, 14, finalY + 18);
        } else {
            doc.text(`Ujier / Receptor: ______________________________`, 14, finalY + 18);
        }

        // Save
        const fileName = `planilla_${zona.replace(/\s+/g, '_')}_${fecha}.pdf`;
        doc.save(fileName);

        utils.showToast('Planilla generada con éxito', 'success');
    }
};

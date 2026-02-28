/**
 * SGND - Bulk Editor Module
 * For Admin/Coordinator corrections
 */

const bulkEditor = {
    initialized: false,
    state: {
        notificaciones: [],
        selectedIds: new Set(),
        filters: {
            search: '',
            ujier: '',
            zona: '',
            estado: '',
            devuelta: '',
            year: '2026'
        },
        currentPage: 1,
        totalPages: 1
    },

    async init() {
        if (this.initialized) {
            await this.loadData();
            return;
        }

        this.setupEventListeners();
        await this.loadInitialFilters();
        await this.loadData();
        this.initialized = true;
    },

    setupEventListeners() {
        const searchInput = document.getElementById('bulk-search');
        const filterUjier = document.getElementById('bulk-filter-ujier');
        const filterZona = document.getElementById('bulk-filter-zona');
        const filterYear = document.getElementById('bulk-filter-year');

        const filterEstado = document.getElementById('bulk-filter-estado');
        const filterDevuelta = document.getElementById('bulk-filter-devuelta');

        const updateAndLoad = () => {
            this.state.currentPage = 1;
            this.loadData();
        };

        searchInput?.addEventListener('input', utils.debounce(() => {
            this.state.filters.search = searchInput.value;
            updateAndLoad();
        }, 300));

        filterUjier?.addEventListener('change', () => {
            this.state.filters.ujier = filterUjier.value;
            updateAndLoad();
        });

        filterZona?.addEventListener('change', () => {
            this.state.filters.zona = filterZona.value;
            updateAndLoad();
        });

        filterEstado?.addEventListener('change', () => {
            this.state.filters.estado = filterEstado.value;
            updateAndLoad();
        });

        filterDevuelta?.addEventListener('change', () => {
            this.state.filters.devuelta = filterDevuelta.value;
            updateAndLoad();
        });

        filterYear?.addEventListener('change', () => {
            this.state.filters.year = filterYear.value;
            updateAndLoad();
        });

        // Bulk actions
        document.getElementById('btn-bulk-select-all')?.addEventListener('click', () => this.toggleSelectAll());
        document.getElementById('btn-apply-bulk-status')?.addEventListener('click', () => this.applyBulkStatus());
        document.getElementById('bulk-new-status')?.addEventListener('change', () => this.updateApplyButtonState());

        // Pagination
        document.getElementById('btn-bulk-prev')?.addEventListener('click', () => {
            if (this.state.currentPage > 1) {
                this.state.currentPage--;
                this.loadData();
            }
        });

        document.getElementById('btn-bulk-next')?.addEventListener('click', () => {
            if (this.state.currentPage < this.state.totalPages) {
                this.state.currentPage++;
                this.loadData();
            }
        });
    },

    async loadInitialFilters() {
        const filterUjier = document.getElementById('bulk-filter-ujier');
        const filterZona = document.getElementById('bulk-filter-zona');

        try {
            const [ujieresResp, zonasResp] = await Promise.all([
                db.getUjieres(),
                db.getDistinctValues('zona')
            ]);

            if (filterUjier && ujieresResp.data) {
                filterUjier.innerHTML = '<option value="">👤 Todos los ujieres</option>' +
                    ujieresResp.data.map(u => `<option value="${u.id}">${u.nombre || u.email}</option>`).join('');
            }

            if (filterZona && zonasResp.data) {
                filterZona.innerHTML = '<option value="">🌎 Todas las zonas</option>' +
                    zonasResp.data.map(z => `<option value="${z}">${utils.formatZoneLabel(z).toUpperCase()}</option>`).join('');
            }
        } catch (e) {
            console.error('Error loading bulk editor filters:', e);
        }
    },

    async loadData() {
        const tbody = document.getElementById('bulk-table-body');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner"></div> Cargando datos...</td></tr>';

        const options = {
            page: this.state.currentPage,
            limit: 50, // Higher limit for bulk editing
            search: this.state.filters.search,
            zona: this.state.filters.zona,
            year: this.state.filters.year,
            estado: this.state.filters.estado,
            devuelta_por_ujier: this.state.filters.devuelta,
            ujier_id: this.state.filters.ujier
        };

        try {
            const { data, count, error } = await db.getNotifications(options);

            if (error) throw error;

            this.state.notificaciones = data || [];
            this.state.totalPages = Math.ceil(count / 50) || 1;
            this.renderTable();
            this.updatePagination(count);
            // Clear selection on filter/page change to avoid confusion
            this.state.selectedIds.clear();
            this.updateSelectedCounter();
        } catch (e) {
            console.error('Error loading bulk data:', e);
            tbody.innerHTML = `<tr><td colspan="7" class="text-center color-error">Error: ${e.message}</td></tr>`;
        }
    },

    renderTable() {
        const tbody = document.getElementById('bulk-table-body');
        if (!tbody) return;

        if (this.state.notificaciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron notificaciones</td></tr>';
            return;
        }

        tbody.innerHTML = this.state.notificaciones.map(n => {
            const actualStatus = n.resultado_ultima_visita || n.resultado_diligencia || n.estado || 'pendiente';
            const isSelected = this.state.selectedIds.has(n.id);

            return `
                <tr class="${isSelected ? 'row-selected' : ''}" onclick="bulkEditor.toggleSelection('${n.id}')">
                    <td onclick="event.stopPropagation()">
                        <label class="checkbox-wrapper">
                            <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="bulkEditor.toggleSelection('${n.id}')">
                            <span class="checkbox-custom"></span>
                        </label>
                    </td>
                    <td><strong>${n.n_expediente}</strong></td>
                    <td title="${n.destinatario_nombre || ''}">${utils.truncate(n.destinatario_nombre || utils.getSpecialDestinationText(n) || '-', 25)}</td>
                    <td title="${n.domicilio}">${utils.truncate(n.domicilio, 35)}</td>
                    <td>${n.ujier_nombre ? n.ujier_nombre.split(' ')[0] : '-'}</td>
                    <td>
                        <span class="badge-mini status-${this.getStatusClass(actualStatus)}">
                            ${(CONFIG.RESULT_OPTIONS[actualStatus] || actualStatus).toUpperCase()}
                        </span>
                    </td>
                    <td style="text-align: center;" onclick="event.stopPropagation()">
                        <button class="btn btn-icon btn-sm" onclick="notifications.viewDetails('${n.id}')" title="Ver Detalle">
                            👁️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    getStatusClass(status) {
        if (!status) return 'pending';
        const s = status.toLowerCase().replace(/_/g, ' ');
        if (['atiende', 'entregada', 'entregado', 'positivo', 'diligenciada'].includes(s)) return 'success';
        if (['no atiende', 'no_atiende', 'negativo', 'rechazado', 'domicilio inexistente', 'domicilio_inexistente'].includes(s)) return 'error';
        if (['pre aviso', 'pre_aviso', 'estrados'].includes(s)) return 'warning';
        return 'pending';
    },

    toggleSelection(id) {
        if (this.state.selectedIds.has(id)) {
            this.state.selectedIds.delete(id);
        } else {
            this.state.selectedIds.add(id);
        }
        this.renderTable();
        this.updateSelectedCounter();
        this.updateApplyButtonState();
    },

    toggleSelectAll() {
        const allIds = this.state.notificaciones.map(n => n.id);
        const allSelected = allIds.every(id => this.state.selectedIds.has(id));

        if (allSelected) {
            allIds.forEach(id => this.state.selectedIds.delete(id));
        } else {
            allIds.forEach(id => this.state.selectedIds.add(id));
        }
        this.renderTable();
        this.updateSelectedCounter();
        this.updateApplyButtonState();
    },

    updateSelectedCounter() {
        const counter = document.getElementById('bulk-selected-badge');
        if (counter) {
            const size = this.state.selectedIds.size;
            counter.textContent = `${size} seleccionadas`;
            counter.classList.toggle('hidden', size === 0);
        }
    },

    updateApplyButtonState() {
        const btn = document.getElementById('btn-apply-bulk-status');
        const statusSelect = document.getElementById('bulk-new-status');
        if (btn && statusSelect) {
            btn.disabled = this.state.selectedIds.size === 0 || !statusSelect.value;
        }
    },

    updatePagination(total) {
        const info = document.getElementById('bulk-pagination-info');
        const btnPrev = document.getElementById('btn-bulk-prev');
        const btnNext = document.getElementById('btn-bulk-next');

        if (info) info.textContent = `Página ${this.state.currentPage} de ${this.state.totalPages} (${total} total)`;
        if (btnPrev) btnPrev.disabled = this.state.currentPage <= 1;
        if (btnNext) btnNext.disabled = this.state.currentPage >= this.state.totalPages;
    },

    async applyBulkStatus() {
        const newStatus = document.getElementById('bulk-new-status').value;
        if (!newStatus || this.state.selectedIds.size === 0) return;

        const count = this.state.selectedIds.size;
        const confirmMsg = `¿Estás seguro de cambiar el resultado a "${CONFIG.RESULT_OPTIONS[newStatus]}" para ${count} notificaciones?`;

        if (!confirm(confirmMsg)) return;

        utils.showLoading(`Aplicando cambios a ${count} registros...`);

        try {
            const ids = Array.from(this.state.selectedIds);

            // We can process them in parallel with a limit or sequentially
            // For simplicity and to avoid hitting API limits/locks, we'll do them in chunks
            const chunkSize = 10;
            for (let i = 0; i < ids.length; i += chunkSize) {
                const chunk = ids.slice(i, i + chunkSize);
                const fechaActual = new Date().toISOString().slice(0, 19).replace('T', ' ');
                await Promise.all(chunk.map(id => {
                    if (newStatus === 'pendiente') {
                        return db.updateNotification(id, {
                            resultado_diligencia: null,
                            fecha_diligencia: null,
                            estado: 'pendiente'
                        });
                    }

                    // Determinar el estado general (workflow) basado en el resultado específico
                    let highLevelEstado = 'diligenciada'; // Default for results that mean it's done
                    const lowStatus = newStatus.toLowerCase().replace(/_/g, ' ');

                    if (lowStatus === 'pendiente') highLevelEstado = 'pendiente';
                    else if (lowStatus === 'pre aviso') highLevelEstado = 'pendiente';

                    return db.updateNotification(id, {
                        resultado_diligencia: newStatus,
                        fecha_diligencia: fechaActual,
                        estado: highLevelEstado
                    });
                }));
            }

            utils.showToast(`${count} notificaciones actualizadas correctamente`, 'success');
            this.state.selectedIds.clear();
            await this.loadData();
        } catch (e) {
            console.error('Error in bulk update:', e);
            utils.showToast('Error al procesar algunos cambios', 'error');
        } finally {
            utils.hideLoading();
        }
    }
};

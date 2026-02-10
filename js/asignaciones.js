/**
 * SGND - Asignaciones Module v40.0
 * Overhauled to match Devoluciones aesthetics and hierarchical flow.
 */

const asignaciones = {
    state: {
        ujieres: [],
        notificaciones: [],
        currentUjierId: null,
        selectedIds: new Set(),
        loading: false,
        searchTerm: '',
        initialized: false
    },

    async init() {
        if (this.state.initialized) {
            await this.refreshData();
            return;
        }
        console.log('[Asignaciones] Initializing v40.1...');
        this.setupEventListeners();
        await this.refreshData();
        this.state.initialized = true;
    },

    setupEventListeners() {
        // Back button
        document.getElementById('btn-back-to-ujieres')?.addEventListener('click', () => {
            this.state.currentUjierId = null;
            this.state.selectedIds.clear();
            this.renderAll();
        });

        // Select All button
        document.getElementById('btn-select-all-reasign')?.addEventListener('click', () => {
            const list = this.getFilteredNotifications();
            const allSelected = list.every(n => this.state.selectedIds.has(n.id));

            if (allSelected) {
                list.forEach(n => this.state.selectedIds.delete(n.id));
            } else {
                list.forEach(n => this.state.selectedIds.add(n.id));
            }
            this.renderList();
            this.updateUI();
        });

        // Search Input
        document.getElementById('search-notif-reasign')?.addEventListener('input', (e) => {
            this.state.searchTerm = e.target.value.toLowerCase();
            this.renderList();
        });

        // Confirm Reassignment
        document.getElementById('btn-confirm-reasign')?.addEventListener('click', () => this.executeReassignment());
    },

    async refreshData() {
        this.state.loading = true;
        this.showLoading();

        try {
            const [notifResult, ujieresResult] = await Promise.all([
                db.getNotifications({
                    limit: 1000,
                    estado: 'pendiente,en_proceso,pre_aviso'
                }),
                db.getUjieres()
            ]);

            if (notifResult.error) throw notifResult.error;
            if (ujieresResult.error) throw ujieresResult.error;

            // Deduplicate notifications to prevent double rows
            const uniqueNotifs = new Map();
            (notifResult.data || []).forEach(n => uniqueNotifs.set(n.id, n));
            this.state.notificaciones = Array.from(uniqueNotifs.values());

            this.state.ujieres = ujieresResult.data || [];

            this.renderAll();
            this.populateTargetUjieres();
        } catch (err) {
            console.error('[Asignaciones] Error:', err);
            utils.showToast('Error al cargar datos', 'error');
        } finally {
            this.state.loading = false;
        }
    },

    renderAll() {
        const grid = document.getElementById('asignaciones-ujieres-grid');
        const list = document.getElementById('asignaciones-list-container');

        if (this.state.currentUjierId) {
            grid.classList.add('hidden');
            list.classList.remove('hidden');
            this.renderList();
            this.populateTargetUjieres(); // <--- Refresh dropdown to update disabled states
        } else {
            grid.classList.remove('hidden');
            list.classList.add('hidden');
            this.renderUjieresGrid();
        }
        this.updateUI();
    },

    renderUjieresGrid() {
        const grid = document.getElementById('asignaciones-ujieres-grid');
        if (!grid) return;

        // Calculate counts per ujier
        const ujierStats = {};
        this.state.ujieres.forEach(u => {
            ujierStats[u.id] = {
                name: u.nombre || u.email,
                pending: 0,
                preAviso: 0
            };
        });

        this.state.notificaciones.forEach(n => {
            if (n.asignado_a && ujierStats[n.asignado_a]) {
                const isPre = utils.isPreAviso(n.estado) || utils.isPreAviso(n.resultado_diligencia);
                if (isPre) ujierStats[n.asignado_a].preAviso++;
                else ujierStats[n.asignado_a].pending++;
            }
        });

        grid.innerHTML = Object.entries(ujierStats).map(([id, stats]) => {
            const total = stats.pending + stats.preAviso;
            return `
                <div class="zone-premium-card" onclick="asignaciones.openUjier('${id}')">
                    <div class="zone-badge">${total}</div>
                    <div class="zone-icon">👤</div>
                    <div class="zone-card-body">
                        <h3 class="zone-name">${stats.name}</h3>
                        <p class="zone-desc">${stats.pending} pendientes / ${stats.preAviso} pre-avisos</p>
                    </div>
                    <div class="zone-card-footer">
                        <span>Ver notificaciones →</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    openUjier(id) {
        this.state.currentUjierId = id;
        this.state.selectedIds.clear();
        this.state.searchTerm = '';

        const ujier = this.state.ujieres.find(u => u.id === id);
        const titleEl = document.getElementById('current-ujier-title');
        if (titleEl) titleEl.textContent = `Ujier: ${ujier?.nombre || 'Desconocido'}`;

        const searchInput = document.getElementById('search-notif-reasign');
        if (searchInput) searchInput.value = '';

        this.renderAll();
    },

    getFilteredNotifications() {
        if (!this.state.currentUjierId) return [];

        return this.state.notificaciones.filter(n => {
            const matchesUjier = n.asignado_a === this.state.currentUjierId;
            const matchesSearch = !this.state.searchTerm ||
                (n.n_expediente || '').toLowerCase().includes(this.state.searchTerm) ||
                (n.destinatario_nombre || '').toLowerCase().includes(this.state.searchTerm) ||
                (n.caratula || '').toLowerCase().includes(this.state.searchTerm) ||
                (n.domicilio || '').toLowerCase().includes(this.state.searchTerm);

            return matchesUjier && matchesSearch;
        });
    },

    renderList() {
        const tbody = document.getElementById('reasignaciones-table-body');
        if (!tbody) return;

        const list = this.getFilteredNotifications();

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay notificaciones activas para este ujier</td></tr>';
            return;
        }

        tbody.innerHTML = list.map(n => `
            <tr class="${this.state.selectedIds.has(n.id) ? 'row-selected' : ''}" 
                onclick="asignaciones.toggleSelection('${n.id}')">
                <td style="width: 50px;" onclick="event.stopPropagation()">
                    <label class="checkbox-wrapper">
                        <input type="checkbox" ${this.state.selectedIds.has(n.id) ? 'checked' : ''} 
                            onchange="asignaciones.toggleSelection('${n.id}')"
                            class="select-checkbox">
                        <span class="checkbox-custom"></span>
                    </label>
                </td>
                <td data-label="Expediente"><strong class="cell-primary">${n.n_expediente || 'S/N'}</strong></td>
                <td data-label="Carátula" title="${n.caratula || ''}" class="cell-truncate">${utils.truncate(n.caratula || '-', 35)}</td>
                <td data-label="Destinatario" class="cell-recipient">${n.destinatario_nombre || utils.getSpecialDestinationText(n) || '-'}</td>
                <td data-label="N° Troquel" style="font-family: monospace; font-weight: 600; color: var(--primary-400);">${n.n_troquel || '-'}</td>
                <td data-label="Domicilio" title="${n.domicilio}" class="cell-truncate">${utils.truncate(n.domicilio, 40)}</td>
                <td data-label="Estado">
                    <span class="badge-mini status-${this.getStatusClass(n.estado)}">${n.estado.toUpperCase()}</span>
                </td>
            </tr>
        `).join('');
    },

    handleRowClick(event, id) {
        // If clicking a link or button inside the row, don't toggle
        if (event.target.closest('a, button, label')) return;
        this.toggleSelection(id);
    },

    toggleSelection(id) {
        if (this.state.selectedIds.has(id)) {
            this.state.selectedIds.delete(id);
        } else {
            this.state.selectedIds.add(id);
        }
        this.renderList();
        this.updateUI();
    },

    getStatusClass(estado) {
        switch (estado) {
            case 'pendiente': return 'warning';
            case 'en_proceso': return 'info';
            case 'pre_aviso': return 'info';
            default: return 'secondary';
        }
    },

    populateTargetUjieres() {
        const select = document.getElementById('select-target-ujier');
        if (!select) return;

        const currentValue = select.value;
        const otherUjieres = this.state.ujieres.filter(u => u.id !== this.state.currentUjierId);

        select.innerHTML = '<option value="">Reasignar a...</option>' +
            this.state.ujieres.map(u => {
                const isCurrent = String(u.id) === String(this.state.currentUjierId);
                return `
                    <option value="${u.id}" ${isCurrent ? 'disabled style="color: #94a3b8; background: #f1f5f9;"' : ''}>
                        👤 ${u.nombre || u.email} ${isCurrent ? '(Origen - Deshabilitado)' : ''}
                    </option>
                `;
            }).join('');

        // Reset selection if the current target is no longer available (because it's now the source)
        if (String(currentValue) === String(this.state.currentUjierId)) {
            select.value = '';
        } else {
            select.value = currentValue;
        }
    },

    updateUI() {
        const count = this.state.selectedIds.size;
        const msg = document.getElementById('reasign-selected-count');
        const btn = document.getElementById('btn-confirm-reasign');
        const select = document.getElementById('select-target-ujier');

        if (msg) msg.textContent = `${count} seleccionada${count === 1 ? '' : 's'}`;

        if (btn) {
            const ujierDestino = select?.value;
            const targetUjier = this.state.ujieres.find(u => String(u.id) === String(ujierDestino));

            btn.disabled = count === 0 || !ujierDestino;

            if (count > 0 && ujierDestino) {
                btn.innerHTML = `<span>🔄</span> Reasignar ${count} a ${targetUjier?.nombre || '...'}`;
            } else {
                btn.innerHTML = `<span>🔄</span> Confirmar Reasignación`;
            }
        }

        // Handle select change to update button
        if (select && !select.onchange) {
            select.onchange = () => this.updateUI();
        }
    },

    showLoading() {
        const grid = document.getElementById('asignaciones-ujieres-grid');
        if (grid && !this.state.currentUjierId) {
            grid.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px;">
                    <div class="loading-spinner"></div>
                    <p style="margin-top: 15px; color: var(--text-muted); font-size: 0.9rem;">Cargando ujieres y estadísticas...</p>
                </div>
            `;
        }
    },

    async executeReassignment() {
        const count = this.state.selectedIds.size;
        const targetUjierId = document.getElementById('select-target-ujier').value;
        const targetUjier = this.state.ujieres.find(u => String(u.id) === String(targetUjierId));

        if (count === 0 || !targetUjierId) return;

        if (!confirm(`¿Estás seguro de reasignar ${count} notificaciones a ${targetUjier?.nombre || targetUjier?.email}?`)) {
            return;
        }

        const btn = document.getElementById('btn-confirm-reasign');
        const originalHTML = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Procesando...';

        let successCount = 0;
        let errorCount = 0;

        const promises = Array.from(this.state.selectedIds).map(id =>
            db.updateNotification(id, {
                asignado_a: targetUjierId,
                fecha_asignacion: new Date().toISOString()
            })
        );

        try {
            const results = await Promise.all(promises);

            results.forEach(res => {
                if (res.error) errorCount++;
                else successCount++;
            });

            if (successCount > 0) {
                utils.showToast(`✅ ${successCount} notificaciones reasignadas con éxito`, 'success');
            }
            if (errorCount > 0) {
                utils.showToast(`❌ Error en ${errorCount} notificaciones`, 'error');
            }

            // Important: refresh data and state
            await this.refreshData();
            this.state.selectedIds.clear();
            this.updateUI();
        } catch (err) {
            console.error('[Asignaciones] Error:', err);
            utils.showToast('Error al procesar reasignación', 'error');
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }
};

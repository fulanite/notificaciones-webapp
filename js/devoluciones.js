/**
 * SGND - Devoluciones Module
 * Handles the return of physical notifications by bailiffs.
 */

const devoluciones = {
    // State
    state: {
        notificacionesPendientes: [],
        filteredNotificaciones: [],
        zones: {},
        currentZone: null,
        selectedIds: new Set(),
        loading: false,
        filterYear: '2026',
        gridSearchTerm: '',
        initialized: false
    },

    // Initialize the module
    async init() {
        console.log('[Devoluciones] Initializing view...');
        this.resetState();
        if (!this.state.initialized) {
            this.setupStaticEventListeners();
            this.state.initialized = true;
        }
        await this.refreshData();
    },

    resetState() {
        this.state.selectedIds.clear();
        this.state.currentZone = null; // We use currentUjierId now but keeping this for safety

        // Reset visibility
        document.getElementById('devoluciones-zones-grid')?.classList.remove('hidden');
        document.getElementById('devoluciones-list-container')?.classList.add('hidden');
    },

    // Refresh data from database (only non-returned notifications)
    async refreshData() {
        this.state.loading = true;
        this.showLoading();

        try {
            console.log('[Devoluciones] Fetching notifications with devuelta_por_ujier: 0...');
            const result = await db.getNotifications({
                limit: 2000,
                year: this.state.filterYear,
                devuelta_por_ujier: 0
            });

            if (result.error) throw result.error;

            const data = result.data || [];
            this.state.notificacionesPendientes = Array.isArray(data) ? data : [];
            console.log(`[Devoluciones] Data received:`, this.state.notificacionesPendientes.length, 'records');

            this.renderUjieresGrid();
        } catch (err) {
            console.error('[Devoluciones] Error loading data:', err);
            const grid = document.getElementById('devoluciones-zones-grid');
            if (grid) {
                grid.innerHTML = `
                    <div class="empty-state error-state" style="grid-column: 1/-1;">
                        <span class="empty-icon">⚠️</span>
                        <p>Error al cargar datos: ${err.message || err}</p>
                        <button class="btn btn-secondary" onclick="devoluciones.refreshData()" style="margin-top: 1rem;">
                            🔄 Reintentar
                        </button>
                    </div>`;
            }
            utils.showToast('Error al cargar datos de devoluciones', 'error');
        } finally {
            this.state.loading = false;
        }
    },

    // Group notifications by zone for the card view
    groupByZone() {
        const groups = {};
        this.state.notificacionesPendientes.forEach(n => {
            const zona = n.zona || 'Sin Zona';
            console.log(`[Devoluciones] Grouping notification ${n.id} in zone ${zona}`);
            if (!groups[zona]) {
                groups[zona] = {
                    name: zona,
                    count: 0,
                    notificaciones: []
                };
            }
            groups[zona].count++;
            groups[zona].notificaciones.push(n);
        });

        // Sort zones alphabetically
        this.state.zones = Object.keys(groups).sort().reduce((obj, key) => {
            obj[key] = groups[key];
            return obj;
        }, {});
    },

    setupStaticEventListeners() {
        // Back to zones button
        document.getElementById('btn-back-to-zones')?.addEventListener('click', () => {
            this.state.currentZone = null;
            document.getElementById('devoluciones-zones-grid').classList.remove('hidden');
            document.getElementById('devoluciones-list-container').classList.add('hidden');
        });

        // Select All button
        document.getElementById('btn-select-all-returns')?.addEventListener('click', () => {
            const filtered = this.state.filteredNotificaciones;
            const allSelected = filtered.every(n => this.state.selectedIds.has(n.id));

            if (allSelected) {
                filtered.forEach(n => this.state.selectedIds.delete(n.id));
            } else {
                filtered.forEach(n => this.state.selectedIds.add(n.id));
            }

            this.renderList();
            this.updateUI();
        });

        // Confirm Return button
        document.getElementById('btn-confirm-return')?.addEventListener('click', () => this.confirmReturns());

        // Grid Search
        document.getElementById('search-ujier-grid-devol')?.addEventListener('input', (e) => {
            this.state.gridSearchTerm = e.target.value.toLowerCase();
            this.renderUjieresGrid();
        });

        // Year Filter
        document.getElementById('filter-devoluciones-year')?.addEventListener('change', (e) => {
            this.state.filterYear = e.target.value;
            this.refreshData();
        });

        // Refresh Button
        document.getElementById('btn-refresh-devoluciones-top')?.addEventListener('click', () => this.refreshData());
    },

    renderUjieresGrid() {
        const grid = document.getElementById('devoluciones-zones-grid');
        const listContainer = document.getElementById('devoluciones-list-container');
        if (!grid) return;

        grid.classList.remove('hidden');
        if (listContainer) listContainer.classList.add('hidden');

        // Aggregate by Ujier
        const ujierStats = {};
        this.state.notificacionesPendientes.forEach(n => {
            const uid = n.asignado_a || 'unassigned';
            const uname = n.ujier_nombre || 'Sin Ujier';
            if (!ujierStats[uid]) {
                ujierStats[uid] = { name: uname, count: 0, notifications: [] };
            }
            ujierStats[uid].count++;
            ujierStats[uid].notifications.push(n);
        });

        // Sort Alphabetically
        const filtered = Object.entries(ujierStats)
            .filter(([id, stats]) => !this.state.gridSearchTerm || stats.name.toLowerCase().includes(this.state.gridSearchTerm))
            .sort((a, b) => a[1].name.localeCompare(b[1].name));

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">No se encontraron resultados</div>';
            return;
        }

        grid.innerHTML = filtered.map(([id, stats]) => `
            <div class="zone-premium-card clickable-card" onclick="devoluciones.openUjier('${id}', '${stats.name}')">
                <div class="zone-card-header">
                    <div class="zone-icon">👤</div>
                    <div class="zone-badge">${stats.count}</div>
                </div>
                <div class="zone-card-body">
                    <h3 class="zone-name">${stats.name}</h3>
                    <p class="zone-desc">Pendientes de devolución</p>
                </div>
                <div class="zone-card-footer">
                    <span>Ver lista para retorno →</span>
                </div>
            </div>
        `).join('');
    },

    openUjier(id, name) {
        this.state.currentUjierId = id;
        this.state.selectedIds.clear();

        // Find notifications for this specific ujier
        this.state.filteredNotificaciones = this.state.notificacionesPendientes.filter(n =>
            (n.asignado_a || 'unassigned') === id
        );

        document.getElementById('current-zone-title').textContent = `Ujier: ${name}`;
        document.getElementById('devoluciones-zones-grid').classList.add('hidden');
        document.getElementById('devoluciones-list-container').classList.remove('hidden');

        this.renderList();
        this.updateUI();
    },

    renderList() {
        const tbody = document.getElementById('devoluciones-table-body');
        if (!tbody) return;

        const list = this.state.filteredNotificaciones;

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay notificaciones en esta zona</td></tr>';
            return;
        }

        tbody.innerHTML = list.map(n => {
            const actualStatus = n.resultado_ultima_visita || n.resultado_diligencia || n.estado || 'pendiente';
            const displayEstado = actualStatus.replace(/_/g, ' ').toUpperCase();
            return `
                <tr class="${this.state.selectedIds.has(n.id) ? 'row-selected' : ''}" onclick="devoluciones.toggleSelection('${n.id}')">
                    <td>
                        <label class="checkbox-wrapper" onclick="event.stopPropagation()">
                            <input type="checkbox" ${this.state.selectedIds.has(n.id) ? 'checked' : ''} 
                                onchange="devoluciones.toggleSelection('${n.id}')"
                                class="select-checkbox">
                            <span class="checkbox-custom"></span>
                        </label>
                    </td>
                    <td data-label="Expediente"><strong class="cell-primary">${n.n_expediente || 'S/N'}</strong></td>
                    <td data-label="Carátula" title="${n.caratula || ''}" class="cell-truncate">${utils.truncate(n.caratula || '-', 35)}</td>
                    <td data-label="Destinatario" class="cell-recipient">${n.destinatario_nombre || utils.getSpecialDestinationText(n) || '-'}</td>
                    <td data-label="N° Troquel" style="font-family: monospace; font-weight: 600; color: var(--primary-400);">${n.n_troquel || '-'}</td>
                    <td data-label="Domicilio" title="${n.domicilio}" class="cell-truncate">${utils.truncate(n.domicilio, 40)}</td>
                    <td data-label="Ujier">
                        <div class="cell-ujier-brief">
                            <span>👤 ${n.ujier_nombre ? n.ujier_nombre.split(' ')[0] : '-'}</span>
                        </div>
                    </td>
                    <td data-label="Entrega">${utils.formatDate(n.fecha_entrega_ujier) || '-'}</td>
                    <td data-label="Estado">
                        <span class="badge-mini status-${this.getStatusClass(actualStatus)}">${displayEstado}</span>
                    </td>
                </tr>
            `;
        }).join('');
    },

    getStatusClass(estado) {
        if (!estado) return 'warning';
        const norm = estado.toLowerCase().replace(/_/g, ' ');

        if (norm.includes('entregado') || norm.includes('atiende')) return 'success';
        if (norm.includes('no atiende') || norm.includes('ausente') || norm.includes('inexistente')) return 'error';
        if (norm.includes('pre aviso') || norm.includes('visto')) return 'info';
        if (norm.includes('pendiente') || norm.includes('proceso')) return 'warning';

        return 'secondary';
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

    updateUI() {
        const count = this.state.selectedIds.size;
        const btn = document.getElementById('btn-confirm-return');
        const msg = document.getElementById('selected-count-msg');

        if (btn) {
            btn.disabled = count === 0;
            btn.innerHTML = `<span>🗸</span> Confirmar Devolución (${count})`;
        }

        if (msg) {
            msg.textContent = `${count} seleccionada${count === 1 ? '' : 's'}`;
        }
    },

    showLoading() {
        const grid = document.getElementById('devoluciones-zones-grid');
        if (grid) {
            grid.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; grid-column: 1/-1;">
                    <div class="loading-spinner"></div>
                    <p style="margin-top: 15px; color: var(--text-muted); font-size: 0.9rem;">Cargando zonas...</p>
                </div>
            `;
        }
    },

    async confirmReturns() {
        const count = this.state.selectedIds.size;
        if (count === 0) return;

        if (!confirm(`¿Confirmás que las ${count} notificaciones seleccionadas han sido devueltas físicamente por los ujieres?`)) {
            return;
        }

        const user = auth.currentUser;
        const userId = user ? user.id : 'sistema';

        this.state.loading = true;
        utils.showLoading(`Procesando ${count} devoluciones...`);

        let successCount = 0;
        let errorCount = 0;

        const promises = Array.from(this.state.selectedIds).map(id =>
            db.returnNotification(id, userId)
        );

        const results = await Promise.all(promises);

        results.forEach(res => {
            if (res.error) errorCount++;
            else successCount++;
        });

        utils.hideLoading();

        if (successCount > 0) {
            utils.showToast(`✅ ${successCount} notificaciones marcadas como devueltas`, 'success');
        }
        if (errorCount > 0) {
            utils.showToast(`❌ Error en ${errorCount} notificaciones`, 'error');
        }

        await this.refreshData();

        // Return to zones view if the current zone is now empty
        if (this.state.currentZone && (!this.state.zones[this.state.currentZone] || this.state.zones[this.state.currentZone].count === 0)) {
            document.getElementById('btn-back-to-zones').click();
        } else if (this.state.currentZone) {
            this.openZone(this.state.currentZone);
        }
    }
};

/**
 * SGND - Asignaciones Module v37.2
 * Completely rewritten for maximum reliability and clean state management.
 */

const asignaciones = {
    // State
    state: {
        currentTab: 'nuevas', // 'nuevas' | 'reasignaciones'
        ujieres: [],
        notificacionesPendientes: [],
        notificacionesAsignadas: [],
        filteredPendientes: [],
        filteredAsignadas: [],
        selectedIds: new Set(),
        selectedUjierDestinoId: null,
        ujierOrigenId: null,
        loading: false
    },

    // Initialize the module
    async init() {
        console.log('[Asignaciones] Initializing v37.2...');
        this.resetState();
        this.setupStaticEventListeners();
        await this.refreshData();
        console.log('[Asignaciones] Ready.');
    },

    resetState() {
        this.state.selectedIds.clear();
        this.state.selectedUjierDestinoId = null;
        this.state.ujierOrigenId = null;
        this.state.currentTab = 'nuevas';
    },

    // Refresh all data from database
    async refreshData() {
        this.state.loading = true;
        this.showLoading();

        try {
            const [notifResult, ujieresResult] = await Promise.all([
                db.getNotifications({ limit: 1000 }), // Increased limit for assignments
                db.getUjieres()
            ]);

            if (notifResult.error) throw notifResult.error;
            if (ujieresResult.error) throw ujieresResult.error;

            const allNotifs = notifResult.data || [];
            this.state.ujieres = ujieresResult.data || [];

            // Categorize notifications
            this.state.notificacionesPendientes = allNotifs.filter(n =>
                n.estado === 'pendiente' && !n.asignado_a
            );

            this.state.notificacionesAsignadas = allNotifs.filter(n =>
                n.asignado_a && (n.estado === 'pendiente' || n.estado === 'en_proceso')
            );

            // Initial filter (all)
            this.state.filteredPendientes = [...this.state.notificacionesPendientes];
            this.applyReassignFilter();

            this.renderAll();
            this.updateFilters();
        } catch (err) {
            console.error('[Asignaciones] Error loading data:', err);
            utils.showToast('Error al cargar datos de asignaciones', 'error');
        } finally {
            this.state.loading = false;
        }
    },

    // Static listeners (Tabs, Search, Global Filters, Action Buttons)
    setupStaticEventListeners() {
        // Tab Switching
        document.getElementById('tab-asign-nuevas')?.addEventListener('click', () => this.switchTab('nuevas'));
        document.getElementById('tab-reasignaciones')?.addEventListener('click', () => this.switchTab('reasignaciones'));

        // Search - Nuevas
        document.getElementById('search-asignaciones')?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            this.state.filteredPendientes = this.state.notificacionesPendientes.filter(n =>
                (n.n_expediente || '').toLowerCase().includes(query) ||
                (n.destinatario_nombre || '').toLowerCase().includes(query) ||
                (n.zona || '').toLowerCase().includes(query)
            );
            this.renderNotifList();
        });

        // Search - Reasignaciones
        document.getElementById('search-reasignaciones')?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            this.applyReassignFilter(query);
            this.renderNotifList();
        });

        // Filter: Zone (Nuevas)
        document.getElementById('filter-zona-asign')?.addEventListener('change', (e) => {
            const zona = e.target.value;
            this.state.filteredPendientes = zona
                ? this.state.notificacionesPendientes.filter(n => n.zona === zona)
                : [...this.state.notificacionesPendientes];
            this.renderNotifList();
        });

        // Filter: Ujier Origen (Reasignaciones)
        document.getElementById('filter-ujier-origen')?.addEventListener('change', (e) => {
            this.state.ujierOrigenId = e.target.value || null;
            this.state.selectedIds.clear(); // Important: clear selection on filter change
            this.applyReassignFilter();
            this.renderNotifList();
            this.updateUI();
        });

        // Bulk Selection Actions
        document.getElementById('btn-select-all-nuevas')?.addEventListener('click', () => this.selectAll('nuevas'));
        document.getElementById('btn-select-none-nuevas')?.addEventListener('click', () => this.selectNone());
        document.getElementById('btn-select-all-reasign')?.addEventListener('click', () => this.selectAll('reasignaciones'));
        document.getElementById('btn-select-none-reasign')?.addEventListener('click', () => this.selectNone());

        // Main Execution Buttons
        document.getElementById('btn-asignar-seleccion')?.addEventListener('click', () => this.executeAssignment());
        document.getElementById('btn-reasignar-seleccion')?.addEventListener('click', () => this.executeAssignment());
    },

    switchTab(tab) {
        this.state.currentTab = tab;
        this.state.selectedIds.clear();
        this.state.selectedUjierDestinoId = null;

        // UI Classes
        document.getElementById('tab-asign-nuevas')?.classList.toggle('active', tab === 'nuevas');
        document.getElementById('tab-reasignaciones')?.classList.toggle('active', tab === 'reasignaciones');

        document.getElementById('section-nuevas')?.classList.toggle('hidden', tab !== 'nuevas');
        document.getElementById('section-reasignaciones')?.classList.toggle('hidden', tab !== 'reasignaciones');

        this.renderAll();
    },

    applyReassignFilter(searchQuery = '') {
        const query = searchQuery || document.getElementById('search-reasignaciones')?.value.toLowerCase() || '';
        let result = [...this.state.notificacionesAsignadas];

        if (this.state.ujierOrigenId) {
            const ujier = this.state.ujieres.find(u => u.id === this.state.ujierOrigenId);
            result = result.filter(n =>
                n.asignado_a === this.state.ujierOrigenId ||
                (ujier && ujier.dni && n.asignado_a == ujier.dni)
            );
        }

        if (query) {
            result = result.filter(n =>
                (n.n_expediente || '').toLowerCase().includes(query) ||
                (n.destinatario_nombre || '').toLowerCase().includes(query) ||
                (n.ujier_nombre || '').toLowerCase().includes(query) ||
                (n.zona || '').toLowerCase().includes(query)
            );
        }

        this.state.filteredAsignadas = result;
    },

    // Core Rendering
    renderAll() {
        this.renderNotifList();
        this.renderUjierList();
        this.updateUI();
    },

    renderNotifList() {
        const isNuevas = this.state.currentTab === 'nuevas';
        const containerId = isNuevas ? 'lista-pendientes' : 'lista-asignadas';
        const countId = isNuevas ? 'count-pendientes' : 'count-asignadas';
        const list = isNuevas ? this.state.filteredPendientes : this.state.filteredAsignadas;

        const container = document.getElementById(containerId);
        if (!container) return;

        // Update count badge
        const countBadge = document.getElementById(countId);
        if (countBadge) countBadge.textContent = list.length;

        if (list.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">${isNuevas ? '📭' : '📋'}</span>
                    <p>${isNuevas ? 'No hay notificaciones pendientes' : 'No se encontraron notificaciones asignadas'}</p>
                </div>`;
            return;
        }

        container.innerHTML = list.map(n => `
            <div class="asignacion-item ${this.state.selectedIds.has(n.id) ? 'selected' : ''}" data-id="${n.id}">
                <label class="checkbox-wrapper">
                    <input type="checkbox" class="notif-checkbox-dynamic" data-id="${n.id}" 
                        ${this.state.selectedIds.has(n.id) ? 'checked' : ''}>
                    <span class="checkbox-custom"></span>
                </label>
                <div class="asignacion-info">
                    <span class="asignacion-expediente"><strong>Exp:</strong> ${n.n_expediente || 'S/N'}</span>
                    <span class="asignacion-tipo"><strong>Tipo:</strong> ${CONFIG.NOTIFICATION_TYPES[n.tipo_notificacion] || n.tipo_notificacion}</span>
                    <span class="asignacion-destinatario"><strong>Dest:</strong> ${n.destinatario_nombre || '-'}</span>
                    ${!isNuevas ? `<span class="asignacion-ujier-actual"><strong>👤 Ujier:</strong> ${n.ujier_nombre || 'Desconocido'}</span>` : ''}
                    <span class="asignacion-zona badge-zona"><strong>📍 Zona:</strong> ${n.zona || '-'}</span>
                </div>
            </div>
        `).join('');

        // Attach listeners to dynamic items
        container.querySelectorAll('.asignacion-item').forEach(item => {
            // Click on the whole item toggles checkbox
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return; // let the checkbox handler do its thing
                const checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
                this.toggleSelection(checkbox.dataset.id, checkbox.checked);
            });
        });

        container.querySelectorAll('.notif-checkbox-dynamic').forEach(cb => {
            cb.addEventListener('change', (e) => {
                this.toggleSelection(e.target.dataset.id, e.target.checked);
            });
        });
    },

    renderUjierList() {
        const containerId = this.state.currentTab === 'nuevas' ? 'lista-ujieres-asign' : 'lista-ujieres-reasign';
        const container = document.getElementById(containerId);
        if (!container) return;

        if (this.state.ujieres.length === 0) {
            container.innerHTML = '<p class="text-center p-4">No hay ujieres disponibles</p>';
            return;
        }

        container.innerHTML = this.state.ujieres.map(u => `
            <div class="ujier-card ${this.state.selectedUjierDestinoId === u.id ? 'selected' : ''}" data-id="${u.id}">
                <div class="ujier-avatar">👤</div>
                <div class="ujier-info">
                    <span class="ujier-nombre">${u.nombre || u.email}</span>
                    <span class="ujier-email">${u.email}</span>
                </div>
                <div class="ujier-stats">
                    <span class="ujier-count">${u.pending_count || 0} pendientes</span>
                </div>
            </div>
        `).join('');

        // Attach listeners
        container.querySelectorAll('.ujier-card').forEach(card => {
            card.addEventListener('click', () => {
                this.state.selectedUjierDestinoId = card.dataset.id;
                this.renderUjierList(); // Re-render to show selection
                this.updateUI();
            });
        });
    },

    toggleSelection(id, isSelected) {
        if (isSelected) {
            this.state.selectedIds.add(id);
        } else {
            this.state.selectedIds.delete(id);
        }

        // Update visual state of items without full re-render for performance
        document.querySelectorAll(`.asignacion-item[data-id="${id}"]`).forEach(item => {
            item.classList.toggle('selected', isSelected);
            const cb = item.querySelector('input');
            if (cb) cb.checked = isSelected;
        });

        this.updateUI();
    },

    selectAll(context) {
        const list = context === 'nuevas' ? this.state.filteredPendientes : this.state.filteredAsignadas;
        list.forEach(n => this.state.selectedIds.add(n.id));
        this.renderNotifList();
        this.updateUI();
        utils.showToast(`Seleccionadas ${list.length} notificaciones`, 'success');
    },

    selectNone() {
        this.state.selectedIds.clear();
        this.renderNotifList();
        this.updateUI();
    },

    updateUI() {
        // Selection counters
        const count = this.state.selectedIds.size;
        const text = count > 0 ? `${count} seleccionada${count > 1 ? 's' : ''}` : '';

        const counterNuevas = document.getElementById('selection-counter-nuevas');
        const counterReasign = document.getElementById('selection-counter-reasign');
        if (counterNuevas) counterNuevas.textContent = text;
        if (counterReasign) counterReasign.textContent = text;

        // Action buttons
        const btnAsignar = document.getElementById('btn-asignar-seleccion');
        const btnReasignar = document.getElementById('btn-reasignar-seleccion');

        const isNuevas = this.state.currentTab === 'nuevas';
        const targetBtn = isNuevas ? btnAsignar : btnReasignar;
        const otherBtn = isNuevas ? btnReasignar : btnAsignar;

        if (targetBtn) {
            const canExecute = count > 0 && this.state.selectedUjierDestinoId;
            targetBtn.disabled = !canExecute;

            if (canExecute) {
                const ujier = this.state.ujieres.find(u => u.id === this.state.selectedUjierDestinoId);
                const prefix = isNuevas ? '✅ Asignar' : '🔄 Reasignar';
                targetBtn.textContent = `${prefix} ${count} a ${ujier?.nombre || 'ujier'}`;
            } else if (count > 0) {
                targetBtn.textContent = `⚠️ Seleccioná un ujier destino`;
            } else {
                targetBtn.textContent = isNuevas ? '✅ Asignar Seleccionados' : '🔄 Reasignar Seleccionados';
            }
        }
    },

    showLoading() {
        const containers = ['lista-pendientes', 'lista-asignadas', 'lista-ujieres-asign', 'lista-ujieres-reasign'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<div class="loading-spinner">⏳ Procesando datos...</div>';
        });
    },

    updateFilters() {
        // Populate Destino Dropdowns (though they are now card grids)
        // Populate Origen Dropdown
        const filterOrigen = document.getElementById('filter-ujier-origen');
        if (filterOrigen) {
            filterOrigen.innerHTML = '<option value="">📍 Ujier Origen: Todos</option>' +
                this.state.ujieres.map(u => `<option value="${u.id}" ${this.state.ujierOrigenId === u.id ? 'selected' : ''}>📍 ${u.nombre || u.email}</option>`).join('');
        }

        // Zone filter dropdown
        const filterZona = document.getElementById('filter-zona-asign');
        if (filterZona) {
            const zones = [...new Set(this.state.notificacionesPendientes.map(n => n.zona).filter(Boolean))].sort();
            filterZona.innerHTML = '<option value="">Todas las zonas</option>' +
                zones.map(z => `<option value="${z}">${z}</option>`).join('');
        }
    },

    async executeAssignment() {
        const count = this.state.selectedIds.size;
        const ujierId = this.state.selectedUjierDestinoId;

        if (count === 0 || !ujierId) return;

        const ujier = this.state.ujieres.find(u => u.id === ujierId);
        const actionText = this.state.currentTab === 'nuevas' ? 'asignar' : 'reasignar';

        if (!confirm(`¿Confirmás ${actionText} ${count} notificaciones a ${ujier?.nombre || ujier?.email}?`)) {
            return;
        }

        this.state.loading = true;
        const btn = this.state.currentTab === 'nuevas' ?
            document.getElementById('btn-asignar-seleccion') :
            document.getElementById('btn-reasignar-seleccion');

        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Procesando...';
        }

        let successCount = 0;
        let errorCount = 0;

        // Perform updates
        const updatePromises = Array.from(this.state.selectedIds).map(notifId =>
            db.updateNotification(notifId, {
                asignado_a: ujierId,
                fecha_asignacion: new Date().toISOString()
            })
        );

        const results = await Promise.all(updatePromises);

        results.forEach(res => {
            if (res.error) errorCount++;
            else successCount++;
        });

        if (successCount > 0) {
            utils.showToast(`✅ ${successCount} notificaciones procesadas con éxito`, 'success');
        }
        if (errorCount > 0) {
            utils.showToast(`❌ Error en ${errorCount} notificaciones`, 'error');
        }

        // Cleanup and Refresh
        await this.refreshData();
        this.state.selectedIds.clear();
        this.state.selectedUjierDestinoId = null;
        this.updateUI();
    }
};

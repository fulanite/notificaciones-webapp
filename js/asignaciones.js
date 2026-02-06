/**
 * SGND - Asignaciones Module
 * Manages assignment of notifications to bailiffs
 */

const asignaciones = {
    selectedNotifications: new Set(),
    selectedUjier: null,
    notifications: [],
    assignedNotifications: [],
    ujieres: [],
    currentTab: 'nuevas', // 'nuevas' or 'reasignaciones'
    sourceUjier: null, // For reassignments

    // Initialize the module
    async init() {
        await this.loadPendingNotifications();
        await this.loadUjieres();
        this.setupEventListeners();
        this.setupTabs();
    },

    // Setup tabs
    setupTabs() {
        const tabNuevas = document.getElementById('tab-asign-nuevas');
        const tabReasign = document.getElementById('tab-reasignaciones');

        if (tabNuevas) {
            tabNuevas.addEventListener('click', () => {
                this.switchTab('nuevas');
            });
        }

        if (tabReasign) {
            tabReasign.addEventListener('click', () => {
                this.switchTab('reasignaciones');
            });
        }
    },

    // Switch between tabs
    switchTab(tab) {
        this.currentTab = tab;
        this.selectedNotifications.clear();
        this.selectedUjier = null;
        this.sourceUjier = null;

        // Update tab buttons
        document.getElementById('tab-asign-nuevas')?.classList.toggle('active', tab === 'nuevas');
        document.getElementById('tab-reasignaciones')?.classList.toggle('active', tab === 'reasignaciones');

        // Show/hide sections
        document.getElementById('section-nuevas')?.classList.toggle('hidden', tab !== 'nuevas');
        document.getElementById('section-reasignaciones')?.classList.toggle('hidden', tab !== 'reasignaciones');

        if (tab === 'reasignaciones') {
            this.loadAssignedNotifications();
        }
    },

    // Setup event listeners
    setupEventListeners() {
        // Search
        document.getElementById('search-asignaciones')?.addEventListener('input', (e) => {
            this.filterNotifications(e.target.value);
        });

        // Assign button
        document.getElementById('btn-asignar-seleccion')?.addEventListener('click', () => {
            this.assignSelected();
        });

        // Reassign button
        document.getElementById('btn-reasignar-seleccion')?.addEventListener('click', () => {
            this.reassignSelected();
        });

        // Filter by zone
        document.getElementById('filter-zona-asign')?.addEventListener('change', (e) => {
            this.filterByZone(e.target.value);
        });

        // Filter by source ujier (for reassignments)
        document.getElementById('filter-ujier-origen')?.addEventListener('change', (e) => {
            this.sourceUjier = e.target.value;
            this.loadAssignedNotifications();
        });

        // Search reassignments
        document.getElementById('search-reasignaciones')?.addEventListener('input', (e) => {
            this.filterAssignedNotifications(e.target.value);
        });
    },

    // Load pending notifications (not assigned)
    async loadPendingNotifications() {
        const container = document.getElementById('lista-pendientes');
        if (!container) return;

        container.innerHTML = '<div class="loading-spinner">Cargando...</div>';

        const { data, error } = await db.getNotifications();

        if (error) {
            container.innerHTML = '<div class="error-message">Error al cargar notificaciones</div>';
            return;
        }

        // Filter only pending (not assigned or without ujier)
        this.notifications = (data || []).filter(n =>
            n.estado === 'pendiente' && !n.asignado_a
        );

        document.getElementById('count-pendientes').textContent = this.notifications.length;

        this.renderNotifications(this.notifications);
    },

    // Load assigned notifications for reassignment
    async loadAssignedNotifications() {
        const container = document.getElementById('lista-asignadas');
        if (!container) return;

        container.innerHTML = '<div class="loading-spinner">Cargando...</div>';

        const { data, error } = await db.getNotifications();

        if (error) {
            container.innerHTML = '<div class="error-message">Error al cargar notificaciones</div>';
            return;
        }

        // Filter assigned notifications (with ujier, pending or in progress)
        let assigned = (data || []).filter(n =>
            n.asignado_a && (n.estado === 'pendiente' || n.estado === 'en_proceso')
        );

        // Filter by source ujier if selected
        if (this.sourceUjier) {
            assigned = assigned.filter(n => n.asignado_a === this.sourceUjier);
        }

        this.assignedNotifications = assigned;

        document.getElementById('count-asignadas').textContent = assigned.length;

        this.renderAssignedNotifications(assigned);
    },

    // Render notifications list
    renderNotifications(notifications) {
        const container = document.getElementById('lista-pendientes');
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📭</span>
                    <p>No hay notificaciones pendientes de asignar</p>
                </div>
            `;
            return;
        }

        container.innerHTML = notifications.map(n => `
            <div class="asignacion-item ${this.selectedNotifications.has(n.id) ? 'selected' : ''}" 
                 data-id="${n.id}">
                <label class="checkbox-wrapper">
                    <input type="checkbox" class="notif-checkbox" data-id="${n.id}"
                        ${this.selectedNotifications.has(n.id) ? 'checked' : ''}>
                    <span class="checkbox-custom"></span>
                </label>
                <div class="asignacion-info">
                    <span class="asignacion-expediente">${n.n_expediente || 'S/N'}</span>
                    <span class="asignacion-tipo">${CONFIG.NOTIFICATION_TYPES[n.tipo_notificacion] || n.tipo_notificacion}</span>
                    <span class="asignacion-destinatario">${n.destinatario_nombre || '-'}</span>
                    <span class="asignacion-zona badge-zona">${n.zona || '-'}</span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.notif-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    this.selectedNotifications.add(id);
                } else {
                    this.selectedNotifications.delete(id);
                }
                this.updateAssignButton();
                e.target.closest('.asignacion-item').classList.toggle('selected', e.target.checked);
            });
        });
    },

    // Render assigned notifications for reassignment
    renderAssignedNotifications(notifications) {
        const container = document.getElementById('lista-asignadas');
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📋</span>
                    <p>No hay notificaciones asignadas${this.sourceUjier ? ' para este ujier' : ''}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = notifications.map(n => `
            <div class="asignacion-item ${this.selectedNotifications.has(n.id) ? 'selected' : ''}" 
                 data-id="${n.id}">
                <label class="checkbox-wrapper">
                    <input type="checkbox" class="notif-checkbox-reassign" data-id="${n.id}"
                        ${this.selectedNotifications.has(n.id) ? 'checked' : ''}>
                    <span class="checkbox-custom"></span>
                </label>
                <div class="asignacion-info">
                    <span class="asignacion-expediente">${n.n_expediente || 'S/N'}</span>
                    <span class="asignacion-tipo">${CONFIG.NOTIFICATION_TYPES[n.tipo_notificacion] || n.tipo_notificacion}</span>
                    <span class="asignacion-destinatario">${n.destinatario_nombre || '-'}</span>
                    <span class="asignacion-ujier-actual">👤 ${n.ujier_nombre || 'Sin nombre'}</span>
                    <span class="asignacion-zona badge-zona">${n.zona || '-'}</span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.notif-checkbox-reassign').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    this.selectedNotifications.add(id);
                } else {
                    this.selectedNotifications.delete(id);
                }
                this.updateReassignButton();
                e.target.closest('.asignacion-item').classList.toggle('selected', e.target.checked);
            });
        });
    },

    // Load ujieres
    async loadUjieres() {
        const container = document.getElementById('lista-ujieres-asign');
        const containerReassign = document.getElementById('lista-ujieres-reasign');

        const { data, error } = await db.getUjieres();

        if (error || !data) {
            if (container) container.innerHTML = '<div class="error-message">Error al cargar ujieres</div>';
            if (containerReassign) containerReassign.innerHTML = '<div class="error-message">Error al cargar ujieres</div>';
            return;
        }

        this.ujieres = data;

        // Render for new assignments
        if (container) {
            container.innerHTML = data.map(u => `
                <div class="ujier-card ${this.selectedUjier === u.id ? 'selected' : ''}" data-id="${u.id}">
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

            // Add click handlers
            container.querySelectorAll('.ujier-card').forEach(card => {
                card.addEventListener('click', () => {
                    container.querySelectorAll('.ujier-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    this.selectedUjier = card.dataset.id;
                    this.updateAssignButton();
                });
            });
        }

        // Render for reassignments
        if (containerReassign) {
            containerReassign.innerHTML = data.map(u => `
                <div class="ujier-card ${this.selectedUjier === u.id ? 'selected' : ''}" data-id="${u.id}">
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

            // Add click handlers
            containerReassign.querySelectorAll('.ujier-card').forEach(card => {
                card.addEventListener('click', () => {
                    containerReassign.querySelectorAll('.ujier-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    this.selectedUjier = card.dataset.id;
                    this.updateReassignButton();
                });
            });
        }

        // Populate filter dropdowns
        const filterSelect = document.getElementById('filter-ujier-asign');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Todos los ujieres</option>' +
                data.map(u => `<option value="${u.id}">${u.nombre || u.email}</option>`).join('');
        }

        const filterOrigen = document.getElementById('filter-ujier-origen');
        if (filterOrigen) {
            filterOrigen.innerHTML = '<option value="">Todos los ujieres</option>' +
                data.map(u => `<option value="${u.id}">${u.nombre || u.email}</option>`).join('');
        }
    },

    // Update assign button state
    updateAssignButton() {
        const btn = document.getElementById('btn-asignar-seleccion');
        if (btn) {
            const canAssign = this.selectedNotifications.size > 0 && this.selectedUjier;
            btn.disabled = !canAssign;
            btn.textContent = canAssign
                ? `✅ Asignar ${this.selectedNotifications.size} notificación(es)`
                : '✅ Asignar Seleccionados';
        }
    },

    // Update reassign button state
    updateReassignButton() {
        const btn = document.getElementById('btn-reasignar-seleccion');
        if (btn) {
            const canReassign = this.selectedNotifications.size > 0 && this.selectedUjier;
            btn.disabled = !canReassign;
            btn.textContent = canReassign
                ? `🔄 Reasignar ${this.selectedNotifications.size} notificación(es)`
                : '🔄 Reasignar Seleccionados';
        }
    },

    // Assign selected notifications to selected ujier
    async assignSelected() {
        if (this.selectedNotifications.size === 0 || !this.selectedUjier) {
            utils.showToast('Seleccioná notificaciones y un ujier', 'warning');
            return;
        }

        const btn = document.getElementById('btn-asignar-seleccion');
        btn.disabled = true;
        btn.textContent = 'Asignando...';

        let successCount = 0;
        let errorCount = 0;

        for (const notifId of this.selectedNotifications) {
            const { error } = await db.updateNotification(notifId, {
                asignado_a: this.selectedUjier,
                fecha_asignacion: new Date().toISOString()
            });

            if (error) {
                errorCount++;
            } else {
                successCount++;
            }
        }

        if (successCount > 0) {
            utils.showToast(`${successCount} notificación(es) asignadas correctamente`, 'success');
        }
        if (errorCount > 0) {
            utils.showToast(`${errorCount} notificación(es) no se pudieron asignar`, 'error');
        }

        // Reset and reload
        this.selectedNotifications.clear();
        this.selectedUjier = null;
        await this.loadPendingNotifications();
        await this.loadUjieres();
    },

    // Reassign selected notifications to another ujier
    async reassignSelected() {
        if (this.selectedNotifications.size === 0 || !this.selectedUjier) {
            utils.showToast('Seleccioná notificaciones y un ujier destino', 'warning');
            return;
        }

        const ujierDestino = this.ujieres.find(u => u.id === this.selectedUjier);
        const confirmMsg = `¿Reasignar ${this.selectedNotifications.size} notificación(es) a ${ujierDestino?.nombre || ujierDestino?.email}?`;

        if (!confirm(confirmMsg)) return;

        const btn = document.getElementById('btn-reasignar-seleccion');
        btn.disabled = true;
        btn.textContent = 'Reasignando...';

        let successCount = 0;
        let errorCount = 0;

        for (const notifId of this.selectedNotifications) {
            const { error } = await db.updateNotification(notifId, {
                asignado_a: this.selectedUjier,
                fecha_asignacion: new Date().toISOString()
            });

            if (error) {
                errorCount++;
            } else {
                successCount++;
            }
        }

        if (successCount > 0) {
            utils.showToast(`${successCount} notificación(es) reasignadas correctamente`, 'success');
        }
        if (errorCount > 0) {
            utils.showToast(`${errorCount} notificación(es) no se pudieron reasignar`, 'error');
        }

        // Reset and reload
        this.selectedNotifications.clear();
        this.selectedUjier = null;
        await this.loadAssignedNotifications();
        await this.loadUjieres();
    },

    // Filter notifications by search
    filterNotifications(query) {
        const filtered = this.notifications.filter(n =>
            (n.n_expediente || '').toLowerCase().includes(query.toLowerCase()) ||
            (n.destinatario_nombre || '').toLowerCase().includes(query.toLowerCase()) ||
            (n.zona || '').toLowerCase().includes(query.toLowerCase())
        );
        this.renderNotifications(filtered);
    },

    // Filter assigned notifications by search
    filterAssignedNotifications(query) {
        const filtered = this.assignedNotifications.filter(n =>
            (n.n_expediente || '').toLowerCase().includes(query.toLowerCase()) ||
            (n.destinatario_nombre || '').toLowerCase().includes(query.toLowerCase()) ||
            (n.zona || '').toLowerCase().includes(query.toLowerCase()) ||
            (n.ujier_nombre || '').toLowerCase().includes(query.toLowerCase())
        );
        this.renderAssignedNotifications(filtered);
    },

    // Filter by zone
    filterByZone(zone) {
        if (!zone) {
            this.renderNotifications(this.notifications);
            return;
        }
        const filtered = this.notifications.filter(n => n.zona === zone);
        this.renderNotifications(filtered);
    }
};

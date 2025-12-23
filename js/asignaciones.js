/**
 * SGND - Asignaciones Module
 * Manages assignment of notifications to bailiffs
 */

const asignaciones = {
    selectedNotifications: new Set(),
    selectedUjier: null,
    notifications: [],
    ujieres: [],

    // Initialize the module
    async init() {
        await this.loadPendingNotifications();
        await this.loadUjieres();
        this.setupEventListeners();
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

        // Filter by zone
        document.getElementById('filter-zona-asign')?.addEventListener('change', (e) => {
            this.filterByZone(e.target.value);
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

    // Load ujieres
    async loadUjieres() {
        const container = document.getElementById('lista-ujieres-asign');
        if (!container) return;

        const { data, error } = await db.getUjieres();

        if (error || !data) {
            container.innerHTML = '<div class="error-message">Error al cargar ujieres</div>';
            return;
        }

        this.ujieres = data;

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
                // Deselect previous
                container.querySelectorAll('.ujier-card').forEach(c => c.classList.remove('selected'));
                // Select this one
                card.classList.add('selected');
                this.selectedUjier = card.dataset.id;
                this.updateAssignButton();
            });
        });

        // Populate filter dropdown
        const filterSelect = document.getElementById('filter-ujier-asign');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Todos los ujieres</option>' +
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

    // Filter notifications by search
    filterNotifications(query) {
        const filtered = this.notifications.filter(n =>
            (n.n_expediente || '').toLowerCase().includes(query.toLowerCase()) ||
            (n.destinatario_nombre || '').toLowerCase().includes(query.toLowerCase()) ||
            (n.zona || '').toLowerCase().includes(query.toLowerCase())
        );
        this.renderNotifications(filtered);
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

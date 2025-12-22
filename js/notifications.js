/**
 * SGND - Notifications Management Module
 */

const notifications = {
    currentPage: 1,
    totalPages: 1,
    filters: {
        estado: '',
        tipo: '',
        fecha: '',
        search: ''
    },

    // Initialize notifications list
    async init() {
        this.setupFilters();
        await this.loadNotifications();
    },

    // Setup filter listeners
    setupFilters() {
        const searchInput = document.getElementById('search-notificaciones');
        const filterEstado = document.getElementById('filter-estado');
        const filterTipo = document.getElementById('filter-tipo');
        const filterFecha = document.getElementById('filter-fecha');

        if (searchInput) {
            searchInput.addEventListener('input', utils.debounce(() => {
                this.filters.search = searchInput.value;
                this.currentPage = 1;
                this.loadNotifications();
            }, 300));
        }

        if (filterEstado) {
            filterEstado.addEventListener('change', () => {
                this.filters.estado = filterEstado.value;
                this.currentPage = 1;
                this.loadNotifications();
            });
        }

        if (filterTipo) {
            filterTipo.addEventListener('change', () => {
                this.filters.tipo = filterTipo.value;
                this.currentPage = 1;
                this.loadNotifications();
            });
        }

        if (filterFecha) {
            filterFecha.addEventListener('change', () => {
                this.filters.fecha = filterFecha.value;
                this.currentPage = 1;
                this.loadNotifications();
            });
        }

        // Pagination
        document.getElementById('btn-prev-page')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadNotifications();
            }
        });

        document.getElementById('btn-next-page')?.addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadNotifications();
            }
        });
    },

    // Load notifications from database
    async loadNotifications() {
        const tbody = document.getElementById('tabla-notificaciones');
        if (!tbody) return;

        // Show loading
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px;">
                    <div class="spinner"></div>
                    <p style="margin-top: 16px; color: var(--text-muted);">Cargando notificaciones...</p>
                </td>
            </tr>
        `;

        const options = {
            page: this.currentPage,
            limit: CONFIG.ITEMS_PER_PAGE,
            ...this.filters
        };

        const { data, error, count } = await db.getNotifications(options);

        if (error) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--error);">
                        Error al cargar notificaciones
                    </td>
                </tr>
            `;
            return;
        }

        this.renderNotifications(data || []);
        this.updatePagination(count || 0);
    },

    // Render notifications table
    renderNotifications(data) {
        const tbody = document.getElementById('tabla-notificaciones');
        if (!tbody) return;

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        No se encontraron notificaciones
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map(notif => `
            <tr class="stagger-item">
                <td>
                    <code style="font-size: 0.75rem; color: var(--primary-500);">
                        ${notif.id.substring(0, 8)}...
                    </code>
                </td>
                <td>${utils.formatDate(notif.fecha_carga)}</td>
                <td>
                    <span class="type-badge">${CONFIG.NOTIFICATION_TYPES[notif.tipo_notificacion] || notif.tipo_notificacion}</span>
                </td>
                <td>${utils.truncate(notif.n_expediente, 20)}</td>
                <td>${utils.truncate(notif.destinatario_nombre, 25)}</td>
                <td>${utils.getStatusBadge(notif.estado)}</td>
                <td>${notif.usuarios?.nombre || '-'}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn" title="Ver detalles" onclick="notifications.viewDetails('${notif.id}')">
                            👁️
                        </button>
                        <button class="action-btn" title="Editar" onclick="notifications.edit('${notif.id}')">
                            ✏️
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // Update pagination
    updatePagination(totalCount) {
        this.totalPages = Math.ceil(totalCount / CONFIG.ITEMS_PER_PAGE) || 1;

        const paginationInfo = document.getElementById('pagination-info');
        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');

        if (paginationInfo) {
            paginationInfo.textContent = `Página ${this.currentPage} de ${this.totalPages}`;
        }

        if (btnPrev) {
            btnPrev.disabled = this.currentPage <= 1;
        }

        if (btnNext) {
            btnNext.disabled = this.currentPage >= this.totalPages;
        }
    },

    // View notification details
    async viewDetails(id) {
        const { data, error } = await db.getNotificationById(id);

        if (error || !data) {
            utils.showToast('Error al cargar detalles', 'error');
            return;
        }

        // Show details modal (simplified version)
        const content = `
            <div class="notification-details">
                <h3>Detalles de Notificación</h3>
                <div class="details-grid">
                    <div class="detail-item">
                        <span class="detail-label">Tipo:</span>
                        <span class="detail-value">${CONFIG.NOTIFICATION_TYPES[data.tipo_notificacion]}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Expediente:</span>
                        <span class="detail-value">${data.n_expediente}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Carátula:</span>
                        <span class="detail-value">${data.caratula}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Destinatario:</span>
                        <span class="detail-value">${data.destinatario_nombre}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Domicilio:</span>
                        <span class="detail-value">${data.domicilio}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Estado:</span>
                        <span class="detail-value">${utils.getStatusBadge(data.estado)}</span>
                    </div>
                    ${data.resultado_diligencia ? `
                        <div class="detail-item">
                            <span class="detail-label">Resultado:</span>
                            <span class="detail-value">${CONFIG.RESULT_OPTIONS[data.resultado_diligencia]}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        utils.showToast('Detalles cargados (ver consola)', 'info');
        console.log('Notification details:', data);
    },

    // Edit notification
    edit(id) {
        utils.showToast('Función de edición en desarrollo', 'info');
    },

    // Create new notification
    async create(notificationData) {
        // Enforce charging user info
        const data = {
            ...notificationData,
            usuario_carga: auth.currentUser?.email
        };

        // Check if online
        if (!utils.isOnline()) {
            offline.addToQueue('create_notification', data);
            utils.showToast('Guardado localmente. Se sincronizará cuando haya conexión.', 'warning');
            return { success: true, offline: true };
        }

        const { data: result, error } = await db.createNotification(data);

        if (error) {
            utils.showToast('Error al crear notificación: ' + error.message, 'error');
            return { success: false, error };
        }

        utils.showToast('Notificación creada exitosamente', 'success');
        return { success: true, data: result };
    },

    // Load ujieres for assignment dropdown
    async loadUjieres() {
        const select = document.getElementById('asignado-a');
        if (!select) return;

        const { data: ujiers } = await db.getUsersByRole('ujier');

        if (ujiers && ujiers.length > 0) {
            const options = ujiers.map(u =>
                `<option value="${u.id}">${u.nombre}</option>`
            ).join('');

            select.innerHTML = `
                <option value="">Sin asignar (pendiente)</option>
                ${options}
            `;
        }
    }
};

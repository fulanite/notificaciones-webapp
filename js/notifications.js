/**
 * SGND - Notifications Management Module
 */

const notifications = {
    currentPage: 1,
    totalPages: 1,
    filters: {
        estado: '',
        tipo: '',
        fecha: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0],
        search: '',
        zona: '',
        year: '2026',
        own_only: true
    },

    // Initialize notifications list
    async init() {
        this.setupFilters();
        await this.loadNotifications();
        this.updateYearBadges();
    },

    // Setup filter listeners
    setupFilters() {
        const searchInput = document.getElementById('search-notificaciones');
        const filterEstado = document.getElementById('filter-estado');
        const filterTipo = document.getElementById('filter-tipo');
        const filterFecha = document.getElementById('filter-fecha');
        const filterZona = document.getElementById('filter-zona');
        const filterPropio = document.getElementById('filter-propio');

        const updateAndLoad = () => {
            this.currentPage = 1;
            this.loadNotifications();
        };

        searchInput?.addEventListener('input', utils.debounce(() => {
            this.filters.search = searchInput.value;
            updateAndLoad();
        }, 300));

        filterEstado?.addEventListener('change', () => {
            this.filters.estado = filterEstado.value;
            updateAndLoad();
        });

        filterTipo?.addEventListener('change', () => {
            this.filters.tipo = filterTipo.value;
            updateAndLoad();
        });

        filterFecha?.addEventListener('change', () => {
            this.filters.fecha = filterFecha.value;
            updateAndLoad();
        });

        filterZona?.addEventListener('change', () => {
            this.filters.zona = filterZona.value;
            updateAndLoad();
        });

        filterPropio?.addEventListener('change', () => {
            this.filters.own_only = filterPropio.value === 'true';
            if (this.filters.own_only) {
                const today = new Date();
                const offset = today.getTimezoneOffset();
                const localToday = new Date(today.getTime() - (offset * 60 * 1000));
                const dateStr = localToday.toISOString().split('T')[0];

                this.filters.fecha = dateStr;
                if (filterFecha) filterFecha.value = dateStr;
                utils.showToast(`Filtrando tus cargas de hoy (${dateStr})`, 'info');
            } else {
                // Clear date when going back to "All notifications"
                this.filters.fecha = '';
                if (filterFecha) filterFecha.value = '';
                utils.showToast('Mostrando todas las notificaciones', 'info');
            }
            updateAndLoad();
        });

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

    // Switch between years
    setYear(year, btn) {
        this.filters.year = year;
        this.currentPage = 1;

        // Update UI
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.loadNotifications();
    },

    // Update counts on year tabs
    async updateYearBadges() {
        const userId = this.filters.own_only ? auth.currentUser?.email : null;
        // This is a simplified call, ideally we'd have a specific endpoint for counts
        // but for now we'll just show the total if needed or keep it static
    },

    // Load notifications from database
    async loadNotifications() {
        const tbody = document.getElementById('tabla-notificaciones');
        const refreshBtn = document.getElementById('btn-refresh-list');
        if (!tbody) return;

        // Show loading
        if (refreshBtn) refreshBtn.classList.add('rotating');
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
            ...this.filters,
            user_id: auth.currentUser?.id,
            user_email: auth.currentUser?.email
        };

        try {
            const { data, error, count } = await db.getNotifications(options);

            if (error) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 40px; color: var(--error);">
                            Error al cargar notificaciones: ${error.message}
                        </td>
                    </tr>
                `;
                return;
            }

            this.renderNotifications(data || []);
            this.updatePagination(count || 0);

            // Update current year badge with total count only if it's the current year
            const badge = document.getElementById(`badge-${this.filters.year}`);
            if (badge) badge.textContent = count || 0;
        } finally {
            if (refreshBtn) {
                setTimeout(() => refreshBtn.classList.remove('rotating'), 500);
            }
        }
    },

    // Render notifications table
    renderNotifications(data) {
        const tbody = document.getElementById('tabla-notificaciones');
        if (!tbody) return;

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        No se encontraron notificaciones
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        let lastDate = '';

        data.forEach(notif => {
            const currentDate = notif.fecha_carga ? notif.fecha_carga.split(' ')[0] : '';

            // Add date separator if grouping is active (own_only) or just as a general improvement
            if (this.filters.own_only && currentDate !== lastDate) {
                html += `
                    <tr class="date-group-row">
                        <td colspan="11">📅 ${utils.formatDate(currentDate)}</td>
                    </tr>
                `;
                lastDate = currentDate;
            }

            html += `
                <tr class="stagger-item">
                    <td style="white-space: nowrap; font-size: 0.75rem;">${utils.formatDate(notif.fecha_carga)}</td>
                    <td title="${notif.origen}">${utils.truncate(notif.origen, 25)}</td>
                    <td title="${notif.letrado || '-'}">${utils.truncate(notif.letrado || '-', 30)}</td>
                    <td><strong style="font-size: 0.85rem;">${utils.truncate(notif.n_expediente, 25)}</strong></td>
                    <td title="${notif.destinatario_nombre}">${utils.truncate(notif.destinatario_nombre, 40)}</td>
                    <td title="${notif.domicilio}">${utils.truncate(notif.domicilio, 50)}</td>
                    <td><span class="badge-zona">${notif.zona || '-'}</span></td>
                    <td style="font-family: monospace; font-size: 0.75rem;">${notif.n_troquel || '-'}</td>
                    <td>${utils.getStatusBadge(notif.resultado_diligencia || notif.estado)}</td>
                    <td style="font-size: 0.75rem;">${notif.ujier_nombre ? notif.ujier_nombre.split(' ')[0] : '-'}</td>
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
            `;
        });

        tbody.innerHTML = html;
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

        // Load visits for this notification
        let visitasHtml = '';
        try {
            const visitasResp = await db.getVisitas(id);
            if (visitasResp.data && visitasResp.data.length > 0) {
                // Tactical Logistics Timeline (Shipping style)
                visitasHtml = visitasResp.data.map((v, index) => `
                    <div class="timeline-item-tactical">
                        <div class="timeline-dot-box">
                            <div class="timeline-dot-tactical completed"></div>
                        </div>
                        <div class="timeline-detail">
                            <div class="timeline-header">
                                <span class="timeline-step">Gestión #${visitasResp.data.length - index}</span>
                                <span class="timeline-time">${utils.formatDateTime(v.fecha)}</span>
                            </div>
                            <div class="timeline-status">
                                ${v.resultado ? `<strong>${v.resultado}</strong>` : '<em>Registrado</em>'}
                            </div>
                            
                            ${v.observaciones ? `<p class="dashboard-notes mt-2" style="padding: 8px; font-size: 0.75rem;">📝 ${v.observaciones}</p>` : ''}
                            
                            ${v.audio_transcripcion ? `<p class="mt-1" style="font-size: 0.75rem; color: #4ade80;">🎤 <em>${v.audio_transcripcion}</em></p>` : ''}
                            
                            <div class="timeline-footer mt-2" style="display:flex; gap:10px;">
                                ${v.ubicacion_lat && v.ubicacion_lng ? `
                                    <a href="https://www.google.com/maps?q=${v.ubicacion_lat},${v.ubicacion_lng}" 
                                       target="_blank" style="font-size: 10px; color: #6366f1; text-decoration:none;">
                                        📍 Ubicación GPS
                                    </a>
                                ` : ''}
                                ${v.foto_url ? `
                                    <a href="${v.foto_url}" target="_blank" style="font-size: 10px; color: #a78bfa; text-decoration:none;">
                                        📸 Foto Evidencia
                                    </a>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.log('No se pudieron cargar visitas:', e);
        }

        // Create modal HTML
        const modalHtml = `
            <div class="modal-overlay" id="modal-detalle" onclick="notifications.closeModal(event)">
                <div class="modal-content modal-panoramic-v2" onclick="event.stopPropagation()">
                    <div class="modal-header-v2">
                        <div class="header-main-left">
                            <div class="header-title-container">
                                <h2>📄 Detalle de Notificación</h2>
                                <div class="header-badges">
                                    <span class="badge-type-pill-v2">${CONFIG.NOTIFICATION_TYPES[data.tipo_notificacion] || data.tipo_notificacion}</span>
                                    <span class="header-id-pill">#${data.id.substring(0, 8)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="header-status-box">
                            ${utils.getStatusBadge(data.resultado_diligencia || data.estado)}
                        </div>
                        <button class="modal-close-v2" onclick="notifications.closeModal()">&times;</button>
                    </div>

                    <div class="modal-body p-0">
                        <!-- New Premium Master Bar -->
                        <div class="master-premium-bar">
                            <div class="premium-card zona-card">
                                <div class="card-icon">📍</div>
                                <div class="card-content">
                                    <span class="card-label">Zona de Trabajo</span>
                                    <span class="card-value">${data.zona || 'N/A'}</span>
                                </div>
                            </div>
                            <div class="premium-card ujier-card">
                                <div class="card-avatar">${data.ujier_nombre ? data.ujier_nombre.charAt(0) : '?'}</div>
                                <div class="card-content">
                                    <span class="card-label">Ujier Asignado</span>
                                    <span class="card-value"><strong>${data.ujier_nombre || 'Sin asignar'}</strong></span>
                                </div>
                            </div>
                            <div class="premium-card dest-card">
                                <div class="card-icon">👤</div>
                                <div class="card-content">
                                    <span class="card-label">Destinatario</span>
                                    <span class="card-value"><strong>${data.destinatario_nombre}</strong></span>
                                </div>
                            </div>
                            <div class="premium-card dom-card grow">
                                <div class="card-icon">🏠</div>
                                <div class="card-content">
                                    <span class="card-label">Domicilio de Notificación</span>
                                    <span class="card-value highlight">${data.domicilio}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Content Grid: 3 Main Sections -->
                        <div class="modal-dashboard-grid">
                            <!-- Col 1: Datos Legales -->
                            <div class="dashboard-col">
                                <div class="section-container">
                                    <h4 class="section-title">⚖️ Información del Expediente</h4>
                                    <table class="dashboard-table">
                                        <tr>
                                            <th>N° Expediente</th>
                                            <td class="val-xl">${data.n_expediente}</td>
                                        </tr>
                                        <tr>
                                            <th>Carátula</th>
                                            <td class="val-caratula">${data.caratula}</td>
                                        </tr>
                                        <tr>
                                            <th>Organismo</th>
                                            <td>${data.origen || '-'}</td>
                                        </tr>
                                        <tr>
                                            <th>Letrado</th>
                                            <td>${data.letrado || '-'}</td>
                                        </tr>
                                    </table>
                                </div>
                            </div>

                            <!-- Col 2: Control y Pago + Otros -->
                            <div class="dashboard-col">
                                <div class="section-container">
                                    <h4 class="section-title">🎫 Control y Gestión</h4>
                                    <table class="dashboard-table">
                                        <tr>
                                            <th>N° Troquel</th>
                                            <td class="val-highlight">${data.sin_troquel ? 'N/A' : (data.n_troquel || '-')}</td>
                                        </tr>
                                        <tr>
                                            <th>Medio de Pago</th>
                                            <td>${data.medio_pago || '-'}</td>
                                        </tr>
                                        <tr>
                                            <th>Costo</th>
                                            <td class="val-money">${utils.formatCurrency(data.costo)}</td>
                                        </tr>
                                        ${data.destinatario_especial ? `
                                            <tr>
                                                <th>Destino Esp.</th>
                                                <td><span class="badge-dest-esp">${data.destinatario_especial}</span></td>
                                            </tr>
                                        ` : ''}
                                    </table>
                                </div>

                                ${data.observaciones_iniciales ? `
                                    <div class="section-container mt-4">
                                        <h4 class="section-title">📝 Notas de Carga</h4>
                                        <div class="dashboard-notes">${data.observaciones_iniciales}</div>
                                    </div>
                                ` : ''}
                            </div>

                            <!-- Col 3: Sidebar con Timeline y Foto -->
                            <div class="dashboard-sidebar">
                                ${data.evidencia_foto ? `
                                    <div class="sidebar-photo-box">
                                        <h4 class="sidebar-title">📸 Evidencia</h4>
                                        <div class="photo-container" onclick="window.open('${data.evidencia_foto}', '_blank')">
                                            <img src="${data.evidencia_foto}">
                                            <div class="photo-hint">Expandir Imagen</div>
                                        </div>
                                    </div>
                                ` : ''}

                                <div class="sidebar-timeline-box">
                                    <h4 class="sidebar-title">📜 Historial de Gestión</h4>
                                    <div class="logistics-timeline">
                                        ${visitasHtml || '<div class="timeline-empty">Sin visitas registradas</div>'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Enhanced Footer -->
                    <div class="modal-footer-v2">
                        <div class="footer-info-strip">
                            <span class="info-tag carga-tag">📅 Carga: ${utils.formatDateTime(data.fecha_carga)}</span>
                            <span class="info-tag user-tag">👤 Por: <strong>${data.usuario_carga || '-'}</strong></span>
                            ${data.migrated_from_glide ? '<span class="badge-migrated-v2">📦 REGISTRO MIGRADO</span>' : ''}
                        </div>
                        <div class="footer-main-actions">
                            <button class="btn btn-glass" onclick="notifications.closeModal()">Cerrar</button>
                            <button class="btn btn-primary btn-action-main" onclick="notifications.edit('${data.id}'); notifications.closeModal();">
                                ✏️ Editar Diligencia
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insert modal into DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add escape key listener
        document.addEventListener('keydown', this.handleModalEscape);
    },

    // Close modal
    closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        const modal = document.getElementById('modal-detalle');
        if (modal) {
            modal.classList.add('fade-out');
            setTimeout(() => modal.remove(), 200);
        }
        document.removeEventListener('keydown', this.handleModalEscape);
    },

    // Handle escape key for modal
    handleModalEscape(e) {
        if (e.key === 'Escape') {
            notifications.closeModal();
        }
    },

    // Edit notification
    async edit(id) {
        const { data, error } = await db.getNotificationById(id);

        if (error || !data) {
            utils.showToast('Error al cargar notificación', 'error');
            return;
        }

        // Store the ID being edited
        this.editingId = id;

        // Navigate to the form
        app.navigateTo('nueva-notificacion');

        // Wait for DOM to be ready
        setTimeout(() => {
            // Populate form fields
            document.getElementById('tipo-notificacion').value = data.tipo_notificacion || '';

            // Trigger tipo change to set up correct origin field
            if (data.tipo_notificacion === 'cedulas_mandamientos_22172' ||
                data.tipo_notificacion === 'cedulas_correspondencia') {
                app.handleTipoNotificacionChange(data.tipo_notificacion);
                // Wait a bit for the searchable select to be set up, then populate
                setTimeout(() => {
                    const input = document.getElementById('origen-dinamico-input');
                    const hidden = document.getElementById('origen-dinamico');
                    if (input && hidden) {
                        input.value = data.origen || '';
                        hidden.value = data.origen || '';
                    }
                }, 150);
            } else {
                document.getElementById('origen').value = data.origen || '';
            }

            document.getElementById('n-expediente').value = data.n_expediente || '';
            document.getElementById('caratula').value = data.caratula || '';
            document.getElementById('letrado').value = data.letrado || '';
            document.getElementById('destinatario-especial').value = data.destinatario_especial || '';
            document.getElementById('destinatario-nombre').value = data.destinatario_nombre || '';
            document.getElementById('domicilio').value = data.domicilio || '';
            document.getElementById('zona').value = data.zona || '';
            document.getElementById('tipo-troquel').value = data.tipo_troquel || '';
            document.getElementById('n-troquel').value = data.n_troquel || '';
            document.getElementById('medio-pago').value = data.medio_pago || '';
            document.getElementById('costo').value = data.costo || '';
            document.getElementById('asignado-a').value = data.asignado_a || '';
            document.getElementById('observaciones-iniciales').value = data.observaciones_iniciales || '';

            // Handle checkboxes
            const sinTroquel = document.getElementById('sin-troquel');
            if (sinTroquel) {
                sinTroquel.checked = data.sin_troquel || false;
                if (data.sin_troquel) {
                    document.getElementById('grupo-n-troquel')?.classList.add('hidden');
                }
            }

            // Update form title to indicate editing
            const pageTitle = document.getElementById('page-title');
            if (pageTitle) pageTitle.textContent = 'Editar Notificación';

            utils.showToast('Editando notificación - Modificá los campos y guardá', 'info');
        }, 100);
    },

    // Update existing notification
    async update(id, notificationData) {
        const { data, error } = await db.updateNotification(id, notificationData, auth.currentUser?.id);

        if (error) {
            utils.showToast('Error al actualizar: ' + error.message, 'error');
            return { success: false, error };
        }

        utils.showToast('Notificación actualizada exitosamente', 'success');
        this.editingId = null;
        return { success: true, data };
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

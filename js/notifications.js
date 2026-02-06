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
                visitasHtml = `
                    <div class="detail-section">
                        <h4>📋 Historial de Visitas (${visitasResp.data.length})</h4>
                        <div class="visitas-list">
                            ${visitasResp.data.map(v => `
                                <div class="visita-item">
                                    <div class="visita-header">
                                        <span class="visita-fecha">${utils.formatDateTime(v.fecha)}${v.ujier_nombre ? ` - <strong>${v.ujier_nombre}</strong>` : ''}</span>
                                        ${utils.getStatusBadge(v.resultado?.toLowerCase().replace(/ /g, '_') || 'pendiente')}
                                    </div>
                                    ${v.observaciones ? `<p class="visita-obs">📝 ${v.observaciones}</p>` : ''}
                                    ${v.audio_transcripcion ? `<p class="visita-obs">🎤 <em>${v.audio_transcripcion}</em></p>` : ''}
                                    ${v.ubicacion_lat && v.ubicacion_lng ? `
                                        <a href="https://www.google.com/maps?q=${v.ubicacion_lat},${v.ubicacion_lng}" 
                                           target="_blank" class="visita-ubicacion">
                                            📍 Ver ubicación en Google Maps
                                        </a>
                                    ` : ''}
                                    ${v.foto_url ? `<img src="${v.foto_url}" class="visita-foto" onclick="window.open('${v.foto_url}', '_blank')">` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            console.log('No se pudieron cargar visitas:', e);
        }

        // Create modal HTML
        const modalHtml = `
            <div class="modal-overlay" id="modal-detalle" onclick="notifications.closeModal(event)">
                <div class="modal-content modal-panoramic" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <div class="header-info">
                            <h2>📄 Detalle de Notificación</h2>
                            <span class="header-id">Expediente N° ${data.n_expediente}</span>
                        </div>
                        <div class="header-status-pill">
                            ${utils.getStatusBadge(data.resultado_diligencia || data.estado)}
                        </div>
                        <button class="modal-close" onclick="notifications.closeModal()">&times;</button>
                    </div>

                    <div class="modal-body p-0">
                        <!-- Barra Maestra Superior: Info Crítica -->
                        <div class="modal-master-bar">
                            <div class="master-item">
                                <span class="master-label">📍 Zona de Trabajo</span>
                                <span class="master-value"><span class="badge-zona-lg">${data.zona || 'N/A'}</span></span>
                            </div>
                            <div class="master-item highlighted">
                                <span class="master-label">🚶 Ujier Asignado</span>
                                <div class="ujier-assigned-box">
                                    <div class="ujier-avatar-mini">${data.ujier_nombre ? data.ujier_nombre.charAt(0) : '?'}</div>
                                    <span class="master-value"><strong>${data.ujier_nombre || 'Sin asignar'}</strong></span>
                                </div>
                            </div>
                            <div class="master-item grow">
                                <span class="master-label">🏠 Domicilio de Notificación</span>
                                <span class="master-value domicile-large">${data.domicilio}</span>
                            </div>
                            ${data.destinatario_especial ? `
                                <div class="master-item">
                                    <span class="master-label">🏢 Destino Especial</span>
                                    <span class="master-value">${data.destinatario_especial}</span>
                                </div>
                            ` : ''}
                        </div>

                        <div class="modal-detailed-grid mt-0">
                            <!-- Columna Izquierda: Datos Técnicos y Legales -->
                            <div class="modal-col-main">
                                <div class="info-section-group">
                                    <h4 class="info-group-title">⚖️ Datos Legales</h4>
                                    <table class="compact-info-table">
                                        <tr>
                                            <th>Tipo de Notific.</th>
                                            <td>${CONFIG.NOTIFICATION_TYPES[data.tipo_notificacion] || data.tipo_notificacion}</td>
                                        </tr>
                                        <tr>
                                            <th>Carátula</th>
                                            <td>${data.caratula}</td>
                                        </tr>
                                        <tr>
                                            <th>Organismo Origen</th>
                                            <td>${data.origen || '-'}</td>
                                        </tr>
                                        <tr>
                                            <th>Letrado Actuante</th>
                                            <td>${data.letrado || '-'}</td>
                                        </tr>
                                    </table>
                                </div>

                                <div class="info-section-group">
                                    <h4 class="info-group-title">👤 Destinatario</h4>
                                    <table class="compact-info-table">
                                        <tr>
                                            <th>Nombre Completo</th>
                                            <td><strong>${data.destinatario_nombre}</strong></td>
                                        </tr>
                                        <tr>
                                            <th>Identificador</th>
                                            <td>${data.id}</td>
                                        </tr>
                                    </table>
                                </div>

                                <div class="info-section-group">
                                    <h4 class="info-group-title">🎫 Control Interno</h4>
                                    <div class="control-badges">
                                        <div class="control-tag">
                                            <span class="tag-label">Troquel:</span>
                                            <span class="tag-value">${data.sin_troquel ? 'N/A' : (data.n_troquel || '-')}</span>
                                        </div>
                                        <div class="control-tag">
                                            <span class="tag-label">Medio Pago:</span>
                                            <span class="tag-value">${data.medio_pago || '-'}</span>
                                        </div>
                                        <div class="control-tag">
                                            <span class="tag-label">Costo:</span>
                                            <span class="tag-value">${utils.formatCurrency(data.costo)}</span>
                                        </div>
                                    </div>
                                </div>

                                ${data.observaciones_iniciales ? `
                                    <div class="info-section-group notes-group">
                                        <h4 class="info-group-title">📝 Notas de Carga</h4>
                                        <div class="notes-content">${data.observaciones_iniciales}</div>
                                    </div>
                                ` : ''}
                            </div>

                            <!-- Columna Derecha: Multimedia e Historial -->
                            <div class="modal-col-side">
                                ${data.evidencia_foto ? `
                                    <div class="side-panel-section">
                                        <h4 class="side-title">📸 Evidencia Fotográfica</h4>
                                        <div class="photo-frame" onclick="window.open('${data.evidencia_foto}', '_blank')">
                                            <img src="${data.evidencia_foto}" class="img-fluid">
                                            <div class="photo-hint">Expandir 🔍</div>
                                        </div>
                                    </div>
                                ` : ''}

                                <div class="side-panel-section scrollable">
                                    <h4 class="side-title">📜 Historial de Visitas</h4>
                                    ${visitasHtml || '<p class="text-muted text-center p-4">Sin visitas registradas</p>'}
                                </div>
                                
                                <div class="modal-system-footer">
                                    <span>Cargado: ${utils.formatDateTime(data.fecha_carga)}</span>
                                    <span>por ${data.usuario_carga || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="footer-left">
                            ${data.migrated_from_glide ? '<span class="badge-migrated">📦 Registro Migrado</span>' : ''}
                        </div>
                        <div class="footer-actions">
                            <button class="btn btn-secondary-outline" onclick="notifications.closeModal()">Cerrar</button>
                            <button class="btn btn-primary btn-edit-detail" onclick="notifications.edit('${data.id}'); notifications.closeModal();">
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

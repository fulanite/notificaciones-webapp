/**
 * SGND - Notifications Management Module
 */

const notifications = {
    initialized: false,
    listenersSetup: false,
    currentPage: 1,
    totalPages: 1,
    lastRequestId: 0,
    filters: {
        estado: '',
        tipo: '',
        fecha: '',
        search: '',
        zona: '',
        year: '2026',
        own_only: true
    },

    // Initialize notifications list
    async init() {
        if (this.initialized) {
            // Si ya se inicializó, solo refrescamos los datos para estar al día
            await this.loadNotifications();
            return;
        }

        // Establecer filtro propio basado en rol
        const rol = auth.currentUser?.rol ? auth.currentUser.rol.toLowerCase() : '';

        // Roles que ven 'Mis Cargas' por defecto: administrativo, coordinador, ujier
        if (rol === 'administrativo' || rol === 'coordinador' || rol === 'ujier') {
            this.filters.own_only = true;
            // Asegurar que el select refleje 'Mis Cargas'
            const filterPropio = document.getElementById('filter-propio');
            if (filterPropio) filterPropio.value = 'mine-all';
        } else {
            // Admin y Auditor ven TODO por defecto
            this.filters.own_only = false;
            const filterPropio = document.getElementById('filter-propio');
            if (filterPropio) filterPropio.value = 'none';
        }

        await this.loadFilterOptions(); // Load options from DB first
        if (!this.listenersSetup) {
            this.setupFilters();
            this.listenersSetup = true;
        }
        await this.loadNotifications();
        this.updateYearBadges();
        this.initialized = true;
    },

    // Load filter options based on real data from DB
    async loadFilterOptions() {
        const filterZona = document.getElementById('filter-zona');
        const filterEstado = document.getElementById('filter-estado');
        const filterTipo = document.getElementById('filter-tipo');

        try {
            // Load Zonas
            const { data: zonas } = await db.getDistinctValues('zona');
            if (filterZona && zonas) {
                filterZona.innerHTML = '<option value="">🌎 Todas las zonas</option>' +
                    zonas.map(z => `<option value="${z}">${z.toUpperCase()}</option>`).join('');
            }

            // Load Estados
            const { data: estados } = await db.getDistinctValues('estado');
            if (filterEstado && estados) {
                filterEstado.innerHTML = '<option value="">📊 Todos los estados</option>' +
                    estados.map(e => {
                        const label = e.charAt(0).toUpperCase() + e.slice(1);
                        return `<option value="${e}">${label}</option>`;
                    }).join('');
            }

            // Load Tipos
            const { data: tipos } = await db.getDistinctValues('tipo_notificacion');
            if (filterTipo && tipos) {
                filterTipo.innerHTML = '<option value="">📦 Todos los tipos</option>' +
                    tipos.map(t => `<option value="${t}">${CONFIG.NOTIFICATION_TYPES[t] || t}</option>`).join('');
            }
        } catch (e) {
            console.error('Error loading filter options:', e);
        }
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
            this.updateYearBadges();
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
            const val = filterPropio.value;
            if (val === 'mine-all') {
                this.filters.own_only = true;
                utils.showToast('Mostrando tus cargas', 'info');
            } else {
                this.filters.own_only = false;
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
        const params = {
            own_only: this.filters.own_only ? 1 : 0,
            user_email: auth.currentUser?.email
        };

        try {
            const counts = await db.getYearCounts(params);

            const badge2026 = document.getElementById('badge-2026');
            const badge2025 = document.getElementById('badge-2025');

            if (badge2026) badge2026.textContent = counts['2026'] || 0;
            if (badge2025) badge2025.textContent = counts['2025'] || 0;
        } catch (error) {
            console.error('Error updating year badges:', error);
        }
    },


    // Load notifications from database
    async loadNotifications() {
        const requestId = ++this.lastRequestId;

        const tbody = document.getElementById('tabla-notificaciones');
        const refreshBtn = document.getElementById('btn-refresh-list');
        if (!tbody) return;

        // Show loading
        if (refreshBtn) refreshBtn.classList.add('rotating');
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 40px;">
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

            // Verificación de ID de petición para evitar race conditions
            if (requestId !== this.lastRequestId) {
                console.log('⏳ Ignorando respuesta obsoleta:', requestId);
                return;
            }

            if (error) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="11" style="text-align: center; padding: 40px; color: var(--error);">
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
            const hasFilters = this.filters.estado || this.filters.search || this.filters.zona || this.filters.own_only;
            const yearText = this.filters.year;
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 60px; color: var(--text-muted);">
                        <div style="font-size: 3rem; margin-bottom: 16px;">🔍</div>
                        <h3>No hay notificaciones en ${yearText}</h3>
                        <p>${hasFilters ? 'Probá quitando algunos filtros o buscando en otro año.' : 'No hay registros cargados para este año aún.'}</p>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        let lastDate = '';

        data.forEach(notif => {
            // Grouping logic: Synchronize with what's shown in the "F. Entrega" column
            // We use exactly the same logic to avoid group-row mismatch
            const displayDate = notif.fecha_entrega_ujier ? notif.fecha_entrega_ujier.split(' ')[0] : 'Sin fecha';

            // Add date separator if grouping is active (own_only) or just as a general improvement
            if (this.filters.own_only && displayDate !== lastDate) {
                const headerLabel = notif.fecha_entrega_ujier ? `📅 ${utils.formatDate(notif.fecha_entrega_ujier)}` : '📅 Pendiente de Entrega';
                html += `
                    <tr class="date-group-row">
                        <td colspan="11">${headerLabel}</td>
                    </tr>
                `;
                lastDate = displayDate;
            }

            const recipientDisplay = (notif.destinatario_nombre?.trim() || utils.getSpecialDestinationText(notif) || 'Sin destinatario');

            html += `
                <tr class="stagger-item row-hover-effect" style="cursor: pointer;" onclick="notifications.viewDetails('${notif.id}')">
                    <td class="col-date" data-label="Fecha">${notif.fecha_entrega_ujier ? utils.formatDate(notif.fecha_entrega_ujier) : '<span style="color:var(--text-muted)">-</span>'}</td>
                    <td class="col-status" data-label="Estado">${this.getEnhancedStatusBadge(notif)}</td>
                    <td class="col-zona" data-label="Zona"><span class="badge-zona">${notif.zona || '-'}</span></td>
                    <td class="col-ujier" data-label="Ujier">${notif.ujier_nombre ? notif.ujier_nombre.split(' ')[0] : '-'}</td>
                    <td class="col-letrado" data-label="Letrado" title="${notif.letrado || '-'}">${notif.letrado || '-'}</td>
                    <td class="col-caratula" data-label="Carátula" title="${notif.caratula || ''}">${notif.caratula || ''}</td>
                    <td class="col-exp" data-label="Expediente"><strong style="white-space: nowrap;">${notif.n_expediente}</strong></td>
                    <td class="col-dest" data-label="Destinatario" title="${recipientDisplay}">${recipientDisplay}</td>
                    <td class="col-cargador" data-label="Cargador" title="${notif.cargador_nombre || '-'}">${(notif.cargador_nombre || '-').split(' ')[0]}</td>
                    <td class="col-dom" data-label="Domicilio" title="${notif.domicilio}">${notif.domicilio}</td>
                    <td class="col-troquel" data-label="Troquel" style="font-family: monospace;">${notif.n_troquel || '-'}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    // Enhanced status badge that handles special recipients logic and latest visit result
    getEnhancedStatusBadge(notif) {
        // Priorizamos el estado procesado por la API (que incluye la última visita)
        let status = notif.estado_display || notif.resultado_diligencia || notif.estado;

        // If it's a special recipient and status is 'atiende', show as 'entregado'
        if (utils.isSpecialDestination(notif.destinatario_especial) && (status === 'atiende' || status === 'pendiente')) {
            // Para ARCAT/Estrados, si aún está pendiente pero es receptor especial, 
            // mantenemos la lógica visual de negocio si corresponde.
            if (status === 'atiende') status = 'entregado';
        }


        let badge = utils.getStatusBadge(status);

        // Add return icon if handled
        if (notif.devuelta_por_ujier == 1) {
            badge = `<div style="display:flex; align-items:center; gap:4px;">${badge}<span title="Devuelta físicamente" style="font-size: 1rem;">📦</span></div>`;
        }

        return badge;
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
        utils.showLoading('Abriendo detalle...');
        const { data, error } = await db.getNotificationById(id);

        if (error || !data) {
            utils.hideLoading();
            utils.showToast('Error al cargar detalles', 'error');
            return;
        }

        // Load visits for this notification
        let visitasHtml = '';
        try {
            const visitasResp = await db.getVisitas(id);
            if (visitasResp.data && visitasResp.data.length > 0) {
                // Tactical Logistics Timeline (Shipping style) - Light Theme Optimized
                visitasHtml = visitasResp.data.map((v, index) => `
                    <div class="timeline-item-tactical">
                        <div class="timeline-dot-box">
                            <div class="timeline-dot-tactical completed"></div>
                        </div>
                        <div class="timeline-detail">
                            <div class="timeline-header">
                                <div class="timeline-header-top">
                                    <span class="timeline-step">Visita #${visitasResp.data.length - index}</span>
                                    <span class="timeline-time">${utils.formatDateTime(v.fecha)}</span>
                                </div>
                                <div class="timeline-ujier-info">
                                    <span class="ujier-badge-mini">🚶 ${v.ujier_nombre || 'Sin registro'}</span>
                                </div>
                            </div>
                            <div class="timeline-status">
                                ${v.resultado ? `<strong>${v.resultado}</strong>` : '<em>Registrada</em>'}
                            </div>
                            
                            ${v.observaciones ? `<div class="visit-notes-box">📝 ${v.observaciones}</div>` : ''}
                            
                            ${(v.transcripcion_audio || v.audio_transcripcion || v.transcripcion_observacion) ? `
                                <div class="audio-transcription-box">
                                    <span class="audio-icon">🎤</span>
                                    <div class="audio-body">
                                        <span class="audio-label">Transcripción de voz:</span>
                                        <p class="transcription-text">${v.transcripcion_audio || v.audio_transcripcion || v.transcripcion_observacion}</p>
                                    </div>
                                </div>
                            ` : ''}
                            
                            <div class="timeline-footer mt-2">
                                ${v.ubicacion_lat && v.ubicacion_lng ? `
                                    <a href="https://www.google.com/maps?q=${v.ubicacion_lat},${v.ubicacion_lng}" 
                                       target="_blank" class="timeline-link">
                                        📍 Ubicación GPS
                                    </a>
                                ` : ''}
                                ${v.foto_url ? `
                                    <a href="${v.foto_url}" target="_blank" class="timeline-link photo-link">
                                        📸 Ver Foto
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
            <div class="modal" id="modal-detalle-wrapper" style="display: flex;">
                <div class="modal-overlay" id="modal-detalle" onclick="notifications.closeModal(event)">
                    <div class="modal-content modal-panoramic-v2 light-theme" onclick="event.stopPropagation()">
                    <div class="modal-header-v2">
                        <div class="header-main-left">
                            <div class="header-title-container">
                                <h2>📄 Detalle de Notificación</h2>
                                <div class="header-badges">
                                    <span class="badge-type-pill-v2">${CONFIG.NOTIFICATION_TYPES[data.tipo_notificacion] || data.tipo_notificacion}</span>
                                    <span class="header-id-pill">ID: ${data.id}</span>
                                    <span class="header-date-pill" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary); padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">📅 Entrega: ${data.fecha_entrega_ujier ? utils.formatDate(data.fecha_entrega_ujier) : 'Pendiente'}</span>
                                </div>
                            </div>
                        </div>
                        <div class="header-status-box">
                            ${this.getEnhancedStatusBadge(data)}
                        </div>
                        <button class="modal-close-v2" onclick="notifications.closeModal()">&times;</button>
                    </div>

                    <div class="modal-body p-0">
                        <!-- Premium Master Bar (Light Mode) -->
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
                                    <span class="card-value"><strong>${data.destinatario_nombre || utils.getSpecialDestinationText(data) || 'Sin nombre'}</strong></span>
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
                                        <tr>
                                            <th>Estado Físico</th>
                                            <td>
                                                ${data.devuelta_por_ujier ?
                '<span class="badge-mini status-success">✅ DEVUELTA AL DEPTO.</span>' :
                '<span class="badge-mini status-warning">⏳ EN PODER DEL UJIER</span>'}
                                            </td>
                                        </tr>
                                        ${utils.isSpecialDestination(data.destinatario_especial) ? `
                                            <tr>
                                                <th>Destino Esp.</th>
                                                <td><span class="badge-dest-esp">${utils.getSpecialDestinationText(data)}</span></td>
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
                                            <div class="photo-hint">Ampliar Evidencia</div>
                                        </div>
                                    </div>
                                ` : ''}

                                <div class="sidebar-timeline-box">
                                    <h4 class="sidebar-title">📜 Historial de Visitas</h4>
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
                             <span class="info-tag delivery-tag" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary);">📅 Entrega: ${data.fecha_entrega_ujier ? utils.formatDate(data.fecha_entrega_ujier) : 'Pendiente'}</span>
                            <span class="info-tag carga-tag">🕒 Carga: ${utils.formatDateTime(data.fecha_carga)}</span>
                            <span class="info-tag user-tag">👤 Por: <strong>${data.cargador_nombre || data.usuario_carga || '-'}</strong></span>
                            ${data.devuelta_por_ujier ? `<span class="info-tag return-tag" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;">📦 Devuelta: ${utils.formatDate(data.fecha_devolucion)}</span>` : ''}
                            ${data.migrated_from_glide ? '<span class="badge-migrated-v2">📦 REGISTRO MIGRADO</span>' : ''}
                        </div>
                        <div class="footer-main-actions">
                            <button class="btn btn-light-glass" onclick="notifications.closeModal()">Cerrar</button>
                            <button class="btn btn-primary btn-action-main" onclick="notifications.edit('${data.id}'); notifications.closeModal();">
                                ✏️ Editar Diligencia
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insert modal into DOM and prevent body scroll
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        utils.hideLoading();
        document.body.style.overflow = 'hidden';

        // Add escape key listener
        document.addEventListener('keydown', this.handleModalEscape);
    },

    // Close modal
    closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        const modal = document.getElementById('modal-detalle-wrapper');
        if (modal) {
            const overlay = document.getElementById('modal-detalle');
            if (overlay) overlay.classList.add('fade-out');
            setTimeout(() => {
                modal.remove();
                document.body.style.overflow = '';
            }, 200);
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

        // Open modal instead of navigating
        const modal = document.getElementById('modal-nueva-notificacion');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            const modalTitle = modal.querySelector('.modal-title');
            if (modalTitle) modalTitle.textContent = '📝 Editar Notificación';

            // Hide persistent settings bar during edit
            const pBar = document.getElementById('persistent-settings-container');
            if (pBar) pBar.classList.add('hidden-important');

            // Force visibility of form-specific fields during edit (they might be hidden by persistent settings)
            const fGroupZona = document.getElementById('f-group-zona');
            const fGroupAsignar = document.getElementById('f-group-asignar');
            const fGroupFecha = document.getElementById('f-group-fecha-entrega');
            if (fGroupZona) fGroupZona.classList.remove('hidden');
            if (fGroupAsignar) fGroupAsignar.classList.remove('hidden');
            if (fGroupFecha) fGroupFecha.classList.remove('hidden');
        }

        // Wait for DOM to be ready
        setTimeout(() => {
            // Populate form fields with smart normalization
            const tipoVal = data.tipo_notificacion || '';
            utils.setSelectByText('tipo-notificacion', tipoVal);

            // Re-fetch standardized value from select (in case it matched by label)
            const standardizedTipo = document.getElementById('tipo-notificacion').value;

            // Trigger tipo change to set up correct origin field
            if (standardizedTipo === 'cedulas_mandamientos_22172' ||
                standardizedTipo === 'cedulas_correspondencia') {
                app.handleTipoNotificacionChange(standardizedTipo);
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
                app.handleTipoNotificacionChange(standardizedTipo || 'cedulas');
                const iFixed = document.getElementById('origen-input');
                const hFixed = document.getElementById('origen');
                if (iFixed && hFixed) {
                    iFixed.value = data.origen || '';
                    hFixed.value = data.origen || '';
                }
            }

            document.getElementById('n-expediente').value = data.n_expediente || '';
            document.getElementById('caratula').value = data.caratula || '';
            document.getElementById('letrado').value = data.letrado || '';
            if (utils.isSpecialDestination(data.destinatario_especial)) {
                // If it's a special flag (usually '1'), we use the name from origen/destinatario_nombre
                // to match the dropdown options.
                document.getElementById('destinatario-especial').value =
                    (String(data.destinatario_especial) === '1') ?
                        (data.origen || data.destinatario_nombre || '1') :
                        data.destinatario_especial;
            } else {
                document.getElementById('destinatario-especial').value = '';
            }
            document.getElementById('destinatario-nombre').value = data.destinatario_nombre || '';
            document.getElementById('domicilio').value = data.domicilio || '';

            // Smart normalization for Zone
            utils.setSelectByText('zona', data.zona);

            // Populate Assignee (ID match first, then name)
            utils.setSelectByText('asignado-a', data.asignado_a);
            document.getElementById('tipo-troquel').value = data.tipo_troquel || '';
            document.getElementById('n-troquel').value = data.n_troquel || '';
            document.getElementById('medio-pago').value = data.medio_pago || '';
            document.getElementById('costo').value = data.costo || '';
            document.getElementById('asignado-a').value = data.asignado_a || '';
            document.getElementById('observaciones-iniciales').value = data.observaciones_iniciales || '';

            // Populate delivery date in BOTH places for consistency
            const fechaInput = document.getElementById('persist-fecha-entrega');
            const fechaForm = document.getElementById('fecha-entrega');
            if (data.fecha_entrega_ujier) {
                const dateOnly = data.fecha_entrega_ujier.split(' ')[0];
                if (fechaInput) fechaInput.value = dateOnly;
                if (fechaForm) fechaForm.value = dateOnly;
            }

            // Handle checkboxes
            const sinTroquel = document.getElementById('sin-troquel');
            if (sinTroquel) {
                sinTroquel.checked = data.sin_troquel || false;
                if (data.sin_troquel) {
                    document.getElementById('grupo-n-troquel')?.classList.add('hidden');
                }
            }


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
            if (error.message && error.message.includes('1452')) {
                utils.showToast('Error: El ujier seleccionado no es válido en la base de datos actual. Se ha limpiado la selección.', 'error');
                // Clear invalid selection
                const select = document.getElementById('asignado-a');
                if (select) select.value = '';
                // Clear persistence
                localStorage.removeItem('sgnd-persist-ujier');
                return { success: false, error };
            }

            utils.showToast('Error al crear notificación: ' + error.message, 'error');
            return { success: false, error };
        }

        utils.showToast('Notificación creada exitosamente', 'success');
        return { success: true, data: result };
    },

    // Load ujieres for assignment dropdown
    async loadUjieres() {
        const select = document.getElementById('asignado-a');
        const persistSelect = document.getElementById('persist-ujier');
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

            if (persistSelect) {
                persistSelect.innerHTML = `
                    <option value="">No fijar</option>
                    ${options}
                `;
            }
        }
    }
};

/**
 * SGND - Módulo de Auditoría
 * Gestión y visualización de logs del sistema
 */

const audit = {
    currentPage: 1,
    filters: {},

    // Inicializar módulo
    async init() {
        console.log('🔍 Audit module init...');
        const container = document.getElementById('audit-logs-table');
        if (!container) {
            console.error('❌ Audit table container not found in DOM');
            return;
        }

        this.setupEventListeners();
        await Promise.all([
            this.loadStats(),
            this.loadLogs(),
            this.loadUsers()
        ]);
        console.log('✅ Audit module init complete');
    },

    // Configurar event listeners
    setupEventListeners() {
        // Botón refrescar
        const btnRefresh = document.getElementById('btn-refresh-audit');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => this.refresh());
        }

        // Filtros (auto-apply on change)
        const filterForm = document.getElementById('audit-filters');
        if (filterForm) {
            filterForm.addEventListener('change', () => this.applyFilters());
            filterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.applyFilters();
            });
        }

        // Limpiar filtros
        const btnClearFilters = document.getElementById('btn-clear-filters');
        if (btnClearFilters) {
            btnClearFilters.addEventListener('click', () => this.clearFilters());
        }

        // Exportar logs
        const btnExport = document.getElementById('btn-export-audit');
        if (btnExport) {
            btnExport.addEventListener('click', () => this.exportLogs());
        }

        // Paginación
        document.addEventListener('click', (e) => {
            if (e.target.matches('.audit-page-btn')) {
                const page = parseInt(e.target.dataset.page);
                this.goToPage(page);
            }
        });
    },

    // Refrescar datos
    async refresh() {
        const btn = document.getElementById('btn-refresh-audit');
        if (btn) {
            btn.classList.add('spinning');
            btn.disabled = true;
        }

        try {
            await Promise.all([
                this.loadStats(),
                this.loadLogs()
            ]);
        } finally {
            if (btn) {
                btn.classList.remove('spinning');
                btn.disabled = false;
            }
        }
    },

    // Cargar estadísticas
    async loadStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/audit.php?stats=1`);
            const data = await response.json();

            if (data.success) {
                this.renderStats(data.data);
            }
        } catch (error) {
            console.error('Error loading audit stats:', error);
        }
    },

    // Cargar logs
    async loadLogs() {
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 50,
                ...this.filters
            });

            const response = await fetch(`${API_BASE_URL}/audit.php?${params}`);
            const data = await response.json();
            console.log('📡 Audit logs data received:', data);

            if (data.success && data.data) {
                this.currentLogs = data.data.logs || [];
                console.log(`📝 Rendering ${this.currentLogs.length} logs`);
                this.renderLogs(this.currentLogs);
                this.renderPagination(data.data);
            } else {
                console.warn('⚠️ Audit API returned success:false or missing data');
                this.renderLogs([]);
            }
        } catch (error) {
            this.renderLogs([]);
        }
    },

    // Cargar usuarios para el filtro
    async loadUsers() {
        try {
            const response = await fetch(`${API_BASE_URL}/usuarios.php`);
            const data = await response.json();

            if (data.success) {
                const select = document.getElementById('audit-filter-user');
                if (!select) return;

                // Guardar opción por defecto
                const defaultValue = select.options[0].outerHTML;

                select.innerHTML = defaultValue + data.data.map(u => `
                    <option value="${u.id}">${u.nombre} (${u.rol})</option>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading users for audit filter:', error);
        }
    },

    // Renderizar estadísticas
    renderStats(stats) {
        console.log('📊 Rendering audit stats:', stats);
        if (!stats) return;

        const updateText = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                // Ensure we show 0 if null/undefined
                const count = (val === null || val === undefined) ? 0 : val;
                el.textContent = count;

                // Add a small animation if value > 0
                if (count > 0) {
                    el.style.color = 'var(--primary-600)';
                    setTimeout(() => el.style.color = '', 300);
                }
            }
        };

        updateText('stat-acciones-hoy', stats.acciones_hoy);
        updateText('stat-reportes-semana', stats.reportes_semana);
        updateText('stat-usuarios-activos', stats.usuarios_activos);
        updateText('stat-alertas', stats.alertas);

        this.renderTopUsers(stats.top_usuarios || []);
        this.renderActionDistribution(stats.distribucion_acciones || []);
    },

    // Renderizar top usuarios
    renderTopUsers(users) {
        const container = document.getElementById('top-usuarios-list');
        if (!container) return;

        if (users.length === 0) {
            container.innerHTML = '<p style="color: #6b7280; text-align: center;">Sin datos</p>';
            return;
        }

        container.innerHTML = users.map((user, index) => `
            <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: ${index % 2 === 0 ? '#f9fafb' : 'white'}; border-radius: 6px;">
                <span style="font-weight: 500;">${user.usuario_nombre}</span>
                <span style="color: #667eea; font-weight: 600;">${user.acciones} acciones</span>
            </div>
        `).join('');
    },

    // Renderizar distribución de acciones
    renderActionDistribution(actions) {
        const container = document.getElementById('action-distribution');
        if (!container) return;

        if (actions.length === 0) {
            container.innerHTML = '<p style="color: #6b7280; text-align: center;">Sin datos</p>';
            return;
        }

        const total = actions.reduce((sum, a) => sum + parseInt(a.count), 0);

        container.innerHTML = actions.map(action => {
            const percentage = ((action.count / total) * 100).toFixed(1);
            return `
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 0.9em; font-weight: 500;">${this.getActionLabel(action.accion)}</span>
                        <span style="font-size: 0.85em; color: #6b7280;">${action.count} (${percentage}%)</span>
                    </div>
                    <div style="height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2);"></div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // Renderizar logs
    renderLogs(logs) {
        const container = document.getElementById('audit-logs-table');
        if (!container) return;

        if (logs.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #6b7280;">
                        No se encontraron registros
                    </td>
                </tr>
            `;
            return;
        }

        container.innerHTML = logs.map(log => `
            <tr class="audit-log-row" data-log-id="${log.id}">
                <td>${this.formatDate(log.created_at)}</td>
                <td>
                    <span class="badge badge-${this.getSeverityColor(log.severidad)}">${log.severidad}</span>
                </td>
                <td>${log.usuario_nombre || 'Sistema'}</td>
                <td>
                    <span class="badge badge-action">${this.getActionLabel(log.accion)}</span>
                </td>
                <td>${log.entidad}</td>
                <td>${log.descripcion}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="audit.showDetails(${log.id})">
                        Ver detalles
                    </button>
                </td>
            </tr>
        `).join('');
    },

    // Renderizar paginación
    renderPagination(data) {
        const container = document.getElementById('audit-pagination');
        if (!container) return;

        const { page, pages, total } = data;

        let html = `<span>Mostrando página ${page} de ${pages} (${total} registros)</span><div class="pagination-buttons">`;

        if (page > 1) {
            html += `<button class="btn btn-sm audit-page-btn" data-page="${page - 1}">← Anterior</button>`;
        }

        // Páginas
        for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) {
            html += `<button class="btn btn-sm audit-page-btn ${i === page ? 'btn-primary' : 'btn-secondary'}" data-page="${i}">${i}</button>`;
        }

        if (page < pages) {
            html += `<button class="btn btn-sm audit-page-btn" data-page="${page + 1}">Siguiente →</button>`;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    // Aplicar filtros
    applyFilters() {
        const form = document.getElementById('audit-filters');
        const formData = new FormData(form);

        this.filters = {};
        for (const [key, value] of formData.entries()) {
            if (value) {
                this.filters[key] = value;
            }
        }

        this.currentPage = 1;
        this.loadLogs();
    },

    // Limpiar filtros
    clearFilters() {
        document.getElementById('audit-filters').reset();
        this.filters = {};
        this.currentPage = 1;
        this.loadLogs();
    },

    // Ir a página
    goToPage(page) {
        this.currentPage = page;
        this.loadLogs();
    },

    // Mostrar detalles de log
    async showDetails(logId) {
        utils.showLoading('Cargando detalles...');

        try {
            // No hay endpoint individual, buscamos en los logs cargados o pedimos de nuevo
            // Para simplicidad, volveremos a pedir los logs pero filtrados por ID (si el API lo soporta)
            // O mejor, buscamos en el array local si lo guardamos
            const log = this.currentLogs.find(l => l.id == logId);

            if (log) {
                this.renderLogDetails(log);
                document.getElementById('modal-audit-details').classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error showing log details:', error);
            utils.showToast('Error al cargar detalles', 'error');
        } finally {
            utils.hideLoading();
        }
    },

    // Renderizar detalles en el modal
    renderLogDetails(log) {
        const container = document.getElementById('audit-details-content');
        if (!container) return;

        const formatJson = (json) => {
            if (!json) return '<i style="color: #9ca3af;">N/A</i>';
            try {
                return `<pre style="background: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 0.85em; max-height: 200px;">${JSON.stringify(json, null, 2)}</pre>`;
            } catch (e) {
                return json;
            }
        };

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h4 style="margin-bottom: 8px; color: #374151; font-size: 0.9em; text-transform: uppercase;">Información General</h4>
                    <table class="detail-table" style="width: 100%; font-size: 0.9em;">
                        <tr><td style="font-weight: 600; padding: 4px 0;">ID Log:</td><td>#${log.id}</td></tr>
                        <tr><td style="font-weight: 600; padding: 4px 0;">Fecha:</td><td>${this.formatDate(log.created_at)}</td></tr>
                        <tr><td style="font-weight: 600; padding: 4px 0;">Usuario:</td><td>${log.usuario_nombre || 'Sistema'} (ID: ${log.usuario_id || '-'})</td></tr>
                        <tr><td style="font-weight: 600; padding: 4px 0;">Rol:</td><td>${log.usuario_rol || '-'}</td></tr>
                        <tr><td style="font-weight: 600; padding: 4px 0;">Acción:</td><td><span class="badge badge-action">${this.getActionLabel(log.accion)}</span></td></tr>
                        <tr><td style="font-weight: 600; padding: 4px 0;">Entidad:</td><td>${log.entidad} (ID: ${log.entidad_id || '-'})</td></tr>
                    </table>
                </div>
                <div>
                    <h4 style="margin-bottom: 8px; color: #374151; font-size: 0.9em; text-transform: uppercase;">Detalles Técnicos</h4>
                    <table class="detail-table" style="width: 100%; font-size: 0.9em;">
                        <tr><td style="font-weight: 600; padding: 4px 0;">IP:</td><td>${log.ip_address || '-'}</td></tr>
                        <tr><td style="font-weight: 600; padding: 4px 0;">Método:</td><td>${log.metodo || '-'}</td></tr>
                        <tr><td style="font-weight: 600; padding: 4px 0;">Ruta:</td><td style="word-break: break-all;">${log.ruta || '-'}</td></tr>
                        <tr><td style="font-weight: 600; padding: 4px 0;">Resultado:</td><td><span class="badge badge-${log.resultado === 'exito' ? 'success' : 'danger'}">${log.resultado}</span></td></tr>
                    </table>
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 8px; color: #374151; font-size: 0.9em; text-transform: uppercase;">Descripción</h4>
                <p style="padding: 12px; background: #f9fafb; border-radius: 6px; border-left: 4px solid #667eea;">${log.descripcion}</p>
            </div>

            <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h4 style="margin-bottom: 8px; color: #374151; font-size: 0.9em; text-transform: uppercase;">🔄 Datos Anteriores</h4>
                    ${formatJson(log.datos_anteriores)}
                </div>
                <div>
                    <h4 style="margin-bottom: 8px; color: #374151; font-size: 0.9em; text-transform: uppercase;">🆕 Datos Nuevos</h4>
                    ${formatJson(log.datos_nuevos)}
                </div>
            </div>

            ${log.metadatos ? `
                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom: 8px; color: #374151; font-size: 0.9em; text-transform: uppercase;">📦 Metadatos</h4>
                    ${formatJson(log.metadatos)}
                </div>
            ` : ''}

            ${log.mensaje_error ? `
                <div style="margin-top: 20px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #b91c1c;">
                    <h4 style="margin-bottom: 4px; font-size: 0.9em; text-transform: uppercase;">Error Registrado</h4>
                    <p style="font-family: monospace;">${log.mensaje_error}</p>
                </div>
            ` : ''}
        `;
    },

    closeDetails() {
        document.getElementById('modal-audit-details').classList.add('hidden');
    },

    // Exportar logs
    async exportLogs() {
        utils.showToast('Funcionalidad de exportación en desarrollo', 'info');
    },

    // Helpers
    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    getSeverityColor(severity) {
        const colors = {
            'info': 'primary',
            'warning': 'warning',
            'error': 'danger',
            'critical': 'danger'
        };
        return colors[severity] || 'secondary';
    },

    getActionLabel(action) {
        const labels = {
            'CREATE': 'Crear',
            'UPDATE': 'Actualizar',
            'DELETE': 'Eliminar',
            'LOGIN': 'Login',
            'LOGOUT': 'Logout',
            'EXPORT': 'Exportar',
            'GENERATE_REPORT': 'Generar Reporte',
            'VIEW': 'Ver',
            'ASSIGN': 'Asignar',
            'IMPORT': 'Importar'
        };
        return labels[action] || action;
    }
};

// Guardar array de logs localmente para los detalles
audit.currentLogs = [];

// Envolver el renderLogs original para guardar el estado
const originalRenderLogs = audit.renderLogs;
audit.renderLogs = function (logs) {
    this.currentLogs = logs || [];
    originalRenderLogs.call(this, logs);
};

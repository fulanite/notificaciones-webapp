/**
 * SGND - Módulo de Auditoría
 * Gestión y visualización de logs del sistema
 */

const audit = {
    currentPage: 1,
    filters: {},

    // Inicializar módulo
    async init() {
        await this.loadStats();
        await this.loadLogs();
        this.setupEventListeners();
    },

    // Configurar event listeners
    setupEventListeners() {
        // Botón refrescar
        const btnRefresh = document.getElementById('btn-refresh-audit');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => this.refresh());
        }

        // Filtros
        const filterForm = document.getElementById('audit-filters');
        if (filterForm) {
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

            if (data.success) {
                this.renderLogs(data.data.logs);
                this.renderPagination(data.data);
            }
        } catch (error) {
            console.error('Error loading audit logs:', error);
        }
    },

    // Renderizar estadísticas
    renderStats(stats) {
        // Métricas principales
        document.getElementById('stat-acciones-hoy').textContent = stats.acciones_hoy || 0;
        document.getElementById('stat-reportes-semana').textContent = stats.reportes_semana || 0;
        document.getElementById('stat-usuarios-activos').textContent = stats.usuarios_activos || 0;
        document.getElementById('stat-alertas').textContent = stats.alertas || 0;

        // Top usuarios
        this.renderTopUsers(stats.top_usuarios || []);

        // Distribución de acciones
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
                    <td colspan="6" style="text-align: center; padding: 40px; color: #6b7280;">
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
        // TODO: Implementar modal con detalles completos
        console.log('Show details for log:', logId);
    },

    // Exportar logs
    async exportLogs() {
        // TODO: Implementar exportación a Excel
        console.log('Export logs');
    },

    // Helpers
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
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

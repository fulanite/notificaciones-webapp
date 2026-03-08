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

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                <div>
                    <h4 style="margin-bottom: 12px; color: #374151; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px;">Información General</h4>
                    <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
                        <table style="width: 100%; font-size: 0.9em; border-collapse: collapse;">
                            <tr><td style="font-weight: 500; padding: 10px 15px; background: #f9fafb; border-bottom: 1px solid #f3f4f6; width: 120px;">ID Log:</td><td style="padding: 10px 15px; border-bottom: 1px solid #f3f4f6;">#${log.id}</td></tr>
                            <tr><td style="font-weight: 500; padding: 10px 15px; background: #f9fafb; border-bottom: 1px solid #f3f4f6;">Fecha:</td><td style="padding: 10px 15px; border-bottom: 1px solid #f3f4f6;">${this.formatDate(log.created_at)}</td></tr>
                            <tr><td style="font-weight: 500; padding: 10px 15px; background: #f9fafb; border-bottom: 1px solid #f3f4f6;">Usuario:</td><td style="padding: 10px 15px; border-bottom: 1px solid #f3f4f6;">${log.usuario_nombre || 'Sistema'}</td></tr>
                            <tr><td style="font-weight: 500; padding: 10px 15px; background: #f9fafb;">Acción:</td><td style="padding: 10px 15px;"><span class="badge badge-action">${this.getActionLabel(log.accion)}</span></td></tr>
                        </table>
                    </div>
                </div>
                <div>
                    <h4 style="margin-bottom: 12px; color: #374151; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px;">Contexto</h4>
                    <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
                        <table style="width: 100%; font-size: 0.9em; border-collapse: collapse;">
                            <tr><td style="font-weight: 500; padding: 10px 15px; background: #f9fafb; border-bottom: 1px solid #f3f4f6; width: 120px;">Entidad:</td><td style="padding: 10px 15px; border-bottom: 1px solid #f3f4f6;">${log.entidad} (ID: ${log.entidad_id || '-'})</td></tr>
                            <tr><td style="font-weight: 500; padding: 10px 15px; background: #f9fafb; border-bottom: 1px solid #f3f4f6;">IP:</td><td style="padding: 10px 15px; border-bottom: 1px solid #f3f4f6;">${log.ip_address || '-'}</td></tr>
                            <tr><td style="font-weight: 500; padding: 10px 15px; background: #f9fafb; border-bottom: 1px solid #f3f4f6;">Método:</td><td style="padding: 10px 15px; border-bottom: 1px solid #f3f4f6;">${log.metodo || '-'}</td></tr>
                            <tr><td style="font-weight: 500; padding: 10px 15px; background: #f9fafb;">Resultado:</td><td style="padding: 10px 15px;"><span class="badge badge-${log.resultado === 'exito' ? 'success' : 'danger'}">${log.resultado}</span></td></tr>
                        </table>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 24px;">
                <h4 style="margin-bottom: 12px; color: #374151; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px;">Descripción del Evento</h4>
                <div style="padding: 15px 20px; background: #f0f7ff; border-radius: 10px; border-left: 5px solid #3b82f6; font-size: 1.05em; color: #1e40af; font-weight: 500;">
                    ${log.descripcion}
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <h4 style="margin-bottom: 12px; color: #374151; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px;">🔍 Comparativa de Datos</h4>
                ${this.renderDiff(log.datos_anteriores, log.datos_nuevos)}
            </div>

            ${log.metadatos ? `
                <div>
                    <h4 style="margin-bottom: 12px; color: #374151; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px;">� Metadatos Adicionales</h4>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 0.85em;">
                        ${this.formatJson(log.metadatos)}
                    </div>
                </div>
            ` : ''}

            ${log.mensaje_error ? `
                <div style="margin-top: 24px; padding: 15px; background: #fff1f2; border: 1px solid #fecaca; border-radius: 10px; color: #991b1b;">
                    <h4 style="margin-bottom: 8px; font-size: 0.85em; text-transform: uppercase; font-weight: 700;">Error Técnico Registrado</h4>
                    <p style="font-family: 'JetBrains Mono', monospace; font-size: 0.85em; margin: 0;">${log.mensaje_error}</p>
                </div>
            ` : ''}
        `;
    },

    // Generar tabla comparativa (Diff)
    renderDiff(oldData, newData) {
        if (!oldData && !newData) return '<p style="color: #9ca3af; font-style: italic; text-align: center; padding: 20px;">Sin datos para comparar</p>';

        // Si es una creación pura (no había datos antes)
        if (!oldData && newData) {
            return `<div style="padding: 15px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; color: #065f46;">
                <strong>Objeto Creado:</strong>
                ${this.formatJson(newData)}
            </div>`;
        }

        // Si es una eliminación pura
        if (oldData && !newData) {
            return `<div style="padding: 15px; background: #fff1f2; border: 1px solid #fecaca; border-radius: 10px; color: #991b1b;">
                <strong>Objeto Eliminado (Último estado):</strong>
                ${this.formatJson(oldData)}
            </div>`;
        }

        const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
        const ignoreKeys = ['updated_at', 'created_at', 'updated_by'];

        const rows = allKeys
            .filter(key => !ignoreKeys.includes(key))
            .map(key => {
                const oldVal = oldData[key];
                const newVal = newData[key];

                // Normalizar para comparación (evitar diferencias por tipo string vs int)
                const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

                if (!isChanged) return ''; // No mostrar campos que no cambiaron para limpiar la vista

                return `
                    <tr style="background: #fff;">
                        <td style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9; font-weight: 600; font-size: 0.8em; color: #64748b; width: 150px; text-transform: uppercase;">${key.replace(/_/g, ' ')}</td>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9; font-size: 0.9em; color: #ef4444; background: #fef2f2; border-radius: 4px; text-decoration: line-through;">${this.formatDiffValue(oldVal)}</td>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9; font-size: 0.9em; color: #10b981; background: #ecfdf5; border-radius: 4px; font-weight: 600;">${this.formatDiffValue(newVal)}</td>
                    </tr>
                `;
            }).join('');

        if (!rows) {
            return '<p style="color: #6b7280; text-align: center; padding: 20px; background: #f9fafb; border-radius: 10px;">No se detectaron cambios en los valores de los campos registrados.</p>';
        }

        return `
            <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff;">
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <th style="text-align: left; padding: 12px 15px; font-size: 0.7em; text-transform: uppercase; color: #94a3b8; width: 150px;">Atributo</th>
                            <th style="text-align: left; padding: 12px 15px; font-size: 0.7em; text-transform: uppercase; color: #ef4444;">Valor Anterior</th>
                            <th style="text-align: left; padding: 12px 15px; font-size: 0.7em; text-transform: uppercase; color: #10b981;">Valor Nuevo</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    formatDiffValue(val) {
        if (val === null || val === undefined || val === '') return '<span style="color: #cbd5e1; font-style: italic;">vacío</span>';
        if (typeof val === 'object') return `<pre style="margin:0; font-size:0.85em;">${JSON.stringify(val)}</pre>`;
        if (typeof val === 'boolean') return val ? 'SÍ' : 'NO';
        return val;
    },

    formatJson(json) {
        if (!json) return '<i style="color: #9ca3af;">Sin datos</i>';
        try {
            return `<pre style="background: #f8fafc; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 0.85em; max-height: 250px; border: 1px solid #e2e8f0; font-family: 'JetBrains Mono', monospace;">${JSON.stringify(json, null, 2)}</pre>`;
        } catch (e) {
            return json;
        }
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

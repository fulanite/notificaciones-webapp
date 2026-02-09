/**
 * SGND - Dashboard Module
 */

const dashboard = {
    charts: {},

    // Initialize dashboard
    async init() {
        await this.loadStats();
        // DISABLED: Charts now handled by dashboard-analytics.js
        // await this.initCharts();
        await this.loadRecentActivity();
        await this.loadUjierPerformance();
    },

    // Load statistics
    async loadStats() {
        const stats = await db.getStats();

        this.animateCounter('stat-total', stats.total);
        this.animateCounter('stat-pending', stats.pendientes);
        this.animateCounter('stat-completed', stats.diligenciadas);
        this.animateCounter('stat-deferred', stats.diferidas);

        // Update pending count in nav
        const pendingBadge = document.getElementById('pending-count');
        if (pendingBadge) pendingBadge.textContent = stats.pendientes;
    },

    // Animate counter
    animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const duration = 1000;
        const startValue = 0;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);

            element.textContent = currentValue;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.textContent = targetValue;
            }
        };

        requestAnimationFrame(animate);
    },

    // Initialize charts
    async initCharts() {
        await this.initTypeChart();
        await this.initResultsChart();
    },

    // Initialize notifications by type chart
    async initTypeChart() {
        const canvas = document.getElementById('chart-by-type');
        if (!canvas) return;

        const data = await db.getStatsByType();

        // Destroy existing chart
        if (this.charts.typeChart) {
            this.charts.typeChart.destroy();
        }

        const colors = [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(6, 182, 212, 0.8)',
            'rgba(249, 115, 22, 0.8)'
        ];

        this.charts.typeChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.map(d => this.truncateLabel(d.label, 15)),
                datasets: [{
                    label: 'Cantidad',
                    data: data.map(d => d.count),
                    backgroundColor: colors.slice(0, data.length),
                    borderColor: colors.slice(0, data.length).map(c => c.replace('0.8', '1')),
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            stepSize: 1
                        }
                    }
                }
            }
        });
    },

    // Initialize results chart (doughnut)
    async initResultsChart() {
        const canvas = document.getElementById('chart-results');
        if (!canvas) return;

        const data = await db.getStatsByResult();

        if (this.charts.resultsChart) {
            this.charts.resultsChart.destroy();
        }

        const colors = [
            'rgba(16, 185, 129, 0.8)',  // Atiende - green
            'rgba(239, 68, 68, 0.8)',   // No atiende - red
            'rgba(245, 158, 11, 0.8)',  // Pre aviso - yellow
            'rgba(59, 130, 246, 0.8)',  // Estrados - blue
            'rgba(139, 92, 246, 0.8)',  // Domicilio inexistente - purple
            'rgba(107, 114, 128, 0.8)'  // Diligenciador ausente - gray
        ];

        this.charts.resultsChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.label),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: colors.slice(0, data.length),
                    borderColor: 'rgba(15, 23, 42, 1)',
                    borderWidth: 3,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#cbd5e1',
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12
                    }
                }
            }
        });
    },

    // Load recent activity
    async loadRecentActivity() {
        const container = document.getElementById('recent-activity');
        if (!container) return;

        const { data } = await db.getNotifications({ limit: 5 });

        if (!data || data.length === 0) {
            container.innerHTML = `
                <li class="activity-item">
                    <div class="activity-content">
                        <span class="activity-text">No hay actividad reciente</span>
                    </div>
                </li>
            `;
            return;
        }

        container.innerHTML = data.map(notif => {
            const icon = this.getActivityIcon(notif.estado);
            const action = this.getActivityAction(notif);

            return `
                <li class="activity-item stagger-item">
                    <div class="activity-icon">${icon}</div>
                    <div class="activity-content">
                        <span class="activity-text">${action}</span>
                        <span class="activity-time">${utils.formatRelativeTime(notif.fecha_carga)}</span>
                    </div>
                </li>
            `;
        }).join('');
    },

    // Get activity icon
    getActivityIcon(estado) {
        const icons = {
            pendiente: '📋',
            diligenciada: '✅',
            Entregado: '✅',
            diferida: '⚠️'
        };
        return icons[estado] || '📋';
    },

    // Get activity action text
    getActivityAction(notif) {
        if (notif.estado === 'diligenciada' || notif.estado === 'Entregado') {
            return `<strong>${notif.destinatario_nombre || notif.destinatario_especial}</strong> fue diligenciada`;
        } else if (notif.estado === 'diferida') {
            return `Carga diferida para <strong>${notif.destinatario_nombre}</strong>`;
        }
        return `Nueva notificación para <strong>${notif.destinatario_nombre}</strong>`;
    },

    // Load ujier performance
    async loadUjierPerformance() {
        const container = document.getElementById('ujier-performance');
        if (!container) return;

        const performance = await db.getUjierPerformance();

        if (!performance || performance.length === 0) {
            container.innerHTML = `
                <div class="ujier-item">
                    <div class="ujier-info">
                        <span class="ujier-name">Sin datos de rendimiento</span>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = performance.map(ujier => `
            <div class="ujier-item stagger-item">
                <div class="ujier-avatar">
                    ${ujier.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div class="ujier-info">
                    <span class="ujier-name">${ujier.nombre}</span>
                    <span class="ujier-stats">${ujier.completed} de ${ujier.total} completadas</span>
                </div>
                <div class="ujier-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${ujier.percentage}%"></div>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${ujier.percentage}%</span>
                </div>
            </div>
        `).join('');
    },

    // Truncate label for chart
    truncateLabel(label, maxLength) {
        if (!label) return '';
        if (label.length <= maxLength) return label;
        return label.substring(0, maxLength) + '...';
    },

    // Refresh dashboard
    async refresh() {
        await this.loadStats();
        await this.initCharts();
        await this.loadRecentActivity();
        await this.loadUjierPerformance();
        utils.showToast('Dashboard actualizado', 'success');
    },

    // Open Image Viewer
    openImageViewer(url, caption = '') {
        let modal = document.getElementById('image-viewer-modal');
        if (!modal) {
            const html = `
                <div id="image-viewer-modal" class="image-viewer-modal" onclick="dashboard.closeImageViewer()">
                    <div class="image-viewer-content" onclick="event.stopPropagation()">
                         <button class="image-viewer-close" onclick="dashboard.closeImageViewer()">×</button>
                        <img id="image-viewer-img" class="image-viewer-img" src="" alt="Vista ampliada">
                        <div id="image-viewer-caption" class="image-viewer-caption"></div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            modal = document.getElementById('image-viewer-modal');
        }

        const img = document.getElementById('image-viewer-img');
        const cap = document.getElementById('image-viewer-caption');

        img.src = url;
        cap.textContent = caption;

        // Timeout to ensure display block before opacity transition
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
    },

    closeImageViewer() {
        const modal = document.getElementById('image-viewer-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                const img = document.getElementById('image-viewer-img');
                if (img) img.src = '';
            }, 300);
        }
    }
};

/**
 * Admin Map Module
 */
const adminMap = {
    mapInstance: null,
    mapLayer: null,

    async init() {
        console.log('🗺️ Inicializando Mapa Admin...');

        await this.loadUjieres();

        // Set default date
        const dateInput = document.getElementById('admin-map-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Init Map
        if (!this.mapInstance) {
            const container = document.getElementById('admin-map-container');
            if (container) {
                this.mapInstance = L.map('admin-map-container').setView([-27.4692131, -58.8306349], 12);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(this.mapInstance);
            }
        }

        // Listeners
        // Listeners
        document.getElementById('btn-admin-refresh-map')?.addEventListener('click', () => this.loadMapData());
        document.getElementById('admin-map-date')?.addEventListener('change', () => this.loadMapData());
        document.getElementById('admin-map-ujier-select')?.addEventListener('change', () => this.loadMapData());

        // Fullscreen Listener
        document.getElementById('btn-admin-map-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());

        // Load Initial Data
        this.loadMapData();

        setTimeout(() => {
            if (this.mapInstance) this.mapInstance.invalidateSize();
        }, 300);
    },

    toggleFullscreen() {
        const container = document.getElementById('admin-map-container');
        if (!container) return;

        container.classList.toggle('fullscreen');

        // Force map resize recalculation
        setTimeout(() => {
            if (this.mapInstance) this.mapInstance.invalidateSize();
        }, 100);
    },

    async loadUjieres() {
        const select = document.getElementById('admin-map-ujier-select');
        if (!select) return;

        const { data } = await db.getUjieres();

        select.innerHTML = '<option value="all">📍 Todos los Ujieres</option>';
        if (data) {
            data.forEach(u => {
                select.innerHTML += `<option value="${u.id}">${u.nombre}</option>`;
            });
        }
    },

    async loadMapData() {
        const date = document.getElementById('admin-map-date')?.value;
        const userId = document.getElementById('admin-map-ujier-select')?.value || 'all';

        if (!this.mapInstance) return;

        // Clear previous layers
        if (this.mapLayer) {
            this.mapInstance.removeLayer(this.mapLayer);
            this.mapLayer = null;
        }

        const { data, error } = await db.getUserLocations(userId, date);

        if (error) {
            utils.showToast('Error cargando mapa', 'error');
            return;
        }

        const timelineContainer = document.getElementById('admin-timeline-container');
        if (userId === 'all') {
            timelineContainer.classList.add('hidden'); // Ocultar historial en vista general
        } else {
            timelineContainer.classList.remove('hidden');
        }

        // Stats UI Update
        const visitsCount = data ? data.length : 0;
        document.getElementById('admin-map-stat-visits').textContent = visitsCount;

        const uniqueUjieres = new Set(data.map(d => d.ujier_nombre || 'Desconocido'));
        document.getElementById('admin-map-stat-users').textContent = visitsCount > 0 ? uniqueUjieres.size : 0;

        if (!data || data.length === 0) {
            utils.showToast(userId === 'all' ? 'Sin actividad global registrada' : 'Sin recorrido para este ujier', 'info');
            return;
        }

        // Create Layer Group
        const markers = L.layerGroup();
        const latlngs = [];
        let totalDist = 0;

        // --- VISTA INDIVIDUAL (RECORRIDO DETALLADO) ---
        if (userId !== 'all') {
            const createNumberedIcon = (number, color) => {
                return L.divIcon({
                    className: 'custom-map-icon',
                    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${number}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
            };

            data.forEach((point, index) => {
                if (point.lat && point.lng) {
                    const coord = [parseFloat(point.lat), parseFloat(point.lng)];
                    latlngs.push(coord);

                    const statusColor = this.getStatusColor(point.resultado);

                    const popupContent = `
                        <strong>#${index + 1} ${point.destinatario || 'Sin nombre'}</strong><br>
                        <span style="font-size:0.9em; color:#555;">${point.domicilio}</span><br>
                        <span class="badge" style="background:${statusColor}; color:white; font-size:0.75em; padding:2px 6px; border-radius:4px;">
                            ${(point.resultado || 'PENDIENTE').toUpperCase()}
                        </span>
                        <div style="font-size:0.8em; margin-top:4px; color:#777;">🕒 ${utils.formatTime(point.fecha)}</div>
                        ${point.foto_url ? `<div style="margin-top:6px; width:100%; height:80px; background:url('${point.foto_url}') center/cover no-repeat; border-radius:4px;"></div>` : ''}
                    `;

                    L.marker(coord, { icon: createNumberedIcon(index + 1, statusColor) })
                        .bindPopup(popupContent)
                        .addTo(markers);
                }
            });

            // Dibujar Líneas de Recorrido
            if (latlngs.length > 1) {
                L.polyline(latlngs, { color: '#3b82f6', weight: 4, opacity: 0.7, lineJoin: 'round' }).addTo(markers);

                // Calcular distancia total
                for (let i = 0; i < latlngs.length - 1; i++) {
                    totalDist += this.calculateDistance(latlngs[i][0], latlngs[i][1], latlngs[i + 1][0], latlngs[i + 1][1]);
                }
            }

            // Renderizar Timeline + Distancia
            this.renderTimeline(data, totalDist);

        }
        // --- VISTA GENERAL (MAPA DE CALOR / PINES SIMPLES) ---
        else {
            data.forEach((point) => {
                if (point.lat && point.lng) {
                    const coord = [parseFloat(point.lat), parseFloat(point.lng)];
                    const ujierName = point.ujier_nombre || 'Desconocido';

                    // Color por Resultado (Estado)
                    const color = this.getStatusColor(point.resultado);

                    const popupContent = `
                        <strong>👤 ${ujierName}</strong><br>
                        ${point.destinatario}<br>
                        <span style="font-size:0.85em; color:#555;">${point.domicilio}</span><br>
                        <span class="badge" style="background:${color}; color:white; font-size:0.7em; padding:2px 5px; border-radius:3px;">
                            ${(point.resultado || 'PENDIENTE').toUpperCase()}
                        </span>
                        <br><small>🕒 ${utils.formatTime(point.fecha)}</small>
                    `;

                    // Círculos simples, sin números, sin líneas
                    L.circleMarker(coord, {
                        radius: 6,
                        fillColor: color,
                        color: '#fff',
                        weight: 1,
                        opacity: 0.9,
                        fillOpacity: 0.7
                    }).bindPopup(popupContent).addTo(markers);
                }
            });
        }

        // Add Layer to Map
        this.mapLayer = markers;
        this.mapInstance.addLayer(this.mapLayer);

        // Fit Bounds
        if (data.length > 0) {
            // Create a temporary feature group to get bounds
            const group = new L.featureGroup();
            if (userId === 'all') {
                // For circles, we need to extract coords manually or use markers logic
                data.forEach(p => {
                    if (p.lat && p.lng) group.addLayer(L.marker([p.lat, p.lng]));
                });
            } else {
                latlngs.forEach(ll => group.addLayer(L.marker(ll)));
            }

            if (group.getLayers().length > 0) {
                this.mapInstance.fitBounds(group.getBounds(), { padding: [50, 50] });
            }
        }
    },

    getStatusColor(status) {
        if (!status) return '#6c757d'; // Grey default
        const s = status.toLowerCase().replace(/_/g, ' ').trim();
        if (['atiende', 'entregado', 'positivo'].includes(s)) return '#10b981'; // Green
        if (['no atiende', 'domicilio inexistente', 'negativo', 'rechazado'].includes(s)) return '#ef4444'; // Red
        if (['pre aviso', 'estrados', 'pre_aviso'].includes(s)) return '#f59e0b'; // Orange
        if (['diligenciador ausente', 'ausente'].includes(s)) return '#6b7280'; // Grey
        return '#3b82f6'; // Blue fallback
    },

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    renderTimeline(data, totalDist) {
        const container = document.getElementById('admin-timeline-container');
        if (!container) return;

        let html = `
            <div class="timeline-header-stats" style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <span class="timeline-title">⏱️ Secuencia de Visitas</span>
                <span class="badge badge-primary" style="font-size: 0.85rem;">🏁 Distancia: ${totalDist.toFixed(2)} km</span>
            </div>
            <div class="timeline-steps">
        `;

        data.forEach((point, index) => {
            const color = this.getStatusColor(point.resultado);
            html += `
                <div class="timeline-step">
                    <div class="step-marker" style="background:${color}; font-size: 11px;">${index + 1}</div>
                    <div class="step-content">
                        <div class="step-header">
                            <span class="step-time">${utils.formatTime(point.fecha)}</span>
                            <span class="step-status" style="color:${color}">${(point.resultado || '').toUpperCase().replace(/_/g, ' ')}</span>
                        </div>
                        <div class="step-address">${point.domicilio}</div>
                        <div style="font-size:0.8rem; margin-top:2px; color: var(--text-muted);">👤 ${point.destinatario}</div>
                    </div>
                </div>
             `;
        });
        html += '</div>';
        container.innerHTML = html;
    }
};

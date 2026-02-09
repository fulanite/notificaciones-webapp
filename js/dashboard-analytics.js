/**
 * Dashboard Analytics Enhancement
 * Handles all dashboard statistics and charts with year filtering
 */

const dashboardAnalytics = {
    currentYear: 2026,
    charts: {},

    async init() {
        console.log('🚀 Initializing Dashboard Analytics...');

        // Set up event listeners
        this.setupEventListeners();

        // Load initial data
        await this.loadAllData();
    },

    setupEventListeners() {
        // Year tab switching
        document.querySelectorAll('.year-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const year = parseInt(e.target.dataset.year);
                this.switchYear(year);
            });

            // Hover effects
            btn.addEventListener('mouseenter', (e) => {
                if (!e.target.classList.contains('active')) {
                    e.target.style.background = 'rgba(255,255,255,0.3)';
                }
            });
            btn.addEventListener('mouseleave', (e) => {
                if (!e.target.classList.contains('active')) {
                    e.target.style.background = 'rgba(255,255,255,0.2)';
                }
            });
        });

        // Refresh button
        const refreshBtn = document.getElementById('btn-refresh-dashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
            refreshBtn.addEventListener('mouseenter', (e) => {
                e.target.style.background = 'rgba(255,255,255,0.3)';
                e.target.style.transform = 'scale(1.05)';
            });
            refreshBtn.addEventListener('mouseleave', (e) => {
                e.target.style.background = 'rgba(255,255,255,0.2)';
                e.target.style.transform = 'scale(1)';
            });
        }
    },

    async switchYear(year) {
        this.currentYear = year;

        // Update tab styles
        document.querySelectorAll('.year-tab-btn').forEach(btn => {
            const isActive = parseInt(btn.dataset.year) === year;
            btn.classList.toggle('active', isActive);
            btn.style.background = isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.2)';
            btn.style.color = isActive ? '#667eea' : 'white';
            btn.style.boxShadow = isActive ? '0 2px 8px rgba(0,0,0,0.1)' : 'none';
        });

        // Update year label
        const yearLabel = document.getElementById('stat-year-label');
        if (yearLabel) yearLabel.textContent = year;

        // Reload all data
        await this.loadAllData();
    },

    async refresh() {
        const btn = document.getElementById('btn-refresh-dashboard');
        if (btn) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span style="font-size: 1.2em; animation: spin 1s linear infinite;">🔄</span> Actualizando...';
            btn.disabled = true;
        }

        await this.loadAllData();

        if (btn) {
            btn.innerHTML = '<span style="font-size: 1.2em;">✅</span> Actualizado';
            setTimeout(() => {
                btn.innerHTML = '<span style="font-size: 1.2em;">🔄</span> Actualizar';
                btn.disabled = false;
            }, 1500);
        }

        showToast('Dashboard actualizado', 'success');
    },

    async loadAllData() {
        try {
            await Promise.all([
                this.loadGeneralStats(),
                this.loadByType(),
                this.loadByResult(),
                this.loadByOrigin(),
                this.loadByZone(),
                this.loadByUjier(),
                this.loadByWeekday(),
                this.loadByHourVisits(),
                this.loadByHourLoads(),
                this.loadTemporal()
            ]);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showToast('Error al cargar datos del dashboard', 'error');
        }
    },

    async loadGeneralStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/stats.php?type=general&year=${this.currentYear}`);
            const data = await response.json();

            if (data.success && data.data) {
                const stats = data.data;
                document.getElementById('stat-total').textContent = stats.total || 0;
                document.getElementById('stat-pending').textContent = stats.pendientes || 0;
                document.getElementById('stat-completed').textContent = stats.diligenciadas || 0;
                document.getElementById('stat-deferred').textContent = stats.diferidas || 0;

                // Update percentages
                const total = stats.total || 1;
                document.getElementById('stat-pending-percent').textContent =
                    `${((stats.pendientes / total) * 100).toFixed(1)}%`;
                document.getElementById('stat-completed-percent').textContent =
                    `${parseFloat(stats.tasa_diligenciamiento || 0).toFixed(1)}%`;
                document.getElementById('stat-deferred-percent').textContent =
                    `${((stats.diferidas / total) * 100).toFixed(1)}%`;

                // Alert if deferred > 5%
                const deferredPercent = (stats.diferidas / total) * 100;
                const deferredCard = document.getElementById('stat-deferred').closest('.stat-card');
                if (deferredPercent > 5) {
                    deferredCard.style.borderLeft = '4px solid #ef4444';
                } else {
                    deferredCard.style.borderLeft = '';
                }
            }
        } catch (error) {
            console.error('Error loading general stats:', error);
        }
    },

    async loadByType() {
        try {
            const response = await fetch(`${API_BASE_URL}/stats.php?type=by_type&year=${this.currentYear}`);
            const data = await response.json();

            if (data.success && data.data) {
                this.renderBarChart('chart-by-type', data.data, 'type', 'count', 'Notificaciones por Tipo');
            }
        } catch (error) {
            console.error('Error loading by type:', error);
        }
    },

    async loadByResult() {
        try {
            const response = await fetch(`${API_BASE_URL}/stats.php?type=by_result&year=${this.currentYear}`);
            const data = await response.json();

            if (data.success && data.data) {
                this.renderDoughnutChart('chart-results', data.data, 'result', 'count', 'Resultados de Diligencias');
            }
        } catch (error) {
            console.error('Error loading by result:', error);
        }
    },

    async loadByOrigin() {
        try {
            const response = await fetch(`${API_BASE_URL}/stats.php?type=by_origin&year=${this.currentYear}`);
            const data = await response.json();

            if (data.success && data.data) {
                this.renderHorizontalBarChart('chart-by-origin', data.data, 'origin', 'count', 'Por Origen');
            }
        } catch (error) {
            console.error('Error loading by origin:', error);
        }
    },

    async loadByZone() {
        try {
            const response = await fetch(`${API_BASE_URL}/stats.php?type=by_zone&year=${this.currentYear}`);
            const data = await response.json();

            if (data.success && data.data) {
                this.renderZoneChart('chart-by-zone', data.data);
            }
        } catch (error) {
            console.error('Error loading by zone:', error);
        }
    },

    async loadByUjier() {
        try {
            const response = await fetch(`${API_BASE_URL}/stats.php?type=by_ujier&year=${this.currentYear}`);
            const data = await response.json();

            if (data.success && data.data) {
                this.renderUjierPerformance(data.data);
            }
        } catch (error) {
            console.error('Error loading by ujier:', error);
        }
    },

    async loadByWeekday() {
        try {
            const response = await fetch(`${API_BASE_URL}/stats.php?type=by_weekday&year=${this.currentYear}`);
            const data = await response.json();

            if (data.success && data.data) {
                this.renderBarChart('chart-by-weekday', data.data, 'day', 'count', 'Por Día de Semana');
            }
        } catch (error) {
            console.error('Error loading by weekday:', error);
        }
    },

    async loadByHourVisits() {
        try {
            const response = await fetch(`${API_BASE_URL}/stats.php?type=by_hour_visits&year=${this.currentYear}`);
            const data = await response.json();

            if (data.success && data.data) {
                // Fill missing hours with 0
                const hourData = Array.from({ length: 24 }, (_, i) => ({
                    hour: i,
                    count: 0
                }));

                data.data.forEach(item => {
                    hourData[item.hour].count = item.count;
                });

                this.renderHourChart('chart-by-hour-visits', hourData, 'Visitas de Ujieres');
            }
        } catch (error) {
            console.error('Error loading by hour visits:', error);
        }
    },

    async loadByHourLoads() {
        try {
            const response = await fetch(`${API_BASE_URL}/stats.php?type=by_hour_loads&year=${this.currentYear}`);
            const data = await response.json();

            if (data.success && data.data) {
                // Fill missing hours with 0
                const hourData = Array.from({ length: 24 }, (_, i) => ({
                    hour: i,
                    count: 0
                }));

                data.data.forEach(item => {
                    hourData[item.hour].count = item.count;
                });

                this.renderHourChart('chart-by-hour-loads', hourData, 'Carga Administrativa');
            }
        } catch (error) {
            console.error('Error loading by hour loads:', error);
        }
    },

    async loadTemporal() {
        try {
            const response = await fetch(`${API_BASE_URL}/stats.php?type=temporal&year=${this.currentYear}&days=30`);
            const data = await response.json();

            if (data.success && data.data) {
                this.renderTemporalChart('chart-temporal', data.data);
            }
        } catch (error) {
            console.error('Error loading temporal:', error);
        }
    },

    // Chart rendering functions
    renderBarChart(canvasId, data, labelKey, valueKey, title) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.map(item => item[labelKey]),
                datasets: [{
                    label: title,
                    data: data.map(item => item[valueKey]),
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.parsed.y} notificaciones`
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    },

    renderHorizontalBarChart(canvasId, data, labelKey, valueKey, title) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.map(item => item[labelKey]),
                datasets: [{
                    label: title,
                    data: data.map(item => item[valueKey]),
                    backgroundColor: 'rgba(118, 75, 162, 0.8)',
                    borderColor: 'rgba(118, 75, 162, 1)',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.parsed.x} (${data[context.dataIndex].percentage}%)`
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true }
                }
            }
        });
    },

    renderDoughnutChart(canvasId, data, labelKey, valueKey, title) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const colors = [
            '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
            '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
        ];

        this.charts[canvasId] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: data.map(item => item[labelKey]),
                datasets: [{
                    data: data.map(item => item[valueKey]),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const percentage = data[context.dataIndex].percentage || 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    renderZoneChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.map(item => item.zone),
                datasets: [
                    {
                        label: 'Total',
                        data: data.map(item => item.total),
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderRadius: 6
                    },
                    {
                        label: 'Diligenciadas',
                        data: data.map(item => item.diligenciadas),
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            afterLabel: (context) => {
                                const efectividad = data[context.dataIndex].efectividad || 0;
                                return `Efectividad: ${efectividad}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    },

    renderHourChart(canvasId, data, title = 'Actividad por Hora') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        // Color gradient based on count
        const maxCount = Math.max(...data.map(d => d.count));
        const colors = data.map(d => {
            const intensity = d.count / maxCount;
            if (intensity > 0.7) return 'rgba(239, 68, 68, 0.8)'; // Red
            if (intensity > 0.4) return 'rgba(245, 158, 11, 0.8)'; // Orange
            return 'rgba(16, 185, 129, 0.8)'; // Green
        });

        this.charts[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.map(item => `${item.hour}:00`),
                datasets: [{
                    label: title,
                    data: data.map(item => item.count),
                    backgroundColor: colors,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    },

    renderTemporalChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: data.map(item => {
                    const date = new Date(item.date);
                    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                }),
                datasets: [
                    {
                        label: 'Creadas',
                        data: data.map(item => item.created),
                        borderColor: 'rgba(59, 130, 246, 1)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Diligenciadas',
                        data: data.map(item => item.completed),
                        borderColor: 'rgba(16, 185, 129, 1)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    },

    renderUjierPerformance(data) {
        const container = document.getElementById('ujier-performance');
        if (!container) return;

        // Show ALL ujieres, not just top 5
        container.innerHTML = data.map((ujier, index) => `
            <div style="padding: 12px; margin-bottom: 10px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-radius: 8px; border-left: 4px solid ${index === 0 ? '#10b981' : '#667eea'};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: #1f2937;">${ujier.nombre}</strong>
                    <span style="background: ${index === 0 ? '#10b981' : '#667eea'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">${ujier.percentage}%</span>
                </div>
                <div style="display: flex; gap: 20px; font-size: 0.9em; color: #6b7280;">
                    <span>Total: <strong>${ujier.total}</strong></span>
                    <span>Completadas: <strong style="color: #10b981;">${ujier.completed}</strong></span>
                </div>
                <div style="margin-top: 8px; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                    <div style="width: ${ujier.percentage}%; height: 100%; background: linear-gradient(90deg, #10b981, #059669); transition: width 0.5s;"></div>
                </div>
            </div>
        `).join('');
    }
};

// Initialize when dashboard view is shown
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for UI patch to apply
    setTimeout(() => {
        if (document.getElementById('view-dashboard-home')) {
            dashboardAnalytics.init();
        }
    }, 500);
});

// Add CSS for spin animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

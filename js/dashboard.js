/**
 * SGND - Dashboard Module
 */

const dashboard = {
    charts: {},

    // Initialize dashboard
    async init() {
        await this.loadStats();
        await this.initCharts();
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
            diferida: '⚠️'
        };
        return icons[estado] || '📋';
    },

    // Get activity action text
    getActivityAction(notif) {
        if (notif.estado === 'diligenciada') {
            return `<strong>${notif.destinatario_nombre}</strong> fue diligenciada`;
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
    }
};

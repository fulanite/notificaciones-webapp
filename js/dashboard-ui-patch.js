/**
 * Dashboard Enhancement Patch
 * Adds year tabs, refresh button, and new chart containers
 */

(function () {
    'use strict';

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboardEnhancements);
    } else {
        initDashboardEnhancements();
    }

    function initDashboardEnhancements() {
        const dashboardView = document.getElementById('view-dashboard-home');
        if (!dashboardView) return;

        // Add dashboard header with year tabs and refresh button
        const statsGrid = dashboardView.querySelector('.stats-grid');
        if (!statsGrid) return;

        const headerHTML = `
            <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 15px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                <div class="year-tabs" style="display: flex; gap: 10px;">
                    <button class="year-tab-btn active" data-year="2026" style="padding: 10px 24px; border: none; border-radius: 8px; background: rgba(255,255,255,0.95); color: #667eea; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">2026</button>
                    <button class="year-tab-btn" data-year="2025" style="padding: 10px 24px; border: none; border-radius: 8px; background: rgba(255,255,255,0.2); color: white; font-weight: 600; cursor: pointer; transition: all 0.3s;">2025</button>
                </div>
                <button id="btn-refresh-dashboard" class="btn btn-secondary btn-sm" style="padding: 10px 20px; border: 2px solid white; border-radius: 8px; background: rgba(255,255,255,0.2); color: white; font-weight: 600; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2em;">🔄</span> Actualizar
                </button>
            </div>
        `;

        statsGrid.insertAdjacentHTML('beforebegin', headerHTML);

        // Add year label to total stat
        const statTotal = document.getElementById('stat-total');
        if (statTotal) {
            const statContent = statTotal.closest('.stat-content');
            if (statContent && !document.getElementById('stat-year-label')) {
                statContent.insertAdjacentHTML('beforeend', '<span class="stat-sublabel" id="stat-year-label" style="font-size: 0.75em; color: rgba(255,255,255,0.7); margin-top: 4px;">2026</span>');
            }
        }

        // Add percentage labels to other stats
        addPercentageLabel('stat-pending', 'stat-pending-percent');
        addPercentageLabel('stat-completed', 'stat-completed-percent');
        addPercentageLabel('stat-deferred', 'stat-deferred-percent');

        // Add new chart containers
        addNewChartContainers();

        console.log('✅ Dashboard UI enhancements applied');
    }

    function addPercentageLabel(statId, labelId) {
        const stat = document.getElementById(statId);
        if (stat) {
            const statContent = stat.closest('.stat-content');
            if (statContent && !document.getElementById(labelId)) {
                statContent.insertAdjacentHTML('beforeend', `<span class="stat-sublabel" id="${labelId}" style="font-size: 0.85em; color: rgba(255,255,255,0.8); margin-top: 4px;">0%</span>`);
            }
        }
    }

    function addNewChartContainers() {
        const dashboardGrid = document.querySelector('.dashboard-grid');
        if (!dashboardGrid) return;

        // Clear old chart period filter
        const chartPeriod = document.getElementById('chart-period');
        if (chartPeriod) chartPeriod.remove();

        // Add new chart containers
        const newChartsHTML = `
            <div class="dashboard-card chart-card">
                <div class="card-header">
                    <h3 class="card-title">📅 Por Día de Semana</h3>
                </div>
                <div class="card-body">
                    <canvas id="chart-by-weekday"></canvas>
                </div>
            </div>
            
            <div class="dashboard-card chart-card">
                <div class="card-header">
                    <h3 class="card-title">⏰ Horas de Visitas (Ujieres)</h3>
                </div>
                <div class="card-body">
                    <canvas id="chart-by-hour-visits"></canvas>
                </div>
            </div>
            
            <div class="dashboard-card chart-card">
                <div class="card-header">
                    <h3 class="card-title">📥 Horas de Carga (Administrativos)</h3>
                </div>
                <div class="card-body">
                    <canvas id="chart-by-hour-loads"></canvas>
                </div>
            </div>
            
            <div class="dashboard-card chart-card">
                <div class="card-header">
                    <h3 class="card-title">🏛️ Por Origen</h3>
                </div>
                <div class="card-body">
                    <canvas id="chart-by-origin"></canvas>
                </div>
            </div>
            
            <div class="dashboard-card chart-card">
                <div class="card-header">
                    <h3 class="card-title">🗺️ Por Zona</h3>
                </div>
                <div class="card-body">
                    <canvas id="chart-by-zone"></canvas>
                </div>
            </div>
            
            <div class="dashboard-card chart-card" style="grid-column: 1 / -1;">
                <div class="card-header">
                    <h3 class="card-title">📈 Evolución Temporal (Últimos 30 días)</h3>
                </div>
                <div class="card-body">
                    <canvas id="chart-temporal"></canvas>
                </div>
            </div>
        `;

        dashboardGrid.insertAdjacentHTML('beforeend', newChartsHTML);
    }

})();

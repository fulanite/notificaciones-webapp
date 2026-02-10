/**
 * SGND - Ujier Module (Bailiff View)
 */

const ujier = {
    assignments: [],
    savedOrder: [],
    selectedCardId: null,
    currentAssignment: null,
    mediaRecorder: null,
    audioChunks: [],
    reorderMode: false,
    historyData: [], // Almacenar historial completo para filtrado local
    selectedHistoryYear: 2026,

    // Initialize ujier view
    async init() {
        this.updateDateDisplay();
        this.setupViewToggle();
        this.setupHistoryFilters();
        this.loadSavedOrder(); // Cargar orden antes de las asignaciones
        await this.loadAssignments();
        this.loadHistory(); // Cargar historial en segundo plano
        this.setupDiligenciaForm();
    },

    // Update current date display
    updateDateDisplay() {
        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            dateEl.textContent = utils.getTodayFormatted();
        }
    },

    // Setup view toggle (list/map)
    setupViewToggle() {
        const toggleBtns = document.querySelectorAll('.toggle-btn[data-view-mode]');
        const listView = document.getElementById('assignments-list');
        const mapView = document.getElementById('assignments-map');

        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.viewMode;

                toggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (mode === 'list') {
                    listView?.classList.remove('hidden');
                    mapView?.classList.add('hidden');
                } else {
                    listView?.classList.add('hidden');
                    mapView?.classList.remove('hidden');
                    this.initMap();
                }
            });
        });

        // Toggle reorder mode
        document.getElementById('btn-reorder-toggle')?.addEventListener('click', () => {
            this.toggleReorderMode();
        });

        // Refresh assignments
        document.getElementById('btn-refresh-assignments')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.classList.add('spinning');
            await this.loadAssignments();
            setTimeout(() => btn.classList.remove('spinning'), 600);
            utils.showToast('Ruta actualizada', 'info');
        });
    },

    toggleReorderMode() {
        this.reorderMode = !this.reorderMode;
        const btn = document.getElementById('btn-reorder-toggle');
        if (btn) {
            btn.innerHTML = this.reorderMode ? '✅ Listo' : '🔃 Reordenar';
            btn.classList.toggle('active', this.reorderMode);
        }
        this.renderAssignments();
    },

    // Setup history filters
    setupHistoryFilters() {
        const searchInput = document.getElementById('search-historial');
        const dateInput = document.getElementById('filter-historial-fecha');
        const statusSelect = document.getElementById('filter-historial-estado');

        searchInput?.addEventListener('input', () => this.filterHistory());
        dateInput?.addEventListener('change', () => this.filterHistory());
        statusSelect?.addEventListener('change', () => this.filterHistory());
    },

    // Get normalized status for filtering and rendering
    getNormalizedStatus(resultado) {
        let status = (resultado || '').toLowerCase();

        // Handle values with underscores or spaces
        if (status === 'no_atiende' || status.includes('no atiende')) return 'no_atiende';
        if (status === 'atiende' || status.includes('entregado') || (status.includes('atiende') && !status.includes('no'))) return 'atiende';
        if (utils.isPreAviso(status) || status === 'pendiente') return 'pre_aviso';
        if (status === 'estrados' || status.includes('estrados')) return 'estrados';
        if (status.includes('inexistente')) return 'domicilio_inexistente';
        if (status.includes('ausente')) return 'diligenciador_ausente';

        return status.replace(/\s+/g, '_');
    },

    // Filter history local data
    filterHistory() {
        const query = document.getElementById('search-historial')?.value.toLowerCase() || '';
        const filterDate = document.getElementById('filter-historial-fecha')?.value || '';
        const filterStatus = document.getElementById('filter-historial-estado')?.value || '';

        const filterYear = this.selectedHistoryYear;

        const filtered = this.historyData.filter(visit => {
            // Filter by year
            const visitDateStr = visit.fecha ? visit.fecha.split(' ')[0] : '';
            const visitYear = visitDateStr ? parseInt(visitDateStr.split('-')[0]) : null;
            if (visitYear !== filterYear) return false;

            // Filter by date (YYYY-MM-DD)
            const matchesDate = !filterDate || visitDateStr === filterDate;

            // Filter by status
            const normalizedStatus = this.getNormalizedStatus(visit.resultado);
            const matchesStatus = !filterStatus || normalizedStatus === filterStatus;

            // Filter by search query - expanded to all fields
            const searchTargets = [
                visit.notificacion_id,
                visit.destinatario_nombre,
                visit.domicilio,
                visit.tipo_notificacion,
                visit.resultado,
                visit.caratula,
                visit.n_expediente,
                visit.zona,
                visit.observaciones
            ].map(v => (v || '').toLowerCase());

            const matchesSearch = !query || searchTargets.some(t => t.includes(query));

            return matchesDate && matchesStatus && matchesSearch;
        });

        this.renderHistory(filtered);
    },

    // Switch history year tab
    switchHistoryYear(year, btn) {
        this.selectedHistoryYear = year;

        // Update active tab UI
        const parent = btn.parentElement;
        parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Apply filtering (data is already loaded, we just filter it)
        this.filterHistory();
    },

    // Load user's assignments
    async loadAssignments() {
        if (!auth.currentUser) return;

        const listContainer = document.getElementById('assignments-list');
        if (!listContainer) return;

        // Show loading
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="spinner"></div>
                <p style="margin-top: 16px; color: var(--text-muted);">Cargando asignaciones...</p>
            </div>
        `;

        const { data, error } = await db.getMyAssignments(auth.currentUser.id, { year: 2026 });

        if (error) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--error);">
                    Error al cargar asignaciones
                </div>
            `;
            return;
        }

        this.assignments = data || [];

        // Aplicar orden guardado
        this.applySavedOrder();

        this.renderAssignments();
        this.setupDragDrop();
        await this.updateStats();
    },

    // Render assignments list
    renderAssignments() {
        const listContainer = document.getElementById('assignments-list');
        if (!listContainer) return;

        if (this.assignments.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 60px;">
                    <div style="font-size: 4rem; margin-bottom: 16px;">🎉</div>
                    <h3 style="margin-bottom: 8px;">¡Sin tareas pendientes!</h3>
                    <p style="color: var(--text-muted);">No tienes notificaciones asignadas por el momento.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = this.assignments.map((assignment, index) => {
            const isSelected = this.selectedCardId === assignment.id;
            const isPreAviso = utils.isPreAviso(assignment.estado) || utils.isPreAviso(assignment.resultado_diligencia);
            const isSpecial = utils.isSpecialDestination(assignment.destinatario_especial);

            return `
            <div class="assignment-card stagger-item ${isSelected ? 'selected' : ''}" 
                 data-id="${assignment.id}" 
                 onclick="ujier.reorderMode ? '' : ujier.openDiligencia('${assignment.id}')">
                
                ${this.reorderMode ? `
                <div class="reorder-controls-vertical" onclick="event.stopPropagation()">
                    <button class="reorder-btn-mini" onclick="ujier.moveAssignment(${index}, -1)" ${index === 0 ? 'disabled' : ''}>▲</button>
                    <button class="reorder-btn-mini" onclick="ujier.moveAssignment(${index}, 1)" ${index === this.assignments.length - 1 ? 'disabled' : ''}>▼</button>
                </div>
                ` : `<div class="assignment-number ${isPreAviso ? 'is-pre-aviso' : ''}">${index + 1}</div>`}

                <div class="assignment-info" style="gap: 8px;">
                    <div class="assignment-header-row" style="margin-bottom: 4px;">
                        ${assignment.zona ? `<span class="assignment-zona" style="font-size: 0.85rem; padding: 2px 8px;">${assignment.zona}</span>` : ''}
                        ${isSpecial ? '<span class="badge-special" style="font-size: 0.8rem;">⭐ Especial</span>' : ''}
                        ${assignment.devuelta_por_ujier ? '<span class="badge-returned" style="background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:bold; margin-left:auto;">📦 DEVUELTA</span>' : ''}
                    </div>
                    
                    <div class="assignment-address" style="font-size: 1.3rem; line-height: 1.3; font-weight: 700; color: var(--primary);">
                        🏠 ${assignment.domicilio || '-'}
                    </div>
                    
                    <div class="assignment-recipient" style="font-size: 1.05rem; line-height: 1.2; color: var(--text-muted); margin-top: 2px;">
                        👤 <strong>${assignment.destinatario_nombre || utils.getSpecialDestinationText(assignment) || '-'}</strong>
                    </div>
                    
                    ${assignment.caratula ? `<div class="assignment-caratula" style="font-size: 0.85rem; margin-top: 4px; color: var(--text-muted);">📄 ${assignment.caratula}</div>` : ''}
                </div>
                
                ${this.reorderMode ? `
                    <div class="reorder-position-badge">ORDEN: ${index + 1}</div>
                ` : `
                    <div class="assignment-actions-quick" onclick="event.stopPropagation()">
                        ${isSpecial ? `
                        <button class="btn-quick-deliver" onclick="ujier.quickDeliver('${assignment.id}')" title="Entrega rápida">
                            ⚡
                        </button>
                        ` : `<div class="assignment-arrow" style="font-size: 1.8rem; color: var(--primary);">›</div>`}
                    </div>
                `}
            </div>
            `;
        }).join('');

        // Limpiar selección después de renderizar (opcional)
        // this.selectedCardId = null;
    },

    // Quick delivery for special recipients
    async quickDeliver(id) {
        const assignment = this.assignments.find(a => a.id === id);
        if (!assignment) return;

        const recipientName = assignment.destinatario_nombre || utils.getSpecialDestinationText(assignment) || 'el destinatario';
        const confirmMsg = `¿Confirmar entrega rápida a ${recipientName}?`;
        if (!confirm(confirmMsg)) return;

        utils.showLoading('Procesando entrega rápida...');

        try {
            let lat = null;
            let lng = null;

            // Try to get GPS but don't block forever
            try {
                const pos = await utils.getGPSPosition();
                lat = pos.lat;
                lng = pos.lng;
            } catch (e) {
                console.warn('No se pudo obtener GPS para entrega rápida:', e);
            }

            const resultData = {
                resultado: 'entregado', // 'entregado' is the preferred value for successful delivery
                ubicacion_lat: lat,
                ubicacion_lng: lng,
                es_carga_diferida: false,
                observaciones: 'ENTREGA RÁPIDA (DESTINATARIO ESPECIAL)'
            };

            const { error } = await db.registerResult(
                id,
                resultData,
                auth.currentUser?.id
            );

            if (error) throw error;

            // Optimistic UI: remove from local list immediately
            this.assignments = this.assignments.filter(a => a.id !== id);
            this.renderAssignments();
            await this.updateStats();

            utils.showToast(`Entregada: ${assignment.destinatario_nombre}`, 'success');

            // Refresh with small delay to ensure server consistency
            setTimeout(() => this.loadAssignments(), 500);

        } catch (error) {
            console.error('Error en quickDeliver:', error);
            utils.showToast('Error al entregar: ' + error.message, 'error');
        } finally {
            utils.hideLoading();
        }
    },

    // Move assignment in the list
    moveAssignment(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.assignments.length) return;

        // Guardar ID de la tarjeta que estamos moviendo para resaltarla
        this.selectedCardId = this.assignments[index].id;

        // Swapping elements
        const temp = this.assignments[index];
        this.assignments[index] = this.assignments[newIndex];
        this.assignments[newIndex] = temp;

        // Re-render and save
        this.renderAssignments();
        this.saveOrder();

        // Scroll a la tarjeta seleccionada
        setTimeout(() => {
            const selectedCard = document.querySelector(`.assignment-card[data-id="${this.selectedCardId}"]`);
            selectedCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    },

    // Setup (keeping for compatibility, but simplified)
    setupDragDrop() {
        // Now using button controls, no listeners needed here
    },

    // Cargar orden guardado de localStorage
    loadSavedOrder() {
        try {
            const userId = auth.currentUser?.id;
            if (!userId) return;

            const saved = localStorage.getItem(`ujier_order_${userId}`);
            if (saved) {
                this.savedOrder = JSON.parse(saved);
            }
        } catch (e) {
            console.log('Error cargando orden guardado:', e);
        }
    },

    // Aplicar orden guardado a los assignments
    applySavedOrder() {
        if (!this.savedOrder || !this.savedOrder.length || !this.assignments || !this.assignments.length) return;

        // Crear mapa de IDs a assignments
        const assignmentMap = new Map();
        this.assignments.forEach(a => assignmentMap.set(a.id, a));

        // Reordenar según el orden guardado
        const reordered = [];
        const remaining = new Set(this.assignments.map(a => a.id));

        this.savedOrder.forEach(id => {
            if (assignmentMap.has(id)) {
                reordered.push(assignmentMap.get(id));
                remaining.delete(id);
            }
        });

        // Agregar los nuevos que no estaban en el orden guardado al final
        remaining.forEach(id => {
            reordered.push(assignmentMap.get(id));
        });

        this.assignments = reordered;
    },

    // Guardar orden actual en localStorage
    saveOrder() {
        try {
            const userId = auth.currentUser?.id;
            if (!userId) return;

            const listContainer = document.getElementById('assignments-list');
            const cards = listContainer.querySelectorAll('.assignment-card');

            const order = Array.from(cards).map(card => card.dataset.id);
            localStorage.setItem(`ujier_order_${userId}`, JSON.stringify(order));

            // También actualizar el array interno
            const assignmentMap = new Map();
            this.assignments.forEach(a => assignmentMap.set(a.id, a));
            this.assignments = order.map(id => assignmentMap.get(id)).filter(Boolean);

            utils.showToast('Orden guardado', 'success');
        } catch (e) {
            console.log('Error guardando orden:', e);
        }
    },

    // Actualizar números de las tarjetas después de reordenar
    updateAssignmentNumbers() {
        const listContainer = document.getElementById('assignments-list');
        const cards = listContainer.querySelectorAll('.assignment-card');

        cards.forEach((card, index) => {
            const numberEl = card.querySelector('.assignment-number');
            if (numberEl) {
                numberEl.textContent = index + 1;
            }
        });
    },

    // Update stats display
    async updateStats() {
        const pendingEl = document.getElementById('route-pending');
        const completedEl = document.getElementById('route-completed');
        const myPendingBadge = document.getElementById('my-pending-count');

        const pending = this.assignments.length;

        if (pendingEl) pendingEl.textContent = pending;
        if (myPendingBadge) myPendingBadge.textContent = pending;

        // Fetch completed count (total history)
        if (completedEl && auth.currentUser) {
            const { data } = await db.getUserVisits(auth.currentUser.id);
            if (data) {
                completedEl.textContent = data.length;
            }
        }
    },

    // Initialize map (placeholder)
    initMap() {
        const mapContainer = document.getElementById('map-container');
        if (!mapContainer) return;

        // Placeholder - would integrate with Google Maps or Leaflet
        mapContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <div style="font-size: 4rem; margin-bottom: 16px;">🗺️</div>
                <h3 style="margin-bottom: 8px;">Vista de Mapa</h3>
                <p style="color: var(--text-muted);">Integración con mapas próximamente</p>
            </div>
        `;
    },

    // Open diligencia modal
    async openDiligencia(id) {
        let assignment = this.assignments.find(a => a.id === id);

        if (!assignment) {
            // Check if it's cached in history? Or just fetch it
            utils.showLoading('Cargando datos...');
            const { data, error } = await db.getNotificationById(id);
            utils.hideLoading();

            if (error || !data) {
                utils.showToast('No se encontró la notificación', 'error');
                return;
            }
            assignment = data;
        }

        this.currentAssignment = assignment;

        // Update modal content
        const modal = document.getElementById('modal-diligenciar');
        const summary = document.getElementById('notif-summary');
        const idInput = document.getElementById('diligencia-id');

        if (idInput) idInput.value = id;

        if (summary) {
            // Obtener tipo con fallback
            const tipoLabel = CONFIG.NOTIFICATION_TYPES?.[assignment.tipo_notificacion] || assignment.tipo_notificacion || 'Sin tipo';

            summary.innerHTML = `
                <div class="notif-summary-card">
                    <div class="summary-header">
                        <span class="summary-tipo">${tipoLabel}</span>
                        <span class="summary-zona">${assignment.zona || ''}</span>
                        ${assignment.devuelta_por_ujier ? '<span class="badge-returned-summary" style="background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; font-size:0.75rem; padding:4px 8px; border-radius:6px; font-weight:bold;">📦 DEVUELTA</span>' : ''}
                    </div>
                    <div class="summary-body">
                        <div class="summary-row">
                            <span class="summary-label">📋 Expediente:</span>
                            <span class="summary-value">${assignment.n_expediente || '-'}</span>
                        </div>
                        <div class="summary-row">
                            <span class="summary-label">📑 Carátula:</span>
                            <span class="summary-value">${assignment.caratula || '-'}</span>
                        </div>
                        <div class="summary-row">
                            <span class="summary-label">👤 Destinatario:</span>
                            <span class="summary-value"><strong>${assignment.destinatario_nombre || utils.getSpecialDestinationText(assignment) || '-'}</strong></span>
                        </div>
                        <div class="summary-row">
                            <span class="summary-label">🏠 Domicilio:</span>
                            <span class="summary-value">${assignment.domicilio || '-'}</span>
                        </div>
                        ${assignment.origen ? `
                        <div class="summary-row">
                            <span class="summary-label">🏛️ Origen:</span>
                            <span class="summary-value">${assignment.origen}</span>
                        </div>
                        ` : ''}
                        ${assignment.letrado ? `
                        <div class="summary-row">
                            <span class="summary-label">⚖️ Letrado:</span>
                            <span class="summary-value">${assignment.letrado}</span>
                        </div>
                        ` : ''}
                        ${(assignment.tipo_troquel || assignment.n_troquel) ? `
                        <div class="summary-row">
                            <span class="summary-label">🎫 Troquel:</span>
                            <span class="summary-value">${assignment.tipo_troquel || ''} ${assignment.n_troquel || ''}</span>
                        </div>
                        ` : ''}
                        ${assignment.observaciones_iniciales ? `
                        <div class="summary-obs">
                            <span class="summary-label">📝 Observaciones:</span>
                            <p>${assignment.observaciones_iniciales}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div id="visitas-historial-container" class="visitas-historial-compact hidden">
                    <h4 class="visitas-title">⌛ Intentos Anteriores</h4>
                    <div id="visitas-historial-list"></div>
                </div>
            </div>
        `;

            // Cargar historial de visitas para esta notificación
            this.loadVisitasNotificacion(id);
        }

        // Reset form
        this.resetDiligenciaForm();

        // Limit results for special recipients vs particulars
        const resultSelect = document.getElementById('resultado-diligencia');
        if (resultSelect) {
            const isSpecial = utils.isSpecialDestination(assignment.destinatario_especial);

            Array.from(resultSelect.options).forEach(opt => {
                if (opt.value === '') return; // "Seleccionar..."

                if (isSpecial) {
                    // For special recipients: only show "Entregado"
                    if (opt.value === 'entregado') {
                        opt.disabled = false;
                        opt.style.display = 'block';
                    } else {
                        opt.disabled = true;
                        opt.style.display = 'none';
                    }
                } else {
                    // For regular recipients: hide "Entregado", show "Atiende" and the rest
                    if (opt.value === 'entregado') {
                        opt.disabled = true;
                        opt.style.display = 'none';
                    } else {
                        opt.disabled = false;
                        opt.style.display = 'block';
                    }
                }
            });

            // Auto-select entregado if special, otherwise force choice
            resultSelect.value = isSpecial ? 'entregado' : '';
        }

        // BLOCKING LOGIC: If already returned, disable form
        const isReturned = assignment.devuelta_por_ujier == 1;
        // Pre-aviso NO cuenta como completado final, permite registrar nueva visita
        const isPreAviso = utils.isPreAviso(assignment.resultado_diligencia);
        const isCompleted = !!assignment.resultado_diligencia && !isPreAviso;

        const form = document.getElementById('form-diligenciar');
        const submitBtn = form?.querySelector('button[type="submit"]');
        const warningEl = document.getElementById('returned-warning');

        // Reset mode
        this.isUpdateMode = false;
        if (warningEl) warningEl.remove();

        // Re-enable inputs first
        const inputs = form?.querySelectorAll('input, select, textarea, button');
        inputs?.forEach(input => {
            if (!input.classList.contains('reorder-btn-mini')) {
                input.disabled = false;
            }
        });

        if (isReturned) {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '🔒 No editable (Ya devuelta)';
            }
            if (!warningEl) {
                const warning = document.createElement('div');
                warning.id = 'returned-warning';
                warning.className = 'alert alert-error mb-4';
                warning.style = 'background: #fef2f2; border: 1.5px solid #fee2e2; color: #b91c1c; padding: 12px; border-radius: 8px; font-weight: 500; display: flex; align-items: center; gap: 8px;';
                warning.innerHTML = '<span>⚠️</span> Esta notificación ya fue devuelta físicamente. No se pueden registrar más visitas.';
                summary.prepend(warning);
            }
            // Disable all inputs in the form EXCEPT cancel button
            inputs?.forEach(input => {
                if (input.id !== 'btn-cancel-diligencia' && !input.classList.contains('modal-close')) {
                    input.disabled = true;
                }
            });
        } else if (isCompleted) {
            // EDIT MODE
            this.isUpdateMode = true;

            if (submitBtn) {
                submitBtn.innerHTML = '📝 Actualizar Datos (Foto/Obs)';
                submitBtn.classList.remove('btn-primary');
                submitBtn.classList.add('btn-warning');
            }

            // Pre-fill data
            if (resultSelect) {
                resultSelect.value = assignment.resultado_diligencia;
                resultSelect.disabled = true; // No cambiar resultado principal
            }

            // Fill observations
            const obsField = document.getElementById('observaciones-resultado');
            if (obsField) obsField.value = assignment.observaciones_resultado || '';

            // Fill transcription
            const transField = document.getElementById('transcripcion-audio');
            if (transField) {
                transField.value = assignment.transcripcion_audio || '';
                transField.classList.remove('hidden');
            }

            // Hide/Disable GPS and Troquel as they are part of the core result
            document.getElementById('gps-wrapper')?.classList.add('hidden');
            document.querySelector('.troquel-selection')?.parentElement.classList.add('hidden');
            document.getElementById('carga-diferida')?.parentElement.parentElement.classList.add('hidden'); // Hide toggle

            // Show existing photo if any (optional, or just allow adding new)
            if (assignment.evidencia_foto) {
                const previewImg = document.getElementById('preview-img');
                const previewContainer = document.getElementById('photo-preview');
                if (previewImg && previewContainer) {
                    previewImg.src = assignment.evidencia_foto;
                    previewContainer.classList.remove('hidden');
                }
            }

            // Add info alert
            const info = document.createElement('div');
            info.id = 'returned-warning'; // reuse ID for simplified toggle logic
            info.style = 'background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 0.9rem;';
            info.innerHTML = '<strong>Modo Edición:</strong> Podés corregir observaciones, transcripción y foto. El resultado y ubicación no se modificarán.';
            summary.prepend(info);

        } else {
            // NORMAL MODE
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '💾 Guardar Resultado';
                submitBtn.classList.add('btn-primary');
                submitBtn.classList.remove('btn-warning');
            }
            document.querySelector('.troquel-selection')?.parentElement.classList.remove('hidden');
            document.getElementById('carga-diferida')?.parentElement.parentElement.classList.remove('hidden');

            if (isPreAviso) {
                const info = document.createElement('div');
                info.id = 'returned-warning';
                info.style = 'background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 0.9rem;';
                info.innerHTML = '<strong>📝 Seguimiento de Pre-Aviso:</strong> Registrá la nueva visita a continuación. La anterior quedará en el historial.';
                summary.prepend(info);
            }
        }

        // Show modal
        modal?.classList.remove('hidden');
        modal?.classList.add('show');

        // Scroll al inicio del modal
        const modalBody = modal?.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
    },

    // Close diligencia modal
    closeDiligencia() {
        // Stop recording if active
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            try { this.mediaRecorder.stop(); } catch (e) { }
        }

        const modal = document.getElementById('modal-diligenciar');
        modal?.classList.add('hidden');
        modal?.classList.remove('show');
        this.currentAssignment = null;
        this.resetDiligenciaForm();
    },

    // Cargar visitas de una notificación específica
    async loadVisitasNotificacion(notificacionId) {
        const container = document.getElementById('visitas-historial-container');
        const list = document.getElementById('visitas-historial-list');
        if (!list) return;

        const { data, error } = await db.getNotificationVisits(notificacionId);

        if (error || !data || data.length === 0) {
            container?.classList.add('hidden');
            return;
        }

        container?.classList.remove('hidden');
        list.innerHTML = data.map(v => `
            <div class="visita-item-mini">
                <div class="visita-meta">
                    <span class="visita-fecha-mini">${utils.formatDateTime(v.fecha)}</span>
                    <span class="visita-resultado-mini resultado-${v.resultado}">${(v.resultado || '').replace(/_/g, ' ').toUpperCase()}</span>
                </div>
                ${v.observaciones ? `<p class="visita-obs-mini">📝 ${v.observaciones}</p>` : ''}
                ${v.transcripcion_audio ? `<p class="visita-trans-mini">🎤 <em>"${v.transcripcion_audio}"</em></p>` : ''}
                <div class="visita-adjuntos-mini">
                    ${v.foto_url ? `
                    <div class="visita-foto-mini" onclick="ujier.viewFullImage('${v.foto_url}')">
                        <img src="${v.foto_url}" alt="Foto visita" loading="lazy">
                    </div>
                    ` : ''}
                    ${(v.ubicacion_lat && v.ubicacion_lng) ? `
                    <a href="https://www.google.com/maps?q=${v.ubicacion_lat},${v.ubicacion_lng}" target="_blank" class="visita-gps-link">
                        📍 Posición GPS
                    </a>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },

    // Ver imagen a pantalla completa
    viewFullImage(url) {
        const modal = document.getElementById('modal-image-viewer');
        const img = document.getElementById('full-image-display');
        if (img) img.src = url;
        modal?.classList.remove('hidden');
        setTimeout(() => modal?.classList.add('show'), 10);
    },

    // Cerrar visor de imagen
    closeImageViewer() {
        const modal = document.getElementById('modal-image-viewer');
        modal?.classList.remove('show');
        setTimeout(() => modal?.classList.add('hidden'), 300);
    },

    // Reset diligencia form
    resetDiligenciaForm() {
        const form = document.getElementById('form-diligenciar');
        form?.reset();

        // Reset GPS safety checks
        const gpsInfo = document.getElementById('gps-info');
        const btnCapture = document.getElementById('btn-capture-gps');
        const ubicacionLat = document.getElementById('ubicacion-lat');
        const ubicacionLng = document.getElementById('ubicacion-lng');

        if (gpsInfo) gpsInfo.classList.add('hidden');
        if (btnCapture) {
            btnCapture.classList.remove('hidden');
            btnCapture.disabled = false;
            btnCapture.innerHTML = '<span>📍</span> Capturar Ubicación';
        }
        if (ubicacionLat) ubicacionLat.value = '';
        if (ubicacionLng) ubicacionLng.value = '';

        // Reset photo
        const photoPreview = document.getElementById('photo-preview');
        const previewImg = document.getElementById('preview-img');
        const photoInput = document.getElementById('evidencia-foto');
        if (photoPreview) photoPreview.classList.add('hidden');
        if (previewImg) previewImg.src = '';
        if (photoInput) photoInput.value = '';
        this.capturedPhoto = null;

        // Reset audio
        document.getElementById('audio-playback')?.classList.add('hidden');
        document.getElementById('audio-recording')?.classList.add('hidden');
        document.getElementById('transcripcion-audio')?.classList.add('hidden');
        document.getElementById('btn-record-audio')?.classList.remove('hidden');
        this.capturedAudio = null;
        this.audioChunks = [];

        // Reset deferred fields
        document.getElementById('motivo-falla-container')?.classList.add('hidden');
    },

    // Setup diligencia form
    setupDiligenciaForm() {
        // Close modal handlers
        document.getElementById('modal-close')?.addEventListener('click', () => this.closeDiligencia());
        document.getElementById('btn-cancel-diligencia')?.addEventListener('click', () => this.closeDiligencia());
        document.querySelector('.modal-overlay')?.addEventListener('click', () => this.closeDiligencia());

        // Carga diferida toggle
        const cargaDiferidaToggle = document.getElementById('carga-diferida');
        cargaDiferidaToggle?.addEventListener('change', (e) => {
            const motivoContainer = document.getElementById('motivo-falla-container');
            const gpsContainer = document.getElementById('gps-wrapper'); // New wrapper for GPS section

            if (e.target.checked) {
                motivoContainer?.classList.remove('hidden');
                gpsContainer?.classList.add('hidden');
            } else {
                motivoContainer?.classList.add('hidden');
                gpsContainer?.classList.remove('hidden');
            }
        });

        // Troquel Toggles
        const toggleTroquel = (val) => {
            const container = document.getElementById('n-troquel-container');
            const input = document.getElementById('n-troquel-diligencia');
            const hiddenType = document.getElementById('tipo-troquel-diligencia');

            if (val === 'SIN') {
                container?.classList.add('hidden');
                if (input) {
                    input.required = false;
                    input.value = '';
                }
                if (hiddenType) hiddenType.value = '';
            } else {
                container?.classList.remove('hidden');
                if (input) input.required = true;
                if (hiddenType) hiddenType.value = val;
            }
        };

        document.getElementById('radio-troquel-c')?.addEventListener('change', () => toggleTroquel('C'));
        document.getElementById('radio-troquel-m')?.addEventListener('change', () => toggleTroquel('M'));
        document.getElementById('radio-troquel-sin')?.addEventListener('change', () => toggleTroquel('SIN'));

        // GPS capture
        document.getElementById('btn-capture-gps')?.addEventListener('click', () => this.captureGPS());

        // Photo capture
        document.getElementById('evidencia-foto')?.addEventListener('change', (e) => this.handlePhotoCapture(e));
        document.getElementById('btn-remove-photo')?.addEventListener('click', () => this.removePhoto());

        // Audio recording
        document.getElementById('btn-record-audio')?.addEventListener('click', () => this.startAudioRecording());
        document.getElementById('btn-stop-audio')?.addEventListener('click', () => this.stopAudioRecording());

        // Form submission
        document.getElementById('form-diligenciar')?.addEventListener('submit', (e) => this.submitDiligencia(e));
    },

    // GPS Map instance
    gpsMap: null,
    gpsMarker: null,
    gpsCircle: null,
    originalPosition: null,
    MAX_RADIUS: 150, // metros máximo de ajuste

    // Capture GPS
    async captureGPS() {
        const btn = document.getElementById('btn-capture-gps');
        const gpsInfo = document.getElementById('gps-info');

        btn.disabled = true;
        btn.innerHTML = '<div class="btn-spinner"></div> Obteniendo...';

        try {
            const position = await utils.getGPSPosition();

            // Establecer posición
            document.getElementById('ubicacion-lat').value = position.lat;
            document.getElementById('ubicacion-lng').value = position.lng;

            // Mostrar confirmación
            gpsInfo?.classList.remove('hidden');
            btn.classList.add('hidden');

            utils.showToast('Ubicación capturada correctamente', 'success');
        } catch (error) {
            // Handle Permission Denied with Guidance Loop
            if (error.message && error.message.includes('Permiso')) {
                try {
                    // Show help modal and wait for user to click "Retry"
                    await utils.showPermissionHelp('gps');
                    // Recursively retry
                    return this.captureGPS();
                } catch (userCancelled) {
                    utils.showToast('Ubicación requerida. Activación cancelada.', 'warning');
                }
            } else {
                utils.showToast(error.message, 'error');
            }

            // Only reset button if we are NOT retrying (recursion returns early)
            btn.disabled = false;
            btn.innerHTML = '<span>📍</span> Capturar Ubicación';
        }
    },

    // Inicializar mapa GPS con pin arrastrable (mantenido por compatibilidad)
    initGPSMap(lat, lng) {
        const mapElement = document.getElementById('gps-map');
        if (!mapElement) return;

        // Si ya existe un mapa, destruirlo
        if (this.gpsMap) {
            this.gpsMap.remove();
        }

        // Crear mapa centrado en la ubicación
        this.gpsMap = L.map('gps-map', {
            zoomControl: false,
            attributionControl: false
        }).setView([lat, lng], 18);

        // Agregar tiles de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(this.gpsMap);

        // Agregar controles de zoom
        L.control.zoom({ position: 'topright' }).addTo(this.gpsMap);

        // Crear círculo de radio máximo
        this.gpsCircle = L.circle([lat, lng], {
            radius: this.MAX_RADIUS,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '5, 5'
        }).addTo(this.gpsMap);

        // Marcador de ubicación original (fijo)
        const originalIcon = L.divIcon({
            className: 'original-marker-icon',
            html: '<div style="width: 12px; height: 12px; background: #3b82f6; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
        L.marker([lat, lng], { icon: originalIcon }).addTo(this.gpsMap);

        // Marcador arrastrable
        const draggableIcon = L.divIcon({
            className: 'draggable-marker-icon',
            html: '<div style="width: 30px; height: 30px; background: #ef4444; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });

        this.gpsMarker = L.marker([lat, lng], {
            icon: draggableIcon,
            draggable: true
        }).addTo(this.gpsMap);

        // Evento de drag
        this.gpsMarker.on('drag', (e) => {
            this.onMarkerDrag(e.target.getLatLng());
        });

        this.gpsMarker.on('dragend', (e) => {
            this.onMarkerDragEnd(e.target.getLatLng());
        });

        // Botón reset
        document.getElementById('btn-reset-gps')?.addEventListener('click', () => {
            this.resetGPSPosition();
        });

        // Actualizar distancia inicial
        this.updateDistanceDisplay(0);

        // Forzar renderizado
        setTimeout(() => {
            if (this.gpsMap) {
                this.gpsMap.invalidateSize();
            }
        }, 300);
    },

    // Calcular distancia entre dos puntos (Haversine)
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // Radio de la Tierra en metros
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distancia en metros
    },

    // Al arrastrar el marcador
    onMarkerDrag(latlng) {
        const distance = this.calculateDistance(
            this.originalPosition.lat,
            this.originalPosition.lng,
            latlng.lat,
            latlng.lng
        );
        this.updateDistanceDisplay(distance);
    },

    // Al soltar el marcador
    onMarkerDragEnd(latlng) {
        const distance = this.calculateDistance(
            this.originalPosition.lat,
            this.originalPosition.lng,
            latlng.lat,
            latlng.lng
        );

        if (distance > this.MAX_RADIUS) {
            // Calcular punto en el borde del círculo
            const angle = Math.atan2(
                latlng.lng - this.originalPosition.lng,
                latlng.lat - this.originalPosition.lat
            );

            // Convertir metros a grados aproximadamente
            const latOffset = (this.MAX_RADIUS * Math.cos(angle)) / 111320;
            const lngOffset = (this.MAX_RADIUS * Math.sin(angle)) / (111320 * Math.cos(this.originalPosition.lat * Math.PI / 180));

            const newLat = this.originalPosition.lat + latOffset;
            const newLng = this.originalPosition.lng + lngOffset;

            this.gpsMarker.setLatLng([newLat, newLng]);

            document.getElementById('ubicacion-lat').value = newLat;
            document.getElementById('ubicacion-lng').value = newLng;

            this.updateDistanceDisplay(this.MAX_RADIUS);
            utils.showToast('Ubicación ajustada al límite de 150m', 'warning');
        } else {
            document.getElementById('ubicacion-lat').value = latlng.lat;
            document.getElementById('ubicacion-lng').value = latlng.lng;
            this.updateDistanceDisplay(distance);
        }

        // Actualizar coords mostradas
        const lat = parseFloat(document.getElementById('ubicacion-lat').value);
        const lng = parseFloat(document.getElementById('ubicacion-lng').value);
        const coordsEl = document.getElementById('gps-coords');
        if (coordsEl) {
            coordsEl.innerHTML = `<span>LAT: ${lat.toFixed(6)}</span><span>LNG: ${lng.toFixed(6)}</span>`;
        }
    },

    // Actualizar display de distancia
    updateDistanceDisplay(distance) {
        const el = document.getElementById('gps-distance');
        if (!el) return;

        el.textContent = `📏 ${Math.round(distance)}m del punto GPS`;
        el.className = 'gps-distance ' + (distance > 100 ? 'warning' : 'ok');
    },

    // Reset a posición original
    resetGPSPosition() {
        if (!this.originalPosition || !this.gpsMarker) return;

        this.gpsMarker.setLatLng([this.originalPosition.lat, this.originalPosition.lng]);
        document.getElementById('ubicacion-lat').value = this.originalPosition.lat;
        document.getElementById('ubicacion-lng').value = this.originalPosition.lng;
        document.getElementById('gps-coords').textContent =
            `${this.originalPosition.lat.toFixed(6)}, ${this.originalPosition.lng.toFixed(6)}`;
        this.updateDistanceDisplay(0);

        this.gpsMap.setView([this.originalPosition.lat, this.originalPosition.lng], 18);
        utils.showToast('Ubicación restaurada', 'info');
    },

    // Handle photo capture
    async handlePhotoCapture(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Compress image
            const compressedBlob = await utils.compressImage(file);

            // Show preview
            const previewImg = document.getElementById('preview-img');
            const previewContainer = document.getElementById('photo-preview');

            previewImg.src = URL.createObjectURL(compressedBlob);
            previewContainer?.classList.remove('hidden');

            // Store for later upload
            this.capturedPhoto = compressedBlob;

            utils.showToast('Foto capturada', 'success');
        } catch (error) {
            utils.showToast('Error al procesar imagen', 'error');
        }
    },

    // Remove photo
    removePhoto() {
        document.getElementById('photo-preview')?.classList.add('hidden');
        document.getElementById('preview-img').src = '';
        document.getElementById('evidencia-foto').value = '';
        this.capturedPhoto = null;
    },

    // Audio recording functions removed


    // Submit diligencia
    async submitDiligencia(event) {
        event.preventDefault();

        if (!this.currentAssignment) return;

        const btnSubmit = event.target.querySelector('button[type="submit"]');
        const originalBtnHtml = btnSubmit.innerHTML;

        const resultado = document.getElementById('resultado-diligencia').value;
        const esCargaDiferida = document.getElementById('carga-diferida').checked;
        const motivoFalla = document.getElementById('motivo-falla').value;

        // Validations
        if (!this.isUpdateMode) {
            if (!resultado) {
                utils.showToast('Selecciona un resultado', 'warning');
                return;
            }

            if (!esCargaDiferida) {
                const lat = document.getElementById('ubicacion-lat').value;
                const lng = document.getElementById('ubicacion-lng').value;

                if (!lat || !lng) {
                    // Double check if deferred is checked again just in case
                    if (!document.getElementById('carga-diferida').checked) {
                        utils.showToast('La ubicación GPS es obligatoria para guardar', 'warning');
                        return;
                    }
                }
            }
        }

        // Show loading state
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<div class="btn-spinner"></div> ' + (this.isUpdateMode ? 'Actualizando...' : 'Guardando...');

        try {
            // Prepare result data
            const commonData = {
                observaciones: document.getElementById('observaciones-resultado').value,
                // audio removed
            };

            let resultData = { ...commonData };

            if (!this.isUpdateMode) {
                // Include all fields for new registration
                Object.assign(resultData, {
                    resultado,
                    ubicacion_lat: esCargaDiferida ? null : (document.getElementById('ubicacion-lat').value || null),
                    ubicacion_lng: esCargaDiferida ? null : (document.getElementById('ubicacion-lng').value || null),
                    es_carga_diferida: esCargaDiferida,
                    motivo_falla_senal: motivoFalla || null
                });
            }

            console.log(this.isUpdateMode ? '📦 Actualizando diligencia:' : '📦 Preparando diligencia:', resultData);

            // Upload files if online
            if (utils.isOnline()) {
                if (this.capturedPhoto) {
                    console.log('📸 Subiendo foto...');
                    // Note: uploadPhoto usually takes File/Blob.
                    const { url, error: photoErr } = await db.uploadPhoto(this.capturedPhoto, this.currentAssignment.id);
                    if (photoErr) {
                        console.error('Error al subir foto:', photoErr);
                        utils.showToast('Error al subir la foto', 'warning');
                    } else {
                        resultData.evidencia_foto = url;
                    }
                }

                // Audio upload removed
            }

            // Save result
            let response;
            if (!utils.isOnline()) {
                console.log('📶 Modo Offline: Guardando en cola local');
                const actionType = this.isUpdateMode ? 'update_result' : 'register_result';
                offline.addToQueue(actionType, {
                    id: this.currentAssignment.id,
                    result: resultData, // For update, this contains updates. For new, full data.
                    userId: auth.currentUser?.id
                });
                utils.showToast('Guardado localmente. Se sincronizará cuando haya conexión.', 'warning');
                response = { data: true }; // Fake success
            } else {
                if (this.isUpdateMode) {
                    response = await db.updateResult(
                        this.currentAssignment.id,
                        resultData,
                        auth.currentUser?.id
                    );
                } else {
                    response = await db.registerResult(
                        this.currentAssignment.id,
                        resultData,
                        auth.currentUser?.id
                    );
                }
            }

            // Handle response
            if (response.error) {
                throw new Error(response.error);
            }

            // Success
            utils.showToast(this.isUpdateMode ? 'Datos actualizados correctamente' : 'Diligencia guardada correctamente', 'success');
            this.closeDiligencia();

            // Refresh visuals
            if (this.isUpdateMode) {
                // Maybe just refresh list if needed?
                // Update the current assignment object in memory to avoid full reload if possible?
                // But loadAssignments() is safer.
            } else {
                // Remove from 'pending' if it was pending?
            }

            await this.loadAssignments();

            // Also refresh history if open?
            if (document.getElementById('historial-ujier')?.classList.contains('active')) { // Check if view active?
                // Doesn't matter, just let user navigate.
            }

        } catch (error) {
            console.error('❌ Error fatal al guardar diligencia:', error);
            utils.showToast('Error al guardar: ' + error.message, 'error');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalBtnHtml;
        }
    },

    // Load work history
    // Load work history
    async loadHistory() {
        if (!auth.currentUser) return;

        const listContainer = document.getElementById('historial-list');
        if (!listContainer) return;

        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="spinner"></div>
                <p style="margin-top: 16px; color: var(--text-muted);">Cargando historial...</p>
            </div>
        `;

        // Obtener historial de visitas del usuario (API ya trae JOIN con notificaciones)
        const { data, error } = await db.getUserVisits(auth.currentUser.id);

        if (error) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--error);">
                     Error al cargar historial: ${error}
                </div>
            `;
            return;
        }

        // Guardar data completa para filtrado local
        this.historyData = data || [];

        // Aplicar filtros iniciales (incluyendo año seleccionado por defecto)
        this.filterHistory();
    },

    // Render history list
    renderHistory(visits) {
        const listContainer = document.getElementById('historial-list');
        if (!listContainer) return;

        if (visits.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📂</div>
                    <h3>Sin actividad reciente</h3>
                    <p>Las diligencias que realices aparecerán aquí.</p>
                </div>
            `;
            return;
        }

        const statusIcons = {
            atiende: '✅',
            no_atiende: '🏠',
            pre_aviso: '📝',
            estrados: '⚖️',
            domicilio_inexistente: '❌',
            diligenciador_ausente: '🚶'
        };

        listContainer.innerHTML = visits.map(visit => {
            const status = this.getNormalizedStatus(visit.resultado);

            return `
                <div class="assignment-card historial-card" onclick="ujier.openDiligencia('${visit.notificacion_id}')">
                    <div class="historial-icon">${statusIcons[status] || '📄'}</div>
                    <div class="assignment-info">
                        <div class="historial-header">
                            <span class="historial-fecha">${utils.formatDateTime(visit.fecha)}</span>
                        </div>
                        <div class="assignment-recipient">👤 <strong>${visit.destinatario_nombre || utils.getSpecialDestinationText(visit) || '-'}</strong></div>
                        <div class="assignment-address">🏠 ${visit.domicilio || '-'}</div>
                        <div class="historial-footer">
                            <span class="resultado-badge resultado-${status}">${(visit.resultado || 'PENDIENTE').replace(/_/g, ' ').toUpperCase()}</span>
                            ${visit.zona ? `<span class="historial-zona">${visit.zona}</span>` : ''}
                            ${visit.devuelta_por_ujier ? '<span class="badge-returned-mini" style="background:#f0fdf4; color:#166534; font-size:0.65rem; padding:1px 5px; border-radius:3px; margin-left:5px;">📦 DEVUELTA</span>' : ''}
                        </div>
                    </div>
                    <div class="assignment-arrow">›</div>
                </div>
            `;
        }).join('');
    },

    // Initialize References View (Shared by all roles)
    initReferences() {
        const btnSearch = document.getElementById('btn-search-references');
        const inputSearch = document.getElementById('search-references');
        const listContainer = document.getElementById('references-list');

        if (btnSearch && !btnSearch.hasListener) {
            btnSearch.addEventListener('click', () => this.loadReferences());
            btnSearch.hasListener = true;
        }

        if (inputSearch && !inputSearch.hasListener) {
            inputSearch.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.loadReferences();
            });
            inputSearch.hasListener = true;

            // Optional: focus input
            setTimeout(() => inputSearch.focus(), 100);
        }

        // Mostrar mensaje inicial solo si el contenedor está vacío o tiene el empty-state inicial
        if (listContainer && (listContainer.innerHTML.trim() === '' || listContainer.querySelector('.empty-state-initial'))) {
            listContainer.innerHTML = `
                <div class="empty-state empty-state-initial" style="grid-column: 1 / -1; padding: 40px;">
                    <div class="empty-icon" style="font-size: 3rem; margin-bottom: 16px;">🔍</div>
                    <h3 style="margin-bottom: 8px;">Explorador de Referencias</h3>
                    <p style="color: var(--text-muted);">Ingresa un nombre, dirección o expediente para buscar en el historial.</p>
                </div>
            `;
        }
    },

    // Load references from API
    async loadReferences() {
        const listContainer = document.getElementById('references-list');
        const query = document.getElementById('search-references')?.value?.trim() || '';

        if (!listContainer) return;

        // Si la búsqueda está vacía y el usuario hace clic, quizás quiera ver recientes.
        // Pero para ser estrictos con "no cargar al vicio", podríamos pedir al menos 1 caracter.
        // Por ahora, permitiremos búsqueda vacía si es explícita (clic en botón), 
        // pero la carga inicial automática ya fue eliminada.

        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; grid-column: 1 / -1;">
                <div class="spinner"></div>
                <p style="margin-top: 16px; color: var(--text-muted);">Buscando referencias...</p>
            </div>
        `;

        const { data, error } = await db.getReferences(query);

        if (error) {
            listContainer.innerHTML = `<div class="error-msg" style="grid-column: 1 / -1;">Error: ${error}</div>`;
            return;
        }

        this.renderReferences(data || []);
    },

    // Render references cards
    renderReferences(visits) {
        const listContainer = document.getElementById('references-list');
        if (!listContainer) return;

        if (visits.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon">📂</div>
                    <h3>No se encontraron resultados</h3>
                    <p>Intentá con otra dirección o palabra clave.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = visits.map(visit => {
            const hasPhoto = !!visit.foto_url;
            const hasGPS = visit.ubicacion_lat && visit.ubicacion_lng;
            const mapUrl = hasGPS ? `https://www.google.com/maps?q=${visit.ubicacion_lat},${visit.ubicacion_lng}` : '#';

            return `
                <div class="reference-card">
                    <div class="reference-photo-container">
                        ${hasPhoto ?
                    `<img src="${visit.foto_url}" class="reference-photo" alt="Fachada" loading="lazy" onclick="ujier.viewFullImage(this.src)">` :
                    `<div class="reference-no-photo"><span>📷</span> Sin foto disponible</div>`
                }
                        <span class="reference-badge-zona">${visit.zona || 'SIN ZONA'}</span>
                    </div>
                    <div class="reference-content">
                        <div class="reference-address">
                            <span>📍</span>
                            ${visit.domicilio || 'Sin domicilio registrado'}
                        </div>
                        <div class="reference-info-row">
                            <span>👤 Destinatario:</span>
                            <strong>${visit.destinatario_nombre || utils.getSpecialDestinationText(visit) || '-'}</strong>
                        </div>
                        <div class="reference-info-row">
                            <span>⚖️ Exp:</span>
                            <strong>${visit.n_expediente || '-'}</strong>
                        </div>
                        ${visit.observaciones ? `
                            <div class="reference-obs">
                                ${visit.observaciones}
                            </div>
                        ` : ''}
                        ${visit.transcripcion_audio ? `
                            <div class="reference-transcription">
                                🎤 "${visit.transcripcion_audio}"
                            </div>
                        ` : ''}
                    </div>
                    <div class="reference-footer">
                        <div class="reference-ujier">
                            <span>👤</span> ${visit.ujier_nombre || 'Compañero'}
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="reference-date">${utils.formatDate(visit.fecha)}</span>
                            ${hasGPS ? `
                                <a href="${mapUrl}" target="_blank" class="btn btn-primary btn-map-ref">
                                    <span>🗺️</span> Mapa
                                </a>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // --- MAP & STATS MODULE ---
    mapInstance: null,
    mapLayer: null,

    initMap() {
        const mapContainer = document.getElementById('ujier-map-container');
        if (!mapContainer) return;

        // Set default date to today if empty
        const dateInput = document.getElementById('map-date-filter');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Initialize Map if not exists
        if (!this.mapInstance) {
            this.mapInstance = L.map('ujier-map-container').setView([-27.4692131, -58.8306349], 13); // Default Corrientes
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.mapInstance);
        }

        // Refresh button listener
        document.getElementById('btn-refresh-map')?.addEventListener('click', () => this.loadMapData());
        document.getElementById('map-date-filter')?.addEventListener('change', () => this.loadMapData());

        // Load initial data
        this.loadMapData();

        // Force map resize calc after tab switch
        setTimeout(() => {
            if (this.mapInstance) this.mapInstance.invalidateSize();
        }, 300);
    },

    async loadMapData() {
        const date = document.getElementById('map-date-filter')?.value;
        if (!date || !auth.currentUser) return;

        // Clear previous layers
        if (this.mapLayer) {
            this.mapInstance.removeLayer(this.mapLayer);
            this.mapLayer = null;
        }

        const { data, error } = await db.getUserLocations(auth.currentUser.id, date);

        if (error) {
            console.error('Error loading locations:', error);
            utils.showToast('No se pudieron cargar las ubicaciones', 'error');
            return;
        }

        // Timeline Container
        let timelineContainer = document.getElementById('ujier-timeline-container');
        if (!timelineContainer) {
            timelineContainer = document.createElement('div');
            timelineContainer.id = 'ujier-timeline-container';
            timelineContainer.className = 'timeline-container';
            // Insert after map container
            const mapContainer = document.getElementById('ujier-map-container');
            if (mapContainer) mapContainer.parentNode.insertBefore(timelineContainer, mapContainer.nextSibling);
        }
        timelineContainer.innerHTML = ''; // Clear previous timeline

        if (!data || data.length === 0) {
            utils.showToast('No hay registros de GPS para esta fecha', 'info');
            document.getElementById('map-stat-visits').textContent = '0';
            document.getElementById('map-stat-distance').textContent = '0 km';
            timelineContainer.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-muted);">Sin actividad registrada</p>';
            return;
        }

        // Process markers and path
        const markers = L.layerGroup();
        const latlngs = [];
        let totalDist = 0;

        // Custom Icon Generator
        const createNumberedIcon = (number, color) => {
            return L.divIcon({
                className: 'custom-map-icon',
                html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${number}</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
        };

        const getStatusColor = (status) => {
            if (!status) return '#6c757d'; // Grey default
            const s = status.toLowerCase().replace(/_/g, ' ').trim();
            if (['atiende', 'entregado', 'positivo'].includes(s)) return '#10b981'; // Green
            if (['no atiende', 'domicilio inexistente', 'negativo', 'rechazado'].includes(s)) return '#ef4444'; // Red
            if (['pre aviso', 'estrados', 'pre_aviso'].includes(s)) return '#f59e0b'; // Orange/Amber
            if (['diligenciador ausente', 'ausente'].includes(s)) return '#6b7280'; // Grey
            return '#3b82f6'; // Blue fallback
        };

        // Timeline HTML Builder
        let timelineHTML = '<div class="timeline-title">⏱️ Secuencia de Visitas</div><div class="timeline-steps">';

        data.forEach((point, index) => {
            if (point.lat && point.lng) {
                const coord = [parseFloat(point.lat), parseFloat(point.lng)];
                latlngs.push(coord);

                const statusColor = getStatusColor(point.resultado);
                const visitNumber = index + 1;

                // Popup Content
                const photoHtml = point.foto_url
                    ? `<div style="margin-top:5px; width:100%; height:120px; background-image:url('${point.foto_url}'); background-size:cover; background-position:center; border-radius:4px; cursor:pointer;" onclick="window.open('${point.foto_url}', '_blank')"></div>`
                    : '';

                const popupContent = `
                    <div style="min-width:200px;">
                        <strong>#${visitNumber} ${point.destinatario || 'Desconocido'}</strong><br>
                        <span style="font-size:0.9em; color:#555;">${point.domicilio}</span><br>
                        <div style="margin-top:4px; margin-bottom:4px;">
                            <span style="background:${statusColor}; color:white; padding:2px 6px; border-radius:4px; font-size:0.8em;">${(point.resultado || 'PENDIENTE').toUpperCase()}</span>
                            <span style="font-size:0.8em; color:#777; margin-left:5px;">${utils.formatTime(point.fecha)}</span>
                        </div>
                        ${photoHtml}
                    </div>
                `;

                L.marker(coord, { icon: createNumberedIcon(visitNumber, statusColor) })
                    .bindPopup(popupContent)
                    .addTo(markers);

                // Add to Timeline
                timelineHTML += `
                    <div class="timeline-step">
                        <div class="step-marker" style="background:${statusColor};">${visitNumber}</div>
                        <div class="step-content">
                            <div class="step-header">
                                <span class="step-time">${utils.formatTime(point.fecha)}</span>
                                <span class="step-status" style="color:${statusColor}">${(point.resultado || '-').toUpperCase()}</span>
                            </div>
                            <div class="step-address">${point.domicilio}</div>
                        </div>
                    </div>
                `;
            }
        });

        timelineHTML += '</div>';
        timelineContainer.innerHTML = timelineHTML;

        // Add Path (Polyline)
        if (latlngs.length > 1) {
            L.polyline(latlngs, { color: '#3b82f6', weight: 4, opacity: 0.6 }).addTo(markers);

            // Calculate Total Distance
            for (let i = 0; i < latlngs.length - 1; i++) {
                totalDist += this.calculateDistance(latlngs[i][0], latlngs[i][1], latlngs[i + 1][0], latlngs[i + 1][1]);
            }
        }

        // Add to map
        this.mapLayer = markers;
        this.mapInstance.addLayer(this.mapLayer);

        // Fit bounds
        if (latlngs.length > 0) {
            this.mapInstance.fitBounds(latlngs, { padding: [50, 50] });
        }

        // Update Stats
        document.getElementById('map-stat-visits').textContent = data.length;
        document.getElementById('map-stat-distance').textContent = totalDist.toFixed(2) + ' km';
    },

    // Haversine formula
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
        return d;
    },

    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

};

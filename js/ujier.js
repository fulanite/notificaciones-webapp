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

    // Initialize ujier view
    async init() {
        this.updateDateDisplay();
        this.setupViewToggle();
        this.loadSavedOrder(); // Cargar orden antes de las asignaciones
        await this.loadAssignments();
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

        const { data, error } = await db.getMyAssignments(auth.currentUser.id);

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

        listContainer.innerHTML = this.assignments.map((assignment, index) => `
            <div class="assignment-card stagger-item" data-id="${assignment.id}" onclick="ujier.openDiligencia('${assignment.id}')">
                <div class="assignment-number">${index + 1}</div>
                <div class="assignment-info">
                    <div class="assignment-header-row">
                        <span class="assignment-type">${CONFIG.NOTIFICATION_TYPES?.[assignment.tipo_notificacion] || assignment.tipo_notificacion || 'Sin tipo'}</span>
                        ${assignment.zona ? `<span class="assignment-zona">${assignment.zona}</span>` : ''}
                    </div>
                    <div class="assignment-recipient">👤 <strong>${assignment.destinatario_nombre || '-'}</strong></div>
                    <div class="assignment-address">🏠 ${assignment.domicilio || '-'}</div>
                </div>
                <div class="assignment-arrow">›</div>
            </div>
        `).join('');
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
                            <span class="summary-value"><strong>${assignment.destinatario_nombre || '-'}</strong></span>
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
            </div>
        `).join('');
    },

    // Reset diligencia form
    resetDiligenciaForm() {
        const form = document.getElementById('form-diligenciar');
        form?.reset();

        // Reset GPS
        document.getElementById('gps-info')?.classList.add('hidden');
        document.getElementById('btn-capture-gps')?.classList.remove('hidden');
        const ubicacionLat = document.getElementById('ubicacion-lat');
        const ubicacionLng = document.getElementById('ubicacion-lng');
        if (ubicacionLat) ubicacionLat.value = '';
        if (ubicacionLng) ubicacionLng.value = '';

        // Reset mapa GPS (si existe)
        document.getElementById('gps-map-container')?.classList.add('hidden');
        if (this.gpsMap) {
            this.gpsMap.remove();
            this.gpsMap = null;
            this.gpsMarker = null;
            this.gpsCircle = null;
        }
        this.originalPosition = null;

        // Reset photo
        document.getElementById('photo-preview')?.classList.add('hidden');
        document.getElementById('preview-img').src = '';

        // Reset audio
        document.getElementById('audio-playback')?.classList.add('hidden');
        document.getElementById('audio-recording')?.classList.add('hidden');
        document.getElementById('transcripcion-audio')?.classList.add('hidden');

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
            if (e.target.checked) {
                motivoContainer?.classList.remove('hidden');
            } else {
                motivoContainer?.classList.add('hidden');
            }
        });

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
            utils.showToast(error.message, 'error');
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

    // Start audio recording
    async startAudioRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                this.audioChunks.push(e.data);
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.capturedAudio = audioBlob;

                const audioEl = document.getElementById('audio-playback');
                audioEl.src = URL.createObjectURL(audioBlob);
                audioEl?.classList.remove('hidden');

                document.getElementById('audio-recording')?.classList.add('hidden');

                // Show transcription field
                const transcriptionField = document.getElementById('transcripcion-audio');
                transcriptionField?.classList.remove('hidden');
                transcriptionField.placeholder = 'Transcribiendo audio...';

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());

                // Try automatic transcription with Speech Recognition
                this.transcribeAudio();
            };

            this.mediaRecorder.start();

            // Start speech recognition in parallel
            this.startSpeechRecognition();

            document.getElementById('btn-record-audio')?.classList.add('hidden');
            document.getElementById('audio-recording')?.classList.remove('hidden');

            utils.showToast('Grabando audio...', 'info');

            // Auto stop after max duration
            setTimeout(() => {
                if (this.mediaRecorder?.state === 'recording') {
                    this.stopAudioRecording();
                }
            }, CONFIG.AUDIO_MAX_DURATION);

        } catch (error) {
            utils.showToast('Error al acceder al micrófono', 'error');
        }
    },

    // Start speech recognition for live transcription
    startSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.log('Speech Recognition no soportado en este navegador');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'es-AR';

        this.transcriptionText = '';

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            this.transcriptionText += finalTranscript;

            const field = document.getElementById('transcripcion-audio');
            if (field) {
                field.value = this.transcriptionText + interimTranscript;
            }
        };

        this.recognition.onerror = (event) => {
            console.log('Error en reconocimiento de voz:', event.error);
        };

        try {
            this.recognition.start();
        } catch (e) {
            console.log('No se pudo iniciar reconocimiento de voz');
        }
    },

    // Finalize transcription
    transcribeAudio() {
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) { }
        }

        const field = document.getElementById('transcripcion-audio');
        if (field && !field.value) {
            field.placeholder = 'Escribí la transcripción manualmente...';
        }
    },

    // Stop audio recording
    stopAudioRecording() {
        if (this.mediaRecorder?.state === 'recording') {
            this.mediaRecorder.stop();
        }
        document.getElementById('btn-record-audio')?.classList.remove('hidden');
    },

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
        if (!resultado) {
            utils.showToast('Selecciona un resultado', 'warning');
            return;
        }

        if (!esCargaDiferida) {
            const lat = document.getElementById('ubicacion-lat').value;
            const lng = document.getElementById('ubicacion-lng').value;

            if (!lat || !lng) {
                utils.showToast('La ubicación GPS es obligatoria para guardar', 'warning');
                return;
            }
        }

        // Show loading state
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<div class="btn-spinner"></div> Guardando...';

        try {
            // Prepare result data
            const resultData = {
                resultado,
                ubicacion_lat: document.getElementById('ubicacion-lat').value || null,
                ubicacion_lng: document.getElementById('ubicacion-lng').value || null,
                es_carga_diferida: esCargaDiferida,
                motivo_falla_senal: motivoFalla || null,
                observaciones: document.getElementById('observaciones-resultado').value,
                transcripcion_audio: document.getElementById('transcripcion-audio').value
            };

            console.log('📦 Preparando diligencia:', resultData);

            // Upload files if online
            if (utils.isOnline()) {
                if (this.capturedPhoto) {
                    console.log('📸 Subiendo foto...');
                    const { url, error: photoErr } = await db.uploadPhoto(this.capturedPhoto, this.currentAssignment.id);
                    if (photoErr) {
                        console.error('Error al subir foto:', photoErr);
                        utils.showToast('Error al subir la foto, se guardará sin imagen', 'warning');
                    }
                    resultData.evidencia_foto = url;
                }

                if (this.capturedAudio) {
                    console.log('🎤 Subiendo audio...');
                    const { url, error: audioErr } = await db.uploadAudio(this.capturedAudio, this.currentAssignment.id);
                    if (audioErr) {
                        console.error('Error al subir audio:', audioErr);
                    }
                    resultData.observacion_audio = url;
                }
            }

            // Save result
            if (!utils.isOnline()) {
                console.log('📶 Modo Offline: Guardando en cola local');
                offline.addToQueue('register_result', {
                    id: this.currentAssignment.id,
                    result: resultData,
                    userId: auth.currentUser?.id
                });
                utils.showToast('Guardado localmente. Se sincronizará cuando haya conexión.', 'warning');
            } else {
                console.log('🌐 Guardando en Supabase...');
                const { error } = await db.registerResult(
                    this.currentAssignment.id,
                    resultData,
                    auth.currentUser?.id
                );

                if (error) {
                    throw error;
                }
            }

            utils.showToast('Diligencia registrada exitosamente', 'success');

            // Close modal and refresh
            this.closeDiligencia();
            await this.loadAssignments();

        } catch (error) {
            console.error('❌ Error fatal al guardar diligencia:', error);
            utils.showToast('Error al guardar: ' + error.message, 'error');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalBtnHtml;
        }
    },

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

        // Obtener visitas recientes del usuario
        const { data, error } = await db.getUserVisits(auth.currentUser.id);

        if (error) {
            listContainer.innerHTML = `<div class="error-msg">Error al cargar historial: ${error}</div>`;
            return;
        }

        this.renderHistory(data || []);
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
            let status = (visit.resultado || '').toLowerCase();
            if (status.includes('no atiende')) status = 'no_atiende';
            else if (status.includes('atiende')) status = 'atiende';
            else if (status.includes('entregado')) status = 'atiende';
            else if (status.includes('pre aviso')) status = 'pre_aviso';
            else if (status === 'pendiente') status = 'pre_aviso';
            else if (status.includes('estrados')) status = 'estrados';
            else if (status.includes('inexistente')) status = 'domicilio_inexistente';
            else status = status.replace(/\s+/g, '_');

            return `
                <div class="assignment-card historial-card" onclick="ujier.openDiligencia('${visit.notificacion_id}')">
                    <div class="historial-icon">${statusIcons[status] || '📄'}</div>
                    <div class="assignment-info">
                        <div class="historial-header">
                            <span class="assignment-type">${visit.tipo_notificacion || 'Notificación'}</span>
                            <span class="historial-fecha">${utils.formatDateTime(visit.fecha)}</span>
                        </div>
                        <div class="assignment-recipient">👤 <strong>${visit.destinatario_nombre || '-'}</strong></div>
                        <div class="assignment-address">🏠 ${visit.domicilio || '-'}</div>
                        <div class="historial-footer">
                            <span class="resultado-badge resultado-${status}">${(visit.resultado || 'PENDIENTE').toUpperCase()}</span>
                            ${visit.zona ? `<span class="historial-zona">${visit.zona}</span>` : ''}
                        </div>
                    </div>
                    <div class="assignment-arrow">›</div>
                </div>
            `;
        }).join('');
    }
};

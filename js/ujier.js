/**
 * SGND - Ujier Module (Bailiff View)
 */

const ujier = {
    assignments: [],
    currentAssignment: null,
    mediaRecorder: null,
    audioChunks: [],

    // Initialize ujier view
    async init() {
        this.updateDateDisplay();
        this.setupViewToggle();
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
        this.renderAssignments();
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
            <div class="assignment-card stagger-item" onclick="ujier.openDiligencia('${assignment.id}')">
                <div class="assignment-number">${index + 1}</div>
                <div class="assignment-info">
                    <span class="assignment-type">${CONFIG.NOTIFICATION_TYPES[assignment.tipo_notificacion] || assignment.tipo_notificacion}</span>
                    <div class="assignment-recipient">${assignment.destinatario_nombre}</div>
                    <div class="assignment-address">📍 ${assignment.domicilio}</div>
                </div>
                <div class="assignment-action">
                    <span style="font-size: 1.5rem;">→</span>
                </div>
            </div>
        `).join('');
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
        const assignment = this.assignments.find(a => a.id === id);
        if (!assignment) return;

        this.currentAssignment = assignment;

        // Update modal content
        const modal = document.getElementById('modal-diligenciar');
        const summary = document.getElementById('notif-summary');
        const idInput = document.getElementById('diligencia-id');

        if (idInput) idInput.value = id;

        if (summary) {
            summary.innerHTML = `
                <div style="display: grid; gap: 8px;">
                    <div><strong>Tipo:</strong> ${CONFIG.NOTIFICATION_TYPES[assignment.tipo_notificacion]}</div>
                    <div><strong>Expediente:</strong> ${assignment.n_expediente}</div>
                    <div><strong>Destinatario:</strong> ${assignment.destinatario_nombre}</div>
                    <div><strong>Domicilio:</strong> ${assignment.domicilio}</div>
                </div>
            `;
        }

        // Reset form
        this.resetDiligenciaForm();

        // Show modal
        modal?.classList.remove('hidden');
        modal?.classList.add('show');
    },

    // Close diligencia modal
    closeDiligencia() {
        const modal = document.getElementById('modal-diligenciar');
        modal?.classList.add('hidden');
        modal?.classList.remove('show');
        this.currentAssignment = null;
        this.resetDiligenciaForm();
    },

    // Reset diligencia form
    resetDiligenciaForm() {
        const form = document.getElementById('form-diligenciar');
        form?.reset();

        // Reset GPS
        document.getElementById('gps-info')?.classList.add('hidden');
        document.getElementById('ubicacion-lat').value = '';
        document.getElementById('ubicacion-lng').value = '';

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

    // Capture GPS
    async captureGPS() {
        const btn = document.getElementById('btn-capture-gps');
        const gpsInfo = document.getElementById('gps-info');
        const coordsEl = document.getElementById('gps-coords');

        btn.disabled = true;
        btn.innerHTML = '<div class="btn-spinner"></div> Obteniendo...';

        try {
            const position = await utils.getGPSPosition();

            document.getElementById('ubicacion-lat').value = position.lat;
            document.getElementById('ubicacion-lng').value = position.lng;

            coordsEl.textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
            gpsInfo?.classList.remove('hidden');

            utils.showToast('Ubicación capturada', 'success');
        } catch (error) {
            utils.showToast(error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>📍</span> Capturar Ubicación';
        }
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
                document.getElementById('transcripcion-audio')?.classList.remove('hidden');

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();

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

        const { data, error } = await db.getUserVisits(auth.currentUser.id);

        if (error) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--error);">
                    Error al cargar historial
                </div>
            `;
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
                <div style="text-align: center; padding: 60px;">
                    <div style="font-size: 4rem; margin-bottom: 16px;">📋</div>
                    <h3 style="margin-bottom: 8px;">Sin actividad reciente</h3>
                    <p style="color: var(--text-muted);">Aún no has registrado ninguna diligencia.</p>
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

        listContainer.innerHTML = visits.map(visit => `
            <div class="assignment-card">
                <div class="assignment-number" style="background: var(--primary-light); color: var(--primary);">
                    ${statusIcons[visit.resultado] || '📄'}
                </div>
                <div class="assignment-info">
                    <span class="assignment-type">Exp. ${visit.notificaciones?.n_expediente || 'S/N'}</span>
                    <div class="assignment-recipient">${visit.notificaciones?.destinatario_nombre || 'N/A'}</div>
                    <div class="assignment-address" style="font-size: 0.8rem; color: var(--text-muted);">
                        ${utils.formatDateTime(visit.fecha)} - <strong>${visit.resultado.replace('_', ' ').toUpperCase()}</strong>
                    </div>
                </div>
                ${visit.foto_url ? `
                    <div class="assignment-action" onclick="window.open('${visit.foto_url}', '_blank')">
                        <span style="font-size: 1.2rem;">🖼️</span>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }
};

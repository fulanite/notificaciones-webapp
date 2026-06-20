/**
 * SGND - Main Application Controller
 */

const app = {
    currentView: 'lista-notificaciones',
    appSettings: {},

    // Initialize application
    async init() {
        console.log('🚀 Initializing SGND...');

        // Initialize API Client (PHP/MySQL backend)
        initApiClient();

        // Initialize offline support
        offline.init();

        // Initialize theme
        this.initTheme();

        // Initialize accessibility
        this.initAccessibility();

        // Setup event listeners
        this.setupEventListeners();

        // Hide loading screen early to ensure modals can be seen
        this.hideLoading();

        // Check authentication
        await this.checkAuth();
    },

    // Initialize theme from localStorage
    initTheme() {
        const savedTheme = localStorage.getItem('sgnd-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.currentTheme = savedTheme;

        // Update button icon after DOM is ready
        setTimeout(() => {
            const btn = document.getElementById('btn-theme-toggle');
            if (btn) {
                btn.querySelector('.header-icon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
            }
        }, 100);
    },

    // Toggle between light and dark theme
    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('sgnd-theme', newTheme);
        this.currentTheme = newTheme;

        // Update toggle button icon
        const btn = document.getElementById('btn-theme-toggle');
        if (btn) {
            btn.querySelector('.header-icon').textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }

        utils.showToast(`Tema ${newTheme === 'dark' ? 'oscuro' : 'claro'} activado`, 'info');
    },

    // Initialize accessibility mode for visual impairment
    initAccessibility() {
        const isAccessible = localStorage.getItem('sgnd-accessibility-mode') === 'true';
        if (isAccessible) {
            document.body.classList.add('accessibility-mode');
        }

        const btn = document.getElementById('btn-toggle-accessibility');
        if (btn) {
            // Remove old listeners to be safe (though init runs once usually)
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.body.classList.toggle('accessibility-mode');
                const newState = document.body.classList.contains('accessibility-mode');
                localStorage.setItem('sgnd-accessibility-mode', newState);

                if (newState) {
                    newBtn.innerHTML = '👁️ Desactivar';
                    utils.showToast('Modo accesible activado', 'success');
                } else {
                    newBtn.innerHTML = '👁️ Modo Accesible';
                    utils.showToast('Modo accesible desactivado', 'info');
                }
            });

            // Set initial state
            if (isAccessible) {
                newBtn.innerHTML = '👁️ Desactivar';
            }
        }
    },

    // View notification details (Delegate to notifications module)
    viewNotificationDetail(id) {
        if (typeof notifications !== 'undefined') {
            notifications.viewDetails(id);
        } else {
            console.error('Notifications module not loaded');
        }
    },

    // Handle persistent settings for Zona/Ujier
    applyPersistentSettings() {
        // Skip persistent settings if we are in edit mode
        if (typeof notifications !== 'undefined' && notifications.editingId) {
            return;
        }

        const savedZona = localStorage.getItem('sgnd-persist-zona');
        const savedUjier = localStorage.getItem('sgnd-persist-ujier');
        const savedFecha = localStorage.getItem('sgnd-persist-fecha-entrega');

        const zonaSelect = document.getElementById('zona');
        const persistZona = document.getElementById('persist-zona');
        const fGroupZona = document.getElementById('f-group-zona');

        if (savedZona) {
            if (zonaSelect) zonaSelect.value = savedZona;
            if (persistZona) persistZona.value = savedZona;
            // Hide field in form if it's already fixed at top to avoid visual duplication
            if (fGroupZona) fGroupZona.classList.add('hidden');
        } else {
            if (fGroupZona) fGroupZona.classList.remove('hidden');
        }

        const ujierSelect = document.getElementById('asignado-a');
        const persistUjier = document.getElementById('persist-ujier');
        const fGroupAsignar = document.getElementById('f-group-asignar');

        if (savedUjier) {
            if (ujierSelect) ujierSelect.value = savedUjier;
            if (persistUjier) persistUjier.value = savedUjier;
            // Hide field in form if it's already fixed at top to avoid visual duplication
            if (fGroupAsignar) fGroupAsignar.classList.add('hidden');
        } else {
            if (fGroupAsignar) fGroupAsignar.classList.remove('hidden');
        }

        const fechaInput = document.getElementById('persist-fecha-entrega');
        const fGroupFecha = document.getElementById('f-group-fecha-entrega');
        if (fechaInput) {
            if (savedFecha) {
                fechaInput.value = savedFecha;
                // If persistent date is set, hide the individual form field to avoid duplication
                if (fGroupFecha) fGroupFecha.classList.add('hidden');
            } else {
                // Default to today in local timezone (YYYY-MM-DD)
                const now = new Date();
                const offset = now.getTimezoneOffset();
                const localNow = new Date(now.getTime() - (offset * 60 * 1000));
                fechaInput.value = localNow.toISOString().split('T')[0];
                if (fGroupFecha) fGroupFecha.classList.remove('hidden');
            }
        }
    },

    // Handle Troquel dropdown change (C, M, SIN)
    handleTroquelChange(val) {
        const tipoTroquelHidden = document.getElementById('tipo-troquel');
        const sinTroquelCheck = document.getElementById('sin-troquel');
        const nTroquelGroup = document.getElementById('grupo-n-troquel');
        const nTroquelInput = document.getElementById('n-troquel');

        if (val === 'SIN') {
            if (tipoTroquelHidden) tipoTroquelHidden.value = '';
            if (sinTroquelCheck) sinTroquelCheck.checked = true;
            if (nTroquelGroup) nTroquelGroup.classList.add('hidden');
            if (nTroquelInput) {
                nTroquelInput.required = false;
                nTroquelInput.value = '';
            }
        } else {
            if (tipoTroquelHidden) tipoTroquelHidden.value = val;
            if (sinTroquelCheck) sinTroquelCheck.checked = false;
            if (nTroquelGroup) nTroquelGroup.classList.remove('hidden');
            if (nTroquelInput) nTroquelInput.required = true;
        }
    },

    savePersistentSettings() {
        const zona = document.getElementById('persist-zona')?.value;
        const ujier = document.getElementById('persist-ujier')?.value;
        const fecha = document.getElementById('persist-fecha-entrega')?.value;

        if (zona !== undefined) localStorage.setItem('sgnd-persist-zona', zona);
        if (ujier !== undefined) localStorage.setItem('sgnd-persist-ujier', ujier);
        if (fecha !== undefined) localStorage.setItem('sgnd-persist-fecha-entrega', fecha);

        // Re-apply to sync UI (like hiding/showing form fields)
        this.applyPersistentSettings();
    },

    // Handle notification type selection from chips
    selectNotificationType(value, label, button) {
        // Update hidden input
        const hiddenInput = document.getElementById('tipo-notificacion');
        if (hiddenInput) {
            hiddenInput.value = value;
        }
        
        // Remove 'selected' class from all chips
        document.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('selected'));
        
        // Add 'selected' class to clicked chip
        if (button) {
            button.classList.add('selected');
        }
        
        // Update alert banner
        const alertBanner = document.getElementById('tipo-notificacion-alert');
        if (alertBanner) {
            alertBanner.innerHTML = '';
            alertBanner.className = 'tipo-alert'; // Reset classes
            
            if (value.includes('urgentes') || value.includes('habilitacion')) {
                alertBanner.innerHTML = `⚠️ ATENCIÓN: ESTÁS CARGANDO UNA ${label.toUpperCase()}`;
                alertBanner.classList.add('alert-urgent');
                alertBanner.classList.remove('hidden');
            } else {
                alertBanner.innerHTML = `✅ ${label.toUpperCase()} SELECCIONADA`;
                alertBanner.classList.add('alert-normal');
                alertBanner.classList.remove('hidden');
            }
        }
        
        // Trigger the original handler to update dynamic fields
        this.handleTipoNotificacionChange(value);
    },

    // Reset the chips UI
    resetNotificationTypeChips() {
        document.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('selected'));
        const alertBanner = document.getElementById('tipo-notificacion-alert');
        if (alertBanner) {
            alertBanner.className = 'tipo-alert hidden';
            alertBanner.innerHTML = '';
        }
        const hiddenInput = document.getElementById('tipo-notificacion');
        if (hiddenInput) hiddenInput.value = '';
    },

    // Handle notification type change - show/populate dynamic origin
    handleTipoNotificacionChange(tipo) {
        const grupoDinamico = document.getElementById('grupo-origen-dinamico');
        const input = document.getElementById('origen-dinamico-input');
        const hidden = document.getElementById('origen-dinamico');
        const dropdown = document.getElementById('origen-dropdown');
        const label = document.getElementById('label-origen-dinamico');
        const grupoFixed = document.getElementById('origen')?.closest('.f-group');

        const troquelSelect = document.getElementById('selector-troquel');

        if (!grupoDinamico || !input || !dropdown || !label) return;

        // Auto-set troquel type for Mandamientos (Only when NOT editing)
        const isMandamiento = tipo.includes('mandamientos') && tipo !== 'cedulas_mandamientos_22172';
        const isHabilitacion = tipo.includes('habilitacion');

        if (!notifications?.editingId) {
            if (isMandamiento || isHabilitacion) {
                if (troquelSelect) {
                    troquelSelect.value = 'M';
                    this.handleTroquelChange('M');
                }
            } else if (tipo === 'cedulas' ||
                tipo === 'cedulas_mandamientos_22172' ||
                tipo === 'ley_22172_bus' ||
                tipo === 'cedulas_correspondencia' ||
                tipo.includes('urgentes')) {
                if (troquelSelect) {
                    troquelSelect.value = 'C';
                    this.handleTroquelChange('C');
                }
            }
        }

        // Clear previous dynamic origin
        input.value = '';
        hidden.value = '';
        dropdown.innerHTML = '';

        // Remove previous listeners
        input.replaceWith(input.cloneNode(true));
        const newInput = document.getElementById('origen-dinamico-input');

        let options = [];

        if (tipo === 'cedulas_mandamientos_22172' || tipo === 'mandamientos_22172' || tipo === 'ley_22172_bus') {
            grupoFixed?.classList.add('hidden');
            document.getElementById('origen').required = false;
            document.getElementById('origen-input').required = false;

            grupoDinamico.classList.remove('hidden');
            newInput.required = true;
            label.textContent = 'Provincia de Origen *';
            newInput.placeholder = 'Escribí para buscar provincia...';
            options = SGND_DATA.PROVINCIAS;

        } else if (tipo === 'cedulas_correspondencia' || tipo === 'mandamientos_interior') {
            grupoFixed?.classList.add('hidden');
            document.getElementById('origen').required = false;
            document.getElementById('origen-input').required = false;

            grupoDinamico.classList.remove('hidden');
            newInput.required = true;
            label.textContent = 'Localidad de Origen *';
            newInput.placeholder = 'Escribí para buscar localidad...';
            options = SGND_DATA.LOCALIDADES_CATAMARCA;

        } else {
            grupoFixed?.classList.remove('hidden');
            const originFijo = document.getElementById('origen');
            const originFijoInput = document.getElementById('origen-input');
            if (originFijo) originFijo.required = false; // Never require hidden inputs
            if (originFijoInput) originFijoInput.required = true;

            grupoDinamico.classList.add('hidden');
            newInput.required = false;
            return;
        }

        this.setupSearchableSelect(newInput, hidden, dropdown, options);
    },

    // Setup searchable select functionality
    setupSearchableSelect(input, hidden, dropdown, options) {
        let highlightedIndex = -1;

        const showDropdown = (filtered) => {
            dropdown.innerHTML = '';
            highlightedIndex = -1;

            if (filtered.length === 0) {
                dropdown.innerHTML = '<div class="searchable-select-empty">No se encontraron resultados</div>';
            } else {
                // Limit to 50 results for performance
                const limited = filtered.slice(0, 50);
                limited.forEach((opt, index) => {
                    const item = document.createElement('div');
                    item.className = 'searchable-select-item';
                    // Highlight matching text
                    const query = input.value.toLowerCase();
                    if (query) {
                        const regex = new RegExp(`(${query})`, 'gi');
                        item.innerHTML = opt.replace(regex, '<mark>$1</mark>');
                    } else {
                        item.textContent = opt;
                    }
                    item.dataset.value = opt;
                    item.dataset.index = index;

                    item.addEventListener('click', () => {
                        input.value = opt;
                        hidden.value = opt;
                        dropdown.classList.remove('show');
                    });

                    dropdown.appendChild(item);
                });

                if (filtered.length > 50) {
                    const more = document.createElement('div');
                    more.className = 'searchable-select-empty';
                    more.textContent = `...y ${filtered.length - 50} más. Seguí escribiendo para filtrar.`;
                    dropdown.appendChild(more);
                }
            }

            dropdown.classList.add('show');
        };

        const normalize = (str) => {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        };

        const filterOptions = () => {
            const query = normalize(input.value);
            const filtered = options.filter(opt => normalize(opt).includes(query));
            showDropdown(filtered);
        };

        // Input events
        input.addEventListener('focus', () => {
            filterOptions();
        });

        input.addEventListener('input', () => {
            hidden.value = ''; // Clear hidden until selection
            filterOptions();
        });

        input.addEventListener('blur', () => {
            // Delay to allow click on dropdown items which happens before blur
            setTimeout(() => {
                dropdown.classList.remove('show');

                // If nothing was selected but there's text, try to match exactly
                if (input.value && !hidden.value) {
                    const match = options.find(opt => opt.toLowerCase() === input.value.trim().toLowerCase());
                    if (match) {
                        input.value = match;
                        hidden.value = match;
                        input.style.borderColor = ''; // Valid
                    } else {
                        // NO MATCH: Inform the user and highlight
                        input.style.borderColor = 'var(--error-500, #ef4444)';
                        input.style.backgroundColor = '#fef2f2';
                        utils.showToast('Debe seleccionar una opción de la lista', 'warning');
                    }
                } else if (!input.value) {
                    hidden.value = '';
                    input.style.borderColor = '';
                    input.style.backgroundColor = '';
                } else {
                    // It has a hidden value, so it's valid selection
                    input.style.borderColor = '';
                    input.style.backgroundColor = '';
                }
            }, 250);
        });

        // Keyboard navigation
        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.searchable-select-item');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                items.forEach((item, i) => item.classList.toggle('highlighted', i === highlightedIndex));
                items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                items.forEach((item, i) => item.classList.toggle('highlighted', i === highlightedIndex));
                items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (highlightedIndex >= 0 && items[highlightedIndex]) {
                    items[highlightedIndex].click();
                }
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('show');
            }
        });
    },

    // Check authentication status
    async checkAuth() {
        // Always check session with server via auth.init()
        const user = await auth.init();

        if (user) {
            await this.onLoginSuccess();
        } else {
            this.showLoginPage();
        }
    },

    // Setup event listeners
    setupEventListeners() {
        // Login form
        document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));

        // Password visibility toggle
        document.querySelector('.password-toggle')?.addEventListener('click', () => {
            const input = document.getElementById('login-password');
            const icon = document.querySelector('.eye-icon');

            if (input.type === 'password') {
                input.type = 'text';
                icon.textContent = '🙈';
            } else {
                input.type = 'password';
                icon.textContent = '👁️';
            }
        });

        // Logout button
        document.getElementById('btn-logout')?.addEventListener('click', () => this.handleLogout());

        // Mobile menu toggle - both buttons (header and sidebar)
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('open');
        });
        document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('open');
        });

        // Cerrar sidebar al hacer clic fuera (en el overlay)
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const menuToggle = document.getElementById('mobile-menu-toggle');

            if (sidebar?.classList.contains('open') &&
                window.innerWidth <= 1024 &&
                !sidebar.contains(e.target) &&
                !menuToggle?.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });

        // Sidebar navigation
        document.querySelectorAll('.nav-link[data-view]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const view = link.dataset.view;
                console.log('📱 Navegando a:', view);

                // Close sidebar on mobile
                const sidebar = document.getElementById('sidebar');
                if (window.innerWidth <= 1024 && sidebar?.classList.contains('open')) {
                    sidebar.classList.remove('open');
                }

                this.navigateTo(view);
            });
        });

        // Bottom tab bar navigation (móvil)
        document.querySelectorAll('.bottom-nav-item[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                console.log('📱 Bottom nav a:', view);

                // Actualizar estado activo
                document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                this.navigateTo(view);
            });
        });

        // Logout móvil
        document.getElementById('btn-logout-mobile')?.addEventListener('click', () => this.handleLogout());

        // Sync button
        document.getElementById('btn-sync')?.addEventListener('click', async () => {
            if (offline.getPendingCount() > 0) {
                await offline.syncQueue();
            } else {
                await dashboard.refresh();
            }
        });

        // New notification form
        document.getElementById('form-nueva-notificacion')?.addEventListener('submit', (e) => this.handleNewNotification(e));

        // Sin troquel checkbox
        document.getElementById('sin-troquel')?.addEventListener('change', (e) => {
            const troquelGroup = document.getElementById('grupo-n-troquel');
            const troquelInput = document.getElementById('n-troquel');

            if (e.target.checked) {
                troquelGroup?.classList.add('hidden');
                troquelInput.required = false;
            } else {
                troquelGroup?.classList.remove('hidden');
                troquelInput.required = true;
            }
        });

        // Initialize Judicial Origin searchable select
        const origenInput = document.getElementById('origen-input');
        const origenHidden = document.getElementById('origen');
        const origenDropdown = document.getElementById('origen-fijo-dropdown');
        if (origenInput && origenHidden && origenDropdown) {
            this.setupSearchableSelect(origenInput, origenHidden, origenDropdown, SGND_DATA.ORIGENES_JUDICIALES);
        }

        // Tipo notificación change - show/hide dynamic destination field
        document.getElementById('tipo-notificacion')?.addEventListener('change', (e) => {
            this.handleTipoNotificacionChange(e.target.value);
        });

        // Destinatario Especial change
        document.getElementById('destinatario-especial')?.addEventListener('change', (e) => {
            const val = e.target.value;
            const nombreInput = document.getElementById('destinatario-nombre');
            const domicilioInput = document.getElementById('domicilio');
            const labelDomicilio = document.querySelector('label[for="domicilio"]');

            if (val && val !== '') {
                // Autopopulate name
                if (nombreInput) nombreInput.value = val;

                // Domicilio non-mandatory and default to SIN DOMICILIO
                if (domicilioInput) {
                    domicilioInput.required = false;
                    domicilioInput.placeholder = "Dirección (Opcional para destinatario especial)";
                    domicilioInput.value = 'SIN DOMICILIO';
                }
                if (labelDomicilio) labelDomicilio.innerHTML = 'Domicilio';
            } else {
                // Clear autopopulated name if NO APLICA
                if (nombreInput) nombreInput.value = '';

                // Reset mandatory and clear default if present
                if (domicilioInput) {
                    domicilioInput.required = true;
                    domicilioInput.placeholder = "Dirección completa";
                    if (domicilioInput.value === 'SIN DOMICILIO') {
                        domicilioInput.value = '';
                    }
                }
                if (labelDomicilio) labelDomicilio.innerHTML = 'Domicilio *';
            }
        });

        // Persistent settings changes
        document.getElementById('persist-zona')?.addEventListener('change', () => this.savePersistentSettings());
        document.getElementById('persist-ujier')?.addEventListener('change', () => this.savePersistentSettings());
        document.getElementById('persist-fecha-entrega')?.addEventListener('change', () => this.savePersistentSettings());

        // Medio pago change
        document.getElementById('medio-pago')?.addEventListener('change', (e) => {
            const costoGroup = document.getElementById('grupo-costo');
            const costoInput = document.getElementById('costo');

            if (e.target.value === 'gratuito') {
                costoGroup?.classList.add('hidden');
                costoInput.value = '0';
            } else {
                costoGroup?.classList.remove('hidden');
                // Auto-fill with fixed value if available and not already set
                // Only auto-fill if the current value is 0 or empty, to avoid overwriting existing data when editing
                if (this.appSettings && this.appSettings.valor_troquel) {
                    const currentVal = parseFloat(costoInput.value) || 0;
                    if (currentVal === 0) {
                        costoInput.value = this.appSettings.valor_troquel;
                    }
                }
            }
        });

        // Clear form button
        document.getElementById('btn-limpiar-form')?.addEventListener('click', () => {
            document.getElementById('form-nueva-notificacion')?.reset();
            app.resetNotificationTypeChips();
        });

        // Modal Nueva Notificación
        const modalNuevaNotif = document.getElementById('modal-nueva-notificacion');

        document.getElementById('btn-open-nueva-notif')?.addEventListener('click', async () => {
            modalNuevaNotif?.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Prevent scroll

            // Reset for new entry
            document.getElementById('form-nueva-notificacion')?.reset();
            app.resetNotificationTypeChips();
            document.getElementById('grupo-costo')?.classList.add('hidden');
            notifications.editingId = null;
            const modalTitle = modalNuevaNotif?.querySelector('.modal-title');
            if (modalTitle) modalTitle.textContent = '📦 Nueva Notificación';

            // Show persistent settings bar for new entries
            const pBar = document.getElementById('persistent-settings-container');
            if (pBar) pBar.classList.remove('hidden-important');

            // Refresh ujieres list to ensure it's up to date
            await notifications.loadUjieres();

            this.applyPersistentSettings();

            // Force a refresh of the notification type logic to reset required fields and visibility
            const currentTipo = document.getElementById('tipo-notificacion')?.value || 'cedulas';
            this.handleTipoNotificacionChange(currentTipo);
        });

        const closeModal = () => {
            modalNuevaNotif?.classList.add('hidden');
            document.body.style.overflow = '';
        };

        document.getElementById('btn-close-modal-nueva-notif')?.addEventListener('click', closeModal);
        document.getElementById('btn-cancelar-nueva-notif')?.addEventListener('click', closeModal);
        modalNuevaNotif?.querySelector('.modal-overlay')?.addEventListener('click', closeModal);

        // Close sidebar on mobile when clicking outside
        document.querySelector('.main-content')?.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                document.getElementById('sidebar')?.classList.remove('open');
            }
        });
    },

    // Handle login
    async handleLogin(event) {
        event.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        const submitBtn = document.querySelector('.btn-login');

        // Show loading state
        submitBtn.querySelector('.btn-text').classList.add('hidden');
        submitBtn.querySelector('.btn-loader').classList.remove('hidden');
        submitBtn.disabled = true;
        errorDiv.classList.add('hidden');

        const result = await auth.signIn(email, password);

        // Reset button state
        submitBtn.querySelector('.btn-text').classList.remove('hidden');
        submitBtn.querySelector('.btn-loader').classList.add('hidden');
        submitBtn.disabled = false;

        if (result.success) {
            await this.onLoginSuccess();
        } else {
            errorDiv.textContent = result.error || 'Error al iniciar sesión';
            errorDiv.classList.remove('hidden');
            errorDiv.classList.add('shake');
            setTimeout(() => errorDiv.classList.remove('shake'), 500);
        }
    },

    // Handle logout
    async handleLogout() {
        // Show confirmation dialog for ujier role
        const rol = auth.currentUser?.rol ? auth.currentUser.rol.toLowerCase() : '';

        if (rol === 'ujier') {
            const confirmed = confirm('¿Estás seguro que querés salir de la aplicación?');
            if (!confirmed) {
                return; // User cancelled logout
            }
        }

        await auth.signOut();
        this.showLoginPage();
        utils.showToast('Sesión cerrada', 'info');
    },

    // On login success
    async onLoginSuccess() {
        console.log('✅ Login exitoso:', auth.currentUser?.email);
        console.log('🎭 Rol detectado:', auth.currentUser?.rol);

        const resetRequired = auth.currentUser?.password_reset_required;
        console.log('🔒 Reset requerido:', resetRequired);

        if (resetRequired === true || resetRequired === 1 || resetRequired === "1") {
            const modal = document.getElementById('modal-password-reset');
            if (modal) {
                // Keep login page active as background
                document.getElementById('page-login')?.classList.add('active');

                // Show only the modal
                this.showPasswordResetModal();
                console.log('⚠️ Password reset modal displayed');
            } else {
                console.error('❌ Modal de cambio de contraseña no encontrado en el DOM');
                // Fallback: Proceed to dashboard if modal is missing (to avoid blank screen)
                this.showDashboard();
                this.updateUserInterface();
                await this.initializeModules();
            }
        } else {
            // Normal flow: only if no reset is required
            this.showDashboard();
            this.updateUserInterface();
            await this.initializeModules();
        }
    },

    // Show login page
    showLoginPage() {
        document.getElementById('page-login')?.classList.add('active');
        document.getElementById('page-dashboard')?.classList.remove('active');
    },

    // Show dashboard
    showDashboard() {
        document.getElementById('page-login')?.classList.remove('active');
        document.getElementById('page-dashboard')?.classList.add('active');
    },

    // Update user interface based on role
    updateUserInterface() {
        if (!auth.currentUser) return;

        const { nombre, rol } = auth.currentUser;

        // Update user info in sidebar with safety checks
        const nameEl = document.getElementById('user-name');
        const roleEl = document.getElementById('user-role');
        const avatarEl = document.getElementById('user-avatar');

        if (nameEl) nameEl.textContent = nombre;
        if (roleEl) roleEl.textContent = CONFIG.ROLES[rol] || rol;
        if (avatarEl) {
            const initialsEl = avatarEl.querySelector('.avatar-initials');
            if (initialsEl) initialsEl.textContent = auth.getInitials();
        }

        // Show appropriate menu based on role
        document.getElementById('menu-admin')?.classList.add('hidden');
        document.getElementById('menu-ujier')?.classList.add('hidden');
        document.getElementById('menu-auditor')?.classList.add('hidden');

        const lowerRol = rol ? rol.toLowerCase() : '';

        const defaultAdminView = (window.innerWidth <= 1024) ? 'asignaciones' : 'lista-notificaciones';

        if (lowerRol === 'admin') {
            // Admin: acceso completo
            document.getElementById('menu-admin')?.classList.remove('hidden');
            document.getElementById('menu-auditor')?.classList.remove('hidden');
            this.navigateTo(defaultAdminView);
        } else if (lowerRol === 'administrativo') {
            // Administrativo: acceso admin pero sin auditoría
            document.getElementById('menu-admin')?.classList.remove('hidden');
            this.navigateTo(defaultAdminView);
        } else if (lowerRol === 'coordinador') {
            // Coordinador: acceso admin pero sin auditoría
            document.getElementById('menu-admin')?.classList.remove('hidden');
            this.navigateTo(defaultAdminView);
        } else if (lowerRol === 'ujier') {
            document.getElementById('menu-ujier')?.classList.remove('hidden');
            this.navigateTo('mis-asignaciones');
        } else if (lowerRol === 'auditor') {
            document.getElementById('menu-auditor')?.classList.remove('hidden');
            document.getElementById('menu-admin')?.classList.remove('hidden');
            this.navigateTo(defaultAdminView);
        }

        // Hide specific menu items based on role
        this.updateMenuItemsVisibility(rol);

        // Show/hide Global Action button (Nueva Notificación)
        const btnNuevaNotif = document.getElementById('btn-open-nueva-notif');
        if (btnNuevaNotif) {
            if (lowerRol === 'admin' || lowerRol === 'administrativo' || lowerRol === 'coordinador') {
                btnNuevaNotif.classList.remove('hidden');
            } else {
                btnNuevaNotif.classList.add('hidden');
            }
        }

        // Always show accessibility toggle for authenticated users
        const btnAccessibility = document.getElementById('btn-toggle-accessibility');
        if (btnAccessibility) {
            btnAccessibility.classList.remove('hidden');
        }

        // --- Mobile Bottom Nav Logic ---
        const mobileNav = document.getElementById('mobile-bottom-nav');
        if (mobileNav) {
            mobileNav.classList.remove('hidden'); // SHOW NAV
            const adminItems = mobileNav.querySelectorAll('.role-admin');
            const ujierItems = mobileNav.querySelectorAll('.role-ujier');

            // Hide all first
            adminItems.forEach(el => el.style.display = 'none');
            ujierItems.forEach(el => el.style.display = 'none');

            if (lowerRol === 'ujier') {
                ujierItems.forEach(el => el.style.display = 'flex');
            } else {
                // Admin, Administrativo, Coordinador, Auditor
                // Only allowed views on mobile based on request: Asignar (asignaciones), Devoluciones, Usuarios
                const allowedViews = ['asignaciones', 'devoluciones', 'usuarios'];
                
                adminItems.forEach(el => {
                    const view = el.dataset.view;
                    if (allowedViews.includes(view)) {
                        el.style.display = 'flex';
                    } else {
                        el.style.display = 'none';
                    }
                });

                // Hide specific views based on role even if they are in the allowed list
                // Hide Usuarios for Auditor
                const usersBtn = mobileNav.querySelector('[data-view="usuarios"]');
                if (usersBtn && lowerRol === 'auditor') {
                    usersBtn.style.display = 'none';
                }

                // Hide Devoluciones for Administrativo and Auditor
                const devolucionesBtn = mobileNav.querySelector('[data-view="devoluciones"]');
                if (devolucionesBtn && (lowerRol === 'administrativo' || lowerRol === 'auditor')) {
                    devolucionesBtn.style.display = 'none';
                }

                // Hide Shared Explorador for Admin roles (per request)
                const sharedExplorador = mobileNav.querySelector('[data-view="referencias-gral"]');
                if (sharedExplorador) {
                    sharedExplorador.style.display = 'none';
                }
            }
        }
    },

    // Update menu items visibility based on role
    updateMenuItemsVisibility(rol) {
        const lowerRol = (rol || '').toLowerCase();

        // Devoluciones: Solo admin y coordinador
        const devolucionesLink = document.querySelector('[data-view="devoluciones"]');
        if (devolucionesLink) {
            const devolucionesItem = devolucionesLink.closest('.nav-item');
            if (lowerRol === 'admin' || lowerRol === 'coordinador') {
                devolucionesItem?.classList.remove('hidden');
            } else {
                devolucionesItem?.classList.add('hidden');
            }
        }

        // Mapa General: Solo admin y coordinador
        const mapaLink = document.querySelector('[data-view="mapa-seguimiento"]');
        if (mapaLink) {
            const mapaItem = mapaLink.closest('.nav-item');
            if (lowerRol === 'admin' || lowerRol === 'coordinador') {
                mapaItem?.classList.remove('hidden');
            } else {
                mapaItem?.classList.add('hidden');
            }
        }

        // Gestión Masiva: Solo admin y coordinador
        const bulkLink = document.querySelector('[data-view="bulk-editor"]');
        if (bulkLink) {
            const bulkItem = bulkLink.closest('.nav-item');
            if (lowerRol === 'admin' || lowerRol === 'coordinador') {
                bulkItem?.classList.remove('hidden');
            } else {
                bulkItem?.classList.add('hidden');
            }
        }

        // Auditoría: Solo admin
        const auditoriaLink = document.querySelector('[data-view="auditoria"]');
        if (auditoriaLink) {
            const auditoriaItem = auditoriaLink.closest('.nav-item');
            if (lowerRol === 'admin') {
                auditoriaItem?.classList.remove('hidden');
            } else {
                auditoriaItem?.classList.add('hidden');
            }
        }
    },

    // Initialize modules based on role
    async initializeModules() {
        const rol = auth.currentUser?.rol ? auth.currentUser.rol.toLowerCase() : '';

        // Módulos comunes para admin, administrativo, coordinador, auditor
        if (rol === 'admin' || rol === 'administrativo' || rol === 'auditor' || rol === 'coordinador') {
            await dashboard.init();
            await notifications.init();
            await notifications.loadUjieres();
            planillas.init();
            reports.init();
            await this.loadSettings(); // Cargar configuración
        }

        // Devoluciones: Solo admin y coordinador
        if (rol === 'admin' || rol === 'coordinador') {
            await devoluciones.init();
        }

        // Usuarios: Solo admin, administrativo, coordinador
        if (rol === 'admin' || rol === 'administrativo' || rol === 'coordinador') {
            await usuarios.init();
        }

        // Apply persistent settings to sync UI
        this.applyPersistentSettings();

        // Ujier
        if (rol === 'ujier') {
            await ujier.init();
        }
    },

    // Navigate to view
    navigateTo(viewId) {
        // Validar permisos de acceso
        const rol = auth.currentUser?.rol;

        // Devoluciones: Solo admin y coordinador
        if (viewId === 'devoluciones' && rol !== 'admin' && rol !== 'coordinador') {
            utils.showToast('No tenés permisos para acceder a esta sección', 'error');
            return;
        }

        // Mapa de Seguimiento: Solo admin y coordinador
        if (viewId === 'mapa-seguimiento' && rol !== 'admin' && rol !== 'coordinador') {
            utils.showToast('No tenés permisos para acceder a esta sección', 'error');
            return;
        }

        // Auditoría: Solo admin
        if (viewId === 'auditoria' && rol !== 'admin') {
            utils.showToast('No tenés permisos para acceder a esta sección', 'error');
            return;
        }

        // Usuarios: Solo admin, administrativo, coordinador
        if (viewId === 'usuarios' && rol !== 'admin' && rol !== 'administrativo' && rol !== 'coordinador') {
            utils.showToast('No tenés permisos para acceder a esta sección', 'error');
            return;
        }

        // Gestión Masiva: Solo admin y coordinador
        if (viewId === 'bulk-editor' && rol !== 'admin' && rol !== 'coordinador') {
            utils.showToast('No tenés permisos para acceder a esta sección', 'error');
            return;
        }

        // Mi Recorrido (ubicaciones-ujier): Solo ujier
        if (viewId === 'ubicaciones-ujier' && rol.toLowerCase() !== 'ujier') {
            utils.showToast('No tenés permisos para acceder a esta sección', 'error');
            return;
        }

        // Mis Asignaciones: Solo ujier
        if (viewId === 'mis-asignaciones' && rol.toLowerCase() !== 'ujier') {
            utils.showToast('No tenés permisos para acceder a esta sección', 'error');
            return;
        }

        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Show target view
        const targetView = document.getElementById(`view-${viewId}`);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('active');
        }

        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === viewId) {
                link.classList.add('active');
            }
        });

        // Update bottom nav active state (mobile)
        document.querySelectorAll('.bottom-nav-item').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === viewId) {
                btn.classList.add('active');
            }
        });

        // Update header title
        this.updatePageTitle(viewId);

        // Store current view
        this.currentView = viewId;

        // Close mobile sidebar
        if (window.innerWidth <= 1024) {
            document.getElementById('sidebar')?.classList.remove('open');
        }

        // Initialize view-specific modules
        this.initViewModule(viewId);
    },

    // Update page title
    updatePageTitle(viewId) {
        const titles = {
            'dashboard-home': { title: 'Dashboard', subtitle: 'Panel de control' },
            'lista-notificaciones': { title: 'Notificaciones', subtitle: 'Listado de todas las notificaciones' },
            'asignaciones': { title: 'Asignaciones', subtitle: 'Gestión de asignaciones a ujieres' },
            'usuarios': { title: 'Usuarios', subtitle: 'Gestión de usuarios del sistema' },
            'reportes': { title: 'Reportes', subtitle: 'Generación de informes y planillas' },
            'mis-asignaciones': { title: 'Mi Ruta', subtitle: 'Notificaciones asignadas para hoy' },
            'historial-ujier': { title: 'Mi Historial', subtitle: 'Historial de diligencias realizadas' },
            'sincronizar': { title: 'Sincronizar', subtitle: 'Gestión de datos offline' },
            'auditoria': { title: 'Panel de Auditoría', subtitle: 'Control y seguimiento de operaciones' },
            'cargas-diferidas': { title: 'Cargas Diferidas', subtitle: 'Notificaciones con carga diferida' },
            'estadisticas': { title: 'Estadísticas', subtitle: 'Análisis de rendimiento' },
            'devoluciones': { title: 'Retorno de Notificaciones', subtitle: 'Control de documentos devueltos por ujieres' },
            'bulk-editor': { title: 'Gestión Masiva', subtitle: 'Corrección masiva de resultados de diligencia' }
        };

        const pageInfo = titles[viewId] || { title: 'SGND', subtitle: '' };

        const titleEl = document.getElementById('page-title');
        const subtitleEl = document.getElementById('page-subtitle');

        if (titleEl) titleEl.textContent = pageInfo.title;
        if (subtitleEl) subtitleEl.textContent = pageInfo.subtitle;
    },

    // Initialize view-specific module
    async initViewModule(viewId) {
        console.log('🔄 Inicializando vista:', viewId);
        try {
            // Set a timeout to prevent infinite loading (30 seconds)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 30000)
            );

            let loadPromise;

            switch (viewId) {
                case 'dashboard-home':
                    loadPromise = typeof dashboard !== 'undefined' && dashboard.init
                        ? dashboard.init()
                        : Promise.resolve();
                    break;
                case 'lista-notificaciones':
                    loadPromise = typeof notifications !== 'undefined' && notifications.loadNotifications
                        ? notifications.loadNotifications()
                        : Promise.resolve();
                    break;
                case 'reportes':
                    loadPromise = typeof reports !== 'undefined' && reports.init
                        ? Promise.resolve(reports.init())
                        : Promise.resolve();
                    break;
                case 'mapa-seguimiento':
                    loadPromise = typeof adminMap !== 'undefined' && adminMap.init
                        ? adminMap.init()
                        : Promise.resolve();
                    break;
                case 'mis-asignaciones':
                    loadPromise = typeof ujier !== 'undefined' && ujier.loadAssignments
                        ? ujier.loadAssignments()
                        : Promise.resolve();
                    break;
                case 'ubicaciones-ujier':
                    loadPromise = typeof ujier !== 'undefined' && ujier.initMap
                        ? ujier.initMap()
                        : Promise.resolve();
                    break;
                    loadPromise = typeof ujier !== 'undefined' && ujier.loadAssignments
                        ? ujier.loadAssignments()
                        : Promise.resolve();
                    break;
                case 'historial-ujier':
                    loadPromise = typeof ujier !== 'undefined' && ujier.loadHistory
                        ? ujier.loadHistory()
                        : Promise.resolve();
                    break;
                case 'referencias-gral':
                    loadPromise = typeof ujier !== 'undefined' && ujier.initReferences
                        ? ujier.initReferences()
                        : Promise.resolve();
                    break;
                case 'asignaciones':
                    loadPromise = typeof asignaciones !== 'undefined' && asignaciones.init
                        ? asignaciones.init()
                        : Promise.resolve();
                    break;
                case 'usuarios':
                    loadPromise = typeof usuarios !== 'undefined' && usuarios.init
                        ? usuarios.init()
                        : Promise.resolve();
                    break;
                case 'devoluciones':
                    loadPromise = typeof devoluciones !== 'undefined' && devoluciones.init
                        ? devoluciones.init()
                        : Promise.resolve();
                    break;
                case 'bulk-editor':
                    loadPromise = typeof bulkEditor !== 'undefined' && bulkEditor.init
                        ? bulkEditor.init()
                        : Promise.resolve();
                    break;
                case 'auditoria':
                    loadPromise = typeof audit !== 'undefined' && audit.init
                        ? audit.init()
                        : Promise.resolve();
                    break;
                case 'planillas':
                    loadPromise = Promise.all([
                        typeof planillas !== 'undefined' && planillas.init
                            ? Promise.resolve(planillas.init())
                            : Promise.resolve(),
                        typeof reports !== 'undefined' && reports.init
                            ? Promise.resolve(reports.init())
                            : Promise.resolve()
                    ]);
                    break;
                default:
                    loadPromise = Promise.resolve();
            }

            console.log('⏳ Esperando carga de:', viewId);
            await Promise.race([loadPromise, timeoutPromise]);
            console.log('✅ Vista cargada:', viewId);
        } catch (error) {
            console.error(`❌ Error loading view ${viewId}:`, error);
            // Don't show error toast for timeout - just silently fail
        }
    },

    // Handle new notification form
    async handleNewNotification(event) {
        event.preventDefault();

        const form = event.target;

        // Manual collection to be 100% sure and resilient to cache issues
        const getVal = (id) => document.getElementById(id)?.value || null;
        const getCheck = (id) => document.getElementById(id)?.checked || false;

        // Create notification object
        // Use origen-dinamico if it has a value (for Ley 22.172 or Correspondencia)
        const origenDinamico = getVal('origen-dinamico');
        const origenJuzgado = getVal('origen');

        const destinatarioEspecial = getVal('destinatario-especial');
        const destinatarioNombre = getVal('destinatario-nombre');

        const isSpecialVal = utils.isSpecialDestination(destinatarioEspecial);

        const notificationData = {
            tipo_notificacion: getVal('tipo-notificacion'),
            n_expediente: getVal('n-expediente'),
            caratula: getVal('caratula'),
            origen: origenDinamico || origenJuzgado,
            letrado: getVal('letrado'),
            destinatario_especial: isSpecialVal ? '1' : '0',
            destinatario_nombre: isSpecialVal ? destinatarioEspecial : destinatarioNombre,
            domicilio: getVal('domicilio'),
            zona: getVal('zona'),
            fecha_entrega_ujier: getVal('fecha-entrega') || getVal('persist-fecha-entrega'),
            tipo_troquel: getVal('tipo-troquel'),
            sin_troquel: getCheck('sin-troquel') ? 1 : 0,
            n_troquel: getVal('n-troquel') ? parseInt(getVal('n-troquel')) : null,
            medio_pago: getVal('medio-pago'),
            costo: parseFloat(getVal('costo')) || 0,
            asignado_a: getVal('asignado-a') || null,
            observaciones_iniciales: getVal('observaciones-iniciales')
        };

        // --- MANUAL VALIDATION (Needed because of novalidate) ---
        const errors = [];
        const validate = (val, name, id) => {
            if (!val || val === '') {
                errors.push(name);
                const el = document.getElementById(id);
                if (el) el.style.borderColor = '#ef4444';
                return false;
            }
            const el = document.getElementById(id);
            if (el) el.style.borderColor = '';
            return true;
        };

        validate(notificationData.n_expediente, 'N° Expediente', 'n-expediente');
        validate(notificationData.caratula, 'Carátula', 'caratula');
        validate(notificationData.domicilio, 'Domicilio', 'domicilio');
        validate(notificationData.destinatario_nombre, 'Destinatario', 'destinatario-nombre');

        // Zona is mandatory
        if (!notificationData.zona) {
            errors.push('Zona');
            const zEl = document.getElementById('zona');
            if (zEl) zEl.style.borderColor = '#ef4444';
        } else {
            const zEl = document.getElementById('zona');
            if (zEl) zEl.style.borderColor = '';
        }

        // Troquel is mandatory unless 'sin troquel'
        if (!notificationData.sin_troquel && !notificationData.n_troquel) {
            errors.push('N° Troquel');
            const ntEl = document.getElementById('n-troquel');
            if (ntEl) ntEl.style.borderColor = '#ef4444';
        } else {
            const ntEl = document.getElementById('n-troquel');
            if (ntEl) ntEl.style.borderColor = '';
        }

        if (errors.length > 0) {
            utils.showToast('⚠️ Por favor, complete los campos obligatorios: ' + errors.join(', '), 'error');
            return;
        }

        // VALIDA ORIGEN: Must have a selected value from dropdown (hidden input)
        if (!notificationData.origen) {
            utils.showToast('⚠️ Por favor, seleccione un Origen válido de la lista desplegable', 'error');

            // Highlight the relevant input
            const iFijo = document.getElementById('origen-input');
            const iDin = document.getElementById('origen-dinamico-input');

            if (iFijo && !document.getElementById('grupo-origen-fijo').classList.contains('hidden')) {
                iFijo.focus();
                iFijo.style.borderColor = '#ef4444';
            } else if (iDin) {
                iDin.focus();
                iDin.style.borderColor = '#ef4444';
            }

            return; // Block submission
        }

        console.log('📤 Enviando datos a MySQL:', notificationData);

        // Prevent double submission
        const submitBtn = document.getElementById('btn-save-nueva-notif');
        if (submitBtn.disabled) {
            console.log('⚠️ Ya se está procesando, ignorando submit duplicado');
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';

        let result;

        try {
            // Check if we're editing an existing notification
            if (notifications.editingId) {
                result = await notifications.update(notifications.editingId, notificationData);
            } else {
                result = await notifications.create(notificationData);
            }

            console.log('📥 Resultado de MySQL:', result);

            if (result.success) {
                form.reset();
                notifications.editingId = null;

                // Reset selector-troquel and its effects
                const troquelSelect = document.getElementById('selector-troquel');
                if (troquelSelect) {
                    troquelSelect.value = 'C';
                    this.handleTroquelChange('C');
                }

                // Reset searchable inputs
                const origenInput = document.getElementById('origen-input');
                const origenHidden = document.getElementById('origen');
                if (origenInput) origenInput.value = '';
                if (origenHidden) origenHidden.value = '';

                // Reset dynamic origin field
                this.handleTipoNotificacionChange('cedulas');

                // Close modal
                const modal = document.getElementById('modal-nueva-notificacion');
                if (modal) {
                    modal.classList.add('hidden');
                    document.body.style.overflow = '';
                }

                // Refresh list
                notifications.loadNotifications();
            } else {
                console.error('❌ Error en resultado:', result);
                utils.showToast('Error al guardar notificación', 'error');
            }
        } catch (error) {
            console.error('❌ Error en handleNewNotification:', error);
            utils.showToast('Error al guardar: ' + error.message, 'error');
        } finally {
            // Re-enable button
            submitBtn.disabled = false;
            submitBtn.textContent = '💾 Guardar Notificación';
        }
    },

    // Hide loading screen
    hideLoading() {
        console.log('🖼️ Hiding loading screen and showing app container...');
        const loadingScreen = document.getElementById('loading-screen');
        const appContainer = document.getElementById('app');

        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.remove();
                console.log('🧹 Loading screen removed from DOM');
            }, 500);
        }

        if (appContainer) {
            appContainer.classList.remove('hidden');
            appContainer.style.display = 'block'; // Force visibility
            console.log('✅ App container unhidden');
        } else {
            console.error('❌ App container (#app) not found!');
        }
    },

    // Show password reset modal (mandatory)
    showPasswordResetModal() {
        const modal = document.getElementById('modal-password-reset');
        if (!modal) {
            console.error('Modal de cambio de contraseña no encontrado');
            return;
        }

        // Force reset form
        document.getElementById('form-password-reset')?.reset();
        document.getElementById('password-reset-error')?.classList.add('hidden');

        modal.classList.remove('hidden');
        modal.classList.add('active'); // Some modals might use this
        modal.style.display = 'flex'; // Ensure it's shown if .hidden uses display:none
        modal.style.zIndex = '99999'; // Super high
        document.body.style.overflow = 'hidden';

        console.log('🚀 Modal reset-password visible:', modal.style.display, 'z-index:', modal.style.zIndex);

        // Close button (return to login)
        const closeBtn = document.getElementById('btn-close-modal-reset');
        if (closeBtn) {
            closeBtn.onclick = () => {
                console.log('🔙 User canceled password reset, returning to login...');
                auth.signOut(); // Clear session and redirect
                modal.classList.add('hidden');
                modal.style.display = 'none';
                document.body.style.overflow = '';
                this.showLoginPage();
            };
        }

        // Setup form handler (only once)
        const form = document.getElementById('form-password-reset');
        if (form && !form.dataset.listenerAttached) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePasswordReset();
            });
            form.dataset.listenerAttached = 'true';
        }
    },

    // Handle password reset
    async handlePasswordReset() {
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const errorDiv = document.getElementById('password-reset-error');
        const submitBtn = document.querySelector('#form-password-reset button[type="submit"]');

        // Clear previous errors
        errorDiv.classList.add('hidden');

        // Validate
        if (newPassword.length < 6) {
            errorDiv.textContent = 'La contraseña debe tener al menos 6 caracteres';
            errorDiv.classList.remove('hidden');
            return;
        }

        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'Las contraseñas no coinciden';
            errorDiv.classList.remove('hidden');
            return;
        }

        // Check if new password is the same as DNI
        if (auth.currentUser?.dni && newPassword === auth.currentUser.dni) {
            errorDiv.textContent = 'La nueva contraseña no puede ser tu DNI';
            errorDiv.classList.remove('hidden');
            return;
        }

        // Show loading
        submitBtn.disabled = true;
        submitBtn.textContent = 'Cambiando contraseña...';

        try {
            const result = await auth.changePassword(auth.currentUser.id, newPassword);

            if (result.success) {
                // Update current user
                auth.currentUser.password_reset_required = false;
                auth.storeSession(auth.currentUser);

                // Close modal
                const modal = document.getElementById('modal-password-reset');
                modal?.classList.add('hidden');
                document.body.style.overflow = '';

                utils.showToast('Contraseña actualizada correctamente', 'success');

                // Now that password is changed, show the normal app UI
                this.showDashboard();
                this.updateUserInterface();

                // Initialize modules now
                await this.initializeModules();
            } else {
                errorDiv.textContent = result.error || 'Error al cambiar contraseña';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            errorDiv.textContent = 'Error de conexión. Intentá de nuevo.';
            errorDiv.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '🔒 Cambiar Contraseña';
        }
    },

    // Load application settings
    async loadSettings() {
        try {
            const { data, error } = await db.getSettings();
            if (!error && data) {
                this.appSettings = data;

                // Si es coordinador o admin, mostrar barra y popular input
                const rol = auth.currentUser?.rol ? auth.currentUser.rol.toLowerCase() : '';
                if (rol === 'coordinador' || rol === 'admin') {
                    const settingInput = document.getElementById('setting-valor-troquel');
                    if (settingInput && data.valor_troquel) {
                        settingInput.value = data.valor_troquel;
                    }
                    document.getElementById('coordinator-settings-bar')?.classList.remove('hidden');
                }
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    },

    // Update troquel price setting
    async updateTroquelSetting() {
        const settingInput = document.getElementById('setting-valor-troquel');
        if (!settingInput) return;

        const value = settingInput.value;
        if (value === '' || isNaN(value)) {
            utils.showToast('Por favor ingresá un valor válido', 'warning');
            return;
        }

        utils.showLoading('Guardando configuración...');
        const { error } = await db.updateSettings({ valor_troquel: value });
        utils.hideLoading();

        if (error) {
            utils.showToast('Error al guardar: ' + error, 'error');
        } else {
            this.appSettings.valor_troquel = value;
            utils.showToast(`Valor fijo del troquel actualizado a: $${value}`, 'success');
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

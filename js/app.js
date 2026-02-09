/**
 * SGND - Main Application Controller
 */

const app = {
    currentView: 'lista-notificaciones',

    // Initialize application
    async init() {
        console.log('🚀 Initializing SGND...');

        // Initialize API Client (PHP/MySQL backend)
        initApiClient();

        // Initialize offline support
        offline.init();

        // Initialize theme
        this.initTheme();

        // Check authentication
        await this.checkAuth();

        // Setup event listeners
        this.setupEventListeners();

        // Hide loading screen immediately when ready
        this.hideLoading();
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

        // Auto-set troquel type for Mandamientos
        const isMandamiento = tipo.includes('mandamientos') && tipo !== 'cedulas_mandamientos_22172';
        const isHabilitacion = tipo.includes('habilitacion');

        if (tipo === 'mandamientos' || isHabilitacion) {
            if (troquelSelect) {
                troquelSelect.value = 'M';
                this.handleTroquelChange('M');
            }
        } else if (tipo === 'cedulas' ||
            tipo === 'cedulas_mandamientos_22172' ||
            tipo === 'cedulas_correspondencia' ||
            tipo.includes('urgentes')) {
            if (troquelSelect) {
                troquelSelect.value = 'C';
                this.handleTroquelChange('C');
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

        if (tipo === 'cedulas_mandamientos_22172' || tipo === 'mandamientos_22172') {
            grupoFixed?.classList.add('hidden');
            document.getElementById('origen').required = false;
            document.getElementById('origen-input').required = false;

            grupoDinamico.classList.remove('hidden');
            newInput.required = true;
            label.textContent = 'Provincia de Origen *';
            newInput.placeholder = 'Escribí para buscar provincia...';
            options = SGND_DATA.PROVINCIAS;

        } else if (tipo === 'cedulas_correspondencia') {
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
            document.getElementById('origen').required = true;
            document.getElementById('origen-input').required = true;

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
            // Delay to allow click on dropdown
            setTimeout(() => {
                dropdown.classList.remove('show');
                // If nothing was selected but there's text, try to match
                if (input.value && !hidden.value) {
                    const match = options.find(opt => opt.toLowerCase() === input.value.toLowerCase());
                    if (match) {
                        input.value = match;
                        hidden.value = match;
                    }
                }
            }, 200);
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
        // Try to load from demo session first
        const demoUser = auth.checkDemoSession();

        if (demoUser) {
            await this.onLoginSuccess();
            return;
        }

        // Check session
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

                // Domicilio non-mandatory
                if (domicilioInput) {
                    domicilioInput.required = false;
                    domicilioInput.placeholder = "Dirección (Opcional para destinatario especial)";
                }
                if (labelDomicilio) labelDomicilio.innerHTML = 'Domicilio';
            } else {
                // Reset mandatory
                if (domicilioInput) {
                    domicilioInput.required = true;
                    domicilioInput.placeholder = "Dirección completa";
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
            }
        });

        // Clear form button
        document.getElementById('btn-limpiar-form')?.addEventListener('click', () => {
            document.getElementById('form-nueva-notificacion')?.reset();
        });

        // Modal Nueva Notificación
        const modalNuevaNotif = document.getElementById('modal-nueva-notificacion');

        document.getElementById('btn-open-nueva-notif')?.addEventListener('click', () => {
            modalNuevaNotif?.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Prevent scroll

            // Reset for new entry
            document.getElementById('form-nueva-notificacion')?.reset();
            notifications.editingId = null;
            const modalTitle = modalNuevaNotif?.querySelector('.modal-title');
            if (modalTitle) modalTitle.textContent = '📦 Nueva Notificación';

            // Show persistent settings bar for new entries
            const pBar = document.getElementById('persistent-settings-container');
            if (pBar) pBar.classList.remove('hidden-important');

            this.applyPersistentSettings();
        });

        const closeModal = () => {
            modalNuevaNotif?.classList.add('hidden');
            document.body.style.overflow = '';
        };

        document.getElementById('btn-close-modal-nueva-notif')?.addEventListener('click', closeModal);
        document.getElementById('btn-cancelar-nueva-notif')?.addEventListener('click', closeModal);
        modalNuevaNotif?.querySelector('.modal-overlay')?.addEventListener('click', closeModal);

        // Persistent settings change
        document.getElementById('persist-zona')?.addEventListener('change', () => this.savePersistentSettings());
        document.getElementById('persist-ujier')?.addEventListener('change', () => this.savePersistentSettings());
        document.getElementById('persist-fecha-entrega')?.addEventListener('change', () => this.savePersistentSettings());

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
        await auth.signOut();
        this.showLoginPage();
        utils.showToast('Sesión cerrada', 'info');
    },

    // On login success
    async onLoginSuccess() {
        console.log('✅ Login exitoso:', auth.currentUser?.email);
        console.log('🎭 Rol detectado:', auth.currentUser?.rol);
        console.log('🔒 Reset requerido:', auth.currentUser?.password_reset_required);

        // Check if password reset is required (robust check for bool, string "1" or number 1)
        const resetRequired = auth.currentUser?.password_reset_required;

        if (resetRequired === true || resetRequired === 1 || resetRequired === "1") {
            console.log('⚠️ Bloqueando app: Mostrando modal de reset obligatorio');
            // Show only the modal, don't update UI or show dashboard yet
            this.showPasswordResetModal();
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

        // Update user info in sidebar
        document.getElementById('user-name').textContent = nombre;
        document.getElementById('user-role').textContent = CONFIG.ROLES[rol] || rol;
        document.getElementById('user-avatar').querySelector('.avatar-initials').textContent = auth.getInitials();

        // Show appropriate menu based on role
        document.getElementById('menu-admin')?.classList.add('hidden');
        document.getElementById('menu-ujier')?.classList.add('hidden');
        document.getElementById('menu-auditor')?.classList.add('hidden');

        const lowerRol = rol ? rol.toLowerCase() : '';

        if (lowerRol === 'admin') {
            // Admin: acceso completo
            document.getElementById('menu-admin')?.classList.remove('hidden');
            document.getElementById('menu-auditor')?.classList.remove('hidden');
            this.navigateTo('lista-notificaciones');
        } else if (lowerRol === 'administrativo') {
            // Administrativo: acceso admin pero sin auditoría
            document.getElementById('menu-admin')?.classList.remove('hidden');
            this.navigateTo('lista-notificaciones');
        } else if (lowerRol === 'coordinador') {
            // Coordinador: acceso admin pero sin auditoría
            document.getElementById('menu-admin')?.classList.remove('hidden');
            this.navigateTo('lista-notificaciones');
        } else if (lowerRol === 'ujier') {
            document.getElementById('menu-ujier')?.classList.remove('hidden');
            this.navigateTo('mis-asignaciones');
        } else if (lowerRol === 'auditor') {
            document.getElementById('menu-auditor')?.classList.remove('hidden');
            document.getElementById('menu-admin')?.classList.remove('hidden');
            this.navigateTo('lista-notificaciones');
        }

        // Hide specific menu items based on role
        this.updateMenuItemsVisibility(rol);

        // Show/hide Global Action button (Nueva Notificación)
        // Show/hide Global Action button (Nueva Notificación)
        const btnNuevaNotif = document.getElementById('btn-open-nueva-notif');
        if (btnNuevaNotif) {
            if (rol === 'admin' || rol === 'administrativo' || rol === 'coordinador') {
                btnNuevaNotif.classList.remove('hidden');
            } else {
                btnNuevaNotif.classList.add('hidden');
            }
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

            if (rol === 'ujier') {
                ujierItems.forEach(el => el.style.display = 'flex');
            } else {
                // Admin, Administrativo, Coordinador, Auditor
                adminItems.forEach(el => el.style.display = 'flex');
            }
        }
    },

    // Update menu items visibility based on role
    updateMenuItemsVisibility(rol) {
        // Devoluciones: Solo admin y coordinador
        const devolucionesLink = document.querySelector('[data-view="devoluciones"]');
        if (devolucionesLink) {
            const devolucionesItem = devolucionesLink.closest('.nav-item');
            if (rol.toLowerCase() === 'admin' || rol.toLowerCase() === 'coordinador') {
                devolucionesItem?.classList.remove('hidden');
            } else {
                devolucionesItem?.classList.add('hidden');
            }
        }

        // Mapa General: Solo admin y coordinador
        const mapaLink = document.querySelector('[data-view="mapa-seguimiento"]');
        if (mapaLink) {
            const mapaItem = mapaLink.closest('.nav-item');
            if (rol.toLowerCase() === 'admin' || rol.toLowerCase() === 'coordinador') {
                mapaItem?.classList.remove('hidden');
            } else {
                mapaItem?.classList.add('hidden');
            }
        }

        // Auditoría: Solo admin
        const auditoriaLink = document.querySelector('[data-view="auditoria"]');
        if (auditoriaLink) {
            const auditoriaItem = auditoriaLink.closest('.nav-item');
            if (rol.toLowerCase() === 'admin') {
                auditoriaItem?.classList.remove('hidden');
            } else {
                auditoriaItem?.classList.add('hidden');
            }
        }
    },

    // Initialize modules based on role
    async initializeModules() {
        const rol = auth.currentUser?.rol;

        // Módulos comunes para admin, administrativo, coordinador, auditor
        if (rol === 'admin' || rol === 'administrativo' || rol === 'auditor' || rol === 'coordinador') {
            await dashboard.init();
            await notifications.init();
            await notifications.loadUjieres();
            planillas.init();
            reports.init();
        }

        // Devoluciones: Solo admin y coordinador
        if (rol === 'admin' || rol === 'coordinador') {
            await devoluciones.init();
        }

        // Usuarios: Solo admin, administrativo, coordinador
        if (rol === 'admin' || rol === 'administrativo' || rol === 'coordinador') {
            await usuarios.init();
        }

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
        targetView?.classList.add('active');

        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === viewId) {
                link.classList.add('active');
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
            'devoluciones': { title: 'Retorno de Notificaciones', subtitle: 'Control de documentos devueltos por ujieres' }
        };

        const pageInfo = titles[viewId] || { title: 'SGND', subtitle: '' };

        document.getElementById('page-title').textContent = pageInfo.title;
        document.getElementById('page-subtitle').textContent = pageInfo.subtitle;
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
                case 'auditoria':
                    loadPromise = typeof audit !== 'undefined' && audit.init
                        ? audit.init()
                        : Promise.resolve();
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

        const notificationData = {
            tipo_notificacion: getVal('tipo-notificacion'),
            n_expediente: getVal('n-expediente'),
            caratula: getVal('caratula'),
            origen: origenDinamico || origenJuzgado,
            letrado: getVal('letrado'),
            destinatario_especial: getVal('destinatario-especial') || null,
            destinatario_nombre: getVal('destinatario-nombre') || getVal('destinatario-especial'),
            domicilio: getVal('domicilio'),
            zona: getVal('zona'),
            fecha_entrega_ujier: getVal('fecha-entrega') || getVal('persist-fecha-entrega'),
            tipo_troquel: getVal('tipo-troquel'),
            sin_troquel: getCheck('sin-troquel'),
            n_troquel: getVal('n-troquel') || null,
            medio_pago: getVal('medio-pago'),
            costo: parseFloat(getVal('costo')) || 0,
            asignado_a: getVal('asignado-a') || null,
            observaciones_iniciales: getVal('observaciones-iniciales')
        };

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
                document.getElementById('grupo-origen-dinamico')?.classList.add('hidden');
                document.getElementById('grupo-origen-fijo')?.classList.remove('hidden');

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
        const loadingScreen = document.getElementById('loading-screen');
        const appContainer = document.getElementById('app');

        loadingScreen?.classList.add('fade-out');
        appContainer?.classList.remove('hidden');

        setTimeout(() => {
            loadingScreen?.remove();
        }, 500);
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
        modal.style.display = 'flex'; // Ensure it's shown if .hidden uses display:none
        document.body.style.overflow = 'hidden';

        // Setup form handler
        const form = document.getElementById('form-password-reset');
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePasswordReset();
        });
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
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

/**
 * SGND - Main Application Controller
 */

const app = {
    currentView: 'dashboard-home',

    // Initialize application
    async init() {
        console.log('🚀 Initializing SGND...');

        // Initialize Supabase
        initSupabase();

        // Initialize offline support
        offline.init();

        // Initialize theme
        this.initTheme();

        // Check authentication
        await this.checkAuth();

        // Setup event listeners
        this.setupEventListeners();

        // Hide loading screen
        setTimeout(() => {
            this.hideLoading();
        }, 1000);
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

    // Handle notification type change - show/populate dynamic origin
    handleTipoNotificacionChange(tipo) {
        const grupoJuzgado = document.getElementById('origen')?.closest('.form-group');
        const grupoDinamico = document.getElementById('grupo-origen-dinamico');
        const input = document.getElementById('origen-dinamico-input');
        const hidden = document.getElementById('origen-dinamico');
        const dropdown = document.getElementById('origen-dropdown');
        const label = document.getElementById('label-origen-dinamico');

        if (!grupoDinamico || !input || !dropdown || !label) return;

        // Clear previous
        input.value = '';
        hidden.value = '';
        dropdown.innerHTML = '';

        // Remove previous listeners
        input.replaceWith(input.cloneNode(true));
        const newInput = document.getElementById('origen-dinamico-input');

        let options = [];

        if (tipo === 'cedulas_mandamientos_22172') {
            // Hide juzgado selector, show province selector
            grupoJuzgado?.classList.add('hidden');
            document.getElementById('origen').required = false;

            grupoDinamico.classList.remove('hidden');
            newInput.required = true;
            label.textContent = 'Provincia de Origen *';
            newInput.placeholder = 'Escribí para buscar provincia...';
            options = SGND_DATA.PROVINCIAS;

        } else if (tipo === 'cedulas_correspondencia') {
            // Hide juzgado selector, show locality selector
            grupoJuzgado?.classList.add('hidden');
            document.getElementById('origen').required = false;

            grupoDinamico.classList.remove('hidden');
            newInput.required = true;
            label.textContent = 'Localidad de Origen *';
            newInput.placeholder = 'Escribí para buscar localidad...';
            options = SGND_DATA.LOCALIDADES_CATAMARCA;

        } else {
            // Show juzgado selector, hide dynamic origin
            grupoJuzgado?.classList.remove('hidden');
            document.getElementById('origen').required = true;

            grupoDinamico.classList.add('hidden');
            newInput.required = false;
            return;
        }

        // Setup searchable select
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

        const filterOptions = () => {
            const query = input.value.toLowerCase();
            const filtered = options.filter(opt => opt.toLowerCase().includes(query));
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

        // Check Supabase session
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

        // Sidebar navigation
        document.querySelectorAll('.nav-link[data-view]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                this.navigateTo(view);
            });
        });

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

        // Tipo notificación change - show/hide dynamic destination field
        document.getElementById('tipo-notificacion')?.addEventListener('change', (e) => {
            this.handleTipoNotificacionChange(e.target.value);
        });

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
        this.showDashboard();
        this.updateUserInterface();
        await this.initializeModules();
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

        if (rol === 'admin' || rol === 'administrativo') {
            document.getElementById('menu-admin')?.classList.remove('hidden');
            this.navigateTo('dashboard-home');
        } else if (rol === 'ujier') {
            document.getElementById('menu-ujier')?.classList.remove('hidden');
            this.navigateTo('mis-asignaciones');
        } else if (rol === 'auditor') {
            document.getElementById('menu-auditor')?.classList.remove('hidden');
            document.getElementById('menu-admin')?.classList.remove('hidden'); // Auditors can see admin dashboard
            this.navigateTo('dashboard-home');
        }
    },

    // Initialize modules based on role
    async initializeModules() {
        const rol = auth.currentUser?.rol;

        if (rol === 'admin' || rol === 'administrativo' || rol === 'auditor') {
            await dashboard.init();
            await notifications.init();
            await notifications.loadUjieres();
            reports.init();
        }

        if (rol === 'ujier') {
            await ujier.init();
        }
    },

    // Navigate to view
    navigateTo(viewId) {
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
            'nueva-notificacion': { title: 'Nueva Notificación', subtitle: 'Registrar nueva cédula o mandamiento' },
            'lista-notificaciones': { title: 'Notificaciones', subtitle: 'Listado de todas las notificaciones' },
            'asignaciones': { title: 'Asignaciones', subtitle: 'Gestión de asignaciones a ujieres' },
            'usuarios': { title: 'Usuarios', subtitle: 'Gestión de usuarios del sistema' },
            'reportes': { title: 'Reportes', subtitle: 'Generación de informes y planillas' },
            'mis-asignaciones': { title: 'Mi Ruta', subtitle: 'Notificaciones asignadas para hoy' },
            'historial-ujier': { title: 'Mi Historial', subtitle: 'Historial de diligencias realizadas' },
            'sincronizar': { title: 'Sincronizar', subtitle: 'Gestión de datos offline' },
            'auditoria': { title: 'Panel de Auditoría', subtitle: 'Control y seguimiento de operaciones' },
            'cargas-diferidas': { title: 'Cargas Diferidas', subtitle: 'Notificaciones con carga diferida' },
            'estadisticas': { title: 'Estadísticas', subtitle: 'Análisis de rendimiento' }
        };

        const pageInfo = titles[viewId] || { title: 'SGND', subtitle: '' };

        document.getElementById('page-title').textContent = pageInfo.title;
        document.getElementById('page-subtitle').textContent = pageInfo.subtitle;
    },

    // Initialize view-specific module
    async initViewModule(viewId) {
        try {
            // Set a timeout to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );

            let loadPromise;

            switch (viewId) {
                case 'dashboard-home':
                    loadPromise = dashboard.init();
                    break;
                case 'lista-notificaciones':
                    loadPromise = notifications.loadNotifications();
                    break;
                case 'reportes':
                    loadPromise = Promise.resolve(reports.init());
                    break;
                case 'mis-asignaciones':
                    loadPromise = ujier.loadAssignments();
                    break;
                case 'historial-ujier':
                    loadPromise = ujier.loadHistory();
                    break;
                case 'asignaciones':
                    loadPromise = asignaciones.init();
                    break;
                case 'usuarios':
                    loadPromise = usuarios.init();
                    break;
                default:
                    loadPromise = Promise.resolve();
            }

            await Promise.race([loadPromise, timeoutPromise]);
        } catch (error) {
            console.error(`Error loading view ${viewId}:`, error);
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
            destinatario_nombre: getVal('destinatario-nombre'),
            domicilio: getVal('domicilio'),
            zona: getVal('zona'),
            tipo_troquel: getVal('tipo-troquel'),
            sin_troquel: getCheck('sin-troquel'),
            n_troquel: getVal('n-troquel') || null,
            medio_pago: getVal('medio-pago'),
            costo: parseFloat(getVal('costo')) || 0,
            asignado_a: getVal('asignado-a') || null,
            observaciones_iniciales: getVal('observaciones-iniciales')
        };

        console.log('📤 Enviando datos a Supabase:', notificationData);

        // Prevent double submission
        const submitBtn = form.querySelector('button[type="submit"]');
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

            console.log('📥 Resultado de Supabase:', result);

            if (result.success) {
                form.reset();
                notifications.editingId = null;

                // Re-apply required logic for troquel after reset
                document.getElementById('grupo-n-troquel')?.classList.remove('hidden');
                document.getElementById('n-troquel').required = true;

                // Reset dynamic origin field
                document.getElementById('grupo-origen-dinamico')?.classList.add('hidden');
                document.getElementById('origen')?.closest('.form-group')?.classList.remove('hidden');

                // Navigate to list
                setTimeout(() => {
                    this.navigateTo('lista-notificaciones');
                }, 1000);
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
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

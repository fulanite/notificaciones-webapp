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

        // Check authentication
        await this.checkAuth();

        // Setup event listeners
        this.setupEventListeners();

        // Hide loading screen
        setTimeout(() => {
            this.hideLoading();
        }, 1000);
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

        // Mobile menu toggle
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
        switch (viewId) {
            case 'dashboard-home':
                await dashboard.init();
                break;
            case 'lista-notificaciones':
                await notifications.loadNotifications();
                break;
            case 'reportes':
                reports.init();
                break;
            case 'mis-asignaciones':
                await ujier.loadAssignments();
                break;
            case 'historial-ujier':
                await ujier.loadHistory();
                break;
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
        const notificationData = {
            tipo_notificacion: getVal('tipo-notificacion'),
            n_expediente: getVal('n-expediente'),
            caratula: getVal('caratula'),
            origen: getVal('origen'),
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

        const result = await notifications.create(notificationData);

        if (result.success) {
            form.reset();

            // Re-apply required logic for troquel after reset
            document.getElementById('grupo-n-troquel')?.classList.remove('hidden');
            document.getElementById('n-troquel').required = true;

            // Navigate to list
            setTimeout(() => {
                this.navigateTo('lista-notificaciones');
            }, 1000);
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

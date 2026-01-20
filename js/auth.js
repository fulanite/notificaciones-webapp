/**
 * SGND - Authentication Module
 * Updated for PHP/MySQL backend
 */

const auth = {
    currentUser: null,
    SESSION_KEY: 'sgnd_session',

    // Initialize auth and check session
    async init() {
        // Check for stored session
        const storedSession = this.getStoredSession();

        if (storedSession) {
            // Verify session is still valid
            const verified = await this.verifySession(storedSession.email);
            if (verified) {
                this.currentUser = storedSession;
                return this.currentUser;
            } else {
                // Session invalid, clear it
                this.clearSession();
            }
        }

        return null;
    },

    // Verify session with server
    async verifySession(email) {
        try {
            const response = await fetch('/api/auth.php?action=verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Session verification failed:', error);
            return false;
        }
    },

    // Load user profile from API
    async loadUserProfile(email) {
        try {
            const { data: profile, error } = await db.getUserByEmail(email);

            if (profile) {
                this.currentUser = {
                    id: profile.id,
                    email: profile.email,
                    nombre: profile.nombre,
                    rol: profile.rol,
                    foto: profile.foto
                };
            } else {
                console.warn('Usuario no encontrado:', email);
                this.currentUser = null;
            }
        } catch (err) {
            console.error('Error al cargar perfil:', err);
            this.currentUser = null;
        }

        return this.currentUser;
    },

    // Sign in with email and password
    async signIn(email, password) {
        try {
            const response = await fetch('/api/auth.php?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success && data.data) {
                this.currentUser = {
                    id: data.data.id,
                    email: data.data.email,
                    nombre: data.data.nombre,
                    rol: data.data.rol,
                    foto: data.data.foto
                };

                // Store session
                this.storeSession(this.currentUser);

                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: data.error || 'Credenciales inválidas' };
            }
        } catch (error) {
            console.error('Sign in error:', error);
            return { success: false, error: 'Error de conexión' };
        }
    },

    // Store session in localStorage
    storeSession(user) {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
    },

    // Get stored session
    getStoredSession() {
        const stored = localStorage.getItem(this.SESSION_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return null;
            }
        }
        return null;
    },

    // Clear session
    clearSession() {
        localStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem('sgnd_demo_user'); // Legacy cleanup
        this.currentUser = null;
    },

    // Sign out
    async signOut() {
        this.clearSession();

        // Force a clean reload to login
        window.location.href = '/';
        return { success: true };
    },

    // Change password
    async changePassword(userId, newPassword) {
        try {
            const response = await fetch('/api/auth.php?action=change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, new_password: newPassword })
            });

            const data = await response.json();
            return { success: data.success, error: data.error };
        } catch (error) {
            console.error('Change password error:', error);
            return { success: false, error: 'Error de conexión' };
        }
    },

    // Create new user (admin only)
    async createUser(userData) {
        try {
            const response = await fetch('/api/auth.php?action=create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (data.success) {
                return { success: true, user: data.data };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Create user error:', error);
            return { success: false, error: 'Error de conexión' };
        }
    },

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    },

    // Check if user has a specific role
    hasRole(role) {
        if (!this.currentUser) return false;

        if (Array.isArray(role)) {
            return role.includes(this.currentUser.rol);
        }

        return this.currentUser.rol === role;
    },

    // Check demo session (for backward compatibility)
    checkDemoSession() {
        // First check new session format
        const session = this.getStoredSession();
        if (session) {
            this.currentUser = session;
            return this.currentUser;
        }

        // Check legacy demo session
        const stored = localStorage.getItem('sgnd_demo_user');
        if (stored) {
            this.currentUser = JSON.parse(stored);
            return this.currentUser;
        }
        return null;
    },

    // Auth state change callback
    onAuthStateChanged(isLoggedIn) {
        console.log('Auth state changed:', isLoggedIn);
    },

    // Get initials for avatar
    getInitials() {
        if (!this.currentUser || !this.currentUser.nombre) return 'US';

        const parts = this.currentUser.nombre.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    }
};

/**
 * SGND - Authentication Module
 */

const auth = {
    currentUser: null,

    // Initialize auth and check session
    async init() {
        if (!supabase) {
            console.log('Demo mode: Using mock authentication');
            return null;
        }

        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            await this.loadUserProfile(session.user.email);
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await this.loadUserProfile(session.user.email);
                this.onAuthStateChanged(true);
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.onAuthStateChanged(false);
            }
        });

        return this.currentUser;
    },

    // Load user profile from usuarios table
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
                console.warn('Usuario no encontrado en la tabla "usuarios":', email);
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
        if (!supabase) {
            // Demo mode - simulate login
            return this.demoSignIn(email, password);
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            // Load user profile
            await this.loadUserProfile(email);

            return { success: true, user: this.currentUser };
        } catch (error) {
            console.error('Sign in error:', error);
            return { success: false, error: error.message };
        }
    },

    // Demo sign in (for testing without Supabase)
    async demoSignIn(email, password) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Demo users
        const demoUsers = {
            'admin@sgnd.gob.ar': { id: '1', nombre: 'Admin Demo', rol: 'admin' },
            'ujier@sgnd.gob.ar': { id: '2', nombre: 'Juan Ujier', rol: 'ujier' },
            'auditor@sgnd.gob.ar': { id: '3', nombre: 'María Auditora', rol: 'auditor' }
        };

        if (demoUsers[email] && password === 'demo123') {
            this.currentUser = {
                id: demoUsers[email].id,
                email,
                nombre: demoUsers[email].nombre,
                rol: demoUsers[email].rol,
                foto: null
            };

            // Store in localStorage for persistence
            localStorage.setItem('sgnd_demo_user', JSON.stringify(this.currentUser));

            return { success: true, user: this.currentUser };
        }

        return { success: false, error: 'Credenciales inválidas' };
    },

    // Sign out
    async signOut() {
        // Clear local session data always
        localStorage.removeItem('sgnd_demo_user');

        if (supabase) {
            try {
                await supabase.auth.signOut();
            } catch (error) {
                console.error('Sign out error:', error);
            }
        }

        this.currentUser = null;

        // Force a clean reload to login
        window.location.href = '/';
        return { success: true };
    },

    // Password reset
    async resetPassword(email) {
        if (!supabase) {
            return { success: true, message: 'Demo mode: Password reset simulated' };
        }

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (error) throw error;

            return { success: true, message: 'Se ha enviado un correo para restablecer la contraseña' };
        } catch (error) {
            console.error('Password reset error:', error);
            return { success: false, error: error.message };
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

    // Check demo session
    checkDemoSession() {
        const stored = localStorage.getItem('sgnd_demo_user');
        if (stored) {
            this.currentUser = JSON.parse(stored);
            return this.currentUser;
        }
        return null;
    },

    // Auth state change callback
    onAuthStateChanged(isLoggedIn) {
        // This will be overridden by the app
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

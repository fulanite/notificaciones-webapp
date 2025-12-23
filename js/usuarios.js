/**
 * SGND - Usuarios Module
 * User management (CRUD)
 */

const usuarios = {
    users: [],
    editingId: null,

    // Initialize the module
    async init() {
        await this.loadUsers();
        this.setupEventListeners();
    },

    // Setup event listeners
    setupEventListeners() {
        // New user button
        document.getElementById('btn-nuevo-usuario')?.addEventListener('click', () => {
            this.openModal();
        });

        // Close modal
        document.getElementById('btn-close-modal-usuario')?.addEventListener('click', () => {
            this.closeModal();
        });
        document.getElementById('btn-cancelar-usuario')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Modal overlay click
        document.querySelector('#modal-usuario .modal-overlay')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Form submit
        document.getElementById('form-usuario')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUser();
        });

        // Search
        document.getElementById('search-usuarios')?.addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });
    },

    // Load users from database
    async loadUsers() {
        const tbody = document.getElementById('usuarios-table-body');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="6" class="loading">Cargando usuarios...</td></tr>';

        const { data, error } = await db.getUsers();

        if (error) {
            tbody.innerHTML = '<tr><td colspan="6" class="error">Error al cargar usuarios</td></tr>';
            return;
        }

        this.users = data || [];
        this.renderUsers(this.users);
    },

    // Render users table
    renderUsers(users) {
        const tbody = document.getElementById('usuarios-table-body');
        if (!tbody) return;

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">No hay usuarios registrados</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr>
                <td><strong>${u.nombre || '-'}</strong></td>
                <td>${u.email}</td>
                <td><span class="badge badge-${u.rol}">${this.getRolLabel(u.rol)}</span></td>
                <td><span class="status-badge ${u.activo ? 'status-completed' : 'status-deferred'}">
                    ${u.activo ? 'Activo' : 'Inactivo'}
                </span></td>
                <td>${u.ultimo_acceso ? utils.formatDate(u.ultimo_acceso) : 'Nunca'}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="usuarios.editUser('${u.id}')">
                        ✏️ Editar
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="usuarios.toggleStatus('${u.id}', ${!u.activo})">
                        ${u.activo ? '🚫 Desactivar' : '✅ Activar'}
                    </button>
                </td>
            </tr>
        `).join('');
    },

    // Get role label in Spanish
    getRolLabel(rol) {
        const labels = {
            'admin': 'Administrador',
            'ujier': 'Ujier',
            'auditor': 'Auditor'
        };
        return labels[rol] || rol;
    },

    // Open modal for new user
    openModal(userId = null) {
        const modal = document.getElementById('modal-usuario');
        const title = document.getElementById('modal-usuario-title');
        const form = document.getElementById('form-usuario');

        if (!modal) return;

        this.editingId = userId;
        form?.reset();

        if (userId) {
            // Edit mode
            title.textContent = 'Editar Usuario';
            const user = this.users.find(u => u.id === userId);
            if (user) {
                document.getElementById('usuario-nombre').value = user.nombre || '';
                document.getElementById('usuario-email').value = user.email || '';
                document.getElementById('usuario-rol').value = user.rol || '';
                document.getElementById('usuario-activo').checked = user.activo !== false;
            }
        } else {
            // New mode
            title.textContent = 'Nuevo Usuario';
        }

        modal.classList.remove('hidden');
    },

    // Close modal
    closeModal() {
        const modal = document.getElementById('modal-usuario');
        modal?.classList.add('hidden');
        this.editingId = null;
    },

    // Save user (create or update)
    async saveUser() {
        const nombre = document.getElementById('usuario-nombre').value;
        const email = document.getElementById('usuario-email').value;
        const rol = document.getElementById('usuario-rol').value;
        const password = document.getElementById('usuario-password').value;
        const activo = document.getElementById('usuario-activo').checked;

        if (!nombre || !email || !rol) {
            utils.showToast('Completá todos los campos obligatorios', 'warning');
            return;
        }

        const userData = { nombre, email, rol, activo };

        let result;
        if (this.editingId) {
            // Update
            result = await db.updateUser(this.editingId, userData);
        } else {
            // Create new user - would need auth signup
            if (!password) {
                utils.showToast('La contraseña es obligatoria para nuevos usuarios', 'warning');
                return;
            }
            result = await db.createUser({ ...userData, password });
        }

        if (result.error) {
            utils.showToast('Error al guardar: ' + result.error.message, 'error');
            return;
        }

        utils.showToast(this.editingId ? 'Usuario actualizado' : 'Usuario creado', 'success');
        this.closeModal();
        await this.loadUsers();
    },

    // Edit user
    editUser(userId) {
        this.openModal(userId);
    },

    // Toggle user active status
    async toggleStatus(userId, newStatus) {
        const { error } = await db.updateUser(userId, { activo: newStatus });

        if (error) {
            utils.showToast('Error al cambiar estado', 'error');
            return;
        }

        utils.showToast(newStatus ? 'Usuario activado' : 'Usuario desactivado', 'success');
        await this.loadUsers();
    },

    // Filter users by search
    filterUsers(query) {
        const filtered = this.users.filter(u =>
            (u.nombre || '').toLowerCase().includes(query.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(query.toLowerCase()) ||
            (u.rol || '').toLowerCase().includes(query.toLowerCase())
        );
        this.renderUsers(filtered);
    }
};

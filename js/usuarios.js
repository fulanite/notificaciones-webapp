/**
 * SGND - Usuarios Module
 * User management (CRUD) with password reset and delete functionality
 */

const usuarios = {
    users: [],
    editingId: null,
    listenersSetup: false,

    // Initialize the module
    async init() {
        await this.loadUsers();
        if (!this.listenersSetup) {
            this.setupEventListeners();
            this.listenersSetup = true;
        }
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

        // Password reset button
        document.getElementById('btn-reset-password')?.addEventListener('click', () => {
            this.resetPassword();
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
                <td data-label="Usuario"><strong>${u.nombre || '-'}</strong></td>
                <td data-label="Email">${u.email}</td>
                <td data-label="DNI">${u.dni || '-'}</td>
                <td data-label="Rol"><span class="badge badge-${u.rol}">${this.getRolLabel(u.rol)}</span></td>
                <td data-label="Estado">
                    <span class="status-badge ${u.activo ? 'status-completed' : 'status-deferred'}">
                        ${u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    ${u.password_reset_required ? '<span class="badge badge-warning" title="Debe cambiar contraseña">🔄</span>' : ''}
                </td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="usuarios.editUser('${u.id}')">
                        ✏️ Editar
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="usuarios.toggleStatus('${u.id}', ${!u.activo})">
                        ${u.activo ? '🚫 Desactivar' : '✅ Activar'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="usuarios.deleteUser('${u.id}')">
                        🗑️ Eliminar
                    </button>
                </td>
            </tr>
        `).join('');
    },

    // Get role label in Spanish
    getRolLabel(rol) {
        const labels = {
            'admin': 'Administrador',
            'administrativo': 'Administrativo',
            'coordinador': 'Coordinador',
            'ujier': 'Ujier',
            'auditor': 'Auditor' // Legacy support
        };
        return labels[rol] || rol;
    },

    // Open modal for new user
    openModal(userId = null) {
        const modal = document.getElementById('modal-usuario');
        const title = document.getElementById('modal-usuario-title');
        const form = document.getElementById('form-usuario');
        const passwordResetSection = document.getElementById('password-reset-section');
        const dniInput = document.getElementById('usuario-dni');

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
                document.getElementById('usuario-dni').value = user.dni || '';
                document.getElementById('usuario-rol').value = user.rol ? user.rol.toLowerCase() : '';
                document.getElementById('usuario-activo').checked = user.activo !== false;

                // Show password reset button for existing users
                passwordResetSection.style.display = 'block';
                // DNI is not required for editing (only for new users)
                dniInput.removeAttribute('required');
            }
        } else {
            // New mode
            title.textContent = 'Nuevo Usuario';
            passwordResetSection.style.display = 'none';
            // DNI is required for new users
            dniInput.setAttribute('required', 'required');
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
        const nombre = document.getElementById('usuario-nombre').value.trim();
        const email = document.getElementById('usuario-email').value.trim();
        const dni = document.getElementById('usuario-dni').value.trim();
        const rol = document.getElementById('usuario-rol').value;
        const activo = document.getElementById('usuario-activo').checked;

        if (!nombre || !email || !rol) {
            utils.showToast('Completá todos los campos obligatorios', 'warning');
            return;
        }

        // Validate DNI for new users
        if (!this.editingId && !dni) {
            utils.showToast('El DNI es obligatorio para nuevos usuarios', 'warning');
            return;
        }

        // Validate DNI format
        if (dni && !/^[0-9]{7,8}$/.test(dni)) {
            utils.showToast('El DNI debe tener 7 u 8 dígitos', 'warning');
            return;
        }

        const userData = { nombre, email, dni, rol, activo };

        let result;
        if (this.editingId) {
            // Update existing user
            result = await db.updateUser(this.editingId, userData);
        } else {
            // Create new user with DNI as initial password
            result = await auth.createUser({
                ...userData,
                password: dni, // Use DNI as initial password
                password_reset_required: true // Force password change on first login
            });
        }

        if (result.error) {
            utils.showToast('Error al guardar: ' + (result.error.message || result.error), 'error');
            return;
        }

        utils.showToast(
            this.editingId
                ? 'Usuario actualizado correctamente'
                : 'Usuario creado. Contraseña inicial: DNI',
            'success'
        );
        this.closeModal();
        await this.loadUsers();
    },

    // Reset password to DNI
    async resetPassword() {
        if (!this.editingId) return;

        const user = this.users.find(u => u.id === this.editingId);
        if (!user || !user.dni) {
            utils.showToast('No se puede blanquear: usuario sin DNI', 'error');
            return;
        }

        const confirmed = confirm(
            `¿Estás seguro de blanquear la contraseña de ${user.nombre}?\n\n` +
            `La contraseña se restablecerá a su DNI (${user.dni}) y deberá cambiarla en su próximo inicio de sesión.`
        );

        if (!confirmed) return;

        try {
            // Call reset-password endpoint
            const result = await apiClient.post('auth.php', {
                action: 'reset-password',
                user_id: this.editingId,
                new_password: user.dni
            });

            if (result.error) {
                utils.showToast('Error al blanquear contraseña: ' + result.error, 'error');
                return;
            }

            // Show a more prominent alert as requested
            alert(
                `✅ CONTRASEÑA BLANQUEADA\n\n` +
                `El usuario: ${user.nombre}\n` +
                `Ahora tiene como clave su DNI: ${user.dni}\n\n` +
                `IMPORTANTE: El sistema le exigirá cambiarla apenas inicie sesión.`
            );

            utils.showToast('Contraseña blanqueada correctamente', 'success');

            // Close modal and reload users to show updated status
            this.closeModal();
            await this.loadUsers();
        } catch (error) {
            console.error('Error al blanquear contraseña:', error);
            utils.showToast('Error al blanquear contraseña', 'error');
        }
    },

    // Edit user
    editUser(userId) {
        this.openModal(userId);
    },

    // Toggle user active status
    async toggleStatus(userId, newStatus) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const action = newStatus ? 'activar' : 'desactivar';
        const confirmed = confirm(`¿Estás seguro de ${action} a ${user.nombre}?`);

        if (!confirmed) return;

        const { error } = await db.updateUser(userId, { activo: newStatus });

        if (error) {
            utils.showToast('Error al cambiar estado', 'error');
            return;
        }

        utils.showToast(newStatus ? 'Usuario activado' : 'Usuario desactivado', 'success');
        await this.loadUsers();
    },

    // Delete user
    async deleteUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const confirmed = confirm(
            `⚠️ ¿Estás seguro de intentar eliminar a ${user.nombre}?\n\n` +
            `Si el usuario tiene notificaciones o visitas asignadas, solo se DESACTIVARÁ.\n\n` +
            `Si no tiene datos asociados, se ELIMINARÁ permanentemente.`
        );

        if (!confirmed) return;

        try {
            const result = await apiClient.delete('usuarios.php', { id: userId });

            if (result.error) {
                utils.showToast('Error: ' + result.error, 'error');
                return;
            }

            // Check if it was deleted or deactivated
            if (result.data.deleted) {
                // Hard delete (no associated data)
                utils.showToast('✅ Usuario eliminado correctamente', 'success');
            } else if (result.data.deactivated) {
                // Soft delete (has associated data)
                const notifCount = result.data.notif_count || 0;
                const visitCount = result.data.visit_count || 0;

                utils.showToast(
                    `⚠️ Usuario desactivado (no eliminado)\n\n` +
                    `Tiene ${notifCount} notificaciones y ${visitCount} visitas asignadas.\n\n` +
                    `Los datos históricos se preservan.`,
                    'warning'
                );
            }

            await this.loadUsers();
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            utils.showToast('Error al eliminar usuario', 'error');
        }
    },

    // Filter users by search
    filterUsers(query) {
        const filtered = this.users.filter(u =>
            (u.nombre || '').toLowerCase().includes(query.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(query.toLowerCase()) ||
            (u.dni || '').toLowerCase().includes(query.toLowerCase()) ||
            (u.rol || '').toLowerCase().includes(query.toLowerCase())
        );
        this.renderUsers(filtered);
    }
};

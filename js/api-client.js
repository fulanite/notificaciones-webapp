/**
 * SGND - API Client for MySQL Backend
 * Replaces Supabase client with PHP API calls
 */

// API Base URL - Your Hostinger domain
// Full URL: https://darkblue-caribou-343892.hostingersite.com/api
const API_BASE_URL = '/api';

// Global API client instance
let apiClient = null;

function initApiClient() {
    apiClient = {
        baseUrl: API_BASE_URL,

        async request(endpoint, options = {}) {
            const url = `${this.baseUrl}/${endpoint}`;

            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            };

            const fetchOptions = { ...defaultOptions, ...options };

            try {
                const response = await fetch(url, fetchOptions);
                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'API request failed');
                }

                return { data: data.data, error: null };
            } catch (error) {
                console.error('API Error:', error);
                return { data: null, error: error.message };
            }
        },

        get(endpoint, params = {}) {
            const queryString = new URLSearchParams(params).toString();
            const urlWithParams = queryString ? `${endpoint}?${queryString}` : endpoint;
            return this.request(urlWithParams, { method: 'GET' });
        },

        post(endpoint, body) {
            return this.request(endpoint, {
                method: 'POST',
                body: JSON.stringify(body),
            });
        },

        put(endpoint, body) {
            return this.request(endpoint, {
                method: 'PUT',
                body: JSON.stringify(body),
            });
        },

        delete(endpoint, body) {
            return this.request(endpoint, {
                method: 'DELETE',
                body: JSON.stringify(body),
            });
        },

        async uploadFile(file, notificationId, type = 'photo') {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('notification_id', notificationId);
            formData.append('type', type);

            try {
                const response = await fetch(`${this.baseUrl}/upload.php`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                });

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Upload failed');
                }

                return { url: data.data.url, error: null };
            } catch (error) {
                console.error('Upload Error:', error);
                return { url: null, error: error.message };
            }
        }
    };

    return apiClient;
}

// Database Operations - Compatible API with existing supabase.js
const db = {
    // ==================== USUARIOS ====================
    async getUsers() {
        if (!apiClient) return { data: [], error: null };
        return apiClient.get('usuarios.php');
    },

    async getUserByEmail(email) {
        if (!apiClient) return { data: null, error: null };
        return apiClient.get('usuarios.php', { email });
    },

    async getUsersByRole(role) {
        if (!apiClient) return { data: [], error: null };
        return apiClient.get('usuarios.php', { rol: role });
    },

    async getUjieres() {
        return this.getUsersByRole('ujier');
    },

    async createUser(userData) {
        if (!apiClient) return { data: null, error: null };
        return apiClient.post('usuarios.php', userData);
    },

    async updateUser(id, updates) {
        if (!apiClient) return { data: null, error: null };
        return apiClient.put('usuarios.php', { id, ...updates });
    },

    // ==================== NOTIFICACIONES ====================
    async getNotifications(options = {}) {
        if (!apiClient) return { data: [], error: null, count: 0 };

        const params = {};
        if (options.estado) params.estado = options.estado;
        if (options.tipo) params.tipo = options.tipo;
        if (options.asignado_a) params.asignado_a = options.asignado_a;
        if (options.fecha) params.fecha = options.fecha;
        if (options.search) params.search = options.search;
        if (options.page) params.page = options.page;
        if (options.limit) params.limit = options.limit;

        const result = await apiClient.get('notificaciones.php', params);

        if (result.error) {
            return { data: [], error: result.error, count: 0 };
        }

        // Handle paginated response
        if (result.data && result.data.data) {
            return {
                data: result.data.data,
                error: null,
                count: result.data.total
            };
        }

        return { data: result.data, error: null, count: result.data?.length || 0 };
    },

    async getNotificationById(id) {
        if (!apiClient) return { data: null, error: null };
        return apiClient.get('notificaciones.php', { id });
    },

    async getMyAssignments(userId) {
        if (!apiClient) return { data: [], error: null };
        return apiClient.get('notificaciones.php', { asignado_a: userId, estado: 'pendiente' });
    },

    async createNotification(notificationData) {
        if (!apiClient) return { data: null, error: null };
        return apiClient.post('notificaciones.php', notificationData);
    },

    async updateNotification(id, updates, userId = null) {
        if (!apiClient) return { data: null, error: null };
        return apiClient.put('notificaciones.php', {
            id,
            ...updates,
            updated_by: userId
        });
    },

    async registerResult(id, resultData, userId) {
        if (!apiClient) return { data: null, error: null };
        return apiClient.put('notificaciones.php', {
            id,
            action: 'result',
            resultado: resultData.resultado,
            observaciones: resultData.observaciones,
            ubicacion_lat: resultData.ubicacion_lat,
            ubicacion_lng: resultData.ubicacion_lng,
            evidencia_foto: resultData.evidencia_foto,
            observacion_audio: resultData.observacion_audio,
            transcripcion_audio: resultData.transcripcion_audio,
            es_carga_diferida: resultData.es_carga_diferida,
            motivo_falla_senal: resultData.motivo_falla_senal,
            user_id: userId
        });
    },

    async getNotificationVisits(notificationId) {
        if (!apiClient) return { data: [], error: null };
        return apiClient.get('visitas.php', { notificacion_id: notificationId });
    },

    async getUserVisits(userId) {
        if (!apiClient) return { data: [], error: null };
        return apiClient.get('visitas.php', { ujier_id: userId });
    },

    async assignNotification(id, ujierId, assignedBy) {
        if (!apiClient) return { data: null, error: null };
        return apiClient.put('notificaciones.php', {
            id,
            action: 'assign',
            asignado_a: ujierId,
            asignado_por: assignedBy
        });
    },

    // ==================== STATISTICS ====================
    async getStats() {
        if (!apiClient) return {
            total: 0,
            pendientes: 0,
            diligenciadas: 0,
            diferidas: 0
        };

        const result = await apiClient.get('stats.php', { type: 'general' });
        return result.data || { total: 0, pendientes: 0, diligenciadas: 0, diferidas: 0 };
    },

    async getStatsByType() {
        if (!apiClient) return [];

        const result = await apiClient.get('stats.php', { type: 'by_type' });
        if (result.error || !result.data) return [];

        return result.data.map(item => ({
            type: item.type,
            label: CONFIG.NOTIFICATION_TYPES[item.type] || item.type,
            count: parseInt(item.count)
        }));
    },

    async getStatsByResult() {
        if (!apiClient) return [];

        const result = await apiClient.get('stats.php', { type: 'by_result' });
        if (result.error || !result.data) return [];

        return result.data.map(item => ({
            result: item.result,
            label: CONFIG.RESULT_OPTIONS[item.result] || item.result,
            count: parseInt(item.count)
        }));
    },

    async getUjierPerformance() {
        if (!apiClient) return [];

        const result = await apiClient.get('stats.php', { type: 'by_ujier' });
        if (result.error || !result.data) return [];

        return result.data.map(item => ({
            id: item.id,
            nombre: item.nombre,
            total: parseInt(item.total),
            completed: parseInt(item.completed),
            percentage: parseFloat(item.percentage) || 0
        }));
    },

    // ==================== FILE UPLOADS ====================
    async uploadPhoto(file, notificationId) {
        if (!apiClient) return { url: null, error: null };
        return apiClient.uploadFile(file, notificationId, 'photo');
    },

    async uploadAudio(blob, notificationId) {
        if (!apiClient) return { url: null, error: null };
        return apiClient.uploadFile(blob, notificationId, 'audio');
    }
};

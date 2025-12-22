/**
 * SGND - Supabase Client & Database Operations
 */

// Global instance of the Supabase client
let supabaseClient = null;

function initSupabase() {
    if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL' || !CONFIG.SUPABASE_URL.startsWith('http')) {
        console.warn('Supabase not configured correctly. Running in demo mode.');
        return null;
    }

    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded!');
        return null;
    }

    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

    // For compatibility with other scripts (auth.js, etc)
    window.supabase = supabaseClient;

    // Also expose it globally if needed but without naming conflict
    window.supabaseInstance = supabaseClient;

    return supabaseClient;
}

// Database Operations
const db = {
    // ==================== USUARIOS ====================
    async getUsers() {
        if (!supabaseClient) return { data: [], error: null };

        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .order('nombre');

        return { data, error };
    },

    async getUserByEmail(email) {
        if (!supabaseClient) return { data: null, error: null };

        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .single();

        return { data, error };
    },

    async getUsersByRole(role) {
        if (!supabaseClient) return { data: [], error: null };

        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('rol', role)
            .order('nombre');

        return { data, error };
    },

    async createUser(userData) {
        if (!supabaseClient) return { data: null, error: null };

        const { data, error } = await supabaseClient
            .from('usuarios')
            .insert([userData])
            .select()
            .single();

        return { data, error };
    },

    async updateUser(id, updates) {
        if (!supabaseClient) return { data: null, error: null };

        const { data, error } = await supabaseClient
            .from('usuarios')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        return { data, error };
    },

    // ==================== NOTIFICACIONES ====================
    async getNotifications(options = {}) {
        if (!supabaseClient) return { data: [], error: null, count: 0 };

        let query = supabaseClient
            .from('notificaciones')
            .select('*, usuarios!asignado_a(nombre, email)', { count: 'exact' });

        // Apply filters
        if (options.estado) {
            query = query.eq('estado', options.estado);
        }

        if (options.tipo) {
            query = query.eq('tipo_notificacion', options.tipo);
        }

        if (options.asignado_a) {
            query = query.eq('asignado_a', options.asignado_a);
        }

        if (options.fecha) {
            const startDate = new Date(options.fecha);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(options.fecha);
            endDate.setHours(23, 59, 59, 999);

            query = query
                .gte('fecha_carga', startDate.toISOString())
                .lte('fecha_carga', endDate.toISOString());
        }

        if (options.search) {
            query = query.or(`n_expediente.ilike.%${options.search}%,destinatario_nombre.ilike.%${options.search}%,caratula.ilike.%${options.search}%`);
        }

        // Ordering
        query = query.order('fecha_carga', { ascending: false });

        // Pagination
        if (options.page && options.limit) {
            const from = (options.page - 1) * options.limit;
            const to = from + options.limit - 1;
            query = query.range(from, to);
        }

        const { data, error, count } = await query;

        return { data, error, count };
    },

    async getNotificationById(id) {
        if (!supabaseClient) return { data: null, error: null };

        const { data, error } = await supabaseClient
            .from('notificaciones')
            .select('*, usuarios!asignado_a(nombre, email)')
            .eq('id', id)
            .single();

        return { data, error };
    },

    async getMyAssignments(userId) {
        if (!supabaseClient) return { data: [], error: null };

        const { data, error } = await supabaseClient
            .from('notificaciones')
            .select('*')
            .eq('asignado_a', userId)
            .eq('estado', 'pendiente')
            .order('fecha_carga', { ascending: true });

        return { data, error };
    },

    async createNotification(notificationData) {
        if (!supabaseClient) return { data: null, error: null };

        const { data, error } = await supabaseClient
            .from('notificaciones')
            .insert([{
                ...notificationData,
                fecha_carga: new Date().toISOString(),
                estado: 'pendiente'
            }])
            .select()
            .single();

        return { data, error };
    },

    async updateNotification(id, updates, userId = null) {
        if (!supabaseClient) return { data: null, error: null };

        // Add audit fields
        const updateData = {
            ...updates,
            updated_at: new Date().toISOString()
        };

        if (userId) {
            updateData.updated_by = userId;
        }

        const { data, error } = await supabaseClient
            .from('notificaciones')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        return { data, error };
    },

    async registerResult(id, resultData, userId) {
        if (!supabaseClient) return { data: null, error: null };

        // 1. First, save the visit in the 'visitas' history table
        const { error: visitError } = await supabaseClient
            .from('visitas')
            .insert({
                notificacion_id: id,
                ujier_id: userId,
                resultado: resultData.resultado,
                observaciones: resultData.observaciones,
                ubicacion_lat: resultData.ubicacion_lat,
                ubicacion_lng: resultData.ubicacion_lng,
                foto_url: resultData.evidencia_foto,
                audio_url: resultData.observacion_audio
            });

        if (visitError) {
            console.error('Error saving visit history:', visitError);
            // We continue even if history fails, but log it
        }

        // 2. Update the main notification record with the LATEST status
        const { data, error } = await supabaseClient
            .from('notificaciones')
            .update({
                resultado_diligencia: resultData.resultado,
                fecha_diligencia: new Date().toISOString(),
                ubicacion_lat: resultData.ubicacion_lat,
                ubicacion_lng: resultData.ubicacion_lng,
                evidencia_foto: resultData.evidencia_foto,
                observacion_audio: resultData.observacion_audio,
                transcripcion_audio: resultData.transcripcion_audio,
                es_carga_diferida: resultData.es_carga_diferida || false,
                motivo_falla_senal: resultData.motivo_falla_senal,
                observaciones_resultado: resultData.observaciones,
                estado: resultData.es_carga_diferida ? 'diferida' : 'diligenciada',
                diligenciado_por: userId,
                updated_at: new Date().toISOString(),
                updated_by: userId
            })
            .eq('id', id)
            .select()
            .single();

        return { data, error };
    },

    async getNotificationVisits(notificationId) {
        if (!supabaseClient) return { data: [], error: null };

        const { data, error } = await supabaseClient
            .from('visitas')
            .select('*')
            .eq('notificacion_id', notificationId)
            .order('fecha', { ascending: false });

        return { data, error };
    },

    async getUserVisits(userId) {
        if (!supabaseClient) return { data: [], error: null };

        const { data, error } = await supabaseClient
            .from('visitas')
            .select('*, notificaciones(n_expediente, destinatario_nombre, tipo_notificacion)')
            .eq('ujier_id', userId)
            .order('fecha', { ascending: false });

        return { data, error };
    },

    async assignNotification(id, ujierId, assignedBy) {
        if (!supabaseClient) return { data: null, error: null };

        const { data, error } = await supabaseClient
            .from('notificaciones')
            .update({
                asignado_a: ujierId,
                fecha_asignacion: new Date().toISOString(),
                asignado_por: assignedBy,
                updated_at: new Date().toISOString(),
                updated_by: assignedBy
            })
            .eq('id', id)
            .select()
            .single();

        return { data, error };
    },

    // ==================== STATISTICS ====================
    async getStats() {
        if (!supabaseClient) return {
            total: 0,
            pendientes: 0,
            diligenciadas: 0,
            diferidas: 0
        };

        // Get counts by status
        const { data, error } = await supabaseClient
            .from('notificaciones')
            .select('estado');

        if (error) return { total: 0, pendientes: 0, diligenciadas: 0, diferidas: 0 };

        const stats = {
            total: data.length,
            pendientes: data.filter(n => n.estado === 'pendiente').length,
            diligenciadas: data.filter(n => n.estado === 'diligenciada').length,
            diferidas: data.filter(n => n.estado === 'diferida').length
        };

        return stats;
    },

    async getStatsByType() {
        if (!supabaseClient) return [];

        const { data, error } = await supabaseClient
            .from('notificaciones')
            .select('tipo_notificacion');

        if (error) return [];

        // Group by type
        const counts = {};
        data.forEach(n => {
            counts[n.tipo_notificacion] = (counts[n.tipo_notificacion] || 0) + 1;
        });

        return Object.entries(counts).map(([type, count]) => ({
            type,
            label: CONFIG.NOTIFICATION_TYPES[type] || type,
            count
        }));
    },

    async getStatsByResult() {
        if (!supabaseClient) return [];

        const { data, error } = await supabaseClient
            .from('notificaciones')
            .select('resultado_diligencia')
            .not('resultado_diligencia', 'is', null);

        if (error) return [];

        const counts = {};
        data.forEach(n => {
            counts[n.resultado_diligencia] = (counts[n.resultado_diligencia] || 0) + 1;
        });

        return Object.entries(counts).map(([result, count]) => ({
            result,
            label: CONFIG.RESULT_OPTIONS[result] || result,
            count
        }));
    },

    async getUjierPerformance() {
        if (!supabaseClient) return [];

        const { data: ujiers } = await supabaseClient
            .from('usuarios')
            .select('id, nombre')
            .eq('rol', 'ujier');

        if (!ujiers) return [];

        const performance = [];

        for (const ujier of ujiers) {
            const { data: notifs } = await supabaseClient
                .from('notificaciones')
                .select('estado')
                .eq('asignado_a', ujier.id);

            if (notifs) {
                const total = notifs.length;
                const completed = notifs.filter(n => n.estado === 'diligenciada').length;

                performance.push({
                    id: ujier.id,
                    nombre: ujier.nombre,
                    total,
                    completed,
                    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
                });
            }
        }

        return performance;
    },

    // ==================== FILE UPLOADS ====================
    async uploadPhoto(file, notificationId) {
        if (!supabaseClient) return { url: null, error: null };

        // Use extension from compressed blob, or extract from filename, or default to jpg
        const extension = file.extension || (file.name ? file.name.split('.').pop() : 'jpg');
        const fileName = `${notificationId}_${Date.now()}.${extension}`;
        const filePath = `evidencias/${fileName}`;

        const { data, error } = await supabaseClient.storage
            .from('sgnd-files')
            .upload(filePath, file);

        if (error) return { url: null, error };

        const { data: { publicUrl } } = supabaseClient.storage
            .from('sgnd-files')
            .getPublicUrl(filePath);

        return { url: publicUrl, error: null };
    },

    async uploadAudio(blob, notificationId) {
        if (!supabaseClient) return { url: null, error: null };

        const fileName = `${notificationId}_${Date.now()}.webm`;
        const filePath = `audios/${fileName}`;

        const { data, error } = await supabaseClient.storage
            .from('sgnd-files')
            .upload(filePath, blob, {
                contentType: 'audio/webm'
            });

        if (error) return { url: null, error };

        const { data: { publicUrl } } = supabaseClient.storage
            .from('sgnd-files')
            .getPublicUrl(filePath);

        return { url: publicUrl, error: null };
    }
};

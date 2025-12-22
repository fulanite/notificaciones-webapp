/**
 * SGND - Configuration
 * Replace these values with your Supabase project credentials
 */

const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://mtcujjxxcbbafwjbazvt.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Y3Vqanh4Y2JiYWZ3amJhenZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjI3MTAsImV4cCI6MjA4MTYzODcxMH0.qUjrQo33indSMMmAXBCvlCC2bkmAYPUR9YEvw7GiEmU',

    // App Settings
    APP_NAME: 'SGND',
    APP_VERSION: '1.0.0',

    // Pagination
    ITEMS_PER_PAGE: 20,

    // GPS Settings
    GPS_TIMEOUT: 10000, // 10 seconds
    GPS_MAX_AGE: 60000, // 1 minute
    GPS_HIGH_ACCURACY: true,

    // Audio Recording
    AUDIO_MAX_DURATION: 120000, // 2 minutes

    // Offline Queue
    OFFLINE_QUEUE_KEY: 'sgnd_offline_queue',

    // Notification Types
    NOTIFICATION_TYPES: {
        cedulas: 'Cédulas',
        cedulas_urgente_norte: 'Cédulas Urgente Norte',
        cedulas_urgente_sur: 'Cédulas Urgente Sur',
        cedulas_mandamientos_22172: 'Cédulas o Mandamientos Ley 22172',
        cedulas_correspondencia: 'Cédulas por Correspondencia (Interior)',
        mandamientos: 'Mandamientos',
        mandamientos_habilitacion_norte: 'Mandamientos con habilitación Norte',
        mandamientos_habilitacion_sur: 'Mandamientos con habilitación Sur'
    },

    // Result Options
    RESULT_OPTIONS: {
        atiende: 'Atiende',
        no_atiende: 'No atiende',
        pre_aviso: 'Pre aviso',
        estrados: 'Estrados',
        domicilio_inexistente: 'Domicilio inexistente',
        diligenciador_ausente: 'Diligenciador ausente'
    },

    // Payment Methods
    PAYMENT_METHODS: {
        gratuito: 'Gratuito',
        efectivo: 'Efectivo',
        transferencia: 'Transferencia',
        qr: 'QR'
    },

    // Zones
    ZONES: ['norte', 'sur', 'centro', 'este', 'oeste', 'interior'],

    // User Roles
    ROLES: {
        admin: 'Administrador',
        administrativo: 'Administrativo',
        ujier: 'Ujier',
        auditor: 'Auditor'
    },

    // Failure Reasons
    FAILURE_REASONS: {
        sin_senal_domicilio: 'Falta de señal en domicilio',
        falla_datos: 'Falla temporal de datos',
        otro: 'Otro'
    }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.NOTIFICATION_TYPES);
Object.freeze(CONFIG.RESULT_OPTIONS);
Object.freeze(CONFIG.PAYMENT_METHODS);
Object.freeze(CONFIG.ROLES);
Object.freeze(CONFIG.FAILURE_REASONS);

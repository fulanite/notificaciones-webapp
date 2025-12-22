/**
 * SGND - Utility Functions
 */

const utils = {
    // Format date to locale string
    formatDate(date, options = {}) {
        if (!date) return '-';

        const d = new Date(date);
        const defaultOptions = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            ...options
        };

        return d.toLocaleDateString('es-AR', defaultOptions);
    },

    // Format date with time
    formatDateTime(date) {
        if (!date) return '-';

        const d = new Date(date);
        return d.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Format relative time (e.g., "hace 5 minutos")
    formatRelativeTime(date) {
        if (!date) return '';

        const now = new Date();
        const d = new Date(date);
        const diff = now - d;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Hace un momento';
        if (minutes < 60) return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
        if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
        if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;

        return this.formatDate(date);
    },

    // Format currency
    formatCurrency(amount) {
        if (!amount && amount !== 0) return '-';

        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount);
    },

    // Truncate text
    truncate(text, length = 50) {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    },

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Debounce function
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit = 300) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Get GPS position
    async getGPSPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocalización no soportada'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                (error) => {
                    let message = 'Error al obtener ubicación';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Permiso de ubicación denegado';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Ubicación no disponible';
                            break;
                        case error.TIMEOUT:
                            message = 'Tiempo de espera agotado';
                            break;
                    }
                    reject(new Error(message));
                },
                {
                    enableHighAccuracy: CONFIG.GPS_HIGH_ACCURACY,
                    timeout: CONFIG.GPS_TIMEOUT,
                    maximumAge: CONFIG.GPS_MAX_AGE
                }
            );
        });
    },

    // Convert file to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    // Compress image - Optimized for Supabase storage efficiency
    // WebP format + lower quality = ~50-100KB per photo instead of 3-5MB
    async compressImage(file, maxWidth = 1200, quality = 0.6) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                let { width, height } = img;

                // Limit max dimensions (1200px is enough for evidence photos)
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                // Also limit height
                const maxHeight = 1600;
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }

                canvas.width = width;
                canvas.height = height;

                // Use white background (helps with transparency and compression)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Try WebP first (30% smaller than JPEG), fallback to JPEG
                const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
                const mimeType = supportsWebP ? 'image/webp' : 'image/jpeg';
                const extension = supportsWebP ? 'webp' : 'jpg';

                canvas.toBlob(
                    (blob) => {
                        // Add metadata to blob for filename extension
                        blob.extension = extension;
                        console.log(`📸 Imagen comprimida: ${(blob.size / 1024).toFixed(1)}KB (${mimeType})`);
                        resolve(blob);
                    },
                    mimeType,
                    quality
                );
            };

            img.onerror = () => {
                console.error('Error loading image for compression');
                resolve(file); // Return original if compression fails
            };

            img.src = URL.createObjectURL(file);
        });
    },

    // Show toast notification
    showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Parse query string
    parseQueryString() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    },

    // Export to CSV
    exportToCSV(data, filename = 'export.csv') {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header => {
                    let value = row[header] || '';
                    if (typeof value === 'string' && value.includes(',')) {
                        value = `"${value}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    },

    // Validate email
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // Get status badge HTML
    getStatusBadge(status) {
        const badges = {
            pendiente: '<span class="status-badge status-pending">⏳ Pendiente</span>',
            diligenciada: '<span class="status-badge status-completed">✅ Diligenciada</span>',
            diferida: '<span class="status-badge status-deferred">⚠️ Diferida</span>'
        };

        return badges[status] || `<span class="status-badge">${status}</span>`;
    },

    // Check if online
    isOnline() {
        return navigator.onLine;
    },

    // Get today's date formatted
    getTodayFormatted() {
        return new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
};

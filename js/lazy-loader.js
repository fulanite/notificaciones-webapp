/**
 * Lazy Loading Utilities
 * Funciones para cargar recursos bajo demanda
 */

const LazyLoader = {
    /**
     * Carga Leaflet solo cuando se necesita
     * @returns {Promise} Promesa que se resuelve cuando Leaflet está cargado
     */
    async loadLeaflet() {
        // Si ya está cargado, retornar inmediatamente
        if (window.L) {
            return Promise.resolve();
        }

        console.log('📍 Cargando Leaflet Maps...');

        // Cargar CSS de Leaflet si no está cargado
        if (!document.querySelector('link[href*="leaflet.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        // Cargar script de Leaflet
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => {
                console.log('✅ Leaflet cargado exitosamente');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ Error al cargar Leaflet');
                reject(new Error('Failed to load Leaflet'));
            };
            document.head.appendChild(script);
        });
    },

    /**
     * Carga un módulo JavaScript bajo demanda
     * @param {string} modulePath - Ruta del módulo a cargar
     * @returns {Promise} Promesa que se resuelve cuando el módulo está cargado
     */
    async loadModule(modulePath) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = modulePath;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    /**
     * Precarga recursos en background
     * @param {Array<string>} resources - Array de URLs a precargar
     */
    preloadResources(resources) {
        resources.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            document.head.appendChild(link);
        });
    },

    /**
     * Carga imágenes de forma lazy
     * @param {HTMLElement} container - Contenedor con imágenes
     */
    lazyLoadImages(container = document) {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            observer.unobserve(img);
                        }
                    }
                });
            });

            container.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        } else {
            // Fallback para navegadores sin IntersectionObserver
            container.querySelectorAll('img[data-src]').forEach(img => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }
    }
};

// Hacer disponible globalmente
window.LazyLoader = LazyLoader;

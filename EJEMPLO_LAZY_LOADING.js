/**
 * EJEMPLO: Cómo usar LazyLoader para cargar Leaflet Maps
 * 
 * Este archivo muestra cómo modificar los módulos existentes
 * para usar lazy loading de Leaflet Maps
 */

// ============================================
// ANTES (Carga inmediata - LENTO)
// ============================================

const MapModule_OLD = {
    async initMap() {
        // Esto asume que Leaflet ya está cargado
        this.mapInstance = L.map('map-container').setView([lat, lng], zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.mapInstance);
    }
};

// ============================================
// DESPUÉS (Lazy Loading - RÁPIDO)
// ============================================

const MapModule_NEW = {
    async initMap() {
        try {
            // Cargar Leaflet solo cuando se necesita
            await LazyLoader.loadLeaflet();

            // Ahora sí, crear el mapa
            this.mapInstance = L.map('map-container').setView([lat, lng], zoom);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.mapInstance);

            console.log('✅ Mapa cargado exitosamente');
        } catch (error) {
            console.error('❌ Error al cargar mapa:', error);
            // Mostrar mensaje de error al usuario
            utils.showToast('Error al cargar el mapa', 'error');
        }
    }
};

// ============================================
// EJEMPLO COMPLETO: Módulo Ujier con Lazy Loading
// ============================================

const ujier = {
    mapInstance: null,

    // Inicializar vista de ubicaciones
    async initUbicacionesView() {
        console.log('📍 Inicializando vista de ubicaciones...');

        // Cargar Leaflet solo cuando el usuario accede a esta vista
        await LazyLoader.loadLeaflet();

        // Crear mapa
        if (!this.mapInstance) {
            this.mapInstance = L.map('ujier-map-container').setView(
                [-27.4692131, -58.8306349],
                13
            );

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.mapInstance);
        }

        // Cargar ubicaciones del ujier
        await this.loadUbicaciones();
    },

    async loadUbicaciones() {
        // Cargar y mostrar ubicaciones en el mapa
        const ubicaciones = await api.getUbicaciones();

        ubicaciones.forEach(ub => {
            L.marker([ub.lat, ub.lng])
                .bindPopup(ub.descripcion)
                .addTo(this.mapInstance);
        });
    }
};

// ============================================
// EJEMPLO: Dashboard con Lazy Loading
// ============================================

const dashboard = {
    mapInstance: null,

    async initMapView() {
        // Solo cargar Leaflet cuando se accede a la vista de mapa
        const mapView = document.getElementById('view-mapa-seguimiento');

        if (!mapView.classList.contains('active')) {
            // Vista no activa, no cargar mapa aún
            return;
        }

        // Cargar Leaflet
        await LazyLoader.loadLeaflet();

        // Crear mapa
        if (!this.mapInstance) {
            this.mapInstance = L.map('admin-map-container').setView(
                [-27.4692131, -58.8306349],
                12
            );

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.mapInstance);
        }
    }
};

// ============================================
// INTEGRACIÓN CON app.js
// ============================================

// En app.js, modificar initViewModule:

async initViewModule(viewId) {
    console.log('🔄 Inicializando vista:', viewId);

    try {
        switch (viewId) {
            case 'mapa-seguimiento':
                // Cargar Leaflet antes de inicializar el mapa
                await LazyLoader.loadLeaflet();
                if (typeof adminMap !== 'undefined' && adminMap.init) {
                    await adminMap.init();
                }
                break;

            case 'ubicaciones-ujier':
                // Cargar Leaflet antes de mostrar ubicaciones
                await LazyLoader.loadLeaflet();
                if (typeof ujier !== 'undefined' && ujier.initUbicacionesView) {
                    await ujier.initUbicacionesView();
                }
                break;

            case 'lista-notificaciones':
                // No necesita Leaflet, carga normal
                if (typeof notifications !== 'undefined' && notifications.loadNotifications) {
                    await notifications.loadNotifications();
                }
                break;

            // ... otros casos
        }
    } catch (error) {
        console.error('❌ Error al inicializar vista:', error);
    }
}

// ============================================
// BENEFICIOS DEL LAZY LOADING
// ============================================

/*
1. ⚡ Carga inicial más rápida
   - Leaflet (100KB) solo se carga cuando se necesita
   - Reduce el tiempo de First Contentful Paint

2. 📊 Mejor uso de recursos
   - No carga librerías que el usuario puede no usar
   - Reduce el consumo de memoria

3. 🎯 Mejor experiencia de usuario
   - La aplicación responde más rápido
   - Las vistas sin mapas cargan instantáneamente

4. 📱 Mejor rendimiento en móviles
   - Reduce el uso de datos
   - Mejora el rendimiento en dispositivos de gama baja
*/

// ============================================
// TESTING
// ============================================

/*
Para probar que funciona:

1. Abrir DevTools > Network
2. Recargar la página
3. Verificar que leaflet.js NO se carga al inicio
4. Navegar a una vista con mapa
5. Verificar que leaflet.js se carga SOLO cuando se necesita
6. Verificar que el mapa funciona correctamente
*/

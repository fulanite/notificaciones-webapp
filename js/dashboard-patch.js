// Patch para agregar funcionalidad de visor de imágenes a los popups del mapa
// Este archivo debe cargarse DESPUÉS de dashboard.js

(function () {
    // Guardar referencia original
    const originalLoadMapData = adminMap.loadMapData;

    // Sobrescribir loadMapData con versión mejorada
    adminMap.loadMapData = async function () {
        const date = document.getElementById('admin-map-date')?.value;
        const userId = document.getElementById('admin-map-ujier-select')?.value || 'all';

        if (!this.mapInstance) return;

        // Clear previous layers
        if (this.mapLayer) {
            this.mapInstance.removeLayer(this.mapLayer);
            this.mapLayer = null;
        }

        const { data, error } = await db.getUserLocations(userId, date);

        if (error) {
            utils.showToast('Error cargando mapa', 'error');
            return;
        }

        const timelineContainer = document.getElementById('admin-timeline-container');
        if (userId === 'all') {
            timelineContainer.classList.add('hidden');
        } else {
            timelineContainer.classList.remove('hidden');
        }

        // Stats UI Update
        const visitsCount = data ? data.length : 0;
        document.getElementById('admin-map-stat-visits').textContent = visitsCount;

        const uniqueUjieres = new Set(data.map(d => d.ujier_nombre || 'Desconocido'));
        document.getElementById('admin-map-stat-users').textContent = visitsCount > 0 ? uniqueUjieres.size : 0;

        if (!data || data.length === 0) {
            utils.showToast(userId === 'all' ? 'Sin actividad global registrada' : 'Sin recorrido para este ujier', 'info');
            return;
        }

        // Create Layer Group
        const markers = L.layerGroup();
        const latlngs = [];
        let totalDist = 0;

        // --- VISTA INDIVIDUAL (RECORRIDO DETALLADO) ---
        if (userId !== 'all') {
            const createNumberedIcon = (number, color) => {
                return L.divIcon({
                    className: 'custom-map-icon',
                    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${number}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
            };

            data.forEach((point, index) => {
                if (point.lat && point.lng) {
                    const coord = [parseFloat(point.lat), parseFloat(point.lng)];
                    latlngs.push(coord);

                    const statusColor = this.getStatusColor(point.resultado);

                    // Clickable Image con escape de comillas
                    const photoHtml = point.foto_url
                        ? `<div style="margin-top:6px; width:100%; height:80px; background:url('${point.foto_url}') center/cover no-repeat; border-radius:4px; cursor: pointer; transition: transform 0.2s;" 
                               onclick="dashboard.openImageViewer('${point.foto_url.replace(/'/g, "\\'")}', '${(point.destinatario + ' - ' + point.domicilio).replace(/'/g, "\\'")}');"
                               title="Click para ampliar"></div>`
                        : '';

                    const popupContent = `
                        <strong>#${index + 1} ${point.destinatario || 'Sin nombre'}</strong><br>
                        <span style="font-size:0.9em; color:#555;">${point.domicilio}</span><br>
                        <span class="badge" style="background:${statusColor}; color:white; font-size:0.75em; padding:2px 6px; border-radius:4px;">
                            ${(point.resultado || 'PENDIENTE').toUpperCase()}
                        </span>
                        <div style="font-size:0.8em; margin-top:4px; color:#777;">🕒 ${utils.formatTime(point.fecha)}</div>
                        ${photoHtml}
                    `;

                    L.marker(coord, { icon: createNumberedIcon(index + 1, statusColor) })
                        .bindPopup(popupContent)
                        .addTo(markers);
                }
            });

            // Dibujar Líneas de Recorrido
            if (latlngs.length > 1) {
                L.polyline(latlngs, { color: '#3b82f6', weight: 4, opacity: 0.7, lineJoin: 'round' }).addTo(markers);

                // Calcular distancia total
                for (let i = 0; i < latlngs.length - 1; i++) {
                    totalDist += this.calculateDistance(latlngs[i][0], latlngs[i][1], latlngs[i + 1][0], latlngs[i + 1][1]);
                }
            }

            // Renderizar Timeline + Distancia
            this.renderTimeline(data, totalDist);

        }
        // --- VISTA GENERAL (MAPA DE CALOR) ---
        else {
            data.forEach((point) => {
                if (point.lat && point.lng) {
                    const coord = [parseFloat(point.lat), parseFloat(point.lng)];
                    const ujierName = point.ujier_nombre || 'Desconocido';

                    const color = this.getStatusColor(point.resultado);

                    // Clickable Image con escape de comillas
                    const photoHtml = point.foto_url
                        ? `<div style="margin-top:5px; width:100%; height:70px; background:url('${point.foto_url}') center/cover no-repeat; border-radius:3px; cursor: pointer;" 
                               onclick="dashboard.openImageViewer('${point.foto_url.replace(/'/g, "\\'")}', '${(ujierName + ' - ' + point.domicilio).replace(/'/g, "\\'")}');"
                               title="Click para ampliar"></div>`
                        : '';

                    const popupContent = `
                        <strong>👤 ${ujierName}</strong><br>
                        ${point.destinatario}<br>
                        <span style="font-size:0.85em; color:#555;">${point.domicilio}</span><br>
                        <span class="badge" style="background:${color}; color:white; font-size:0.7em; padding:2px 5px; border-radius:3px;">
                            ${(point.resultado || 'PENDIENTE').toUpperCase()}
                        </span>
                        <br><small>🕒 ${utils.formatTime(point.fecha)}</small>
                        ${photoHtml}
                    `;

                    L.circleMarker(coord, {
                        radius: 6,
                        fillColor: color,
                        color: '#fff',
                        weight: 1,
                        opacity: 0.9,
                        fillOpacity: 0.7
                    }).bindPopup(popupContent).addTo(markers);
                }
            });
        }

        // Add Layer to Map
        this.mapLayer = markers;
        this.mapInstance.addLayer(this.mapLayer);

        // Fit Bounds
        if (data.length > 0) {
            const group = new L.featureGroup();
            if (userId === 'all') {
                data.forEach(p => {
                    if (p.lat && p.lng) group.addLayer(L.marker([p.lat, p.lng]));
                });
            } else {
                latlngs.forEach(ll => group.addLayer(L.marker(ll)));
            }

            if (group.getLayers().length > 0) {
                this.mapInstance.fitBounds(group.getBounds(), { padding: [50, 50] });
            }
        }
    };

    console.log('✅ Dashboard patch aplicado: Visor de imágenes habilitado');
})();

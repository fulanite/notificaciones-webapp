-- Fix para corregir notificaciones con tipo "cedulas" que deberían ser urgentes según la zona ingresada

-- 1. Actualizar a Cédulas Urgentes NORTE
UPDATE notificaciones 
SET tipo_notificacion = 'cedulas_urgentes_norte'
WHERE tipo_notificacion = 'cedulas' 
  AND zona = 'Urgente NORTE - Cédulas';

-- 2. Actualizar a Cédulas Urgentes SUR
UPDATE notificaciones 
SET tipo_notificacion = 'cedulas_urgentes_sur'
WHERE tipo_notificacion = 'cedulas' 
  AND zona = 'Urgente SUR - Cédulas';

-- Opcional: Mostrar los resultados de los registros que fueron afectados (ejecutar antes como SELECT si se desea previsualizar)
-- SELECT id, n_expediente, tipo_notificacion, zona FROM notificaciones WHERE zona IN ('Urgente NORTE - Cédulas', 'Urgente SUR - Cédulas');

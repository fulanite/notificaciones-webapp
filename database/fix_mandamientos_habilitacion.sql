-- ================================================
-- Script para corregir tipos de notificación incorrectos
-- Problema: 27 notificaciones fueron incorrectamente categorizadas como
-- "mandamientos_habilitacion_*" después de la migración de Glide
-- ================================================

-- Paso 1: Verificar cuántas notificaciones tienen tipo "Mandamientos con Habilitación" en diciembre 2025
SELECT 
    tipo_notificacion,
    COUNT(*) as cantidad
FROM notificaciones
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01'
  AND tipo_notificacion LIKE '%Habilitación%'
GROUP BY tipo_notificacion;

-- Paso 2: Listar las notificaciones que DEBERÍAN tener tipo mandamientos_habilitacion_*
-- según el CSV original de Glide (solo estos 16 IDs)
SELECT 
    id,
    glide_id_cedula,
    tipo_notificacion,
    n_expediente,
    origen
FROM notificaciones
WHERE glide_id_cedula IN (
    '6f67e8a2-5060-41ed-b9fa-1a2b76c1b91a',
    '1668358e-faca-4c8b-a928-49b6ab80ddc0',
    '43dc3a64-5275-4a84-821a-b4ee45acedca',
    '411b6c54-4e4c-459c-96f9-f9ce42ee4249',
    '076de4b5-a80f-4911-816b-07acffd897ac',
    '0d19f93c-7bef-4c0b-844f-c3da1bbe8e20',
    'a8dfc706-c0f4-4803-bce7-c91efc1464d1',
    '2d2e734f-40e2-4ecb-a9cf-cc65286c8e36',
    '77e5654e-4229-4ee8-8aad-36e7c2692ea3',
    '10569809-1801-436c-977f-09945dacd099',
    'f9edc4d8-a85a-4e36-91c1-b54a9672e722',
    'a31640e3-cc24-4fc9-8091-313897ce62a1',
    'ffa89f9a-2420-4606-9681-a95645581620',
    'bd434c8e-2c55-40c9-bc7b-a1fb94d4d8d7',
    '7e10c53e-8702-4b09-bdba-578ad85fbd51',
    '38e34b14-1643-4680-839f-c24e23896c2b'
);

-- Paso 3: Listar las notificaciones que TIENEN tipo "Mandamientos con Habilitación"
-- pero NO deberían tenerlo (las 27 incorrectas)
SELECT 
    id,
    glide_id_cedula,
    tipo_notificacion,
    n_expediente,
    origen,
    fecha_carga
FROM notificaciones
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01'
  AND tipo_notificacion LIKE '%Habilitación%'
  AND glide_id_cedula NOT IN (
    '6f67e8a2-5060-41ed-b9fa-1a2b76c1b91a',
    '1668358e-faca-4c8b-a928-49b6ab80ddc0',
    '43dc3a64-5275-4a84-821a-b4ee45acedca',
    '411b6c54-4e4c-459c-96f9-f9ce42ee4249',
    '076de4b5-a80f-4911-816b-07acffd897ac',
    '0d19f93c-7bef-4c0b-844f-c3da1bbe8e20',
    'a8dfc706-c0f4-4803-bce7-c91efc1464d1',
    '2d2e734f-40e2-4ecb-a9cf-cc65286c8e36',
    '77e5654e-4229-4ee8-8aad-36e7c2692ea3',
    '10569809-1801-436c-977f-09945dacd099',
    'f9edc4d8-a85a-4e36-91c1-b54a9672e722',
    'a31640e3-cc24-4fc9-8091-313897ce62a1',
    'ffa89f9a-2420-4606-9681-a95645581620',
    'bd434c8e-2c55-40c9-bc7b-a1fb94d4d8d7',
    '7e10c53e-8702-4b09-bdba-578ad85fbd51',
    '38e34b14-1643-4680-839f-c24e23896c2b'
);

-- ================================================
-- CORRECCIÓN (ejecutar solo después de verificar los resultados anteriores)
-- ================================================

-- Paso 4: Corregir las notificaciones incorrectas cambiándolas a "Mandamientos"
-- ADVERTENCIA: Ejecutar solo después de verificar que el Paso 3 muestra las 27 notificaciones correctas

-- DESCOMENTAR ESTAS LÍNEAS DESPUÉS DE VERIFICAR:
/*
UPDATE notificaciones
SET tipo_notificacion = 'Mandamientos'
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01'
  AND tipo_notificacion LIKE '%Habilitación%'
  AND glide_id_cedula NOT IN (
    '6f67e8a2-5060-41ed-b9fa-1a2b76c1b91a',
    '1668358e-faca-4c8b-a928-49b6ab80ddc0',
    '43dc3a64-5275-4a84-821a-b4ee45acedca',
    '411b6c54-4e4c-459c-96f9-f9ce42ee4249',
    '076de4b5-a80f-4911-816b-07acffd897ac',
    '0d19f93c-7bef-4c0b-844f-c3da1bbe8e20',
    'a8dfc706-c0f4-4803-bce7-c91efc1464d1',
    '2d2e734f-40e2-4ecb-a9cf-cc65286c8e36',
    '77e5654e-4229-4ee8-8aad-36e7c2692ea3',
    '10569809-1801-436c-977f-09945dacd099',
    'f9edc4d8-a85a-4e36-91c1-b54a9672e722',
    'a31640e3-cc24-4fc9-8091-313897ce62a1',
    'ffa89f9a-2420-4606-9681-a95645581620',
    'bd434c8e-2c55-40c9-bc7b-a1fb94d4d8d7',
    '7e10c53e-8702-4b09-bdba-578ad85fbd51',
    '38e34b14-1643-4680-839f-c24e23896c2b'
);

-- Verificar el resultado
SELECT 
    tipo_notificacion,
    COUNT(*) as cantidad
FROM notificaciones
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01'
  AND tipo_notificacion LIKE '%Habilitación%'
GROUP BY tipo_notificacion;
*/

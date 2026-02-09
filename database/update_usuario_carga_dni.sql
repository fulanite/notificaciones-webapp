-- Update usuario_carga to DNI where it matches an email in usuarios
UPDATE notificaciones n
JOIN usuarios u ON n.usuario_carga = u.email
SET n.usuario_carga = u.dni
WHERE u.dni IS NOT NULL AND u.dni != '' AND n.usuario_carga LIKE '%@%';

-- Update usuario_carga to DNI where it matches a name in usuarios (exact match)
UPDATE notificaciones n
JOIN usuarios u ON n.usuario_carga = u.nombre
SET n.usuario_carga = u.dni
WHERE u.dni IS NOT NULL AND u.dni != '' AND n.usuario_carga NOT REGEXP '^[0-9]+$';

-- Update usuario_carga to DNI where it matches a name in usuarios (fuzzy match - careful!)
-- Only updating if unique match found
-- (This part is commented out to be safe, uncomment if needed)
/*
UPDATE notificaciones n
SET n.usuario_carga = (
    SELECT u.dni 
    FROM usuarios u 
    WHERE u.nombre LIKE CONCAT('%', n.usuario_carga, '%') 
    LIMIT 1
)
WHERE n.usuario_carga NOT REGEXP '^[0-9]+$' 
AND n.usuario_carga NOT LIKE '%@%'
AND (
    SELECT COUNT(*) 
    FROM usuarios u 
    WHERE u.nombre LIKE CONCAT('%', n.usuario_carga, '%')
) = 1;
*/

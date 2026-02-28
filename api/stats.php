<?php
/**
 * SGND - Statistics API
 * Endpoints for dashboard statistics with year filtering
 */

require_once __DIR__ . '/db.php';

$db = Database::getInstance();
$pdo = $db->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    Database::sendError('Method not allowed', 405);
}

try {
    $type = $_GET['type'] ?? 'general';
    $year = $_GET['year'] ?? date('Y'); // Default to current year

    // Year filter for WHERE clause
    $yearFilter = "YEAR(fecha_carga) = :year AND (eliminada = 0 OR eliminada IS NULL)";

    switch ($type) {
        case 'general':
            // General statistics with corrected "diligenciadas" logic
            // Diligenciadas = ALL except (estado='pendiente' OR resultado_diligencia IN ('Pre Aviso', 'PRE_AVISO'))
            $stmt = $pdo->prepare("
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
                    SUM(CASE 
                        WHEN estado != 'pendiente' 
                        AND (resultado_diligencia IS NULL OR LOWER(REPLACE(resultado_diligencia, '_', ' ')) NOT IN ('pre aviso'))
                        THEN 1 ELSE 0 
                    END) as diligenciadas,
                    SUM(CASE WHEN es_carga_diferida = 1 THEN 1 ELSE 0 END) as diferidas,
                    CAST(ROUND(
                        SUM(CASE 
                            WHEN estado != 'pendiente' 
                            AND (resultado_diligencia IS NULL OR LOWER(REPLACE(resultado_diligencia, '_', ' ')) NOT IN ('pre aviso'))
                            THEN 1 ELSE 0 
                        END) * 100.0 / NULLIF(COUNT(*), 0),
                        2
                    ) AS DECIMAL(10,2)) as tasa_diligenciamiento
                FROM notificaciones
                WHERE $yearFilter
            ");
            $stmt->execute(['year' => $year]);
            Database::sendResponse($stmt->fetch());
            break;

        case 'by_type':
            // Statistics by notification type
            $stmt = $pdo->prepare("
                SELECT 
                    tipo_notificacion as type,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM notificaciones WHERE YEAR(fecha_carga) = :year2 AND (eliminada = 0 OR eliminada IS NULL)), 2) as percentage
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year AND (eliminada = 0 OR eliminada IS NULL)
                GROUP BY tipo_notificacion
                ORDER BY count DESC
            ");
            $stmt->execute(['year' => $year, 'year2' => $year]);
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'by_result':
            // Statistics by result (detailed) with normalization
            $stmt = $pdo->prepare("
                SELECT 
                    CASE 
                        WHEN resultado_diligencia IS NULL THEN 'Sin resultado'
                        WHEN LOWER(TRIM(REPLACE(resultado_diligencia, '_', ' '))) = 'domicilio inexistente' THEN 'Domicilio Inexistente'
                        WHEN LOWER(TRIM(REPLACE(resultado_diligencia, '_', ' '))) = 'atiende' THEN 'Atiende'
                        WHEN LOWER(TRIM(REPLACE(resultado_diligencia, '_', ' '))) = 'no atiende' THEN 'No Atiende'
                        WHEN LOWER(TRIM(REPLACE(resultado_diligencia, '_', ' '))) = 'entregada' THEN 'Entregada'
                        WHEN LOWER(TRIM(REPLACE(resultado_diligencia, '_', ' '))) = 'pre aviso' THEN 'Pre Aviso'
                        WHEN LOWER(TRIM(REPLACE(resultado_diligencia, '_', ' '))) = 'estrados' THEN 'Estrados'
                        WHEN LOWER(TRIM(REPLACE(resultado_diligencia, '_', ' '))) = 'diligenciador ausente' THEN 'Diligenciador Ausente'
                        WHEN LOWER(TRIM(REPLACE(resultado_diligencia, '_', ' '))) = 'traslado' THEN 'Traslado'
                        WHEN LOWER(TRIM(REPLACE(resultado_diligencia, '_', ' '))) = 'fallecido' THEN 'Fallecido'
                        ELSE TRIM(REPLACE(resultado_diligencia, '_', ' '))
                    END as result,
                    COUNT(*) as count,
                    ROUND(
                        COUNT(*) * 100.0 / 
                        (SELECT COUNT(*) FROM notificaciones WHERE YEAR(fecha_carga) = :year2 AND resultado_diligencia IS NOT NULL AND (eliminada = 0 OR eliminada IS NULL)),
                        2
                    ) as percentage
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year 
                AND resultado_diligencia IS NOT NULL 
                AND (eliminada = 0 OR eliminada IS NULL)
                GROUP BY result
                ORDER BY count DESC
            ");
            $stmt->execute(['year' => $year, 'year2' => $year]);
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'by_origin':
            // Statistics by origin (Juzgados)
            $stmt = $pdo->prepare("
                SELECT 
                    origen as origin,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM notificaciones WHERE YEAR(fecha_carga) = :year2 AND (eliminada = 0 OR eliminada IS NULL)), 2) as percentage
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year AND (eliminada = 0 OR eliminada IS NULL)
                GROUP BY origen
                ORDER BY count DESC
                LIMIT 15
            ");
            $stmt->execute(['year' => $year, 'year2' => $year]);
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'by_ujier':
            // Performance by ujier with corrected diligenciadas logic
            $stmt = $pdo->prepare("
                SELECT 
                    u.id,
                    u.nombre,
                    COUNT(n.id) as total,
                    SUM(CASE 
                        WHEN n.estado != 'pendiente' 
                        AND (n.resultado_diligencia IS NULL OR LOWER(REPLACE(n.resultado_diligencia, '_', ' ')) NOT IN ('pre aviso'))
                        THEN 1 ELSE 0 
                    END) as completed,
                    ROUND(
                        SUM(CASE 
                            WHEN n.estado != 'pendiente' 
                            AND (n.resultado_diligencia IS NULL OR LOWER(REPLACE(n.resultado_diligencia, '_', ' ')) NOT IN ('pre aviso'))
                            THEN 1 ELSE 0 
                        END) * 100.0 / NULLIF(COUNT(n.id), 0),
                        2
                    ) as percentage
                FROM usuarios u
                LEFT JOIN notificaciones n ON u.id = n.asignado_a AND YEAR(n.fecha_carga) = :year AND (n.eliminada = 0 OR n.eliminada IS NULL)
                WHERE u.rol = 'ujier' AND u.activo = 1
                GROUP BY u.id, u.nombre
                ORDER BY completed DESC
            ");
            $stmt->execute(['year' => $year]);
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'by_zone':
            // Statistics by zone
            $stmt = $pdo->prepare("
                SELECT 
                    zona as zone,
                    COUNT(*) as total,
                    SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
                    SUM(CASE 
                        WHEN estado != 'pendiente' 
                        AND (resultado_diligencia IS NULL OR LOWER(REPLACE(resultado_diligencia, '_', ' ')) NOT IN ('pre aviso'))
                        THEN 1 ELSE 0 
                    END) as diligenciadas,
                    ROUND(
                        SUM(CASE 
                            WHEN estado != 'pendiente' 
                            AND (resultado_diligencia IS NULL OR LOWER(REPLACE(resultado_diligencia, '_', ' ')) NOT IN ('pre aviso'))
                            THEN 1 ELSE 0 
                        END) * 100.0 / NULLIF(COUNT(*), 0),
                        2
                    ) as efectividad
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year AND (eliminada = 0 OR eliminada IS NULL)
                GROUP BY zona
                ORDER BY total DESC
            ");
            $stmt->execute(['year' => $year]);
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'by_weekday':
            // Statistics by day of week
            $stmt = $pdo->prepare("
                SELECT 
                    CASE DAYOFWEEK(fecha_carga)
                        WHEN 1 THEN 'Domingo'
                        WHEN 2 THEN 'Lunes'
                        WHEN 3 THEN 'Martes'
                        WHEN 4 THEN 'Miércoles'
                        WHEN 5 THEN 'Jueves'
                        WHEN 6 THEN 'Viernes'
                        WHEN 7 THEN 'Sábado'
                    END as day,
                    DAYOFWEEK(fecha_carga) as day_num,
                    COUNT(*) as count
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year AND (eliminada = 0 OR eliminada IS NULL)
                GROUP BY DAYOFWEEK(fecha_carga)
                ORDER BY day_num
            ");
            $stmt->execute(['year' => $year]);
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'by_hour_visits':
        case 'by_hour_loads':
            // Calculate dynamic offset between PHP time (local Argentina) and MySQL session time
            // This ensures charts show local Argentina time regardless of server location
            $timeCheck = $pdo->query("SELECT HOUR(NOW()) as mysql_h, " . date('H') . " as php_h")->fetch();
            $offset = intval($timeCheck['php_h'] ?? 0) - intval($timeCheck['mysql_h'] ?? 0);

            // Adjust offset if it's too large due to date change (e.g. 23 vs 02)
            if ($offset > 12)
                $offset -= 24;
            if ($offset < -12)
                $offset += 24;

            $column = ($type === 'by_hour_visits') ? 'fecha_diligencia' : 'fecha_carga';
            $whereYear = ($type === 'by_hour_visits') ? 'YEAR(fecha_diligencia) = :year AND fecha_diligencia IS NOT NULL' : 'YEAR(fecha_carga) = :year';

            // Special case: Migrated data is almost certainly in UTC (from Glide CSV)
            // If the database is NOT already in UTC, we might need a fixed shift for those records.
            // But the dynamic $offset approach is safer for live data.
            $stmt = $pdo->prepare("
                SELECT 
                    HOUR(DATE_ADD($column, INTERVAL $offset HOUR)) as hour,
                    COUNT(*) as count
                FROM notificaciones
                WHERE $whereYear AND (eliminada = 0 OR eliminada IS NULL)
                GROUP BY hour
                ORDER BY hour
            ");
            $stmt->execute(['year' => $year]);
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'temporal':
            // Temporal evolution (last N days)
            $days = intval($_GET['days'] ?? 30);
            $stmt = $pdo->prepare("
                SELECT 
                    DATE(fecha_carga) as date,
                    COUNT(*) as created,
                    SUM(CASE 
                        WHEN estado != 'pendiente' 
                        AND (resultado_diligencia IS NULL OR LOWER(REPLACE(resultado_diligencia, '_', ' ')) NOT IN ('pre aviso'))
                        THEN 1 ELSE 0 
                    END) as completed
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year 
                AND fecha_carga >= DATE_SUB(NOW(), INTERVAL :days DAY)
                AND (eliminada = 0 OR eliminada IS NULL)
                GROUP BY DATE(fecha_carga)
                ORDER BY date ASC
            ");
            $stmt->execute(['year' => $year, 'days' => $days]);
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'year_counts':
            // Simple counts for each year tab
            $userId = $_GET['user_email'] ?? null;
            $ownOnly = ($_GET['own_only'] ?? '0') === '1';

            $whereClause = "1=1";
            $params = [];

            if ($ownOnly && !empty($userId)) {
                $whereClause = " (
                    n.usuario_carga = ? OR 
                    TRIM(n.usuario_carga) = (SELECT dni FROM usuarios WHERE email = ? LIMIT 1) OR
                    TRIM(n.usuario_carga) = (SELECT nombre FROM usuarios WHERE email = ? LIMIT 1) OR
                    (SELECT nombre FROM usuarios WHERE email = ? LIMIT 1) LIKE CONCAT('%', TRIM(n.usuario_carga), '%')
                )";
                $params = [$userId, $userId, $userId, $userId];
            }

            if (!empty($_GET['filter_ujier'])) {
                $ujier = $_GET['filter_ujier'];
                $whereClause .= " AND (n.asignado_a = ? OR n.asignado_a = (SELECT dni FROM usuarios WHERE id = ?))";
                $params[] = $ujier;
                $params[] = $ujier;
            }


            $stmt2026 = $pdo->prepare("SELECT COUNT(*) FROM notificaciones n WHERE (YEAR(n.fecha_carga) = 2026 OR YEAR(n.created_at) = 2026) AND (n.eliminada = 0 OR n.eliminada IS NULL) AND $whereClause");
            $stmt2026->execute($params);
            $count2026 = $stmt2026->fetchColumn();

            $stmt2025 = $pdo->prepare("SELECT COUNT(*) FROM notificaciones n WHERE (YEAR(n.fecha_carga) = 2025 OR YEAR(n.created_at) = 2025) AND (n.eliminada = 0 OR n.eliminada IS NULL) AND $whereClause");
            $stmt2025->execute($params);
            $count2025 = $stmt2025->fetchColumn();

            Database::sendResponse([
                '2026' => (int) $count2026,
                '2025' => (int) $count2025
            ]);
            break;

        default:

            Database::sendError('Invalid stats type', 400);
    }
} catch (PDOException $e) {
    Database::sendError('Database error: ' . $e->getMessage(), 500);
}

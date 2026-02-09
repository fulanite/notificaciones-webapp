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
    $yearFilter = "YEAR(fecha_carga) = :year";

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
                        AND (resultado_diligencia IS NULL OR resultado_diligencia NOT IN ('Pre Aviso', 'PRE_AVISO', 'pre_aviso'))
                        THEN 1 ELSE 0 
                    END) as diligenciadas,
                    SUM(CASE WHEN es_carga_diferida = 1 THEN 1 ELSE 0 END) as diferidas,
                    CAST(ROUND(
                        SUM(CASE 
                            WHEN estado != 'pendiente' 
                            AND (resultado_diligencia IS NULL OR resultado_diligencia NOT IN ('Pre Aviso', 'PRE_AVISO', 'pre_aviso'))
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
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM notificaciones WHERE YEAR(fecha_carga) = :year2), 2) as percentage
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year
                GROUP BY tipo_notificacion
                ORDER BY count DESC
            ");
            $stmt->execute(['year' => $year, 'year2' => $year]);
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'by_result':
            // Statistics by result (detailed)
            $stmt = $pdo->prepare("
                SELECT 
                    COALESCE(resultado_diligencia, 'Sin resultado') as result,
                    COUNT(*) as count,
                    ROUND(
                        COUNT(*) * 100.0 / 
                        (SELECT COUNT(*) FROM notificaciones WHERE YEAR(fecha_carga) = :year2 AND resultado_diligencia IS NOT NULL),
                        2
                    ) as percentage
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year AND resultado_diligencia IS NOT NULL
                GROUP BY resultado_diligencia
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
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM notificaciones WHERE YEAR(fecha_carga) = :year2), 2) as percentage
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year
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
                        AND (n.resultado_diligencia IS NULL OR n.resultado_diligencia NOT IN ('Pre Aviso', 'PRE_AVISO', 'pre_aviso'))
                        THEN 1 ELSE 0 
                    END) as completed,
                    ROUND(
                        SUM(CASE 
                            WHEN n.estado != 'pendiente' 
                            AND (n.resultado_diligencia IS NULL OR n.resultado_diligencia NOT IN ('Pre Aviso', 'PRE_AVISO', 'pre_aviso'))
                            THEN 1 ELSE 0 
                        END) * 100.0 / NULLIF(COUNT(n.id), 0),
                        2
                    ) as percentage
                FROM usuarios u
                LEFT JOIN notificaciones n ON u.id = n.asignado_a AND YEAR(n.fecha_carga) = :year
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
                        AND (resultado_diligencia IS NULL OR resultado_diligencia NOT IN ('Pre Aviso', 'PRE_AVISO', 'pre_aviso'))
                        THEN 1 ELSE 0 
                    END) as diligenciadas,
                    ROUND(
                        SUM(CASE 
                            WHEN estado != 'pendiente' 
                            AND (resultado_diligencia IS NULL OR resultado_diligencia NOT IN ('Pre Aviso', 'PRE_AVISO', 'pre_aviso'))
                            THEN 1 ELSE 0 
                        END) * 100.0 / NULLIF(COUNT(*), 0),
                        2
                    ) as efectividad
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year
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
                WHERE YEAR(fecha_carga) = :year
                GROUP BY DAYOFWEEK(fecha_carga)
                ORDER BY day_num
            ");
            $stmt->execute(['year' => $year]);
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'by_hour':
            // Statistics by hour of day
            $stmt = $pdo->prepare("
                SELECT 
                    HOUR(fecha_carga) as hour,
                    COUNT(*) as count
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year
                GROUP BY HOUR(fecha_carga)
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
                        AND (resultado_diligencia IS NULL OR resultado_diligencia NOT IN ('Pre Aviso', 'PRE_AVISO', 'pre_aviso'))
                        THEN 1 ELSE 0 
                    END) as completed
                FROM notificaciones
                WHERE YEAR(fecha_carga) = :year AND fecha_carga >= DATE_SUB(NOW(), INTERVAL :days DAY)
                GROUP BY DATE(fecha_carga)
                ORDER BY date ASC
            ");
            $stmt->execute(['year' => $year, 'days' => $days]);
            Database::sendResponse($stmt->fetchAll());
            break;

        default:
            Database::sendError('Invalid stats type', 400);
    }
} catch (PDOException $e) {
    Database::sendError('Database error: ' . $e->getMessage(), 500);
}

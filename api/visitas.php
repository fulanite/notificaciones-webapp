<?php
/**
 * SGND - Visitas API
 * Endpoints for visit history
 */

require_once __DIR__ . '/db.php';

$db = Database::getInstance();
$pdo = $db->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            if (isset($_GET['notificacion_id'])) {
                // Get visits for a notification
                // Support both new data (ujier_id = UUID) and migrated data (ujier_id = DNI)
                $stmt = $pdo->prepare("
                    SELECT v.*, 
                           COALESCE(u1.nombre, u2.nombre) as ujier_nombre
                    FROM visitas v
                    LEFT JOIN usuarios u1 ON v.ujier_id = u1.id
                    LEFT JOIN usuarios u2 ON v.ujier_id = u2.dni
                    WHERE v.notificacion_id = ?
                    ORDER BY v.fecha DESC
                ");
                $stmt->execute([$_GET['notificacion_id']]);
                Database::sendResponse($stmt->fetchAll());
            } elseif (isset($_GET['ujier_id'])) {
                $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 2000;
                $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;

                $search = isset($_GET['search']) ? trim($_GET['search']) : '';
                $searchTerm = $search !== '' ? '%' . $search . '%' : null;

                $sql = "
                    SELECT v.*, 
                           n.n_expediente, 
                           n.destinatario_nombre, 
                           n.tipo_notificacion,
                           n.caratula,
                           n.domicilio,
                           n.zona,
                           n.devuelta_por_ujier
                    FROM visitas v
                    LEFT JOIN notificaciones n ON v.notificacion_id = n.id
                    LEFT JOIN usuarios u ON (v.ujier_id = u.id OR v.ujier_id = u.dni)
                    WHERE (u.id = ? OR (v.ujier_id IS NULL AND n.asignado_a = ?))
                    AND (n.eliminada = 0 OR n.eliminada IS NULL)
                ";

                if ($searchTerm) {
                    $sql .= " AND (n.domicilio LIKE ? OR n.destinatario_nombre LIKE ? OR n.n_expediente LIKE ? OR n.caratula LIKE ? OR v.observaciones LIKE ?)";
                }

                $sql .= " ORDER BY v.fecha DESC LIMIT $limit OFFSET $offset";

                $stmt = $pdo->prepare($sql);
                $params = [$_GET['ujier_id'], $_GET['ujier_id']];
                if ($searchTerm) {
                    $params = array_merge($params, [$searchTerm, $searchTerm, $searchTerm, $searchTerm, $searchTerm]);
                }
                $stmt->execute($params);
                Database::sendResponse($stmt->fetchAll());
            } elseif (isset($_GET['view']) && $_GET['view'] === 'references') {
                // Get all "public" visits (excluding special recipients) for logistic references
                $search = isset($_GET['search']) ? trim($_GET['search']) : '';
                $searchTerm = $search !== '' ? '%' . $search . '%' : null;

                $sql = "
                    SELECT v.*, 
                           n.n_expediente, 
                           n.destinatario_nombre, 
                           n.tipo_notificacion,
                           n.caratula,
                           n.domicilio,
                           n.zona,
                           u.nombre as ujier_nombre
                    FROM visitas v
                    LEFT JOIN notificaciones n ON v.notificacion_id = n.id
                    LEFT JOIN usuarios u ON (v.ujier_id = u.id OR v.ujier_id = u.dni)
                    WHERE (n.destinatario_especial IS NULL OR n.destinatario_especial = '' OR n.destinatario_especial = '0' OR n.destinatario_especial = 'false')
                    AND (n.eliminada = 0 OR n.eliminada IS NULL)
                ";

                if ($searchTerm) {
                    $sql .= " AND (n.domicilio LIKE ? OR n.destinatario_nombre LIKE ? OR n.n_expediente LIKE ? OR n.caratula LIKE ?)";
                }

                $sql .= " ORDER BY v.fecha DESC LIMIT 2000";

                $stmt = $pdo->prepare($sql);
                if ($searchTerm) {
                    // 4 parameters now: domicilio, destinatario_nombre, n_expediente, caratula
                    $stmt->execute([$searchTerm, $searchTerm, $searchTerm, $searchTerm]);
                } else {
                    $stmt->execute();
                }
                Database::sendResponse($stmt->fetchAll());
            } elseif (isset($_GET['view']) && $_GET['view'] === 'locations') {
                // Get geo-located visits for a specific user and date
                $userId = $_GET['user_id'] ?? null;
                $date = $_GET['date'] ?? date('Y-m-d');

                if (!$userId) {
                    Database::sendResponse(['error' => 'User ID required'], 400);
                }

                if ($userId === 'all') {
                    $stmt = $pdo->prepare("
                        SELECT v.fecha, LOWER(TRIM(v.resultado)) as resultado, v.ubicacion_lat as lat, v.ubicacion_lng as lng, v.foto_url,
                               n.destinatario_nombre as destinatario, n.domicilio,
                               COALESCE(u.nombre, 'Ujier') as ujier_nombre
                        FROM visitas v
                        LEFT JOIN notificaciones n ON v.notificacion_id = n.id
                        LEFT JOIN usuarios u ON (v.ujier_id = u.id OR v.ujier_id = u.dni)
                        WHERE DATE(v.fecha) = ?
                        AND (n.eliminada = 0 OR n.eliminada IS NULL)
                        AND v.ubicacion_lat IS NOT NULL 
                        AND v.ubicacion_lat != ''
                        ORDER BY v.fecha ASC
                    ");
                    $stmt->execute([$date]);
                } else {
                    $stmt = $pdo->prepare("
                        SELECT v.fecha, LOWER(TRIM(v.resultado)) as resultado, v.ubicacion_lat as lat, v.ubicacion_lng as lng, v.foto_url,
                               n.destinatario_nombre as destinatario, n.domicilio,
                               'Yo' as ujier_nombre
                        FROM visitas v
                        LEFT JOIN notificaciones n ON v.notificacion_id = n.id
                        WHERE (v.ujier_id = ? OR v.ujier_id = (SELECT dni FROM usuarios WHERE id = ?))
                        AND DATE(v.fecha) = ?
                        AND (n.eliminada = 0 OR n.eliminada IS NULL)
                        AND v.ubicacion_lat IS NOT NULL 
                        AND v.ubicacion_lat != ''
                        ORDER BY v.fecha ASC
                    ");
                    $stmt->execute([$userId, $userId, $date]);
                }
                Database::sendResponse($stmt->fetchAll());
            } else {
                // Get all recent visits (standard view)
                $stmt = $pdo->query("
                    SELECT v.*, 
                           COALESCE(u1.nombre, u2.nombre) as ujier_nombre, 
                           n.n_expediente
                    FROM visitas v
                    LEFT JOIN usuarios u1 ON v.ujier_id = u1.id
                    LEFT JOIN usuarios u2 ON v.ujier_id = u2.dni
                    LEFT JOIN notificaciones n ON v.notificacion_id = n.id
                    WHERE (n.eliminada = 0 OR n.eliminada IS NULL)
                    ORDER BY v.fecha DESC
                    LIMIT 100
                ");
                Database::sendResponse($stmt->fetchAll());
            }
            break;

        case 'POST':
            // Create visit record
            $data = Database::getJsonBody();

            if (empty($data['notificacion_id'])) {
                Database::sendError('Notification ID is required', 400);
            }

            $id = Database::generateUUID();

            // Normalize result
            if (isset($data['resultado']) && !empty($data['resultado'])) {
                $rawResult = trim(str_replace('_', ' ', $data['resultado']));
                $normMap = [
                    'atiende' => 'Atiende',
                    'entregado' => 'Entregada',
                    'entregada' => 'Entregada',
                    'no atiende' => 'No Atiende',
                    'no_atiende' => 'No Atiende',
                    'domicilio inexistente' => 'Domicilio Inexistente',
                    'domicilio_inexistente' => 'Domicilio Inexistente',
                    'pre aviso' => 'Pre Aviso',
                    'pre_aviso' => 'Pre Aviso',
                    'estrados' => 'Estrados',
                    'diligenciador ausente' => 'Diligenciador Ausente',
                    'diligenciador_ausente' => 'Diligenciador Ausente',
                    'traslado' => 'Traslado',
                    'fallecido' => 'Fallecido'
                ];
                $data['resultado'] = $normMap[strtolower($rawResult)] ?? ucwords(strtolower($rawResult));
            }

            $stmt = $pdo->prepare("
                INSERT INTO visitas (id, notificacion_id, ujier_id, resultado, observaciones, ubicacion_lat, ubicacion_lng, foto_url, audio_url, fecha)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");

            $stmt->execute([
                $id,
                $data['notificacion_id'],
                $data['ujier_id'] ?? null,
                $data['resultado'] ?? null,
                $data['observaciones'] ?? null,
                $data['ubicacion_lat'] ?? null,
                $data['ubicacion_lng'] ?? null,
                $data['foto_url'] ?? null,
                $data['audio_url'] ?? null
            ]);

            $stmt = $pdo->prepare("SELECT * FROM visitas WHERE id = ?");
            $stmt->execute([$id]);
            Database::sendResponse($stmt->fetch(), 201);
            break;

        default:
            Database::sendError('Method not allowed', 405);
    }
} catch (PDOException $e) {
    Database::sendError('Database error: ' . $e->getMessage(), 500);
}

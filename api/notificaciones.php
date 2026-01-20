<?php
/**
 * SGND - Notifications API
 * Endpoints for notification management
 */

require_once __DIR__ . '/db.php';

$db = Database::getInstance();
$pdo = $db->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            if (isset($_GET['id'])) {
                // Get single notification with user info
                $stmt = $pdo->prepare("
                    SELECT n.*, u.nombre as ujier_nombre, u.email as ujier_email
                    FROM notificaciones n
                    LEFT JOIN usuarios u ON n.asignado_a = u.id
                    WHERE n.id = ?
                ");
                $stmt->execute([$_GET['id']]);
                $notification = $stmt->fetch();

                if ($notification) {
                    Database::sendResponse($notification);
                } else {
                    Database::sendError('Notification not found', 404);
                }
            } elseif (isset($_GET['asignado_a'])) {
                // Get notifications assigned to a user
                $estado = $_GET['estado'] ?? 'pendiente';
                $stmt = $pdo->prepare("
                    SELECT * FROM notificaciones 
                    WHERE asignado_a = ? AND estado = ?
                    ORDER BY fecha_carga ASC
                ");
                $stmt->execute([$_GET['asignado_a'], $estado]);
                Database::sendResponse($stmt->fetchAll());
            } else {
                // Get all notifications with filters
                $where = ["1=1"];
                $params = [];

                if (!empty($_GET['estado'])) {
                    $where[] = "n.estado = ?";
                    $params[] = $_GET['estado'];
                }

                if (!empty($_GET['tipo'])) {
                    $where[] = "n.tipo_notificacion = ?";
                    $params[] = $_GET['tipo'];
                }

                if (!empty($_GET['fecha'])) {
                    $where[] = "DATE(n.fecha_carga) = ?";
                    $params[] = $_GET['fecha'];
                }

                if (!empty($_GET['search'])) {
                    $search = "%" . $_GET['search'] . "%";
                    $where[] = "(n.n_expediente LIKE ? OR n.destinatario_nombre LIKE ? OR n.caratula LIKE ?)";
                    $params[] = $search;
                    $params[] = $search;
                    $params[] = $search;
                }

                // Count total
                $countSql = "SELECT COUNT(*) as total FROM notificaciones n WHERE " . implode(" AND ", $where);
                $countStmt = $pdo->prepare($countSql);
                $countStmt->execute($params);
                $total = $countStmt->fetch()['total'];

                // Pagination
                $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
                $limit = isset($_GET['limit']) ? min(100, max(1, (int) $_GET['limit'])) : 20;
                $offset = ($page - 1) * $limit;

                $sql = "
                    SELECT n.*, u.nombre as ujier_nombre, u.email as ujier_email
                    FROM notificaciones n
                    LEFT JOIN usuarios u ON n.asignado_a = u.id
                    WHERE " . implode(" AND ", $where) . "
                    ORDER BY n.fecha_carga DESC
                    LIMIT $limit OFFSET $offset
                ";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);

                Database::sendResponse([
                    'data' => $stmt->fetchAll(),
                    'total' => (int) $total,
                    'page' => $page,
                    'limit' => $limit,
                    'pages' => ceil($total / $limit)
                ]);
            }
            break;

        case 'POST':
            $data = Database::getJsonBody();

            // Validate required fields
            $required = ['tipo_notificacion', 'n_expediente', 'caratula', 'origen', 'destinatario_nombre', 'domicilio', 'zona'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    Database::sendError("Field '$field' is required", 400);
                }
            }

            $id = Database::generateUUID();
            $stmt = $pdo->prepare("
                INSERT INTO notificaciones (
                    id, fecha_carga, usuario_carga, estado,
                    tipo_notificacion, n_expediente, caratula, origen, letrado,
                    destinatario_especial, destinatario_nombre, domicilio, zona,
                    tipo_troquel, sin_troquel, n_troquel, medio_pago, costo,
                    observaciones_iniciales, created_at, updated_at
                ) VALUES (
                    ?, NOW(), ?, 'pendiente',
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, NOW(), NOW()
                )
            ");

            $stmt->execute([
                $id,
                $data['usuario_carga'] ?? null,
                Database::sanitize($data['tipo_notificacion']),
                Database::sanitize($data['n_expediente']),
                Database::sanitize($data['caratula']),
                Database::sanitize($data['origen']),
                $data['letrado'] ?? null,
                $data['destinatario_especial'] ?? null,
                Database::sanitize($data['destinatario_nombre']),
                Database::sanitize($data['domicilio']),
                Database::sanitize($data['zona']),
                $data['tipo_troquel'] ?? null,
                $data['sin_troquel'] ?? 0,
                $data['n_troquel'] ?? null,
                $data['medio_pago'] ?? null,
                $data['costo'] ?? 0,
                $data['observaciones_iniciales'] ?? null
            ]);

            // Return created notification
            $stmt = $pdo->prepare("SELECT * FROM notificaciones WHERE id = ?");
            $stmt->execute([$id]);
            Database::sendResponse($stmt->fetch(), 201);
            break;

        case 'PUT':
            $data = Database::getJsonBody();

            if (empty($data['id'])) {
                Database::sendError('Notification ID is required', 400);
            }

            // Check for special actions
            if (isset($data['action'])) {
                switch ($data['action']) {
                    case 'assign':
                        // Assign notification to ujier
                        $stmt = $pdo->prepare("
                            UPDATE notificaciones SET
                                asignado_a = ?,
                                fecha_asignacion = NOW(),
                                asignado_por = ?,
                                updated_at = NOW(),
                                updated_by = ?
                            WHERE id = ?
                        ");
                        $stmt->execute([
                            $data['asignado_a'],
                            $data['asignado_por'],
                            $data['asignado_por'],
                            $data['id']
                        ]);
                        break;

                    case 'result':
                        // Register result (diligencia)
                        $newEstado = ($data['es_carga_diferida'] ?? false) ? 'diferida' : 'diligenciada';

                        $stmt = $pdo->prepare("
                            UPDATE notificaciones SET
                                resultado_diligencia = ?,
                                fecha_diligencia = NOW(),
                                ubicacion_lat = ?,
                                ubicacion_lng = ?,
                                evidencia_foto = ?,
                                observacion_audio = ?,
                                transcripcion_audio = ?,
                                es_carga_diferida = ?,
                                motivo_falla_senal = ?,
                                observaciones_resultado = ?,
                                estado = ?,
                                diligenciado_por = ?,
                                updated_at = NOW(),
                                updated_by = ?
                            WHERE id = ?
                        ");
                        $stmt->execute([
                            $data['resultado'],
                            $data['ubicacion_lat'] ?? null,
                            $data['ubicacion_lng'] ?? null,
                            $data['evidencia_foto'] ?? null,
                            $data['observacion_audio'] ?? null,
                            $data['transcripcion_audio'] ?? null,
                            $data['es_carga_diferida'] ?? 0,
                            $data['motivo_falla_senal'] ?? null,
                            $data['observaciones'] ?? null,
                            $newEstado,
                            $data['user_id'],
                            $data['user_id'],
                            $data['id']
                        ]);

                        // Also save to visitas history
                        $visitaId = Database::generateUUID();
                        $stmtVisita = $pdo->prepare("
                            INSERT INTO visitas (id, notificacion_id, ujier_id, resultado, observaciones, ubicacion_lat, ubicacion_lng, foto_url, audio_url, fecha)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                        ");
                        $stmtVisita->execute([
                            $visitaId,
                            $data['id'],
                            $data['user_id'],
                            $data['resultado'],
                            $data['observaciones'] ?? null,
                            $data['ubicacion_lat'] ?? null,
                            $data['ubicacion_lng'] ?? null,
                            $data['evidencia_foto'] ?? null,
                            $data['observacion_audio'] ?? null
                        ]);
                        break;

                    default:
                        Database::sendError('Invalid action', 400);
                }
            } else {
                // Generic update
                $allowedFields = [
                    'estado',
                    'observaciones_iniciales',
                    'tipo_notificacion',
                    'n_expediente',
                    'caratula',
                    'origen',
                    'letrado',
                    'destinatario_nombre',
                    'domicilio',
                    'zona'
                ];
                $updates = [];
                $params = [];

                foreach ($allowedFields as $field) {
                    if (isset($data[$field])) {
                        $updates[] = "$field = ?";
                        $params[] = Database::sanitize($data[$field]);
                    }
                }

                if (empty($updates)) {
                    Database::sendError('No fields to update', 400);
                }

                $updates[] = "updated_at = NOW()";
                if (isset($data['updated_by'])) {
                    $updates[] = "updated_by = ?";
                    $params[] = $data['updated_by'];
                }
                $params[] = $data['id'];

                $sql = "UPDATE notificaciones SET " . implode(", ", $updates) . " WHERE id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
            }

            // Return updated notification
            $stmt = $pdo->prepare("SELECT * FROM notificaciones WHERE id = ?");
            $stmt->execute([$data['id']]);
            Database::sendResponse($stmt->fetch());
            break;

        case 'DELETE':
            $data = Database::getJsonBody();

            if (empty($data['id'])) {
                Database::sendError('Notification ID is required', 400);
            }

            // Hard delete (or you could implement soft delete)
            $stmt = $pdo->prepare("DELETE FROM notificaciones WHERE id = ?");
            $stmt->execute([$data['id']]);

            Database::sendResponse(['deleted' => true]);
            break;

        default:
            Database::sendError('Method not allowed', 405);
    }
} catch (PDOException $e) {
    Database::sendError('Database error: ' . $e->getMessage(), 500);
}

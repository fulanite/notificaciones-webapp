<?php
/**
 * SGND - Notifications API
 * Endpoints for notification management
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/AuditLogger.php';

session_start();
$db = Database::getInstance();
$pdo = $db->getConnection();
$logger = new AuditLogger($pdo);
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            if (isset($_GET['id'])) {
                // Get single notification with user info
                $stmt = $pdo->prepare("
                    SELECT n.*, 
                           COALESCE(u1.nombre, u2.nombre) as ujier_nombre, 
                           COALESCE(u1.email, u2.email) as ujier_email,
                           COALESCE(u3.nombre, u4.nombre, n.usuario_carga) as cargador_nombre,
                           (SELECT nombre FROM usuarios u_del WHERE u_del.email = n.eliminada_por OR u_del.id = n.eliminada_por LIMIT 1) as eliminada_por_nombre,
                           (SELECT resultado FROM visitas v_sub 
                            WHERE v_sub.notificacion_id = n.id 
                            ORDER BY v_sub.fecha DESC, v_sub.id DESC LIMIT 1) as resultado_ultima_visita,
                           (SELECT fecha FROM visitas v_sub 
                            WHERE v_sub.notificacion_id = n.id 
                            ORDER BY v_sub.fecha DESC, v_sub.id DESC LIMIT 1) as fecha_ultima_visita
                    FROM notificaciones n
                    LEFT JOIN usuarios u1 ON n.asignado_a = u1.id
                    LEFT JOIN usuarios u2 ON n.asignado_a = u2.dni
                    LEFT JOIN usuarios u3 ON n.usuario_carga = u3.dni
                    LEFT JOIN usuarios u4 ON n.usuario_carga = u4.email
                    WHERE n.id = ?
                ");
                $stmt->execute([$_GET['id']]);
                $notification = $stmt->fetch();

                if ($notification) {
                    $notification['estado_display'] = !empty($notification['resultado_ultima_visita'])
                        ? $notification['resultado_ultima_visita']
                        : $notification['estado'];
                    Database::sendResponse($notification);
                } else {
                    Database::sendError('Notification not found', 404);
                }
            } elseif (isset($_GET['asignado_a'])) {
                // Get notifications assigned to a user
                $estadosStr = $_GET['estado'] ?? 'pendiente';
                $estadosArr = explode(',', $estadosStr);
                $placeholders = implode(',', array_fill(0, count($estadosArr), '?'));

                $sql = "SELECT DISTINCT n.* FROM notificaciones n
                        WHERE (n.asignado_a = ? OR n.asignado_a = (SELECT dni FROM usuarios WHERE id = ?)) 
                        AND (n.estado IN ($placeholders) OR LOWER(n.estado) IN ('pre_aviso', 'pre aviso', 'pre-aviso')) 
                        AND n.devuelta_por_ujier = 0
                        AND (
                            -- Solo si NO tiene una visita con un resultado final (distinto a pre aviso)
                            NOT EXISTS (
                                SELECT 1 FROM visitas v
                                WHERE v.notificacion_id = n.id
                                AND LOWER(v.resultado) NOT IN ('pre_aviso', 'pre aviso', 'pre-aviso')
                            )
                            OR n.estado = 'pre_aviso'
                        )
                        AND (n.eliminada = 0 OR n.eliminada IS NULL)
                        ORDER BY COALESCE(n.fecha_entrega_ujier, n.fecha_carga) ASC";

                $stmt = $pdo->prepare($sql);
                // We need to pass both ID and placeholders, plus ID again for the subquery
                $params = array_merge([$_GET['asignado_a'], $_GET['asignado_a']], $estadosArr);
                $stmt->execute($params);
                Database::sendResponse($stmt->fetchAll());
            } elseif (isset($_GET['action']) && $_GET['action'] === 'distinct' && isset($_GET['column'])) {
                // Get distinct values for a column
                $allowedColumns = ['zona', 'estado', 'tipo_notificacion', 'resultado_diligencia', 'medio_pago'];
                $column = $_GET['column'];

                if (!in_array($column, $allowedColumns)) {
                    Database::sendError('Invalid column for distinct values', 400);
                }

                $stmt = $pdo->prepare("SELECT DISTINCT $column FROM notificaciones WHERE $column IS NOT NULL AND $column != '' AND (eliminada = 0 OR eliminada IS NULL) ORDER BY $column ASC");
                $stmt->execute();

                $values = $stmt->fetchAll(PDO::FETCH_COLUMN);
                Database::sendResponse($values);
            } else {
                // Get all notifications with filters
                $where = ["1=1"];
                $params = [];

                // Hide deleted notifications by default (show only for audit when show_deleted=1)
                if (!isset($_GET['show_deleted']) || $_GET['show_deleted'] != '1') {
                    $where[] = "(n.eliminada = 0 OR n.eliminada IS NULL)";
                }

                if (!empty($_GET['estado'])) {
                    $estadosArr = explode(',', $_GET['estado']);

                    // Check if pre_aviso is requested to add loose matching
                    $includePreAviso = false;
                    foreach ($estadosArr as $est) {
                        $norm = str_replace('_', ' ', strtolower(trim($est)));
                        if ($norm === 'pre aviso') {
                            $includePreAviso = true;
                            break;
                        }
                    }

                    $placeholders = implode(',', array_fill(0, count($estadosArr), '?'));

                    if ($includePreAviso) {
                        $where[] = "(COALESCE(n.resultado_diligencia, n.estado) IN ($placeholders) OR COALESCE(n.resultado_diligencia, n.estado) LIKE '%pre aviso%' OR COALESCE(n.resultado_diligencia, n.estado) LIKE '%pre_aviso%')";
                    } else {
                        $where[] = "COALESCE(n.resultado_diligencia, n.estado) IN ($placeholders)";
                    }

                    foreach ($estadosArr as $est) {
                        $params[] = trim($est);
                    }
                }

                if (!empty($_GET['tipo'])) {
                    $where[] = "n.tipo_notificacion = ?";
                    $params[] = $_GET['tipo'];
                }

                if (!empty($_GET['fecha'])) {
                    $where[] = "DATE(n.fecha_entrega_ujier) = ?";
                    $params[] = $_GET['fecha'];
                }

                if (!empty($_GET['fecha_carga'])) {
                    $where[] = "DATE(n.fecha_carga) = ?";
                    $params[] = $_GET['fecha_carga'];
                }

                if (!empty($_GET['zona'])) {
                    $where[] = "n.zona = ?";
                    $params[] = $_GET['zona'];
                }

                if (!empty($_GET['filter_ujier'])) {
                    $ujier = $_GET['filter_ujier'];
                    $where[] = "(n.asignado_a = ? OR n.asignado_a = (SELECT dni FROM usuarios WHERE id = ?))";
                    $params[] = $ujier;
                    $params[] = $ujier;
                }

                if (!empty($_GET['unassigned_only']) && $_GET['unassigned_only'] == '1') {
                    $where[] = "(n.fecha_entrega_ujier IS NULL OR n.fecha_entrega_ujier = '')";
                }

                if (!empty($_GET['year'])) {
                    $year = (int) $_GET['year'];
                    // Mas robusto para fechas migradas que pueden ser strings o NULL
                    // Si se pide un año, incluimos las que coincidan por YEAR() PERO TAMBIEN permitimos ver las que NO TIENEN FECHA DE ENTREGA
                    // si unassigned_only NO está activado (para que aparezcan en "Todas")

                    $condition = "(
                        YEAR(n.fecha_entrega_ujier) = ? OR 
                        YEAR(n.fecha_carga) = ? OR 
                        n.fecha_carga LIKE ? OR
                        n.created_at LIKE ?";

                    // Si NO estamos filtrando SOLO por una zona u otro parametro hiper especifico, 
                    // y el usuario quiere ver "Todas", permitimos que las sin fecha se vean en el año actual
                    if (empty($_GET['unassigned_only']) && $year == (int) date('Y')) {
                        $condition .= " OR n.fecha_entrega_ujier IS NULL OR n.fecha_entrega_ujier = ''";
                    }

                    $condition .= ")";

                    $where[] = $condition;
                    $params[] = $year;
                    $params[] = $year;
                    $params[] = "%$year%";
                    $params[] = "$year%";
                }

                if (!empty($_GET['month'])) {
                    $where[] = "MONTH(n.fecha_entrega_ujier) = ?";
                    $params[] = (int) $_GET['month'];
                }

                if (isset($_GET['devuelta_por_ujier'])) {
                    $val = (int) $_GET['devuelta_por_ujier'];
                    if ($val === 0) {
                        $where[] = "(n.devuelta_por_ujier = 0 OR n.devuelta_por_ujier IS NULL)";
                    } else {
                        $where[] = "n.devuelta_por_ujier = ?";
                        $params[] = $val;
                    }
                }

                if (!empty($_GET['own_only']) && $_GET['own_only'] == '1' && !empty($_GET['user_email'])) {
                    // Buscar por email actual, o por DNI/Nombre que pudieran estar en la base migrada
                    $where[] = "(
                        n.usuario_carga = ? OR 
                        TRIM(n.usuario_carga) = (SELECT dni FROM usuarios WHERE email = ? LIMIT 1) OR
                        TRIM(n.usuario_carga) = (SELECT nombre FROM usuarios WHERE email = ? LIMIT 1) OR
                        (SELECT nombre FROM usuarios WHERE email = ? LIMIT 1) LIKE CONCAT('%', TRIM(n.usuario_carga), '%')
                    )";
                    $params[] = $_GET['user_email'];
                    $params[] = $_GET['user_email'];
                    $params[] = $_GET['user_email'];
                    $params[] = $_GET['user_email'];

                }

                if (!empty($_GET['search'])) {
                    $search = "%" . $_GET['search'] . "%";
                    $where[] = "(
                        n.id LIKE ? OR 
                        n.glide_id_cedula LIKE ? OR 
                        n.n_expediente LIKE ? OR 
                        n.destinatario_nombre LIKE ? OR 
                        n.caratula LIKE ? OR 
                        n.origen LIKE ? OR 
                        n.letrado LIKE ? OR 
                        n.domicilio LIKE ? OR 
                        n.zona LIKE ? OR 
                        n.n_troquel LIKE ? OR 
                        n.tipo_notificacion LIKE ? OR 
                        n.observaciones_iniciales LIKE ? OR 
                        n.observaciones_resultado LIKE ? OR 
                        n.destinatario_especial LIKE ?
                    )";
                    // Add params for each field (14 fields now)
                    for ($i = 0; $i < 14; $i++) {
                        $params[] = $search;
                    }
                }

                if (!empty($_GET['medio_pago'])) {
                    $where[] = "n.medio_pago = ?";
                    $params[] = $_GET['medio_pago'];
                }

                if (!empty($_GET['diferida_only']) && $_GET['diferida_only'] == '1') {
                    $where[] = "n.es_carga_diferida = 1";
                }

                // Count total
                $countSql = "SELECT COUNT(*) as total FROM notificaciones n WHERE " . implode(" AND ", $where);
                $countStmt = $pdo->prepare($countSql);
                $countStmt->execute($params);
                $total = $countStmt->fetch()['total'];

                // Pagination
                $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
                $limit = isset($_GET['limit']) ? min(5000, max(1, (int) $_GET['limit'])) : 20;
                $offset = ($page - 1) * $limit;

                $sql = "
                    SELECT n.*, 
                           MAX(COALESCE(u1.nombre, u2.nombre)) as ujier_nombre, 
                           MAX(COALESCE(u3.nombre, u4.nombre, n.usuario_carga)) as cargador_nombre,
                           (SELECT nombre FROM usuarios u_del WHERE u_del.email = n.eliminada_por OR u_del.id = n.eliminada_por LIMIT 1) as eliminada_por_nombre,
                           (SELECT resultado FROM visitas v_sub 
                            WHERE v_sub.notificacion_id = n.id 
                            ORDER BY v_sub.fecha DESC, v_sub.id DESC LIMIT 1) as resultado_ultima_visita,
                           (SELECT fecha FROM visitas v_sub 
                            WHERE v_sub.notificacion_id = n.id 
                            ORDER BY v_sub.fecha DESC, v_sub.id DESC LIMIT 1) as fecha_ultima_visita
                    FROM notificaciones n
                    LEFT JOIN usuarios u1 ON n.asignado_a = u1.id
                    LEFT JOIN usuarios u2 ON n.asignado_a = u2.dni
                    LEFT JOIN usuarios u3 ON n.usuario_carga = u3.email
                    LEFT JOIN usuarios u4 ON n.usuario_carga = u4.dni
                    WHERE " . implode(" AND ", $where) . "
                    GROUP BY n.id
                    ORDER BY COALESCE(n.fecha_entrega_ujier, n.fecha_carga) DESC, n.created_at DESC
                    LIMIT $limit OFFSET $offset
                ";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);

                $results = $stmt->fetchAll();

                // Sobrescribimos el estado visual con el de la última visita si existe
                foreach ($results as &$row) {
                    if (!empty($row['resultado_ultima_visita'])) {
                        $row['estado_display'] = $row['resultado_ultima_visita'];
                    } else {
                        $row['estado_display'] = $row['estado'];
                    }
                }

                Database::sendResponse([
                    'data' => $results,
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
            $required = ['tipo_notificacion', 'n_expediente', 'caratula', 'origen', 'destinatario_nombre', 'zona'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    Database::sendError("Field '$field' is required", 400);
                }
            }

            // Domicilio is only required if NOT a special recipient
            if (empty($data['destinatario_especial']) && empty($data['domicilio'])) {
                Database::sendError("Field 'domicilio' is required for regular recipients", 400);
            }

            // Resolve usuario_carga: prefer DNI, lookup if email/name provided
            $usuarioCarga = $data['usuario_carga'] ?? null;
            if ($usuarioCarga && !is_numeric($usuarioCarga)) {
                // Try to find user by email or name to get DNI
                $stmtUser = $pdo->prepare("SELECT dni FROM usuarios WHERE email = ? OR nombre = ? LIMIT 1");
                $stmtUser->execute([$usuarioCarga, $usuarioCarga]);
                $foundUser = $stmtUser->fetch();
                if ($foundUser && !empty($foundUser['dni'])) {
                    $usuarioCarga = $foundUser['dni'];
                }
            }

            $id = Database::generateUUID();
            $stmt = $pdo->prepare("
                INSERT INTO notificaciones (
                    id, fecha_carga, fecha_entrega_ujier, usuario_carga, estado,
                    tipo_notificacion, n_expediente, caratula, origen, letrado,
                    destinatario_especial, destinatario_nombre, domicilio, zona,
                    tipo_troquel, sin_troquel, n_troquel, medio_pago, costo,
                    asignado_a, fecha_asignacion, asignado_por,
                    observaciones_iniciales, created_at, updated_at
                ) VALUES (
                    ?, NOW(), ?, ?, 'pendiente',
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, NOW(), NOW()
                )
            ");

            // Normalize asignado_a to DNI if UUID provided
            $asignadoA = $data['asignado_a'] ?? null;
            if ($asignadoA && strlen($asignadoA) > 15) { // Assuming UUID length
                $stmtUjier = $pdo->prepare("SELECT dni FROM usuarios WHERE id = ? LIMIT 1");
                $stmtUjier->execute([$asignadoA]);
                $u = $stmtUjier->fetch();
                if ($u && !empty($u['dni']))
                    $asignadoA = $u['dni'];
            }

            $stmt->execute([
                $id,
                !empty($data['fecha_entrega_ujier']) ? $data['fecha_entrega_ujier'] : null,
                $usuarioCarga, // Use resolved DNI

                Database::sanitize($data['tipo_notificacion']),
                Database::sanitize($data['n_expediente']),
                Database::sanitize($data['caratula']),
                Database::sanitize($data['origen']),
                $data['letrado'] ?? null,
                $data['destinatario_especial'] ?? null,
                Database::sanitize($data['destinatario_nombre']),
                Database::sanitize($data['domicilio']),
                Database::sanitize($data['zona']),
                !empty($data['tipo_troquel']) ? $data['tipo_troquel'] : null,
                isset($data['sin_troquel']) ? (int) $data['sin_troquel'] : 0,
                !empty($data['n_troquel']) ? (int) $data['n_troquel'] : null,
                $data['medio_pago'] ?? null,
                $data['costo'] ?? 0,
                $asignadoA,
                !empty($asignadoA) ? date('Y-m-d H:i:s') : null,
                $data['asignado_por'] ?? null,
                $data['observaciones_iniciales'] ?? null
            ]);

            // Return created notification
            $stmt = $pdo->prepare("SELECT * FROM notificaciones WHERE id = ?");
            $stmt->execute([$id]);
            $createdNotif = $stmt->fetch();

            // Log creation
            if (isset($_SESSION['user_id'])) {
                $logger->logCreate('notificacion', $id, $createdNotif, [
                    'id' => $_SESSION['user_id'],
                    'nombre' => $_SESSION['user_nombre'] ?? 'Usuario',
                    'rol' => $_SESSION['user_rol'] ?? 'unknown'
                ], "Creó notificación #{$id} - {$data['tipo_notificacion']}");
            }

            Database::sendResponse($createdNotif, 201);
            break;

        case 'PUT':
            $data = Database::getJsonBody();

            // Get original notification data before any changes for audit logging
            $beforeUpdate = null;
            if (!empty($data['id'])) {
                $stmtBefore = $pdo->prepare("SELECT * FROM notificaciones WHERE id = ?");
                $stmtBefore->execute([$data['id']]);
                $beforeUpdate = $stmtBefore->fetch();
            }

            if (empty($data['id'])) {
                Database::sendError('Notification ID is required', 400);
            }

            // Check for special actions
            if (isset($data['action'])) {
                // Normalize result if present to ensure database consistency
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

                switch ($data['action']) {
                    case 'assign':
                        // Normalize asignado_a to DNI if UUID provided
                        $asignadoA = $data['asignado_a'];
                        if ($asignadoA && strlen($asignadoA) > 15) {
                            $stmtUjier = $pdo->prepare("SELECT dni FROM usuarios WHERE id = ? LIMIT 1");
                            $stmtUjier->execute([$asignadoA]);
                            $u = $stmtUjier->fetch();
                            if ($u && !empty($u['dni']))
                                $asignadoA = $u['dni'];
                        }

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
                            $asignadoA,
                            $data['asignado_por'],
                            $data['asignado_por'],
                            $data['id']
                        ]);
                        break;

                    case 'result':
                        // Register result (diligencia)
                        // Segun el usuario: 'el estado de la notificacion, es la ultima visita que hizo el ujier, el resultado'
                        $newEstado = $data['resultado'];

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
                            INSERT INTO visitas (id, notificacion_id, ujier_id, resultado, observaciones, transcripcion_audio, ubicacion_lat, ubicacion_lng, foto_url, audio_url, fecha)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                        ");
                        $stmtVisita->execute([
                            $visitaId,
                            $data['id'],
                            $data['user_id'],
                            $data['resultado'],
                            $data['observaciones'] ?? null,
                            $data['transcripcion_audio'] ?? null,
                            $data['ubicacion_lat'] ?? null,
                            $data['ubicacion_lng'] ?? null,
                            $data['evidencia_foto'] ?? null,
                            $data['observacion_audio'] ?? null
                        ]);
                        break;

                    case 'update_result':
                        // Update existing result (diligencia) without creating new visit
                        $newResult = $data['resultado'] ?? null;

                        // Security check: Don't allow update if already returned
                        $stmtCheck = $pdo->prepare("SELECT devuelta_por_ujier FROM notificaciones WHERE id = ?");
                        $stmtCheck->execute([$data['id']]);
                        $current = $stmtCheck->fetch();
                        if ($current && $current['devuelta_por_ujier'] == 1) {
                            Database::sendError('No se puede editar una notificación ya devuelta físicamente', 403);
                        }

                        $stmt = $pdo->prepare("
                            UPDATE notificaciones SET
                                resultado_diligencia = COALESCE(?, resultado_diligencia),
                                estado = COALESCE(?, estado),
                                observaciones_resultado = ?,
                                transcripcion_audio = ?,
                                evidencia_foto = COALESCE(?, evidencia_foto),
                                observacion_audio = COALESCE(?, observacion_audio),
                                updated_at = NOW(),
                                updated_by = ?
                            WHERE id = ?
                        ");
                        $stmt->execute([
                            $newResult,
                            $newResult, // Sync state
                            $data['observaciones'] ?? null,
                            $data['transcripcion_audio'] ?? null,
                            $data['evidencia_foto'] ?? null,
                            $data['observacion_audio'] ?? null,
                            $data['user_id'],
                            $data['id']
                        ]);

                        // Update the latest visit log for this notification to maintain consistency
                        $stmtVisita = $pdo->prepare("
                            UPDATE visitas SET 
                                resultado = COALESCE(?, resultado),
                                observaciones = ?, 
                                transcripcion_audio = ?,
                                foto_url = COALESCE(?, foto_url),
                                audio_url = COALESCE(?, audio_url)
                            WHERE notificacion_id = ? 
                            ORDER BY fecha DESC LIMIT 1
                        ");
                        $stmtVisita->execute([
                            $newResult,
                            $data['observaciones'] ?? null,
                            $data['transcripcion_audio'] ?? null,
                            $data['evidencia_foto'] ?? null,
                            $data['observacion_audio'] ?? null,
                            $data['id']
                        ]);
                        break;

                    case 'return':
                        // Mark as returned by ujier
                        $stmt = $pdo->prepare("
                            UPDATE notificaciones SET
                                devuelta_por_ujier = 1,
                                fecha_devolucion = NOW(),
                                updated_at = NOW(),
                                updated_by = ?
                            WHERE id = ?
                        ");
                        $stmt->execute([
                            $data['user_id'],
                            $data['id']
                        ]);
                        break;

                    case 'revert_return':
                        // Only Coordinator and Admin can revert return
                        $userRol = strtolower($_SESSION['user_rol'] ?? '');
                        if ($userRol !== 'coordinador' && $userRol !== 'admin') {
                            Database::sendError('No tenés permisos para esta acción', 403);
                        }

                        $stmt = $pdo->prepare("
                            UPDATE notificaciones SET
                                devuelta_por_ujier = 0,
                                fecha_devolucion = NULL,
                                updated_at = NOW(),
                                updated_by = ?
                            WHERE id = ?
                        ");
                        $stmt->execute([
                            $data['user_id'] ?? ($_SESSION['user_id'] ?? 'system'),
                            $data['id']
                        ]);

                        // Log action
                        $logger->log([
                            'usuario_id' => $_SESSION['user_id'] ?? null,
                            'usuario_nombre' => $_SESSION['user_nombre'] ?? 'Sistema',
                            'usuario_rol' => $_SESSION['user_rol'] ?? null,
                            'accion' => 'REVERT_RETURN',
                            'entidad' => 'notificacion',
                            'entidad_id' => $data['id'],
                            'descripcion' => "Deshizo la devolución de la notificación #" . $data['id'],
                            'severidad' => 'warning'
                        ]);
                        break;

                    case 'mark_retirada':
                        // Only Administrative, Coordinator and Admin can mark as withdrawn
                        $userRol = strtolower($_SESSION['user_rol'] ?? '');
                        if ($userRol !== 'administrativo' && $userRol !== 'coordinador' && $userRol !== 'admin') {
                            Database::sendError('No tenés permisos para esta acción', 403);
                        }

                        $stmt = $pdo->prepare("
                            UPDATE notificaciones SET
                                retirada_por_profesional = 1,
                                fecha_retiro_profesional = NOW(),
                                retirado_por_usuario = ?,
                                updated_at = NOW(),
                                updated_by = ?
                            WHERE id = ?
                        ");
                        $stmt->execute([
                            $_SESSION['user_nombre'] ?? 'Administrativo',
                            $data['user_id'] ?? ($_SESSION['user_id'] ?? 'system'),
                            $data['id']
                        ]);

                        // Log action
                        $logger->log([
                            'usuario_id' => $_SESSION['user_id'] ?? null,
                            'usuario_nombre' => $_SESSION['user_nombre'] ?? 'Sistema',
                            'usuario_rol' => $_SESSION['user_rol'] ?? null,
                            'accion' => 'MARK_RETIRADA',
                            'entidad' => 'notificacion',
                            'entidad_id' => $data['id'],
                            'descripcion' => "Marcó notificación #" . $data['id'] . " como retirada por profesional",
                            'severidad' => 'info'
                        ]);
                        break;

                    case 'revert_retirada':
                        // Only Administrative, Coordinator and Admin can revert
                        $userRol = strtolower($_SESSION['user_rol'] ?? '');
                        if ($userRol !== 'administrativo' && $userRol !== 'coordinador' && $userRol !== 'admin') {
                            Database::sendError('No tenés permisos para esta acción', 403);
                        }

                        $stmt = $pdo->prepare("
                            UPDATE notificaciones SET
                                retirada_por_profesional = 0,
                                fecha_retiro_profesional = NULL,
                                retirado_por_usuario = NULL,
                                updated_at = NOW(),
                                updated_by = ?
                            WHERE id = ?
                        ");
                        $stmt->execute([
                            $data['user_id'] ?? ($_SESSION['user_id'] ?? 'system'),
                            $data['id']
                        ]);

                        $logger->log([
                            'usuario_id' => $_SESSION['user_id'] ?? null,
                            'usuario_nombre' => $_SESSION['user_nombre'] ?? 'Sistema',
                            'usuario_rol' => $_SESSION['user_rol'] ?? null,
                            'accion' => 'REVERT_RETIRADA',
                            'entidad' => 'notificacion',
                            'entidad_id' => $data['id'],
                            'descripcion' => "Deshizo el retiro por profesional de la notificación #" . $data['id'],
                            'severidad' => 'info'
                        ]);
                        break;

                    case 'delete':
                        // Soft delete notification
                        $stmt = $pdo->prepare("
                            UPDATE notificaciones SET
                                eliminada = 1,
                                eliminada_por = ?,
                                eliminada_motivo = ?,
                                eliminada_fecha = NOW(),
                                updated_at = NOW(),
                                updated_by = ?
                            WHERE id = ?
                        ");
                        $stmt->execute([
                            $data['eliminada_por'],
                            $data['eliminada_motivo'],
                            $data['eliminada_por'],
                            $data['id']
                        ]);

                        // Log soft delete immediately as a DELETE action
                        if ($beforeUpdate && isset($_SESSION['user_id'])) {
                            $logger->logDelete('notificacion', $data['id'], $beforeUpdate, [
                                'id' => $_SESSION['user_id'],
                                'nombre' => $_SESSION['user_nombre'] ?? 'Usuario',
                                'rol' => $_SESSION['user_rol'] ?? 'unknown'
                            ], "Eliminó (marcó para borrar) notificación #{$data['id']} - Motivo: {$data['eliminada_motivo']}");
                        }
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
                    'zona',
                    'asignado_a',
                    'fecha_entrega_ujier',
                    'destinatario_especial',
                    'tipo_troquel',
                    'n_troquel',
                    'sin_troquel',
                    'medio_pago',
                    'costo',
                    'resultado_diligencia',
                    'fecha_diligencia',
                    'eliminada',
                    'eliminada_por',
                    'eliminada_motivo',
                    'eliminada_fecha'
                ];
                $updates = [];
                $params = [];

                foreach ($allowedFields as $field) {
                    if (array_key_exists($field, $data)) {
                        $updates[] = "$field = ?";
                        $val = $data[$field];

                        if ($field === 'sin_troquel') {
                            $params[] = ($val === true || $val === '1' || $val === 'true' || $val === 1) ? 1 : 0;
                        } elseif ($field === 'n_troquel') {
                            $params[] = !empty($val) ? (int) $val : null;
                        } elseif ($field === 'costo') {
                            $params[] = (float) $val;
                        } elseif ($field === 'tipo_troquel') {
                            $params[] = !empty($val) ? $val : null;
                        } else {
                            $params[] = Database::sanitize($val);
                        }

                        // Si se cambia el ujier, actualizar también la fecha de asignación
                        if ($field === 'asignado_a' && !empty($data['asignado_a'])) {
                            $updates[] = "fecha_asignacion = NOW()";
                        }
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
            $updatedNotif = $stmt->fetch();

            // Log update
            if (isset($_SESSION['user_id'])) {
                $raw_action = $data['action'] ?? 'update';
                if ($raw_action !== 'delete') {
                    $description = "Actualizó notificación #{$data['id']}";
                    if ($raw_action === 'assign')
                        $description = "Asignó notificación #{$data['id']} a ujier";
                    if ($raw_action === 'result')
                        $description = "Registró resultado en notificación #{$data['id']}";
                    if ($raw_action === 'return')
                        $description = "Marcó notificación #{$data['id']} como devuelta";

                    $logger->logUpdate('notificacion', $data['id'], $beforeUpdate, $updatedNotif, [
                        'id' => $_SESSION['user_id'],
                        'nombre' => $_SESSION['user_nombre'] ?? 'Usuario',
                        'rol' => $_SESSION['user_rol'] ?? 'unknown'
                    ], $description);
                }
            }

            Database::sendResponse($updatedNotif);
            break;

        case 'DELETE':
            $data = Database::getJsonBody();

            if (empty($data['id'])) {
                Database::sendError('Notification ID is required', 400);
            }

            // Get notification data before deleting
            $stmt = $pdo->prepare("SELECT * FROM notificaciones WHERE id = ?");
            $stmt->execute([$data['id']]);
            $deletedNotif = $stmt->fetch();

            // Hard delete (or you could implement soft delete)
            $stmt = $pdo->prepare("DELETE FROM notificaciones WHERE id = ?");
            $stmt->execute([$data['id']]);

            // Log deletion
            if ($deletedNotif && isset($_SESSION['user_id'])) {
                $logger->logDelete('notificacion', $data['id'], $deletedNotif, [
                    'id' => $_SESSION['user_id'],
                    'nombre' => $_SESSION['user_nombre'] ?? 'Usuario',
                    'rol' => $_SESSION['user_rol'] ?? 'unknown'
                ], "Eliminó notificación #{$data['id']} - {$deletedNotif['tipo_notificacion']}");
            }

            Database::sendResponse(['deleted' => true]);
            break;

        default:
            Database::sendError('Method not allowed', 405);
    }
} catch (PDOException $e) {
    Database::sendError('Database error: ' . $e->getMessage(), 500);
}

<?php
/**
 * AuditLogger - Sistema de auditoría para SGND
 * Registra todas las acciones críticas del sistema
 */

class AuditLogger
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Registrar una acción en el log de auditoría
     * 
     * @param array $params Parámetros del log
     * @return int|false ID del log insertado o false en caso de error
     */
    public function log($params)
    {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO audit_log (
                    usuario_id, usuario_nombre, usuario_rol,
                    accion, entidad, entidad_id,
                    descripcion, datos_anteriores, datos_nuevos, metadatos,
                    ip_address, user_agent, ruta, metodo,
                    severidad, resultado, mensaje_error
                ) VALUES (
                    :usuario_id, :usuario_nombre, :usuario_rol,
                    :accion, :entidad, :entidad_id,
                    :descripcion, :datos_anteriores, :datos_nuevos, :metadatos,
                    :ip_address, :user_agent, :ruta, :metodo,
                    :severidad, :resultado, :mensaje_error
                )
            ");

            $stmt->execute([
                'usuario_id' => $params['usuario_id'] ?? null,
                'usuario_nombre' => $params['usuario_nombre'] ?? null,
                'usuario_rol' => $params['usuario_rol'] ?? null,
                'accion' => $params['accion'],
                'entidad' => $params['entidad'],
                'entidad_id' => $params['entidad_id'] ?? null,
                'descripcion' => $params['descripcion'],
                'datos_anteriores' => isset($params['datos_anteriores']) ? json_encode($params['datos_anteriores']) : null,
                'datos_nuevos' => isset($params['datos_nuevos']) ? json_encode($params['datos_nuevos']) : null,
                'metadatos' => isset($params['metadatos']) ? json_encode($params['metadatos']) : null,
                'ip_address' => $this->getClientIP(),
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
                'ruta' => $_SERVER['REQUEST_URI'] ?? null,
                'metodo' => $_SERVER['REQUEST_METHOD'] ?? null,
                'severidad' => $params['severidad'] ?? 'info',
                'resultado' => $params['resultado'] ?? 'exito',
                'mensaje_error' => $params['mensaje_error'] ?? null
            ]);

            return $this->pdo->lastInsertId();
        } catch (Exception $e) {
            error_log("Error en AuditLogger: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Registrar generación de reporte o planilla
     */
    public function logReport($tipo, $params, $usuario)
    {
        return $this->log([
            'usuario_id' => $usuario['id'],
            'usuario_nombre' => $usuario['nombre'],
            'usuario_rol' => $usuario['rol'],
            'accion' => 'GENERATE_REPORT',
            'entidad' => $tipo, // 'reporte_mensual', 'planilla_diaria', etc.
            'descripcion' => $this->buildReportDescription($tipo, $params),
            'metadatos' => [
                'tipo' => $tipo,
                'rango_fechas' => $params['rango_fechas'] ?? null,
                'filtros' => $params['filtros'] ?? [],
                'registros_count' => $params['registros_count'] ?? 0,
                'formato' => $params['formato'] ?? 'PDF',
                'tamaño_kb' => $params['tamaño_kb'] ?? null
            ],
            'severidad' => 'info'
        ]);
    }

    /**
     * Registrar exportación de datos
     */
    public function logExport($vista, $filtros, $count, $formato, $usuario)
    {
        return $this->log([
            'usuario_id' => $usuario['id'],
            'usuario_nombre' => $usuario['nombre'],
            'usuario_rol' => $usuario['rol'],
            'accion' => 'EXPORT',
            'entidad' => $vista,
            'descripcion' => "Exportó {$count} registros de {$vista} a {$formato}",
            'metadatos' => [
                'vista' => $vista,
                'filtros' => $filtros,
                'registros_count' => $count,
                'formato' => $formato
            ],
            'severidad' => 'info'
        ]);
    }

    /**
     * Registrar autenticación (login/logout)
     */
    public function logAuth($accion, $usuario, $resultado = 'exito', $mensaje_error = null)
    {
        return $this->log([
            'usuario_id' => $usuario['id'] ?? null,
            'usuario_nombre' => $usuario['nombre'] ?? $usuario['email'] ?? 'Desconocido',
            'usuario_rol' => $usuario['rol'] ?? null,
            'accion' => $accion, // 'LOGIN' o 'LOGOUT'
            'entidad' => 'sesion',
            'descripcion' => $accion === 'LOGIN'
                ? ($resultado === 'exito' ? 'Inicio de sesión exitoso' : 'Intento de inicio de sesión fallido')
                : 'Cierre de sesión',
            'severidad' => $resultado === 'exito' ? 'info' : 'warning',
            'resultado' => $resultado,
            'mensaje_error' => $mensaje_error
        ]);
    }

    /**
     * Registrar creación de entidad
     */
    public function logCreate($entidad, $entidad_id, $datos, $usuario, $descripcion = null)
    {
        return $this->log([
            'usuario_id' => $usuario['id'],
            'usuario_nombre' => $usuario['nombre'],
            'usuario_rol' => $usuario['rol'],
            'accion' => 'CREATE',
            'entidad' => $entidad,
            'entidad_id' => $entidad_id,
            'descripcion' => $descripcion ?? "Creó {$entidad} #{$entidad_id}",
            'datos_nuevos' => $datos,
            'severidad' => 'info'
        ]);
    }

    /**
     * Registrar actualización de entidad
     */
    public function logUpdate($entidad, $entidad_id, $datos_anteriores, $datos_nuevos, $usuario, $descripcion = null)
    {
        return $this->log([
            'usuario_id' => $usuario['id'],
            'usuario_nombre' => $usuario['nombre'],
            'usuario_rol' => $usuario['rol'],
            'accion' => 'UPDATE',
            'entidad' => $entidad,
            'entidad_id' => $entidad_id,
            'descripcion' => $descripcion ?? "Actualizó {$entidad} #{$entidad_id}",
            'datos_anteriores' => $datos_anteriores,
            'datos_nuevos' => $datos_nuevos,
            'severidad' => 'info'
        ]);
    }

    /**
     * Registrar eliminación de entidad
     */
    public function logDelete($entidad, $entidad_id, $datos, $usuario, $descripcion = null)
    {
        return $this->log([
            'usuario_id' => $usuario['id'],
            'usuario_nombre' => $usuario['nombre'],
            'usuario_rol' => $usuario['rol'],
            'accion' => 'DELETE',
            'entidad' => $entidad,
            'entidad_id' => $entidad_id,
            'descripcion' => $descripcion ?? "Eliminó {$entidad} #{$entidad_id}",
            'datos_anteriores' => $datos,
            'severidad' => 'warning'
        ]);
    }

    /**
     * Obtener IP del cliente
     */
    private function getClientIP()
    {
        $ip = null;

        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            $ip = $_SERVER['HTTP_CLIENT_IP'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
        } else {
            $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        }

        return $ip;
    }

    /**
     * Construir descripción legible para reportes
     */
    private function buildReportDescription($tipo, $params)
    {
        $descripciones = [
            'reporte_mensual' => 'Generó reporte mensual',
            'planilla_diaria' => 'Generó planilla diaria',
            'planilla_semanal' => 'Generó planilla semanal',
            'planilla_mensual' => 'Generó planilla mensual'
        ];

        $desc = $descripciones[$tipo] ?? "Generó {$tipo}";

        if (isset($params['rango_fechas'])) {
            $desc .= " ({$params['rango_fechas']})";
        }

        if (isset($params['formato'])) {
            $desc .= " en formato {$params['formato']}";
        }

        return $desc;
    }
    /**
     * Obtener logs con filtros y paginación
     */
    public function getLogs($filters = [], $page = 1, $limit = 50)
    {
        try {
            $where = [];
            $params = [];

            if (!empty($filters['accion'])) {
                $where[] = "accion = :accion";
                $params['accion'] = $filters['accion'];
            }
            if (!empty($filters['entidad'])) {
                $where[] = "entidad = :entidad";
                $params['entidad'] = $filters['entidad'];
            }
            if (!empty($filters['severidad'])) {
                $where[] = "severidad = :severidad";
                $params['severidad'] = $filters['severidad'];
            }
            if (!empty($filters['usuario_id'])) {
                $where[] = "usuario_id = :usuario_id";
                $params['usuario_id'] = $filters['usuario_id'];
            }
            if (!empty($filters['fecha_desde'])) {
                $where[] = "created_at >= :fecha_desde";
                $params['fecha_desde'] = $filters['fecha_desde'] . ' 00:00:00';
            }
            if (!empty($filters['fecha_hasta'])) {
                $where[] = "created_at <= :fecha_hasta";
                $params['fecha_hasta'] = $filters['fecha_hasta'] . ' 23:59:59';
            }

            $whereSql = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

            // Count total
            $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM audit_log $whereSql");
            $countStmt->execute($params);
            $total = $countStmt->fetchColumn();

            // Get logs
            $offset = ($page - 1) * $limit;
            $stmt = $this->pdo->prepare("
                SELECT * FROM audit_log 
                $whereSql 
                ORDER BY created_at DESC 
                LIMIT :limit OFFSET :offset
            ");

            // Bind values explicitly for LIMIT/OFFSET
            foreach ($params as $key => $val) {
                $stmt->bindValue($key, $val);
            }
            $stmt->bindValue('limit', (int) $limit, PDO::PARAM_INT);
            $stmt->bindValue('offset', (int) $offset, PDO::PARAM_INT);
            $stmt->execute();

            return [
                'logs' => $stmt->fetchAll(PDO::FETCH_ASSOC),
                'total' => (int) $total,
                'page' => (int) $page,
                'pages' => ceil($total / $limit)
            ];
        } catch (Exception $e) {
            error_log("Error en getLogs: " . $e->getMessage());
            return ['logs' => [], 'total' => 0, 'page' => 1, 'pages' => 0];
        }
    }

    /**
     * Obtener estadísticas de auditoría
     */
    public function getStats()
    {
        try {
            $stats = [];

            // Acciones hoy
            $stats['acciones_hoy'] = $this->pdo->query("SELECT COUNT(*) FROM audit_log WHERE DATE(created_at) = CURDATE()")->fetchColumn();

            // Reportes última semana
            $stats['reportes_semana'] = $this->pdo->query("SELECT COUNT(*) FROM audit_log WHERE accion = 'GENERATE_REPORT' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)")->fetchColumn();

            // Usuarios activos hoy (únicos)
            $stats['usuarios_activos'] = $this->pdo->query("SELECT COUNT(DISTINCT usuario_id) FROM audit_log WHERE DATE(created_at) = CURDATE() AND usuario_id IS NOT NULL")->fetchColumn();

            // Alertas (severidad warning/error/critical) hoy
            $stats['alertas'] = $this->pdo->query("SELECT COUNT(*) FROM audit_log WHERE severidad IN ('warning', 'error', 'critical') AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)")->fetchColumn();

            // Top usuarios (últimos 30 días)
            $stmt = $this->pdo->query("
                SELECT usuario_nombre, COUNT(*) as acciones 
                FROM audit_log 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
                AND usuario_id IS NOT NULL
                GROUP BY usuario_id, usuario_nombre 
                ORDER BY acciones DESC 
                LIMIT 5
            ");
            $stats['top_usuarios'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Distribución de acciones (últimos 30 días)
            $stmt = $this->pdo->query("
                SELECT accion, COUNT(*) as count 
                FROM audit_log 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
                GROUP BY accion 
                ORDER BY count DESC
            ");
            $stats['distribucion_acciones'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return $stats;
        } catch (Exception $e) {
            error_log("Error en getStats: " . $e->getMessage());
            return [];
        }
    }
}

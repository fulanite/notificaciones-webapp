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
}

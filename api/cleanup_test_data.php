<?php
/**
 * SGND - Herramienta de Limpieza de Pruebas
 * Vacía las carpetas de evidencias y audios para dejar el sistema limpio.
 */

// Define SGND_API to allow access to config.php
define('SGND_API', true);
require_once __DIR__ . '/config.php';

// Seguridad: Requiere confirmación manual vía URL para evitar ejecuciones accidentales
if (($_GET['confirm'] ?? '') !== 'true') {
    header('Content-Type: text/html; charset=UTF-8');
    die("
    <div style='font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); background: white;'>
        <h1 style='color: #e53e3e; margin-top: 0; font-size: 24px;'>⚠️ Herramienta de Limpieza de Evidencias</h1>
        <p style='color: #4a5568; line-height: 1.6;'>Esta acción eliminará de forma permanente <strong>TODOS</strong> los archivos alojados en el servidor dentro de:</p>
        <ul style='background: #f7fafc; padding: 15px 40px; border-radius: 8px; color: #2d3748;'>
            <li><code>uploads/evidencias/</code> (Fotos)</li>
            <li><code>uploads/audios/</code> (Grabaciones)</li>
        </ul>
        <p style='color: #4a5568;'>Use esta herramienta solo si desea limpiar los archivos de prueba antes de comenzar el uso real del sistema.</p>
        <div style='background: #fff5f5; border-left: 4px solid #f56565; padding: 15px; margin: 20px 0;'>
            <strong style='color: #c53030;'>Aviso:</strong> Esta acción no se puede deshacer. Los registros de la base de datos que apunten a estos archivos quedarán con enlaces rotos.
        </div>
        <div style='text-align: center; margin-top: 25px;'>
            <a href='?confirm=true' style='display: inline-block; background: #e53e3e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; transition: background 0.2s;'>
                CONFIRMAR Y VACIAR CARPETAS
            </a>
            <p style='margin-top: 15px; font-size: 0.85em; color: #718096;'>O simplemente cierre esta pestaña para cancelar.</p>
        </div>
    </div>
    ");
}

header('Content-Type: text/plain; charset=UTF-8');

$evidenciasDir = UPLOAD_DIR . 'evidencias/';
$audiosDir = UPLOAD_DIR . 'audios/';

echo "🚀 Iniciando limpieza de archivos de prueba...\n";
echo "-------------------------------------------\n\n";

/**
 * Vacía el contenido de un directorio sin borrar el directorio mismo
 */
function vaciarDirectorio($dir, $label)
{
    if (!file_exists($dir)) {
        echo "❌ No se encontró la carpeta: $label ($dir)\n";
        // Intentar crearla si no existe para que quede lista
        if (mkdir($dir, 0755, true)) {
            echo "📁 Se creó la carpeta vacía: $label\n";
        }
        return;
    }

    echo "📂 Analizando $label...\n";

    // Usar DirectoryIterator para ser más eficiente y seguro
    try {
        $files = new DirectoryIterator($dir);
        $count = 0;
        foreach ($files as $fileInfo) {
            if ($fileInfo->isFile() && !$fileInfo->isDot()) {
                if (unlink($fileInfo->getRealPath())) {
                    $count++;
                } else {
                    echo "  ⚠️ No se pudo eliminar: " . $fileInfo->getFilename() . "\n";
                }
            }
        }
        echo "✅ Se eliminaron $count archivos de $label.\n\n";
    } catch (Exception $e) {
        echo "❌ Error al acceder a $label: " . $e->getMessage() . "\n\n";
    }
}

vaciarDirectorio($evidenciasDir, "Evidencias (Fotos)");
vaciarDirectorio($audiosDir, "Audios");

echo "-------------------------------------------\n";
echo "✨ Limpieza completada con éxito.\n\n";
echo "⚠️ SEGURIDAD: Por favor, ELIMINÁ este archivo (" . basename(__FILE__) . ") de tu servidor inmediatamente para evitar usos accidentales en el futuro.";

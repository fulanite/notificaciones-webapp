<?php
/**
 * SGND - Database Fix Script
 * Updates notificaciones.resultado_diligencia with the last result from visitas table
 * specifically for migrated or inconsistent records.
 */

require_once 'db.php';

header('Content-Type: text/plain');

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    echo "🔍 Starting Database Fix: Syncing results from visitas to notificaciones...\n";

    // Subquery to find the latest result for each notification
    $sql = "
        UPDATE notificaciones n
        SET n.resultado_diligencia = (
            SELECT v.resultado 
            FROM visitas v 
            WHERE v.notificacion_id = n.id 
            ORDER BY v.fecha DESC, v.id DESC 
            LIMIT 1
        )
        WHERE (n.resultado_diligencia IS NULL OR n.resultado_diligencia = '' OR n.resultado_diligencia = 'pendiente')
        AND EXISTS (
            SELECT 1 FROM visitas v2 WHERE v2.notificacion_id = n.id
        )
    ";

    $affectedRows = $pdo->exec($sql);

    echo "✅ Success! Updated $affectedRows notifications with their latest visit result.\n";

    // Also sync the status: if it has a result and it's not 'Pre Aviso', it should be 'diligenciada'
    echo "📊 Syncing status (pendiente -> diligenciada) based on results...\n";

    $sqlStatus = "
        UPDATE notificaciones 
        SET estado = 'diligenciada' 
        WHERE estado = 'pendiente' 
        AND resultado_diligencia IS NOT NULL 
        AND resultado_diligencia NOT IN ('Pre Aviso', 'PRE_AVISO', 'pre_aviso', 'pre aviso')
    ";

    $affectedStatus = $pdo->exec($sqlStatus);
    echo "✅ Success! Updated $affectedStatus records to 'diligenciada' status.\n";

    // Check for Pre Aviso status consistency
    $sqlPreAviso = "
        UPDATE notificaciones 
        SET estado = 'pendiente' 
        WHERE resultado_diligencia IN ('Pre Aviso', 'PRE_AVISO', 'pre_aviso', 'pre aviso')
        AND estado != 'pendiente'
    ";
    $affectedPre = $pdo->exec($sqlPreAviso);
    echo "✅ Success! Ensured $affectedPre 'Pre Aviso' records are in 'pendiente' status.\n";

} catch (Exception $e) {
    die("❌ Error during database fix: " . $e->getMessage() . "\n");
}

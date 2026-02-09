<?php
require_once __DIR__ . '/api/db.php';

try {
    $pdo = Database::getInstance()->getConnection();

    // Check if table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'audit_log'");
    $exists = $stmt->rowCount() > 0;

    if (!$exists) {
        echo json_encode(['success' => false, 'error' => 'Table audit_log does not exist']);
        exit;
    }

    // Check columns
    $stmt = $pdo->query("DESCRIBE audit_log");
    $columns = $stmt->fetchAll();

    // Check if FULLTEXT index exists
    $stmt = $pdo->query("SHOW INDEX FROM audit_log WHERE Index_type = 'FULLTEXT'");
    $fulltext = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'table_exists' => true,
        'columns' => $columns,
        'fulltext_index' => $fulltext
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

<?php
require_once __DIR__ . '/api/db.php';
try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();
    echo "<pre>";
    echo "Schema of 'notificaciones':\n";
    $stmt = $pdo->query("DESCRIBE notificaciones");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        printf("%-25s | %-15s | %-5s\n", $row['Field'], $row['Type'], $row['Null']);
    }
    echo "</pre>";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}

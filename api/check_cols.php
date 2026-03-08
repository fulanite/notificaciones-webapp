<?php
require_once __DIR__ . '/db.php';
$pdo = Database::getInstance()->getConnection();
header('Content-Type: text/plain');
try {
    $q = $pdo->query("DESCRIBE notificaciones");
    while ($r = $q->fetch()) {
        echo $r['Field'] . "\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}

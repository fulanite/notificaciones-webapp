<?php
require_once __DIR__ . '/api/db.php';
try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();
    $php_now = date('Y-m-d H:i:s');
    $res = $pdo->query("SELECT NOW() as mysql_now, @@session.time_zone as tz, UTC_TIMESTAMP() as utc")->fetch();
    $log = "PHP Time: $php_now\nMySQL Time: {$res['mysql_now']}\nSession TZ: {$res['tz']}\nUTC Time: {$res['utc']}\n";
    file_put_contents(__DIR__ . '/time_check.txt', $log);
    echo "Check time_check.txt";
} catch (Exception $e) {
    file_put_contents(__DIR__ . '/time_check.txt', "Error: " . $e->getMessage());
}

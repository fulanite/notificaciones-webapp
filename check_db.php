<?php
require_once __DIR__ . '/api/db.php';

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    echo "<h1>Database Check</h1>";

    // Check 'usuarios' table
    echo "<h2>Table: usuarios</h2>";
    $stmt = $pdo->query("DESCRIBE usuarios");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "<ul>";
    foreach ($columns as $col) {
        echo "<li>$col</li>";
    }
    echo "</ul>";

    $requiredColumns = ['dni', 'password_reset_required', 'password_reset_token'];
    $missing = [];

    foreach ($requiredColumns as $col) {
        if (!in_array($col, $columns)) {
            $missing[] = $col;
        }
    }

    if (empty($missing)) {
        echo "<p style='color: green;'>✅ All required columns exist.</p>";
    } else {
        echo "<p style='color: red;'>❌ Missing columns: " . implode(', ', $missing) . "</p>";
        echo "<p>Running migration script...</p>";

        $sql = file_get_contents(__DIR__ . '/database/add_password_reset_fields.sql');
        if ($sql) {
            // Split by semicolon and execute each statement
            $statements = array_filter(array_map('trim', explode(';', $sql)));
            foreach ($statements as $s) {
                if ($s) {
                    $pdo->exec($s);
                    echo "<code>$s</code><br>";
                }
            }
            echo "<p style='color: green;'>✅ Migration completed.</p>";
        } else {
            echo "<p style='color: red;'>❌ SQL file not found.</p>";
        }
    }

} catch (Exception $e) {
    echo "<p style='color: red;'>Error: " . $e->getMessage() . "</p>";
}
?>
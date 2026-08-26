#!/bin/bash

# 1. api/notificaciones.php
sed -i '' -e 's/$stmt->execute(\[/$nombreProfesional = $data['\''nombre_profesional_retiro'\''] ?? null;\n\n                        $stmt = $pdo->prepare("\n                            UPDATE notificaciones SET\n                                retirada_por_profesional = 1,\n                                fecha_retiro_profesional = NOW(),\n                                retirado_por_usuario = ?,\n                                nombre_profesional_retiro = ?,\n                                updated_at = NOW(),\n                                updated_by = ?\n                            WHERE id = ?\n                        ");\n                        $stmt->execute(\[/g' api/notificaciones.php

# Wait, sed might be messy for multiline. Let's use Python again, it's safer.

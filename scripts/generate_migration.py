import csv
import uuid
from datetime import datetime

def clean_val(val):
    if not val or val.lower() == 'null' or val == '':
        return 'NULL'
    return "'" + val.replace("'", "''") + "'"

def clean_bool(val):
    if not val or val.lower() in ['null', '', '0', 'false', 'no']:
        return '0'
    return '1'

def clean_num(val):
    if not val or val.lower() == 'null' or val == '':
        return '0'
    try:
        return str(float(val))
    except:
        return '0'

def parse_coords(val):
    if not val or ',' not in val:
        return 'NULL', 'NULL'
    try:
        parts = val.strip('"').split(',')
        return f"'{parts[0]}'", f"'{parts[1]}'"
    except:
        return 'NULL', 'NULL'

def generate_migration_sql(cedulas_csv, visitas_csv, output_sql):
    with open(output_sql, 'w', encoding='utf-8') as f:
        f.write("-- Migration Script\n")
        f.write("SET FOREIGN_KEY_CHECKS = 0;\n\n")

        # Process Cedulas (Notificaciones)
        f.write("-- Migrating Notificaciones\n")
        with open(cedulas_csv, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                id_val = clean_val(row['id_cedula'])
                fecha_carga = clean_val(row['fecha_carga'])
                fecha_entrega = clean_val(row['fecha_entrega_ujier'])
                usuario_carga = clean_val(row['id_usuario_carga'])
                estado = clean_val(row['estado_notificacion'])
                tipo_not = clean_val(row['tipo_not'])
                n_exp = clean_val(row['n_exp'])
                caratula = clean_val(row['caratula'])
                origen = clean_val(row['origen'])
                letrado = clean_val(row['letrado'])
                dest_especial = clean_val(row['destino_especial'])
                dest_nombre = clean_val(row['destinatario'])
                domicilio = clean_val(row['domicilio'])
                zona = clean_val(row['zona_cedula'])
                tipo_troquel = clean_val(row['troquel_categoria'])
                n_troquel = clean_val(row['troquel'])
                medio_pago = clean_val(row['Medio de pago'])
                costo = clean_num(row['costo'])
                asignado_a = clean_val(row['Ujier_asignado'])
                devuelta = clean_bool(row['devuelta_por_ujier'])

                f.write(f"INSERT INTO notificaciones (id, fecha_carga, fecha_entrega_ujier, usuario_carga, estado, tipo_notificacion, n_expediente, caratula, origen, letrado, destinatario_especial, destinatario_nombre, domicilio, zona, tipo_troquel, n_troquel, medio_pago, costo, asignado_a, devuelta_por_ujier, created_at, updated_at) VALUES ({id_val}, {fecha_carga}, {fecha_entrega}, {usuario_carga}, {estado}, {tipo_not}, {n_exp}, {caratula}, {origen}, {letrado}, {dest_especial}, {dest_nombre}, {domicilio}, {zona}, {tipo_troquel}, {n_troquel}, {medio_pago}, {costo}, {asignado_a}, {devuelta}, NOW(), NOW()) ON DUPLICATE KEY UPDATE updated_at = NOW();\n")

        # Process Visitas
        f.write("\n-- Migrating Visitas\n")
        with open(visitas_csv, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                id_val = f"'{str(uuid.uuid4())}'"
                notif_id = clean_val(row['ID_cedula'])
                ujier_id = clean_val(row['id_ujier'])
                resultado = clean_val(row['estado_notificacion'])
                obs = clean_val(row['observaciones_ujier'])
                transcrip = clean_val(row['transcripción_observación'])
                foto = clean_val(row['foto_domicilio'])
                fecha = clean_val(row['fecha_hora_visita'])
                lat, lng = parse_coords(row['ubicacion_ujier'])

                f.write(f"INSERT INTO visitas (id, notificacion_id, ujier_id, resultado, observaciones, transcripcion_audio, ubicacion_lat, ubicacion_lng, foto_url, fecha) VALUES ({id_val}, {notif_id}, {ujier_id}, {resultado}, {obs}, {transcrip}, {lat}, {lng}, {foto}, {fecha});\n")

        f.write("\nSET FOREIGN_KEY_CHECKS = 1;\n")

if __name__ == "__main__":
    generate_migration_sql(
        '/Users/matiascardozo/Downloads/df37e3.cedulas.csv',
        '/Users/matiascardozo/Downloads/4c7d35.visitas.csv',
        '/Users/matiascardozo/.gemini/antigravity/playground/rapid-zenith/sql/migracion_datos_nuevos.sql'
    )
    print("Migration SQL generated successfully.")

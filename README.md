# SGND - Sistema de Gestión de Notificaciones Digitales

![SGND Logo](assets/icons/icon.svg)

Sistema de Gestión de Notificaciones Digitales para la Provincia de Catamarca. Aplicación web progresiva (PWA) para la gestión de cédulas y mandamientos judiciales.

## 🚀 Características

- ✅ **Gestión de Notificaciones**: Registro y seguimiento de cédulas y mandamientos
- ✅ **Roles de Usuario**: Admin, Administrativo, Ujier y Auditor
- ✅ **Diligenciamiento con GPS**: Captura de ubicación georreferenciada
- ✅ **Evidencia Multimedia**: Fotos y grabaciones de audio
- ✅ **Modo Offline**: Funcionamiento sin conexión con sincronización automática
- ✅ **Carga Diferida**: Soporte para zonas sin señal (Art. 5 de la Acordada)
- ✅ **Reportes**: Planillas diarias (CSV) e informes mensuales (PDF)
- ✅ **Panel de Auditoría**: Control y seguimiento de operaciones
- ✅ **PWA**: Instalable en dispositivos móviles

## 📋 Requisitos Previos

- Cuenta en [Supabase](https://supabase.com) (gratuita)
- Servidor web para alojar los archivos estáticos (Vercel, Netlify, etc.)
- Navegador moderno con soporte para PWA

## 🛠️ Configuración

### 1. Configurar Supabase

1. Crea un nuevo proyecto en [Supabase](https://supabase.com)

2. Ve a **SQL Editor** y ejecuta el contenido del archivo `database/schema.sql`

3. Configura **Storage**:
   - Crea un bucket llamado `sgnd-files`
   - Marca como **Público**
   - Crea carpetas: `evidencias` y `audios`

4. Configura **Authentication**:
   - Ve a Authentication > Providers
   - Habilita el proveedor de Email
   - (Opcional) Deshabilita la confirmación de email para desarrollo

5. Crea usuarios de prueba en Authentication > Users

### 2. Configurar la Aplicación

1. Abre el archivo `js/config.js`

2. Reemplaza las credenciales de Supabase:

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
    SUPABASE_ANON_KEY: 'TU-ANON-KEY',
    // ... resto de la configuración
};
```

3. Para encontrar las credenciales:
   - Ve a Project Settings > API en Supabase
   - Copia la URL del proyecto
   - Copia la clave `anon` (pública)

### 3. Desplegar

#### Opción A: Servidor Local (Desarrollo)

```bash
# Usando Python
python -m http.server 8000

# Usando Node.js (http-server)
npx http-server -p 8000

# Usando Live Server en VS Code
# Click derecho en index.html > "Open with Live Server"
```

#### Opción B: Vercel (Producción)

1. Sube el proyecto a GitHub
2. Conecta el repositorio a Vercel
3. Despliega automáticamente

#### Opción C: Netlify (Producción)

1. Arrastra la carpeta del proyecto a Netlify
2. O conecta el repositorio para CI/CD

## 👥 Usuarios de Demo

Si no configuraste Supabase, la app funciona en **modo demo** con los siguientes usuarios:

| Email | Contraseña | Rol |
|-------|------------|-----|
| admin@sgnd.gob.ar | demo123 | Administrador |
| ujier@sgnd.gob.ar | demo123 | Ujier |
| auditor@sgnd.gob.ar | demo123 | Auditor |

## 📱 Instalar como PWA

### En Android (Chrome):
1. Abre la app en Chrome
2. Toca el menú (⋮)
3. Selecciona "Instalar app" o "Añadir a pantalla de inicio"

### En iOS (Safari):
1. Abre la app en Safari
2. Toca el botón de compartir
3. Selecciona "Añadir a pantalla de inicio"

### En Desktop (Chrome/Edge):
1. Abre la app
2. Click en el ícono de instalación en la barra de direcciones
3. Confirma la instalación

## 📁 Estructura del Proyecto

```
sgnd/
├── index.html              # Página principal
├── manifest.json           # Manifest PWA
├── sw.js                   # Service Worker
├── css/
│   ├── variables.css       # Variables CSS (colores, tipografía)
│   ├── base.css            # Estilos base y reset
│   ├── components.css      # Componentes reutilizables
│   ├── layout.css          # Layout (sidebar, header)
│   ├── pages.css           # Estilos específicos de páginas
│   └── animations.css      # Animaciones
├── js/
│   ├── config.js           # Configuración
│   ├── supabase.js         # Cliente y operaciones DB
│   ├── auth.js             # Autenticación
│   ├── utils.js            # Utilidades
│   ├── offline.js          # Soporte offline
│   ├── notifications.js    # Gestión de notificaciones
│   ├── ujier.js            # Módulo del ujier
│   ├── dashboard.js        # Dashboard y gráficos
│   ├── reports.js          # Generación de reportes
│   └── app.js              # Controlador principal
├── assets/
│   └── icons/
│       └── icon.svg        # Ícono de la app
└── database/
    └── schema.sql          # Schema de Supabase
```

## 🔐 Roles y Permisos

| Función | Admin | Administrativo | Ujier | Auditor |
|---------|:-----:|:-------------:|:-----:|:-------:|
| Ver dashboard | ✅ | ✅ | ❌ | ✅ |
| Crear notificaciones | ✅ | ✅ | ❌ | ❌ |
| Ver notificaciones | ✅ | ✅ | Propias | ✅ |
| Diligenciar | ❌ | ❌ | ✅ | ❌ |
| Asignar ujieres | ✅ | ✅ | ❌ | ❌ |
| Gestionar usuarios | ✅ | ❌ | ❌ | ❌ |
| Ver auditoría | ✅ | ❌ | ❌ | ✅ |
| Generar reportes | ✅ | ✅ | ❌ | ✅ |

## 📊 Tipos de Notificación

Según la Acordada, los tipos soportados son:

- Cédulas
- Cédulas Urgente Norte
- Cédulas Urgente Sur
- Cédulas o Mandamientos Ley 22172
- Cédulas por Correspondencia (Interior)
- Mandamientos
- Mandamientos con habilitación Norte
- Mandamientos con habilitación Sur

## 🔄 Modo Offline y Carga Diferida

La aplicación soporta funcionamiento sin conexión:

1. **Caché Automático**: Los recursos se almacenan localmente
2. **Cola de Sincronización**: Los cambios se guardan y sincronizan al reconectarse
3. **Carga Diferida**: Para zonas sin señal, el ujier puede:
   - Activar el modo "Sin Señal"
   - Tomar fotos desde la galería (capturadas previamente)
   - Indicar el motivo de la falla
   - Los registros se marcan para auditoría posterior

## 📈 Reportes Disponibles

1. **Planilla Diaria (CSV)**: Listado de notificaciones del día
2. **Informe Mensual (PDF)**: Estadísticas completas del mes
3. **Rendimiento por Ujier (CSV)**: Métricas individuales
4. **Cargas Diferidas (CSV)**: Listado para auditoría

## 🛡️ Seguridad

- **Row Level Security (RLS)** en Supabase
- Políticas basadas en roles
- Auditoría automática de cambios
- Sin posibilidad de eliminar registros (solo ujieres)

## 🐛 Solución de Problemas

### "Supabase not configured"
- Configura las credenciales en `js/config.js`
- La app funcionará en modo demo hasta configurar Supabase

### GPS no funciona
- Verifica permisos de ubicación en el navegador
- Usa HTTPS (requerido para geolocalización)

### La app no se instala como PWA
- Verifica que uses HTTPS
- Limpia caché del navegador
- Verifica que `manifest.json` sea accesible

## 📝 Licencia

Este proyecto fue desarrollado para el Poder Judicial de la Provincia de Catamarca.

## 👨‍💻 Desarrollo

Desarrollado como PWA con:
- HTML5, CSS3, JavaScript (ES6+)
- Supabase (PostgreSQL + Auth + Storage)
- Chart.js para gráficos
- jsPDF para reportes PDF
- Service Workers para offline

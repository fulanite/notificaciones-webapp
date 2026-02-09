# 🔐 Matriz de Permisos por Rol - SGND (ACTUALIZADO)

## 📊 Resumen Ejecutivo

Este documento detalla **qué puede hacer cada rol** en el sistema SGND con los permisos **actualizados**.

---

## 🎭 Roles Disponibles

1. **Administrador** (`admin`) - Acceso completo
2. **Administrativo** (`administrativo`) - Gestión operativa
3. **Coordinador** (`coordinador`) - Coordinación de campo
4. **Ujier** (`ujier`) - Personal de campo
5. **Auditor** (`auditor`) - Legacy (solo lectura)

---

## 📋 Matriz de Permisos Actualizada

### ✅ = Acceso Completo | 👁️ = Solo Lectura | ❌ = Sin Acceso

| Módulo/Función | Admin | Administrativo | Coordinador | Ujier | Auditor |
|----------------|-------|----------------|-------------|-------|---------|
| **Dashboard** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Notificaciones** | ✅ | ✅ | ✅ | ❌ | 👁️ |
| **Crear/Editar Notificaciones** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Asignaciones (todas)** | ✅ | ✅ | ✅ | ❌ | 👁️ |
| **Mis Asignaciones** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Registrar Visitas** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Reportes** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Auditoría** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Usuarios** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Blanquear Contraseñas** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Devoluciones** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Planillas** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Mapa General (todos)** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Mi Recorrido** | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## 1️⃣ ADMINISTRADOR (`admin`)

### ✅ Acceso COMPLETO a TODO

#### Menús Visibles:
- ✅ Dashboard
- ✅ Notificaciones
- ✅ Asignaciones
- ✅ Reportes
- ✅ **Auditoría** (exclusivo)
- ✅ Usuarios
- ✅ Devoluciones
- ✅ Planillas
- ✅ Mapa General

#### Funcionalidades Exclusivas:
- ✅ **Auditoría completa** - Solo el admin puede ver logs
- ✅ Acceso a todas las secciones sin restricciones

---

## 2️⃣ ADMINISTRATIVO (`administrativo`)

### ✅ Gestión Operativa (sin auditoría, devoluciones ni mapa)

#### Menús Visibles:
- ✅ Dashboard
- ✅ Notificaciones
- ✅ Asignaciones
- ✅ Reportes
- ❌ **Auditoría** (solo admin)
- ✅ Usuarios
- ❌ **Devoluciones** (solo admin/coordinador)
- ✅ Planillas
- ❌ **Mapa General** (solo admin/coordinador)

#### Funcionalidades:
```
✅ Ver/crear/editar notificaciones
✅ Gestionar asignaciones
✅ Generar reportes
✅ Gestionar usuarios
✅ Blanquear contraseñas
✅ Gestionar planillas
❌ No puede ver auditoría
❌ No puede gestionar devoluciones
❌ No puede ver mapa general
```

---

## 3️⃣ COORDINADOR (`coordinador`)

### ✅ Coordinación de Campo (sin auditoría)

#### Menús Visibles:
- ✅ Dashboard
- ✅ Notificaciones
- ✅ Asignaciones
- ✅ Reportes
- ❌ **Auditoría** (solo admin)
- ✅ Usuarios
- ✅ **Devoluciones**
- ✅ Planillas
- ✅ **Mapa General**

#### Funcionalidades:
```
✅ Ver/crear/editar notificaciones
✅ Gestionar asignaciones
✅ Generar reportes
✅ Gestionar usuarios
✅ Blanquear contraseñas
✅ Gestionar devoluciones
✅ Ver mapa de seguimiento de todos los ujieres
✅ Gestionar planillas
❌ No puede ver auditoría
```

---

## 4️⃣ UJIER (`ujier`)

### ✅ Personal de Campo (acceso limitado)

#### Menús Visibles:
- ✅ **Mi Ruta** (mis asignaciones)
- ✅ **Mi Recorrido** (mi mapa)
- ✅ Mi Historial
- ✅ Explorador de Referencias
- ✅ Sincronizar
- ❌ Todo lo demás

#### Funcionalidades:
```
✅ Ver SOLO sus asignaciones
✅ Registrar visitas (exclusivo del ujier)
✅ Subir evidencias (GPS, foto, audio)
✅ Ver SOLO su recorrido en mapa
✅ Ver su historial
✅ Sincronizar datos offline
❌ No puede ver asignaciones de otros
❌ No puede crear asignaciones
❌ No puede ver notificaciones generales
❌ No puede ver reportes
❌ No puede gestionar usuarios
❌ No puede ver auditoría
❌ No puede ver mapa general
```

---

## 5️⃣ AUDITOR (`auditor`) - Legacy

### 👁️ Solo Lectura + Auditoría

#### Menús Visibles:
- ✅ Dashboard
- ✅ Notificaciones (solo lectura)
- ✅ Asignaciones (solo lectura)
- ✅ Reportes
- ✅ **Auditoría**
- ❌ Usuarios
- ❌ Devoluciones
- ❌ Planillas
- ❌ Mapas

#### Funcionalidades:
```
�️ Ver notificaciones (no puede editar)
👁️ Ver asignaciones (no puede editar)
✅ Ver auditoría completa
✅ Generar reportes
❌ No puede crear/editar/eliminar nada
❌ No puede gestionar usuarios
```

⚠️ **Recomendación**: Migrar a `administrativo` si necesita más permisos.

---

## � Detalles por Funcionalidad

### 📱 Registrar Visitas
**Solo Ujier** ✅

Los ujieres son los únicos que pueden:
- Registrar visitas en campo
- Capturar GPS
- Tomar fotos
- Grabar audio
- Marcar como completada

**Admin, Administrativo, Coordinador**: ❌ No pueden registrar visitas

---

### 🗺️ Mi Recorrido
**Solo Ujier** ✅

Solo el ujier puede ver su propio recorrido en el mapa.

**Admin, Administrativo, Coordinador**: ❌ No tienen acceso a "Mi Recorrido"

---

### 🗺️ Mapa General (Seguimiento)
**Solo Admin y Coordinador** ✅

Pueden ver el recorrido de **todos los ujieres**.

**Administrativo, Ujier, Auditor**: ❌ No tienen acceso

---

### � Devoluciones
**Solo Admin y Coordinador** ✅

Gestión de documentos devueltos por ujieres.

**Administrativo, Ujier, Auditor**: ❌ No tienen acceso

---

### 🔍 Auditoría
**Solo Admin** ✅

Acceso completo a logs de auditoría.

**Administrativo, Coordinador, Ujier**: ❌ No tienen acceso

**Auditor** (legacy): ✅ Tiene acceso

---

### 👤 Usuarios
**Admin, Administrativo, Coordinador** ✅

Pueden:
- Ver todos los usuarios
- Crear usuarios
- Editar usuarios
- Blanquear contraseñas
- Activar/Desactivar

**Ujier, Auditor**: ❌ No tienen acceso

---

## 📊 Tabla Comparativa Visual

```
┌─────────────────────┬───────┬────────────────┬─────────────┬───────┬─────────┐
│ Funcionalidad       │ Admin │ Administrativo │ Coordinador │ Ujier │ Auditor │
├─────────────────────┼───────┼────────────────┼─────────────┼───────┼─────────┤
│ Dashboard           │   ✅   │       ✅        │      ✅      │   ❌   │    ✅    │
│ Notificaciones      │   ✅   │       ✅        │      ✅      │   ❌   │    👁️    │
│ Asignaciones        │   ✅   │       ✅        │      ✅      │   ❌   │    �️    │
│ Mis Asignaciones    │   ❌   │       ❌        │      ❌      │   ✅   │    ❌    │
│ Registrar Visitas   │   ❌   │       ❌        │      ❌      │   ✅   │    ❌    │
│ Reportes            │   ✅   │       ✅        │      ✅      │   ❌   │    ✅    │
│ Auditoría           │   ✅   │       ❌        │      ❌      │   ❌   │    ✅    │
│ Usuarios            │   ✅   │       ✅        │      ✅      │   ❌   │    ❌    │
│ Devoluciones        │   ✅   │       ❌        │      ✅      │   ❌   │    ❌    │
│ Planillas           │   ✅   │       ✅        │      ✅      │   ❌   │    ❌    │
│ Mapa General        │   ✅   │       ❌        │      ✅      │   ❌   │    ❌    │
│ Mi Recorrido        │   ❌   │       ❌        │      ❌      │   ✅   │    ❌    │
└─────────────────────┴───────┴────────────────┴─────────────┴───────┴─────────┘
```

---

## 🎯 Casos de Uso Recomendados

### 👨‍💼 Administrador
**Usar para**: 
- Director del sistema
- Cuenta principal
- Necesita ver auditoría completa

### 📋 Administrativo
**Usar para**:
- Personal de oficina
- Gestión diaria de notificaciones
- Asignación de tareas
- **No necesita** auditoría ni mapa general

### 🎯 Coordinador
**Usar para**:
- Coordinador de campo
- Supervisión de ujieres en mapa
- Gestión de devoluciones
- **No necesita** auditoría

### 🚶 Ujier
**Usar para**:
- Personal de campo
- Notificación en terreno
- Registro de visitas
- **Solo** ve sus propias tareas

### 🔍 Auditor (Legacy)
**Usar para**:
- Solo auditoría
- Migrar a administrativo si necesita más

---

## � Validaciones Implementadas

El sistema **valida permisos** en dos niveles:

### 1. Nivel de Menú
Los menús se ocultan automáticamente según el rol.

### 2. Nivel de Navegación
Si un usuario intenta acceder directamente a una URL:
```javascript
// Ejemplo: Administrativo intenta acceder a auditoría
navigateTo('auditoria') 
→ ❌ "No tenés permisos para acceder a esta sección"
```

---

## 📝 Resumen de Cambios

### ❌ Administrativo PIERDE acceso a:
- Auditoría (solo admin)
- Devoluciones (solo admin/coordinador)
- Mapa General (solo admin/coordinador)

### ✅ Coordinador MANTIENE acceso a:
- Devoluciones
- Mapa General
- Usuarios

### ✅ Ujier es el ÚNICO que puede:
- Registrar visitas
- Ver "Mi Recorrido"
- Ver "Mi Ruta"

### ✅ Admin es el ÚNICO que puede:
- Ver Auditoría completa

---

**Fecha**: 2026-02-09  
**Versión**: 41.1  
**Estado**: ✅ Permisos Actualizados e Implementados

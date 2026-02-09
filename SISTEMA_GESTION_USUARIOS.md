# 🔐 Sistema de Gestión de Usuarios - SGND

## 📋 Resumen de Implementación

Se ha implementado un sistema completo y seguro de gestión de usuarios con las siguientes características:

---

## ✨ Nuevas Funcionalidades

### 1. **Roles Actualizados**
Los roles disponibles ahora son:
- ✅ **Administrador** (`admin`) - Acceso completo
- ✅ **Administrativo** (`administrativo`) - Gestión administrativa
- ✅ **Coordinador** (`coordinador`) - Coordinación de operaciones
- ✅ **Ujier** (`ujier`) - Operaciones de campo

**Nota**: El rol "Auditor" se mantiene para compatibilidad con datos existentes.

---

### 2. **Campo DNI Obligatorio**
- Todos los usuarios ahora tienen un campo **DNI** (7-8 dígitos)
- El DNI se usa como **contraseña inicial** al crear un usuario
- Validación automática del formato del DNI

---

### 3. **Sistema de Blanqueo de Contraseñas** 🔄

#### Cómo funciona:
1. **Administrador/Administrativo** puede "blanquear" la contraseña de cualquier usuario
2. Al blanquear, la contraseña se restablece al **DNI del usuario**
3. Se activa el flag `password_reset_required = true`
4. El usuario **debe cambiar su contraseña** en el próximo inicio de sesión

#### Flujo completo:
```
Usuario olvida contraseña
    ↓
Admin blanquea contraseña
    ↓
Usuario inicia sesión con su DNI
    ↓
Modal obligatorio de cambio de contraseña
    ↓
Usuario establece nueva contraseña segura
    ↓
Acceso normal al sistema
```

---

### 4. **Activar/Desactivar/Eliminar Usuarios** ✅🚫🗑️

- **Activar/Desactivar**: Los usuarios inactivos no pueden iniciar sesión pero preservan su historial.
- **Eliminar**: Funcionalidad de eliminación con protección de integridad:
  - 🗑️ Si el usuario **tiene datos** asociados (notificaciones o visitas), el sistema lo **desactivará** automáticamente para preservar la integridad referencial.
  - 🗑️ Si el usuario **no tiene datos**, se eliminará **permanentemente**.
  - ⚠️ Requiere confirmación explícita.

---

### 5. **Login con DNI o Email**

Los usuarios pueden iniciar sesión con:
- ✉️ **Email** (como antes)
- 🆔 **DNI** (nuevo)

Esto facilita el acceso para usuarios que recuerdan su DNI pero no su email.

---

## 🗂️ Archivos Modificados

### Backend (PHP)
1. **`api/auth.php`**
   - Login con DNI o email
   - Soporte para `password_reset_required`
   - Limpieza del flag al cambiar contraseña

2. **`api/usuarios.php`**
   - Muestra todos los usuarios (activos e inactivos)
   - Soporte para campo DNI

### Frontend (JavaScript)
3. **`js/usuarios.js`** (reescrito completamente)
   - Gestión completa de usuarios
   - Función de blanqueo de contraseñas
   - Validación de DNI
   - Activar/desactivar usuarios

4. **`js/auth.js`**
   - Soporte para `password_reset_required`
   - Almacenamiento de DNI en sesión

5. **`js/app.js`**
   - Modal obligatorio de cambio de contraseña
   - Validaciones de seguridad

### Frontend (HTML)
6. **`index.html`**
   - Tabla de usuarios con columna DNI
   - Modal de usuario actualizado con DNI
   - Botón de blanqueo de contraseña
   - Modal obligatorio de cambio de contraseña

### Base de Datos
7. **`database/add_password_reset_fields.sql`**
   - Script SQL para agregar campos necesarios

---

## 🔧 Cambios en la Base de Datos

Ejecutar este script SQL:

```sql
-- Agregar campo DNI
ALTER TABLE usuarios ADD COLUMN dni VARCHAR(20) AFTER email;

-- Agregar campos para password reset
ALTER TABLE usuarios ADD COLUMN password_reset_required BOOLEAN DEFAULT FALSE AFTER activo;
ALTER TABLE usuarios ADD COLUMN password_reset_token VARCHAR(255) DEFAULT NULL AFTER password_reset_required;

-- Crear índice para búsqueda por DNI
CREATE INDEX idx_usuarios_dni ON usuarios(dni);

-- Actualizar roles existentes (opcional)
UPDATE usuarios SET rol = 'administrativo' WHERE rol = 'auditor';
```

---

## 📖 Guía de Uso

### Para Administradores

#### Crear un Nuevo Usuario
1. Ir a **Usuarios** en el menú
2. Click en **"➕ Nuevo Usuario"**
3. Completar:
   - Nombre completo
   - Email
   - **DNI** (será la contraseña inicial)
   - Rol
4. Click en **"💾 Guardar Usuario"**

✅ El usuario podrá iniciar sesión con:
- **Usuario**: Email o DNI
- **Contraseña**: DNI

⚠️ En el primer inicio de sesión, deberá cambiar su contraseña.

---

#### Blanquear Contraseña de un Usuario
1. Ir a **Usuarios**
2. Click en **"✏️ Editar"** del usuario
3. Click en **"🔄 Blanquear Contraseña"**
4. Confirmar la acción

✅ La contraseña se restablecerá al DNI del usuario.
✅ El usuario deberá cambiarla en su próximo inicio de sesión.

---

#### Desactivar un Usuario
1. Ir a **Usuarios**
2. Click en **"🚫 Desactivar"** del usuario
3. Confirmar la acción

✅ El usuario no podrá iniciar sesión.
✅ Aparecerá como "Inactivo" en la lista.
✅ Puede reactivarse con **"✅ Activar"**.

---

### Para Usuarios

#### Primer Inicio de Sesión
1. Ir a la página de login
2. Ingresar:
   - **Usuario**: Tu email o DNI
   - **Contraseña**: Tu DNI
3. Click en **"Iniciar Sesión"**
4. **Modal obligatorio**: Establecer nueva contraseña
   - Mínimo 6 caracteres
   - No puede ser tu DNI
   - Confirmar contraseña
5. Click en **"🔒 Cambiar Contraseña"**

✅ Ahora podés usar tu nueva contraseña.

---

#### Si Olvidaste tu Contraseña
1. Contactar a un **Administrador** o **Administrativo**
2. Solicitar **blanqueo de contraseña**
3. Iniciar sesión con tu **DNI**
4. Establecer nueva contraseña

---

## 🔒 Seguridad Implementada

### Validaciones
- ✅ DNI debe tener 7-8 dígitos
- ✅ Nueva contraseña no puede ser el DNI
- ✅ Contraseña mínima de 6 caracteres
- ✅ Confirmación de contraseña obligatoria
- ✅ Usuarios inactivos no pueden iniciar sesión

### Encriptación
- ✅ Contraseñas hasheadas con `password_hash()` (PHP)
- ✅ Algoritmo: `PASSWORD_DEFAULT` (bcrypt)
- ✅ No se almacenan contraseñas en texto plano

### Auditoría
- ✅ Todos los cambios se registran en `audit_log`
- ✅ Login exitoso/fallido registrado
- ✅ Creación/modificación de usuarios registrada

---

## 🎨 Interfaz de Usuario

### Tabla de Usuarios (Actualizada)
```
┌─────────────┬──────────────┬──────────┬──────────────┬─────────┬──────────┐
│ Nombre      │ Email        │ DNI      │ Rol          │ Estado  │ Acciones │
├─────────────┼──────────────┼──────────┼──────────────┼─────────┼──────────┤
│ Juan Pérez  │ juan@sgnd... │ 12345678 │ Ujier        │ Activo  │ ✏️ 🚫 🗑️ │
│ María López │ maria@sgnd...│ 87654321 │ Admin        │ Activo🔄│ ✏️ 🚫 🗑️ │
│ Pedro Gómez │ pedro@sgnd...│ 11223344 │ Coordinador  │ Inactivo│ ✏️ ✅ 🗑️ │
└─────────────┴──────────────┴──────────┴──────────────┴─────────┴──────────┘
```

**Badges**:
- 🔄 = Debe cambiar contraseña (blanqueada)
- ✏️ = Editar usuario
- 🚫 = Desactivar (mantiene historial)
- ✅ = Activar
- 🗑️ = Eliminar (inteligente: borra o desactiva según datos)

---

### Modal de Blanqueo
```
┌──────────────────────────────────────────┐
│ ⚠️ Blanqueo de Contraseña                │
├──────────────────────────────────────────┤
│ Al blanquear, la contraseña se           │
│ restablecerá al DNI del usuario.         │
│ El usuario deberá cambiarla en su        │
│ próximo inicio de sesión.                │
│                                          │
│ [🔄 Blanquear Contraseña]                │
└──────────────────────────────────────────┘
```

---

### Modal de Cambio Obligatorio
```
┌──────────────────────────────────────────┐
│ 🔐 Cambio de Contraseña Obligatorio      │
├──────────────────────────────────────────┤
│ ⚠️ Tu contraseña ha sido blanqueada.    │
│ Debés establecer una nueva contraseña.   │
│                                          │
│ Nueva Contraseña: [__________]           │
│ Confirmar:        [__________]           │
│                                          │
│ [🔒 Cambiar Contraseña]                  │
└──────────────────────────────────────────┘
```
**Nota**: Este modal no se puede cerrar hasta cambiar la contraseña.

---

## 🧪 Testing

### Casos de Prueba

#### 1. Crear Usuario Nuevo
- [ ] Crear usuario con DNI válido
- [ ] Verificar que se crea correctamente
- [ ] Iniciar sesión con DNI como contraseña
- [ ] Verificar modal de cambio obligatorio
- [ ] Cambiar contraseña exitosamente

#### 2. Blanquear Contraseña
- [ ] Editar usuario existente
- [ ] Click en "Blanquear Contraseña"
- [ ] Confirmar acción
- [ ] Cerrar sesión
- [ ] Iniciar sesión con DNI
- [ ] Verificar modal de cambio obligatorio

#### 3. Activar/Desactivar
- [ ] Desactivar usuario
- [ ] Verificar badge "Inactivo"
- [ ] Intentar login (debe fallar)
- [ ] Activar usuario
- [ ] Verificar badge "Activo"
- [ ] Login exitoso

#### 4. Login con DNI
- [ ] Iniciar sesión con DNI en lugar de email
- [ ] Verificar que funciona correctamente

---

## 📝 Notas Importantes

1. **Migración de Datos Existentes**:
   - Los usuarios existentes necesitarán que se les asigne un DNI
   - Puede hacerse manualmente desde la interfaz de edición
   - O mediante un script SQL de migración

2. **Compatibilidad**:
   - El sistema es compatible con usuarios sin DNI (legacy)
   - Pero no podrán usar la función de blanqueo sin DNI

3. **Roles Legacy**:
   - El rol "auditor" se mantiene para compatibilidad
   - Se recomienda migrar a "administrativo"

---

## 🚀 Próximos Pasos Sugeridos

1. **Migración de Datos**:
   - Asignar DNI a usuarios existentes
   - Actualizar roles legacy

2. **Mejoras Futuras**:
   - Recuperación de contraseña por email
   - Autenticación de dos factores (2FA)
   - Historial de cambios de contraseña
   - Política de expiración de contraseñas

3. **Documentación**:
   - Manual de usuario
   - Video tutorial
   - FAQ

---

**Fecha de Implementación**: 2026-02-09  
**Versión**: 41.0  
**Estado**: ✅ Completado y listo para testing

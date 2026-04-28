# Fixes Aplicados

## 1. Fix Inconsistencia: Tacho vs Revertir en Consumos Pagados ✅
**Archivo:** `src/pages/Alquileres/CuentaAlquilerModal.jsx`

- Creado helper `revertirConsumoAPendiente` reutilizable
- `removeConsumo` (tacho) ahora revierte primero a PENDIENTE antes de eliminar, evitando EGRESO doble en caja
- `revertConsumoToPending` delega en el mismo helper

## 2. Fix Creación de Habitaciones - Root Cause Identificado 🔍
**Archivo frontend:** `src/pages/Habitaciones/index.jsx` (payload corregido)
**Archivo backend a modificar:** `TipoHabitacionDTO.java`

### Problema real (backend):
```java
@JsonProperty(access = JsonProperty.Access.READ_ONLY)
private Long id;
```
Esta anotación hace que Jackson **ignore el campo `id` al deserializar**. Cuando el frontend envía `{ "tipoHabitacion": { "id": 1, "nombre": "SIMPLE" } }`, el backend crea el objeto con `id = null`, luego el servicio falla al buscar `findById(null)` → devuelve 409 "tipo de habitación obligatorio".

### Fix requerido en backend:
**Archivo:** `com.proyecto.hotel.model.dto.TipoHabitacionDTO`

```java
// QUITAR esta anotación:
// @JsonProperty(access = JsonProperty.Access.READ_ONLY)

// Dejar el campo simple:
private Long id;
```

O si necesitas que sea read-only en algunos casos, crear un DTO separado para creación o usar `@JsonView`.

### Frontend ya está correcto:
El payload que envía el frontend ahora es válido:
```json
{
  "numero": "101",
  "piso": 1,
  "estado": "DISPONIBLE",
  "tipoHabitacion": { "id": 1, "nombre": "SIMPLE" }
}
```

## Pendiente
- [ ] Aplicar fix en backend (`TipoHabitacionDTO.java`)
- [ ] Probar creación de habitación


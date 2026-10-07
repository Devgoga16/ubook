# uBook API

Backend de uBook (Unify Tec): plataforma SaaS multi-tenant de reservas.
NestJS 12 · MongoDB (Mongoose) · TypeScript (ESM).

## Arranque

```bash
pnpm install
cp .env.example .env   # completar MONGODB_URI, JWT_ACCESS_SECRET y super admin
pnpm start:dev
```

- API: `http://localhost:3000/api`
- Documentación OpenAPI (fuera de producción): `http://localhost:3000/api/docs`

Sin MongoDB instalado: `pnpm dev:memory` levanta la API con un Mongo en memoria
(los datos se pierden al detenerla).

MongoDB **debe ser un replica set**, porque el registro de un negocio usa transacciones.
MongoDB Atlas ya lo es. Con MongoDB instalado como servicio de Windows:

1. En `C:\Program Files\MongoDB\Server\<versión>\bin\mongod.cfg` agrega:
   ```yaml
   replication:
     replSetName: rs0
   ```
2. Reinicia el servicio (PowerShell como administrador): `Restart-Service MongoDB`
3. `pnpm db:init-rs`
4. En `.env`: `MONGODB_URI=mongodb://127.0.0.1:27017/ubook?replicaSet=rs0`

Si Mongo no es replica set, la API se niega a arrancar y explica qué hacer.
Si al arrancar ves `Server selection timed out` con `?replicaSet=rs0`, falta el paso 3
(el replica set está configurado pero no inicializado).

## Tests

```bash
pnpm test       # unitarios
pnpm test:e2e   # e2e contra un replica set de Mongo en memoria
```

## Estructura

```
src/
  config/              variables de entorno validadas
  core/
    tenancy/           contexto por petición (organización, actor, permisos)
    database/          conexión + plugin de tenant (filtra por organizationId)
    authorization/     catálogo de permisos y roles por defecto
    auth/              decoradores (@Public, @RequirePermission, @RequireFeature...)
    audit/             registro de auditoría
  modules/
    identity/          usuarios y sesiones (refresh token rotativo)
    auth/              registro, login, cambio de negocio + guards globales
    organization/      negocio, sucursales, roles, miembros
    platform/          planes, suscripciones y qué incluye cada uno
    platform-admin/    panel de super admin y arranque (planes y super admin)
```

## Reglas del núcleo

- **Multi-tenant:** los modelos de negocio usan `tenantPlugin`. Toda consulta se filtra
  por la organización en contexto, y si no hay ninguna la consulta falla.
  El código de sistema usa `TenantContext.runAsSystem()` y filtra a mano.
- **Sesiones:** `account` (sin negocio elegido), `staff` (dentro de un negocio) y `platform` (Unify Tec).
  Los endpoints aceptan solo `staff` salvo que digan `@AllowContexts(...)`.
- **Permisos:** el catálogo vive en el código (`permissions.catalog.ts`). Cada negocio arma
  sus roles con alcance `own` / `branch` / `organization`.
- **Planes:** `@RequireFeature('x')` en el endpoint y `EntitlementsService.assertWithinLimit()`
  al crear recursos con límite. Si la suscripción está vencida, el negocio queda en solo lectura.

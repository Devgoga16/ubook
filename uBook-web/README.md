# uBook Web

Frontend de uBook (Unify Tec). React 19 · Vite · TypeScript · Tailwind v4 · Radix · TanStack Query.

```bash
pnpm install
pnpm dev        # http://localhost:5173 (las llamadas a /api van a localhost:3000)
pnpm test       # unitarios
pnpm build
```

Necesita la API corriendo. Sin MongoDB instalado: `pnpm --dir ../uBook-api dev:memory`.

## Sesión

- El access token vive solo en memoria; la sesión se renueva con una cookie httpOnly (`lib/api/client.ts`).
- `useAuth()` expone la sesión; `useAccess()` responde "¿puede?" según rol y plan.
- El menú (`components/layout/nav.ts`) declara qué permiso y qué funcionalidad del plan necesita cada pantalla;
  el mismo dato protege la ruta (`app/guards.tsx`).

Sin sesión, `/` muestra la landing (`features/landing/`); `/inicio` la muestra siempre.
`/registro?plan=pro` preselecciona el plan.

Referencia visual: `../docs/ubook-prototipo.html`. En desarrollo, `/design` muestra todos los componentes base.

## Estructura

```
src/
  styles/tokens.css     tokens de diseño (claro y oscuro)
  index.css             Tailwind + mapeo de tokens a utilidades (bg-surface, text-muted, bg-grad…)
  lib/                  cn, formatos (es-PE, soles), tema
  domain/               tipos de negocio compartidos (estados de cita…)
  components/ui/        componentes base
  components/layout/    estructura: menú lateral, encabezado, navegación
  features/<módulo>/    pantallas
  app/                  router y datos de ejemplo de la sesión
```

## Reglas

- Colores solo con tokens (`bg-surface`, `text-ink-2`, `border-line`…), nunca hex sueltos:
  así el modo oscuro funciona sin trabajo extra.
- Texto teal → `text-teal-ink`. `teal` es para rellenos, bordes y foco.
- Botones de ícono siempre con `aria-label`.
- Montos con `formatMoney()` (S/), nunca a mano.

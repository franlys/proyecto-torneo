# SKILLS_MASTER.md — Perfiles activos del proyecto

Este documento documenta los 6 perfiles de habilidades activos que guían el desarrollo de la plataforma.

---

## 1. frontend-design

**Objetivo**: Interfaces premium, no genéricas.

**Principios**:
- Cada pantalla debe sentirse como un producto de alta calidad, no un template
- Jerarquía visual clara: qué es lo más importante en cada vista
- Consistencia visual entre todas las páginas
- Dark mode como modo principal (paleta eSports)

**Aplicación en este proyecto**:
- Leaderboard público: el producto principal, debe impresionar a los espectadores
- Dashboard: funcional pero con estética premium, no "admin panel genérico"
- Formularios: validación visual inmediata, estados de error claros

---

## 2. ui-ux-pro-max

**Objetivo**: Paletas eSports, tipografía impactante, experiencia de usuario de alto nivel.

**Paleta de colores**:
- `neon-cyan`: #00F5FF — acción principal, highlights
- `neon-purple`: #8B5CF6 — secundario, badges
- `gold`: #FFD700 — rank #1, logros, VIP
- `dark-bg`: #0A0A0F — fondo principal
- `dark-card`: #12121A — cards y paneles

**Tipografía**:
- `Orbitron`: headings principales del leaderboard (impacto máximo)
- `Rajdhani`: headings secundarios, nombres de equipos
- `Inter`: UI general, texto de cuerpo

**UX Patterns**:
- Feedback inmediato en todas las acciones
- Estados de carga con skeletons, no spinners genéricos
- Errores inline, no modales disruptivos
- Confirmaciones para acciones destructivas

---

## 3. emilkowalski-design

**Objetivo**: Animaciones fluidas, micro-interacciones, Framer Motion.

**Principios** (inspirados en el trabajo de Emil Kowalski):
- Las animaciones deben tener propósito, no ser decorativas
- Spring physics para movimientos naturales
- `AnimatePresence` para entradas/salidas suaves
- Micro-interacciones en hover/focus que dan feedback táctil

**Aplicación en este proyecto**:
- Rank changes en el leaderboard: animación de posición con `layout` prop
- Row highlights cuando un equipo sube/baja de posición
- Transiciones de página suaves
- Drag-and-drop de columnas con feedback visual

```typescript
// Ejemplo: animación de rank change
<motion.div
  layout
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
>
```

---

## 4. vercel-react-best-practices

**Objetivo**: Performance, lazy loading, Server Components.

**Reglas**:
- Server Components por defecto, Client Components solo cuando necesario
- `Suspense` + `loading.tsx` para todas las rutas con datos
- `next/image` para todas las imágenes (optimización automática)
- `next/font` para todas las fuentes (sin layout shift)
- Dynamic imports para componentes pesados (BracketView, CustomizePanel)
- `revalidatePath` después de mutations para invalidar cache

**Métricas objetivo**:
- LCP < 2.5s en el leaderboard público
- CLS = 0 (sin layout shift)
- FID < 100ms

---

## 5. vercel-composition-patterns

**Objetivo**: Arquitectura limpia, evitar prop hell.

**Patterns**:
- **Compound Components**: para componentes complejos (LeaderboardTable + LeaderboardRow)
- **Render Props / Slots**: para layouts flexibles
- **Custom Hooks**: extraer lógica de estado a hooks reutilizables
- **Server/Client boundary**: pasar datos del servidor al cliente via props, no fetch en cliente

**Anti-patterns a evitar**:
- Prop drilling más de 2 niveles → usar Context o Zustand
- Componentes con más de 200 líneas → dividir
- Lógica de negocio en componentes → mover a hooks o Server Actions
- Fetch de datos en Client Components cuando puede ser Server Component

---

## 6. deploy-to-vercel

**Objetivo**: Flujo de deploy y validación.

**Pre-deploy checklist**:
1. `npm run typecheck` — sin errores TypeScript
2. `npm test` — todos los tests pasando
3. `npm run build` — build exitoso sin warnings
4. Variables de entorno configuradas en Vercel dashboard
5. Migraciones de Supabase aplicadas en producción

**Configuración Vercel**:
- Framework: Next.js (auto-detectado)
- Build command: `npm run build`
- Output directory: `.next`
- Node.js version: 20.x

**Variables de entorno requeridas**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Post-deploy verification**:
- Leaderboard público accesible sin auth
- Login/register funcionando
- Supabase Realtime conectando correctamente

# Architecture & State Management Rules

## Rendering Strategy

### Server Components (RSC) — usar para:
- Carga inicial del leaderboard público (`/t/[slug]`) — SEO y performance
- Dashboard pages (lista de torneos, overview, participantes)
- Formularios de configuración que no necesitan interactividad inmediata
- Cualquier componente que solo lea datos sin suscripciones en tiempo real

### Client Components (`"use client"`) — usar SOLO para:
- Suscripción Realtime al leaderboard (`useLeaderboard` hook)
- Drag-and-drop de columnas (`@dnd-kit`)
- Animaciones de posición (Framer Motion `AnimatePresence`)
- Upload de evidencias con preview (FileReader API)
- Formularios con validación en tiempo real (React Hook Form)
- Modales y overlays interactivos

**Regla**: Si un componente no necesita `useState`, `useEffect`, event handlers, o APIs del browser → debe ser Server Component.

## Mutations — Server Actions

Todas las mutaciones van en `src/lib/actions/`:
- `tournaments.ts` — CRUD de torneos
- `participants.ts` — gestión de participantes y equipos
- `submissions.ts` — submit, aprobar, rechazar
- `customization.ts` — temas y assets
- `auth.ts` — signIn, signUp, signOut
- `bracket.ts` — generación y avance de bracket
- `groups.ts` — fase de grupos

**Patrón de Server Action**:
```typescript
"use server";

export async function createTournament(data: CreateTournamentInput) {
  // 1. Validar con Zod
  const parsed = CreateTournamentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.message };
  
  // 2. Verificar auth
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };
  
  // 3. Operación DB
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .insert({ ...parsed.data, creator_id: user.id })
    .select()
    .single();
  
  if (error) return { success: false, error: error.message };
  
  // 4. Revalidar cache
  revalidatePath("/tournaments");
  return { success: true, data: tournament };
}
```

## State Management

### Zustand — solo para estado UI mínimo:
- Estado de modales (open/closed)
- Tab activo en el dashboard
- Estado de drag-and-drop de columnas
- Preferencias de UI del usuario (no persistidas en DB)

**NO usar Zustand para**:
- Datos del servidor (usar Server Components + fetch)
- Estado de formularios (usar React Hook Form)
- Cache de datos (usar Next.js cache + revalidatePath)

### Data Fetching
- Server Components: `await supabase.from(...).select()`
- Client Components con Realtime: `useLeaderboard` hook con `supabase.channel()`
- Mutations: Server Actions con `revalidatePath`

## File Structure Rules

```
src/lib/actions/     # Server Actions únicamente
src/lib/supabase/    # Clientes Supabase (browser, server, middleware)
src/lib/scoring/     # Scoring Engine puro (sin imports de Supabase)
src/lib/validations/ # Zod schemas
src/hooks/           # Custom hooks (solo Client-side)
src/types/           # TypeScript types globales
```

## Performance Rules

- Usar `Suspense` con fallback skeleton para secciones que cargan datos
- Usar `loading.tsx` en rutas del App Router
- Imágenes con `next/image` siempre
- Fonts con `next/font` siempre
- No importar librerías pesadas en Server Components innecesariamente

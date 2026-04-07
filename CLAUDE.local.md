# CLAUDE.local.md — Notas de entorno local

> Este archivo es específico del desarrollador y NO debe commitearse. Agregar a `.gitignore`.

## Supabase local

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu_anon_key_local>
SUPABASE_SERVICE_ROLE_KEY=<tu_service_role_key_local>
```

Para obtener las keys locales:
```bash
supabase status
```

## Variables de entorno necesarias

Copiar `.env.local.example` a `.env.local` y completar:

```bash
cp .env.local.example .env.local
```

## Comandos útiles

```bash
# Desarrollo
npm run dev

# Tests (single run)
npm test

# TypeScript check
npm run typecheck

# Supabase local
supabase start
supabase stop
supabase db reset
supabase migration new <nombre>
```

## Notas del desarrollador

- Supabase local corre en puerto 54321 (API) y 54323 (Studio)
- Studio disponible en http://localhost:54323
- Inbucket (email testing) en http://localhost:54324

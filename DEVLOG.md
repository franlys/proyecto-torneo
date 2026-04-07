# Development Log — Tournament Leaderboard Platform

Este archivo sirve como bitácora de progreso, decisiones técnicas y contexto del proyecto. Se actualiza a medida que se completan tareas y se resuelven problemas.

---

## [2026-04-06] — Estado Inicial y Task 6 Completa

### Resumen del Estado
El proyecto ha avanzado a través de las fases iniciales de setup, base de datos y autenticación. Recientemente se completó la gestión de torneos (Task 6).

### Tareas Completadas
- [x] **Setup del Proyecto**: Next.js 14, Tailwind, Supabase, Vitest.
- [x] **Schema DB**: Migraciones iniciales para torneos, equipos, participantes y puntuaciones.
- [x] **Autenticación**: Integración con Supabase Auth.
- [x] **Scoring Engine**: Lógica de cálculo de puntos por kills y posición.
- [x] **Dashboard — Torneos**:
    - Creación de torneos con validaciones Zod (`schemas.ts`).
    - Server Actions para CRUD de torneos (`tournaments.ts`).
    - Formulario dinámico de creación (`TournamentForm.tsx`).
    - Editor de reglas de puntuación (`ScoringRuleEditor.tsx`).

### Decisiones Técnicas
- **Zod para Validaciones**: Se centralizan las reglas de negocio en `src/lib/validations/schemas.ts` para asegurar consistencia entre cliente y servidor.
- **Server Actions**: Se utiliza el patrón de Server Actions para todas las mutaciones de datos, simplificando el manejo de formularios y caché de Next.js.
- **Supabase para Realtime**: El leaderboard público utilizará las capacidades de tiempo real de Supabase para reflejar cambios en los standings instantáneamente.

### Contexto Actual
- **Tarea 7: Gestión de Participantes**
  - [x] **Task 7.1**: `teamSchema` y `participantSchema` creados en `schemas.ts`. Server Actions creados en `participants.ts` (`createTeam`, `addParticipant`, etc).
  - [x] **Task 7.2**: Interfaz de gestión de participantes (`ParticipantsPage`, `ParticipantsManager` cliente-servidor render path), soportando modos individuales y por equipos.
- **Tarea 8 y 9: Submissions y Aprobación**
  - [x] **Task 8.1**: `submissionSchema` en `schemas.ts` y server actions en `submissions.ts` implementados (submit, approve, reject).
  - [x] **Task 9.1**: Interfaz de moderación y listado de envíos (`SubmissionsPage`, `SubmissionsManager`) creados.
  - [ ] **Task 9.2**: Lógica completa de re-cálculo de standings al aprobar (Pendiente integración con Scoring Engine).

---

- **Tarea 11: Leaderboard Público**
  - [x] Lógica de recálculo (Task 9.2) implementada en `submissions.ts`.
  - [x] Vista pública `/t/[slug]` con `LeaderboardClient` conectada a Supabase Realtime y usando Framer Motion para animación de rankings.

- **Tarea 12: Personalización Visual**
  - [x] Creada sección de personalización en `ThemeEditor.tsx` para cambiar el color primario y previsualizar opciones. Modificada la base de datos indirectamente a través del UPSERT del theme.

---

## Próximos Pasos
1. **Task 13**: Validaciones finales de formatos especiales (soportados vía `calculateKillRaceStandings`).
2. **Task 16**: Deploy a Vercel. Revisión de variables de entorno y smoke test.

---

## [2026-04-07] — Streams Multi-POV, Portales de Equipo y Fix Visibilidad

### Tareas Completadas

- **Branding "Gonzalez Labs"**:
  - Sello discreto "Powered by Gonzalez Labs" añadido a Login, Registro y Sidebar del Dashboard.
  - El logo principal permanece neutral para adaptarse al branding de cada torneo.

- **Integración de Live Streams (Twitch/YouTube/Kick)**:
  - **Fondos dinámicos**: `LeaderboardClient.tsx` detecta URLs de YouTube, Twitch y Kick como fondos de pantalla completa (muteados, semi-transparentes).
  - **Stream por Equipo**: campo `stream_url` añadido a la tabla `teams` (migración `20240407000000`).
  - **Stream por Jugador (Participante)**: campo `stream_url` añadido a la tabla `participants` (migración `20240407000001`).
  - **Multi-POV Quick Watch**: El Leaderboard agrega todos los links activos (equipo + participantes) en botones individuales en la barra superior.
  - **Modal de Reproducción**: Iframe in-app con botón "Ver en sitio original" para redirigir directo a Twitch/YouTube/Kick.

- **Portales de Equipo (Sin Login)**:
  - Nueva ruta pública `/t/[slug]/team/[teamId]` para que representantes suban evidencias.
  - Formulario con: selección de partida, kills del equipo, checkbox TOP 1, subida de imagen.
  - Imágenes almacenadas en Supabase Storage bucket `evidence` (política RLS de INSERT público creada).
  - Server Action actualizada para insertar en `evidence_files` al mismo tiempo que `submissions`.

- **Mejoras de UI en Dashboard (Participantes)**:
  - Botón "**Copiar Portal**" siempre visible (con fallback para HTTP) usando el slug del torneo.
  - URL del portal visible en cada tarjeta de equipo para referencia rápida.
  - Formulario de añadir participante ahora tiene campo de "Link Stream" para cada jugador.

- **Fix Visibilidad de Equipos en Leaderboard**:
  - Al crear un equipo, se inicializa automáticamente una fila en `team_standings` con 0 puntos.
  - Equipos ahora aparecen en el Leaderboard público desde el momento en que se crean.

### Migraciones SQL Aplicadas
- `20240407000000_add_stream_url_to_teams.sql`
- `20240407000001_add_stream_url_to_participants.sql`
- Storage bucket `evidence` + política de INSERT público creados manualmente en Supabase.

### Decisiones Técnicas
- `team_standings` usa UPSERT al crear equipos para garantizar visibilidad inmediata.
- Los links del portal usan el `slug` del torneo (legible por humanos) en vez del UUID.
- El sistema de streams es aditivo: equipo + todos los participantes con link activo se muestran.

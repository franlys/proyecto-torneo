# Implementation Plan: Tournament Leaderboard Platform

## Overview

Implementación incremental de la plataforma de torneos competitivos con Next.js 14 (App Router), TypeScript, Supabase y Tailwind CSS. Cada tarea construye sobre la anterior, comenzando por la infraestructura base hasta llegar a las funcionalidades avanzadas de formatos de competencia y deploy.

## Tasks

- [x] 1. Setup del proyecto y archivos de instrucciones
  - Inicializar proyecto Next.js 14 con App Router y TypeScript strict
  - Instalar dependencias: `supabase-js`, `@supabase/ssr`, `tailwindcss`, `shadcn/ui`, `framer-motion`, `zod`, `react-hook-form`, `@hookform/resolvers`, `zustand`, `fast-check`, `vitest`, `@testing-library/react`, `@dnd-kit/core`, `@dnd-kit/sortable`
  - Crear `CLAUDE.md` en la raíz con identidad del proyecto, estándares visuales premium y anti-AI-slop guidelines
  - Crear `CLAUDE.local.md` en la raíz con notas de entorno local y configuración de desarrollador
  - Crear `.claude/rules/architecture-state.md` con reglas de arquitectura y patrones de estado
  - Crear `.claude/rules/code-style.md` con estándares TypeScript, React y CSS
  - Crear `.claude/rules/workflows-standards.md` con estándares de planificación y verificación
  - Crear `task.md` en la raíz para tracking de tareas y progreso
  - Crear `SKILLS_MASTER.md` documentando los perfiles activos: frontend-design, ui-ux-pro-max, emilkowalski-design, vercel-react-best-practices, vercel-composition-patterns, deploy-to-vercel
  - Configurar `tsconfig.json` con strict mode, path aliases (`@/*`)
  - Configurar Tailwind CSS con paleta eSports personalizada
  - Crear estructura de directorios base: `src/app`, `src/components`, `src/lib`, `src/hooks`, `src/types`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [x] 2. Schema de base de datos y migraciones Supabase
  - [x] 2.1 Crear enums y tablas principales
    - Crear migración con todos los enums: `tournament_mode`, `competition_format`, `tournament_level`, `tournament_status`, `submission_status`
    - Crear tablas: `tournaments`, `scoring_rules`, `teams`, `participants`, `matches`
    - Crear tablas: `submissions`, `evidence_files`, `team_standings`, `leaderboard_themes`
    - Crear tablas de formatos especiales: `bracket_rounds`, `bracket_matchups`, `groups`, `group_teams`
    - _Requirements: 1.1, 1.3, 2.1, 2.6, 3.1, 4.1, 5.2, 6.1, 9.1_

  - [x] 2.2 Configurar RLS y políticas de seguridad
    - Habilitar RLS en todas las tablas
    - Crear política `creator_full_access` en `tournaments` (USING `creator_id = auth.uid()`)
    - Crear política `public_read_active` en `tournaments` para status active/finished
    - Crear política `public_read` en `team_standings`
    - Crear política `captain_insert` en `submissions` verificando `is_captain = true`
    - Crear políticas de lectura pública para `teams`, `participants`, `matches`, `leaderboard_themes`, `bracket_rounds`, `bracket_matchups`, `groups`, `group_teams`
    - _Requirements: 7.7, 3.9, 3.10_

  - [x] 2.3 Crear clientes Supabase y tipos TypeScript
    - Crear `src/lib/supabase/client.ts` (browser client con `createBrowserClient`)
    - Crear `src/lib/supabase/server.ts` (server client con `createServerClient` y cookies)
    - Crear `src/lib/supabase/middleware.ts` para refresh de sesión
    - Crear `src/middleware.ts` usando el helper de Supabase
    - Crear `src/types/index.ts` con todos los tipos TypeScript del design: `Tournament`, `ScoringRule`, `Team`, `Participant`, `Submission`, `TeamStanding`, `LeaderboardTheme`, `BracketRound`, `BracketMatchup`, `ColumnConfig` y todos los enums
    - _Requirements: 1.1, 7.5, 7.6_

- [x] 3. Autenticación con Supabase Auth
  - [x] 3.1 Implementar páginas de registro y login
    - Crear `src/app/(auth)/login/page.tsx` con formulario email/password usando React Hook Form + Zod
    - Crear `src/app/(auth)/register/page.tsx` con formulario de registro
    - Crear Server Actions para `signIn`, `signUp`, `signOut` en `src/lib/actions/auth.ts`
    - Implementar redirect post-login a `/tournaments` y redirect de sesión expirada a `/login?redirect=`
    - _Requirements: 7.1, 7.2, 7.3, 7.6_

  - [x] 3.2 Implementar protección de rutas y layout de dashboard
    - Crear `src/app/(dashboard)/layout.tsx` con verificación de sesión server-side y sidebar de navegación
    - Configurar middleware para proteger rutas `/tournaments/*`
    - Implementar `signOut` en sidebar
    - _Requirements: 7.6, 7.7_

  - [ ]* 3.3 Escribir tests de autenticación
    - Test unitario: registro con email inválido es rechazado (Property 29 — validación de input)
    - Test de integración: lockout tras 5 intentos fallidos (Property 29)
    - Test de integración: token expira en máximo 24h (Property 30)
    - Test de integración: RLS rechaza modificación por no-creator (Property 31)
    - _Requirements: 7.4, 7.5, 7.7_

- [x] 4. Scoring Engine puro con property-based tests
  - [x] 4.1 Implementar Scoring Engine
    - Crear `src/lib/scoring/engine.ts` con funciones puras (sin side effects):
      - `calculateMatchPoints(rule, position, kills): number` — Property 15
      - `calculateTournamentPoints(matchResults, rule): number` — Property 15
      - `calculateKillRate(totalKills, totalMatches): number` — Property 16
      - `calculatePotTopCount(submissions): number` — Property 17
      - `calculateTotalWithVip(points, vipScore): number` — Property 18
      - `rankTeams(standings): TeamStanding[]` — Properties 19, 20
      - `computeStandings(submissions, rule, config): TeamStanding[]` — Property 21
      - `calculateKillRaceStandings(submissions): TeamStanding[]` — Property 32
      - `calculateGroupStageStandings(groups, submissions, rule, advanceCount): GroupResult` — Property 35
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 9.2, 9.3, 9.9_

  - [x]* 4.2 Escribir property-based tests — Property 15: Scoring formula correctness
    - Usar fast-check: para cualquier posición P y kills K, `calculateMatchPoints` debe retornar `placementPoints[P] + killPoints * K`
    - Anotar: `// Feature: tournament-leaderboard-platform, Property 15`
    - **Validates: Requirements 4.2, 4.3**

  - [x]* 4.3 Escribir property-based tests — Property 16: Kill_Rate formula accuracy
    - Usar fast-check: para cualquier N kills y M partidas, `calculateKillRate(N, M)` debe retornar `N / M`
    - Anotar: `// Feature: tournament-leaderboard-platform, Property 16`
    - **Validates: Requirements 4.4**

  - [x]* 4.4 Escribir property-based tests — Property 17: Pot_Top count accuracy
    - Usar fast-check: el conteo de Pot_Top debe igualar el número de submissions aprobadas con `pot_top = true`
    - Anotar: `// Feature: tournament-leaderboard-platform, Property 17`
    - **Validates: Requirements 4.5**

  - [x]* 4.5 Escribir property-based tests — Property 18: VIP score included in total
    - Usar fast-check: para cualquier VIP score V, el total de puntos debe incluir V
    - Anotar: `// Feature: tournament-leaderboard-platform, Property 18`
    - **Validates: Requirements 4.6**

  - [x]* 4.6 Escribir property-based tests — Property 19: Leaderboard descending order invariant
    - Usar fast-check: para cualquier par de equipos i, j donde rank[i] < rank[j], points[i] >= points[j]
    - Anotar: `// Feature: tournament-leaderboard-platform, Property 19`
    - **Validates: Requirements 4.7**

  - [x]* 4.7 Escribir property-based tests — Property 20: Tiebreaker by total kills
    - Usar fast-check: dos equipos con puntos iguales, el de más kills tiene menor rank number
    - Anotar: `// Feature: tournament-leaderboard-platform, Property 20`
    - **Validates: Requirements 4.8**

  - [x]* 4.8 Escribir property-based tests — Property 21: Approval order independence (confluence)
    - Usar fast-check: `computeStandings(submissions)` debe ser igual a `computeStandings(shuffle(submissions))`
    - Anotar: `// Feature: tournament-leaderboard-platform, Property 21`
    - **Validates: Requirements 4.11**

  - [x]* 4.9 Escribir property-based tests — Property 32: Kill_Race placement points are zero
    - Usar fast-check: en Kill_Race, `placementPoints` para todas las posiciones debe ser 0 y el ranking es por kills descendente
    - Anotar: `// Feature: tournament-leaderboard-platform, Property 32`
    - **Validates: Requirements 9.3**

  - [x]* 4.10 Escribir property-based tests — Property 35: Group stage advancement correctness
    - Usar fast-check: exactamente `advance_count` equipos por grupo avanzan, ordenados por puntos acumulados
    - Anotar: `// Feature: tournament-leaderboard-platform, Property 35`
    - **Validates: Requirements 9.9**

- [x] 5. Checkpoint — Scoring Engine
  - Ejecutar `vitest --run src/lib/scoring` y verificar que todos los tests pasen.
  - Asegurarse de que las funciones del engine son puras (sin imports de Supabase).
  - Preguntar al usuario si hay dudas antes de continuar.

- [x] 6. Dashboard — Creación y configuración de torneos
  - [x] 6.1 Crear Zod schemas y Server Actions de torneos
    - Crear `src/lib/validations/schemas.ts` con schemas Zod para `CreateTournamentInput`, `UpdateTournamentInput`, `ScoringRuleInput`
    - Crear `src/lib/actions/tournaments.ts` con Server Actions: `createTournament`, `updateTournament`, `activateTournament`
    - Implementar validación de `total_matches` según `tournament_level` (casual ≤ 3, profesional 6–12)
    - Implementar bloqueo de modificación cuando status = 'active'
    - Implementar validación de `kill_race_time_limit_minutes` requerido para Kill_Race
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 9.4_

  - [x] 6.2 Crear páginas y formulario de torneos
    - Crear `src/app/(dashboard)/tournaments/page.tsx` — lista de torneos del creator (Server Component)
    - Crear `src/app/(dashboard)/tournaments/new/page.tsx` — página de creación
    - Crear `src/app/(dashboard)/tournaments/[id]/page.tsx` — overview del torneo
    - Crear `src/components/dashboard/TournamentForm.tsx` — formulario con React Hook Form + Zod, campos: nombre, descripción, modo, formato, nivel, fechas, total_matches, métricas habilitadas, reglas de texto
    - Crear `src/components/dashboard/ScoringRuleEditor.tsx` — editor de kill_points y tabla de placement_points
    - _Requirements: 1.1, 1.3, 1.5, 1.6, 1.11_

  - [ ]* 6.3 Escribir tests unitarios para validaciones de torneo
    - Test: activación rechazada si profesional con < 6 o > 12 partidas (Property 4)
    - Test: activación rechazada si casual con > 3 partidas (Property 5)
    - Test: rules_text > 5000 chars es rechazado (Property 6)
    - Test: modificación de torneo activo es rechazada (Property 3)
    - Test: Kill_Race sin time_limit es rechazado (Property 33)
    - _Requirements: 1.8, 1.9, 1.10, 1.11, 9.4_

- [-] 7. Dashboard — Gestión de participantes y equipos
  - [-] 7.1 Crear Server Actions y schemas de participantes
    - Agregar schemas Zod: `AddParticipantInput`, `CreateTeamInput`
    - Crear `src/lib/actions/participants.ts` con: `addParticipant`, `createTeam`, `removeParticipant`, `assignCaptain`
    - Implementar validación de tamaño de equipo según `tournament_mode`
    - Implementar validación de capitán requerido en modos no-individual
    - Implementar unicidad de `display_name` dentro del torneo
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9_

  - [ ] 7.2 Crear página y componente de gestión de participantes
    - Crear `src/app/(dashboard)/tournaments/[id]/participants/page.tsx`
    - Crear `src/components/dashboard/ParticipantManager.tsx` — lista de participantes/equipos, formulario de agregar, botón de eliminar, selector de capitán
    - Mostrar error inline cuando se intenta guardar equipo sin capitán
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 7.3 Escribir tests unitarios para gestión de participantes
    - Test: equipo con tamaño incorrecto es rechazado (Property 2)
    - Test: equipo sin capitán en modo no-individual es rechazado (Property 8)
    - Test: nombre de participante duplicado es rechazado (Property 7)
    - _Requirements: 2.3, 2.7, 2.8, 2.9_

- [~] 8. Dashboard — Registro de submissions con evidencias
  - [~] 8.1 Configurar Supabase Storage y Server Actions de submissions
    - Crear bucket `evidence` en Supabase Storage con políticas de acceso
    - Agregar schema Zod: `SubmitKillsInput` con validación de MIME types y tamaño ≤ 50MB
    - Crear `src/lib/actions/submissions.ts` con: `submitKills` (incluye upload de evidencias a Storage)
    - Implementar validación: solo Team_Captain puede enviar en modos no-individual
    - Implementar validación: match_id debe existir en el torneo
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.9, 3.10, 3.11_

  - [~] 8.2 Crear página y componente de submissions
    - Crear `src/app/(dashboard)/tournaments/[id]/submissions/page.tsx`
    - Crear componente de formulario de submission con: selector de match, input de kills, toggle pot_top, upload de evidencias con preview y validación client-side
    - Mostrar lista de submissions del equipo con status (pending/approved/rejected) y razón de rechazo
    - _Requirements: 3.1, 3.2, 3.3, 3.7, 3.8_

  - [ ]* 8.3 Escribir tests unitarios para submissions
    - Test: submission sin match_id es rechazada (Property 10)
    - Test: submission sin evidencia es rechazada (Property 10)
    - Test: archivo > 50MB es rechazado (Property 11)
    - Test: MIME type inválido es rechazado (Property 11)
    - Test: submission de no-capitán en modo equipo es rechazada (Property 13)
    - Test: submission con match inexistente es rechazada (Property 14)
    - Test: datos de submission se recuperan íntegros (Property 12)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.9, 3.10, 3.11_

- [~] 9. Dashboard — Aprobación y rechazo de submissions
  - [~] 9.1 Crear Server Actions de revisión y componente reviewer
    - Agregar a `src/lib/actions/submissions.ts`: `approveSubmission`, `rejectSubmission`
    - Al aprobar: llamar al Scoring Engine para recalcular standings y actualizar `team_standings` en DB
    - Al rechazar: guardar `rejection_reason` y notificar al participante
    - Crear `src/app/(dashboard)/tournaments/[id]/submissions/page.tsx` (sección de revisión para creator)
    - Crear `src/components/dashboard/SubmissionReviewer.tsx` — cola de submissions pendientes con preview de evidencias, botones aprobar/rechazar, modal de razón de rechazo
    - _Requirements: 3.5, 3.6, 3.7, 4.1, 4.10_

  - [ ]* 9.2 Escribir tests de integración para aprobación
    - Test de integración: aprobar submission actualiza `team_standings` en < 5s (Requirements 3.6)
    - Test de integración: rechazar submission guarda `rejection_reason` y no modifica standings
    - _Requirements: 3.5, 3.6, 3.7_

- [ ] 10. Checkpoint — Dashboard completo
  - Ejecutar `vitest --run` y verificar que todos los tests pasen.
  - Verificar que el flujo completo creator → torneo → participantes → submissions → aprobación funciona end-to-end con Supabase local.
  - Preguntar al usuario si hay dudas antes de continuar.

- [~] 11. Leaderboard público con Realtime
  - [~] 11.1 Crear página pública SSR del leaderboard
    - Crear `src/app/t/[slug]/page.tsx` como Server Component que carga standings iniciales via Supabase server client
    - Crear `src/components/leaderboard/TournamentHeader.tsx` — banner, logo, status badge (upcoming/active/finished), countdown
    - Crear `src/components/leaderboard/ScoringInfoPanel.tsx` — tabla de placement_points, kill_points, formato, progreso de partidas (completadas/total), reglas de texto
    - Crear `src/components/leaderboard/LeaderboardRow.tsx` — fila con rank, team name, avatar, métricas configuradas
    - Crear `src/components/leaderboard/LeaderboardTable.tsx` — tabla completa con columnas configurables
    - _Requirements: 5.1, 5.2, 5.8, 5.9, 5.10, 5.11_

  - [~] 11.2 Implementar hook Realtime con fallback polling
    - Crear `src/hooks/useLeaderboard.ts` con suscripción a `postgres_changes` en `team_standings`
    - Implementar fallback a polling cada 30s cuando la conexión Realtime se cierra (`status === 'CLOSED'`)
    - Mostrar indicador "reconectando" en UI durante desconexión
    - Crear `src/components/leaderboard/ThemeProvider.tsx` para aplicar tema dinámico via CSS variables
    - _Requirements: 5.3, 5.4_

  - [ ]* 11.3 Escribir tests de rendering del leaderboard
    - Test: columnas habilitadas aparecen, columnas deshabilitadas no aparecen (Property 22)
    - Test: tema aplicado consistentemente en header, filas y paneles (Property 23)
    - Test: scoring info renderizada en vista pública (Property 24)
    - Test: rules text renderizado en vista pública (Property 25)
    - Test: progreso de partidas renderizado (Property 26)
    - _Requirements: 5.2, 5.5, 5.7, 5.9, 5.10, 5.11_

- [~] 12. Personalización visual del leaderboard
  - [~] 12.1 Crear Server Actions y schemas de personalización
    - Agregar schemas Zod para `LeaderboardTheme`
    - Crear `src/lib/actions/customization.ts` con: `saveTheme`, `uploadAsset`
    - Implementar validación de assets: MIME types {image/jpeg, image/png, image/svg+xml}, tamaño ≤ 5MB
    - Crear bucket `assets` en Supabase Storage para logos y banners
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.8_

  - [~] 12.2 Crear panel de personalización con drag-and-drop
    - Crear `src/app/(dashboard)/tournaments/[id]/customize/page.tsx`
    - Crear `src/components/dashboard/CustomizePanel.tsx` con:
      - Selector de 5+ presets de temas (neon-dark, gold-elite, etc.)
      - Color picker para primary color
      - Selector de background (solid/gradient/image)
      - Selector de font family
      - Upload de logo y banner con preview y validación client-side
      - Toggle de visibilidad por columna
      - Drag-and-drop de orden de columnas usando `@dnd-kit/sortable`
      - Preview en tiempo real del leaderboard
    - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.7, 6.8_

  - [ ]* 12.3 Escribir tests de validación de assets
    - Test: logo/banner > 5MB es rechazado (Property 28)
    - Test: MIME type inválido para logo/banner es rechazado (Property 28)
    - _Requirements: 6.4, 6.5_

- [~] 13. Formatos de competencia especiales
  - [~] 13.1 Implementar Bracket (Eliminacion_Directa)
    - Crear `src/lib/actions/bracket.ts` con: `generateBracket`, `recordMatchupResult`, `advanceWinner`
    - Implementar lógica de generación de bracket con bye slots cuando equipos no son potencia de 2
    - Implementar eliminación de perdedor de todos los rounds subsiguientes
    - Crear `src/components/leaderboard/BracketView.tsx` — árbol visual de eliminación directa con rondas, matchups y estado de avance
    - _Requirements: 9.6, 9.7, 9.10_

  - [ ]* 13.2 Escribir tests para bracket
    - Test: perdedor es excluido de rondas subsiguientes (Property 34)
    - Test: bracket renderizado en vista pública para formato eliminacion_directa (Property 27)
    - _Requirements: 9.6, 9.7_

  - [~] 13.3 Implementar Fase de Grupos
    - Crear `src/lib/actions/groups.ts` con: `createGroups`, `assignTeamToGroup`, `computeGroupStandings`
    - Integrar con Scoring Engine (`calculateGroupStageStandings`)
    - Crear `src/components/leaderboard/GroupStageView.tsx` — vista de grupos con standings intra-grupo y equipos que avanzan
    - _Requirements: 9.8, 9.9_

  - [~] 13.4 Implementar Kill_Race y reset de formato
    - Integrar `calculateKillRaceStandings` del Scoring Engine en el flujo de aprobación
    - Implementar Server Action `changeFormat` que resetea matches, submissions y standings con confirmación modal
    - _Requirements: 9.3, 9.4, 9.5, 9.11_

  - [ ]* 13.5 Escribir tests para formatos especiales
    - Test: Kill_Race rankea por kills, placement_points = 0 (Property 32 — ya cubierto en tarea 4.9)
    - Test: Kill_Race sin time_limit rechaza activación (Property 33)
    - Test: cambio de formato resetea todos los datos (Property 36)
    - Test: avance correcto en fase de grupos (Property 35 — ya cubierto en tarea 4.10)
    - _Requirements: 9.3, 9.4, 9.9, 9.11_

- [ ] 14. Tests de integración y smoke tests
  - [ ] 14.1 Escribir tests de integración con Supabase local
    - Crear `src/tests/integration/leaderboard.test.ts`:
      - Test: latencia de actualización de leaderboard tras aprobación < 5s (Requirements 3.6, 5.3)
      - Test: suscripción Realtime dispara actualización de standings (Requirements 5.4)
      - Test: lockout de cuenta tras 5 intentos fallidos (Property 29)
      - Test: expiración de token en máximo 24h (Property 30)
      - Test: RLS rechaza modificación por usuario no-creator (Property 31)
    - _Requirements: 3.6, 5.3, 5.4, 7.4, 7.5, 7.7_

  - [ ] 14.2 Escribir smoke tests
    - Crear `src/tests/smoke/public-access.test.ts`:
      - Test: leaderboard público accesible sin autenticación (Requirements 5.1)
      - Test: archivos de instrucciones existen en el repositorio (Requirements 8.1–8.7)
    - _Requirements: 5.1, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 15. Checkpoint final — Todos los tests
  - Ejecutar `vitest --run` y verificar que todos los tests (unit, PBT, integración, smoke) pasen.
  - Verificar que no hay errores de TypeScript con `tsc --noEmit`.
  - Preguntar al usuario si hay dudas antes de proceder al deploy.

- [~] 16. Deploy a Vercel
  - [~] 16.1 Configurar variables de entorno y proyecto Vercel
    - Crear `.env.local.example` con todas las variables requeridas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
    - Configurar variables de entorno en Vercel dashboard (production y preview)
    - Verificar `next.config.ts` con configuración de imágenes para Supabase Storage domain
    - _Requirements: deploy_

  - [~] 16.2 Configurar Supabase para producción y deploy
    - Ejecutar migraciones en proyecto Supabase de producción con `supabase db push`
    - Configurar Supabase Auth con URL de producción (Site URL, Redirect URLs)
    - Conectar repositorio a Vercel y hacer deploy con `vercel --prod`
    - Verificar que el leaderboard público es accesible en la URL de producción
    - _Requirements: 5.1, 7.1_

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental antes de continuar
- Los property-based tests usan fast-check con mínimo 100 iteraciones por propiedad
- Los tests unitarios cubren casos concretos y edge cases
- El Scoring Engine (tarea 4) es completamente puro — sin imports de Supabase ni side effects

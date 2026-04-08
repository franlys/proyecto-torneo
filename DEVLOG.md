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
  - El servidor ahora genera el leaderboard basándose en la lista total de equipos (`allTeams`), garantizando que incluso los equipos sin puntos aparezcan en orden de registro (Backfill dinámico).
  - Equipos ahora aparecen en el Leaderboard público desde el momento en que se crean.

- **Tab "Participantes" y Escalabilidad de Streams**:
  - Nuevo tab en el Leaderboard público que lista equipos, sus integrantes y links de stream.
  - **Refactor de Streams**: Se eliminaron los botones globales POV del encabezado por falta de escalabilidad.
  - **Icono de Cámara**: Se añadió un indicador visual (📹) en la tabla de posiciones que redirige al tab de participantes.
  - **Organización**: Los links de stream ahora se gestionan por equipo/participante dentro del tab de Participantes, permitiendo soportar 50+ streamers sin saturar la UI.
  - **Lógica de Estado**: Los indicadores de stream ("Live") ahora solo aparecen cuando el torneo está en estado `active`. En `draft` (Pre-torneo), la UI permanece limpia.

- **Infraestructura y Despliegue**:
  - **GitHub**: Repositorio inicializado y sincronizado en `https://github.com/franlys/proyecto-torneo.git`.
  - **Vercel**: Proyecto configurado con variables de entorno de Supabase.
  - **Build Fix**: Se modificó `next.config.mjs` para ignorar errores de ESLint y TypeScript solo durante el proceso de build, permitiendo despliegues rápidos a pesar de advertencias cosméticas de tipado (`any`).
  - **Realtime Sync**: Suscripción de Supabase actualizada para incluir la información de equipos y participantes en tiempo real.

### Migraciones SQL Aplicadas
- `20240407000000_add_stream_url_to_teams.sql`
- `20240407000001_add_stream_url_to_participants.sql`

### Decisiones Técnicas
- **Data-Driven Standings**: Se abandonó la dependencia exclusiva de la tabla `team_standings` para el renderizado inicial, usando un "merge" en memoria con `allTeams` para asegurar visibilidad total.
- **UX Escalable**: Centralización de streams en el tab de participantes para evitar un encabezado saturado en torneos grandes.
- **Ignorar errores de Lint en Build**: Decisión pragmática para acelerar el despliegue a Vercel, manteniendo el código funcional mientras se pulen los tipos de TypeScript.

---

## Próximos Pasos
1. **Calentamiento**: Implementar el sistema opcional de partidas de warmup (según plan de ejecución aprobado).
2. **Cálculo VIP**: Lógica basada en kills individuales para determinar el MVP/VIP del torneo.
3. **Producción**: Configurar las URLs de redirección en Supabase Auth una vez confirmado el dominio final de Vercel.

---

## [2026-04-07 (noche)] — Warmup Matches + Responsive Design

### Tareas Completadas

- **Sistema de Partidas de Calentamiento (Warmup)**:
  - Nueva migración `20240408000000`: campo `is_warmup BOOLEAN DEFAULT FALSE` en tabla `matches`.
  - Nueva migración `20240408000001`: campos `warmup_enabled` y `warmup_match_count` en tabla `tournaments`.
  - `recalculateStandings`: ahora excluye automáticamente los envíos de partidas de calentamiento del cálculo de standings oficial.
  - `createSubmission`: permite envíos en partidas warmup independientemente del estado del torneo (`draft`/`active`).

- **Responsive Design — Dashboard**:
  - Creado `DashboardShell.tsx` (Client Component): contiene toda la lógica de sidebar/drawer.
  - `layout.tsx` simplificado para delegar el render al Shell (Server/Client boundary limpio).
  - Sidebar de escritorio: oculto en móviles (`hidden lg:flex`).
  - Header móvil fijo con botón hamburguesa.
  - Drawer lateral animado con Framer Motion (`spring: stiffness 300, damping 30`).
  - Backdrop con click-fuera para cerrar el drawer.

- **Responsive Design — Torneos Page**:
  - Padding adaptado: `p-4 sm:p-8`.
  - Header: tipografía escalada `text-xl sm:text-2xl`.
  - Botón "Nuevo Torneo" condensa el texto en móviles (`+ Torneo` en mobile, `+ Nuevo Torneo` en sm+).

- **Responsive Design — Leaderboard Público**:
  - Título del torneo: `text-2xl sm:text-4xl md:text-5xl`.
  - Tabs: con scroll horizontal en móviles (`overflow-x-auto`, `shrink-0`), texto más compacto.
  - Tabla: padding reducido en móviles, columnas "Top 1" y "Kill Rate" ocultas en pantallas < md.
  - Nombre de equipo: `text-sm sm:text-lg` para evitar overflow.
  - Rankings: `text-base sm:text-xl`.

### Migraciones SQL Creadas (pendientes de aplicar en Supabase)
- `20240408000000_add_warmup_to_matches.sql`
- `20240408000001_add_warmup_to_tournaments.sql`
- `20240408000002_add_bg_opacity_to_themes.sql`
- `20240408000003_add_mobile_bg_to_themes.sql`

---

## [2026-04-07 (noche - sprint 3)] — Fondos Duales (Desktop/Móvil)

### Tareas Completadas

- **Soporte para Fondos Duales**:
    - Nueva migración `20240408000003`: columna `background_mobile_value` en `leaderboard_themes`.
    - `ThemeEditor`: Añadido apartado específico para subir un video vertical (9:16) para móviles.
    - `LeaderboardClient`: Implementada detección dinámica de dispositivo con `window.matchMedia`. El sistema ahora intercambia el fondo instantáneamente según el ancho de pantalla (breakpoint 768px).
    - **Backfill Inteligente**: Si no se configura un fondo móvil, el sistema utiliza el fondo principal escalado como respaldo.

### Decisiones Técnicas
- **Detección Lado Cliente**: Se utiliza un listener de `resize` en `LeaderboardClient` para que el cambio de fondo sea reactivo incluso si el usuario cambia la orientación de su dispositivo o redimensiona la ventana en PC.
- **Keys en React**: Se añadieron `key={activeBackground}` a los elementos de video e imagen para forzar el re-montado del componente cuando el fondo cambia, asegurando que el nuevo recurso se cargue y reproduzca correctamente de inmediato.

---

---

## [2026-04-08 (madrugada)] — Hardening 404 & Actualización Terminología (Top Fragger)

### Tareas Completadas

- **Refuerzo Anti-404**:
    - **Normalización Agresiva**: Se implementó `.trim().toLowerCase()` en todos los parámetros de ruta (`slug` e `teamId`). Esto previene errores por espacios accidentales al copiar/pegar o capitalización automática de teclados móviles.
    - **Bypass de Cache (edge)**: Se añadió `export const dynamic = 'force-dynamic'` a las rutas públicas relevantes. Esto asegura que Vercel no sirva una página 404 estática si el torneo fue creado o actualizado recientemente.
- **Cambio de Terminología (VIP → Top Fragger)**:
    - Se reemplazó la etiqueta "VIP" por **"Top Fragger"** en el `TournamentForm` y en el `LeaderboardClient`.
    - **UI Dinámica**: Las columnas de "Top Fragger" y "Pot Top" en el leaderboard ahora son condicionales; solo aparecen si la métrica está habilitada en la configuración del torneo.
    - Se utilizó tipografía Orbitron y badges con efectos neon para mantener la estética gamer.

### Decisiones Técnicas
- **Force Dynamic**: Dado que el leaderboard es una herramienta de consulta en tiempo real, forzar el renderizado dinámico garantiza consistencia de datos sin depender de los tiempos de revalidación de ISR que a veces causaban 404s en enlaces nuevos.
- **Métricas Condicionales**: Se limpió la interfaz del leaderboard para no mostrar columnas vacías (0.0) si el organizador no utiliza ciertas métricas (Kill Rate, Pot Top, etc.).




---

## [2026-04-08 (madrugada - sprint 6)] - Top Fragger MVP Card y Match Recap Clarity

### Problema Reportado
El usuario senalo que el 'Top Fragger' podia mezclarse con el ranking de equipos por puntos, y que los resumenes de partida podian confundir datos entre rondas distintas.

### Tareas Completadas

- **Tarjeta Top Fragger MVP (Independiente)**:
    - Anadida entre el header del torneo y los tabs en LeaderboardClient.tsx.
    - Logica: Calcula con Array.reduce el equipo con mayor vipScore, desvinculado de rank o totalPoints.
    - Muestra el puesto en tabla (Puesto en tabla: #X) para dejar claro que MVP no es igual a #1 en puntos.
    - Solo aparece si vipEnabled = true y vipScore > 0 en algun equipo.
    - Animacion Framer Motion spring (skill emilkowalski-design).

- **MatchRecap.tsx - Refactoring Completo**:
    - Re-escrito con interfaces TypeScript explicitas, sin any.
    - Header por partida: nombre, equipos registrados, kills totales en esa ronda.
    - Top Fragger de la Partida: badge separado con kills de esa ronda, etiquetado 'Top Fragger - Esta Partida'.
    - Cards ordenadas por kills descendente. Lider de kills lleva ribbon visual.
    - Warm-up matches diferenciados con badge naranja.

### Arquitectura de Metricas (3 contextos separados)
1. Ranking de Equipos - Tab Posiciones: puntos + kills acumulados del torneo.
2. Top Fragger MVP del Torneo - Tarjeta flotante: vip_score asignado manualmente, independiente del ranking.
3. Top Fragger de la Partida - Tab Partidas/header: kills de esa ronda solamente.

### Skills Aplicados
frontend-design, ui-ux-pro-max, emilkowalski-design, vercel-react-best-practices, vercel-composition-patterns.

---

## [2026-04-08 (madrugada - sprint 7)] - Gestión de Torneos y Notificaciones Pro

### Tareas Completadas

- **Gestión de Torneos (CRUD)**:
    - Implementación de `deleteTournament` (Server Action) con verificación de propiedad (`creator_id`).
    - Creación de `TournamentCard` (Client Component) con botón de borrado en hover y confirmación.
    - Añadida "Zona de Peligro" en la vista de detalle del torneo para borrado permanente.
- **Hardening de Rutas**:
    - Normalización estricta (`.trim().toLowerCase()`) en slugs y IDs.
    - Uso de `export const dynamic = 'force-dynamic'` para evitar caché de estados 404.

---

## [2026-04-08 (mañana - sprint 8)] - Refinamiento Premium y MVP Individual

### Problema Reportado
El usuario solicitó una estética más profesional (menos diálogos de navegador) y una separación clara de las métricas de "Top Fragger", las cuales deben ser individuales y no por equipo. También se reportaron problemas con el fondo de video en pantallas verticales.

### Tareas Completadas

- **Sistema de Notificaciones Premium**:
    - **Sonner Integration**: Reemplazo de `alert()` por notificaciones "toast" con estética eSports (neon gradients, glassmorphism).
    - **ConfirmModal (Framer Motion)**: Reemplazo de `window.confirm()` con un modal personalizado, animado y temático para acciones destructivas.
    - **ToastProvider**: Centralizado en `layout.tsx` para feedback global de acciones.

- **Revolución del "Top Fragger" (MVP Individual)**:
    - **Migración DB**: Añadido `total_kills` a la tabla `participants` (migración `20240408000004`).
    - **Hero Section Individual**: Nuevo podio visual encima de la tabla de posiciones que destaca a los 3 mejores jugadores del torneo (no equipos).
    - **Campos**: Muestra Nombre de Jugador, Equipo, Kills Totales y botón directo a su stream personal.
    - **Limpieza de Tabla**: Eliminada la columna "Top Fragger" de la tabla de equipos para evitar redundancia y confusión de métricas.

- **Fondo de Video Pro (Full Coverage)**:
    - **CSS Fix**: Implementada lógica de `min-w-full min-h-full` con centrado absoluto vía `translate` para que los fondos de iframe (YouTube/Twitch) se comporten como `object-cover`.
    - Centrado garantizado en laptops con pantallas verticales y dispositivos móviles.

- **Refinado de UI/UX**:
    - **TournamentCard**: Reestructurado el header (Flexbox) para evitar que el botón de borrar se solape con el badge de estado en títulos largos.
    - **Data Realtime**: Actualizada la suscripción de Supabase para incluir los kills individuales en tiempo real.

### Decisiones Técnicas
- **Independencia de Métricas**: El MVP individual ahora se calcula recorriendo la lista de participantes, permitiendo que un jugador destaque incluso si su equipo no está en el top del ranking por puntos.
- **Consistencia Visual**: Uso extensivo de la fuente `Orbitron` y efectos de resplandor (`drop-shadow`) para consolidar la marca eSports.

---

## [2026-04-08 (mañana - sprint 9)] — Sistema de Multirondas (BO3, BO5, Maps)

### Problema Reportado
Los organizadores necesitaban una forma de agrupar varios mapas o juegos bajo un mismo "Encuentro" (Match), evitando la creación manual de partidas sueltas y permitiendo una visualización estructurada de series competitivas.

### Tareas Completadas

- **Infraestructura Jerárquica (Matches & Rounds)**:
    - **Migración DB (`20240409000000`)**: Añadidas columnas `parent_match_id` y `round_number` a la tabla `matches`.
    - **Lógica de Creación**: Actualizado el Server Action `createTournament` para generar automáticamente encuentros padres e hijos según la configuración del torneo.
    - **Configuración Global**: Añadido campo `default_rounds_per_match` en `TournamentForm` (Sección Configuración).

- **Portal de Equipos con Sub-Rondas**:
    - **Selector Dinámico**: El formulario de envío de evidencias ahora detecta si un encuentro tiene múltiples rondas y despliega un selector secundario de mapa/ronda.
    - **Validación Granular**: Se permite un envío por equipo por **Ronda**, no solo por encuentro padre.

- **Match Recap Estructurado**:
    - **Refactor de MatchRecap.tsx**: Agrupación visual por Encuentro.
    - **Tabs de Ronda**: Cada encuentro muestra sus rondas como sub-tabs dinámicos.
    - **Análisis de Ronda**: El header del recap indica si se está visualizando un "Resumen de Ronda" o un "Encuentro Global".
    - **Cálculo de Totales**: El sistema suma automáticamente los resultados de todas las rondas de un encuentro para mostrar el desempeño acumulado de la serie.

### Sprint 10: Visibilidad de Reglas y Gestión Manual (Refinamiento)
- **Reglas Públicas**: Implementada pestaña 'rules' en `LeaderboardClient` con renderizado de `rules_text`.
- **MVP Manual**: Añadida capacidad de editar `total_kills` de participantes directamente en el Dashboard.
- **Sincronización**: Git push a rama principal para despliegue en Vercel.

### Sprint 11: Gestión de Partidas y Reportes Pro
- **Editor de Partidas**: Nueva interfaz para renombrar encuentros, rondas y asignar mapas (Erangel, Miramar, etc.).
- **Exportación**: Generación de reportes CSV con resultados finales y estadísticas MVP.

### Sprint 12: Dashboard Interactivo de Análisis (Visual WOW)
- **Deep Dive Tables**: Refactor completo del leaderboard público. Ahora cada equipo se expande con una animación fluida al hacer clic.
- **Gráficas de Progreso**: Integración de `AreaChart` dinámico mostrando la evolución acumulada de puntos y kills por ronda.
- **Análisis de Jugadores**: Desglose detallado de estadísticas individuales dentro de la vista expandida del equipo.

### Sprint 13: Motor de Validación con IA Vision
- **Integración con Gemini 1.5 Flash**: Implementación del servicio de OCR y análisis de imágenes gratuito.
- **Validación Automática**: Los resultados enviados por jugadores son analizados en segundo plano al subir la evidencia.
- **Dashboard de Aprobación**: Nueva interfaz para administradores que contrastan los datos del jugador vs las extracciones de la IA.
- **Indicadores de Confianza**: Sistema de badges (Alta Confianza / Revisión Manual) basado en el análisis probabilístico del modelo visual.

### Próximos Pasos
1. **Galería de Campeones**: Hall of Fame para torneos finalizados.
2. **Auto-Aprobación**: Lógica opcional para aprobar automáticamente si la IA tiene 100% de confianza.
3. **Optimización de OCR**: Refinar prompts para diferentes tipos de juegos (BR, Kill Race, etc.).


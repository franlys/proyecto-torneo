# Tareas: Sistema de Multirondas (Sprint 9)

- [x] **Base de Datos**
    - [x] Crear migración `add_rounds_to_matches.sql`
    - [x] Crear migración `add_default_rounds_to_tournaments.sql`
- [x] **Tipos e Interfaces**
    - [x] Actualizar `Tournament` y `Match` en `src/types/index.ts`
    - [x] Actualizar `schemas.ts` con validaciones de rondas
- [x] **Dashboard — Configuración**
    - [x] Añadir campo `default_rounds_per_match` en `TournamentForm.tsx`
    - [x] Actualizar Server Action `createTournament`
- [x] **Dashboard — Gestión de Partidas**
    - [x] Crear componente/lógica para creación masiva de rondas (Encuentros)
- [x] **Portal de Equipos**
    - [x] Implementar sub-selector de Ronda en el formulario de envío
    - [x] Actualizar validación de envíos duplicados (ahora por ronda, no por partida padre)
- [x] **Leaderboard**
    - [x] Refactorizar `MatchRecap.tsx` para agrupar visualmente por Encuentro
- [x] **Documentación**
    - [x] Actualizar `DEVLOG.md`

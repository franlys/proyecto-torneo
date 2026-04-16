# Task Tracking — Tournament Leaderboard Platform

## Sprint 9: Admin Access, AC Sync & Live Match Control (2026-04-15/16)

| Tarea | Estado | Notas |
|-------|--------|-------|
| Fix registro usuarios "Database error saving new user" | ✅ Completo | Trigger silencioso (EXCEPTION WHEN OTHERS) + fallback en auth callback |
| Perfil admin para elmaestrogonzalez30@gmail.com | ✅ Completo | Insertado manualmente vía SQL con role=ADMIN |
| Panel de administración `/admin` | ✅ Completo | Stats globales + usuarios recientes + todos los torneos |
| Gestión de usuarios `/admin/users` | ✅ Completo | `auth.admin.listUsers()` como fuente primaria + RoleSelect + SubToggle |
| Perfil de usuario `/profile` | ✅ Completo | Editar username + flujo suscripción (upload → pending → active) |
| Gate de creación de torneos | ✅ Completo | Bloqueo si `subscription_status !== 'ACTIVE'` (excepto ADMIN) |
| Recordatorios de suscripción | ✅ Completo | `sendSubscriptionReminders()` — magic links a subs que expiran en 7 días |
| Fix ArenaCrypto banner 404 | ✅ Completo | URL cambiada a homepage con `?ref=kronix&tournament=slug` |
| Fix códigos de streamer salen del dashboard | ✅ Completo | Nueva ruta `/tournaments/[id]/codes` dentro del grupo `(dashboard)` |
| Fix "Sin permisos" al generar códigos | ✅ Completo | `canManageCodes()`: creador del torneo también puede gestionar, no solo admin |
| Admin puede ver torneos ajenos | ✅ Completo | `getTournament/getTournaments` sin filtro `creator_id` para ADMIN + RLS bypass |
| RLS bypass para ADMIN | ✅ Completo | `is_admin_user()` + políticas `admin_full_access` en todas las tablas |
| Arena Crypto sync fields | ✅ Completo | `tournament_type`, `rank`, `player_kills` (JSONB+GIN), `is_warmup` en matches |
| XVI COUP marcado como kill_race | ✅ Completo | `tournament_type = 'kill_race'` via migración + UPDATE |
| matches.is_active para AC live sync | ✅ Completo | Campo booleano + botones ▶ Iniciar / ✓ Finalizar en MatchesManager |

## Sprint 8: Producción, Branding & Admin Panel (2026-04-14/15)

| Tarea | Estado | Notas |
|-------|--------|-------|
| Fix leaderboard mostrando solo 1 equipo | ✅ Completo | Memoized supabase client + `ascending: false` en order |
| Fix Hall of Fame no aparecía al finalizar | ✅ Completo | Condición cambiada a `currentStatus === 'finished'` |
| Fix "EN VIVO" en torneo finalizado (caché Vercel) | ✅ Completo | `revalidatePath` en `finishTournament` + endpoint `/api/revalidate-tournament` |
| Fix build Vercel (JSX error Gemini commit) | ✅ Completo | `TournamentForm.tsx`: self-closing textarea + orphaned `</div>` eliminado |
| Rebrand ArenaLabs → Kronix + Powered by GonzalezLabs | ✅ Completo | Todos los archivos de UI actualizados |
| Fix URL ArenaCrypto → arena-crypto.vercel.app | ✅ Completo | `page.tsx`, `ArenaPromoBanner.tsx` |

## Sprint 7: Premium Refinement & Individual Metrics

| Tarea | Estado | Notas |
|-------|--------|-------|
| Background Video Fix | ✅ Completo | Centrado absoluto y `object-cover` real para iframes. |
| Premium Toast System | ✅ Completo | Implementado Sonoma con tema dark y eSports. |
| Custom Confirm Modal | ✅ Completo | Reemplazo de window.confirm con modal de Framer Motion. |
| CRUD Torneos Refinement | ✅ Completo | Botón borrar elegante, Danger Zone y layouts corregidos. |
| Individual Top Fragger | ✅ Completo | Refactorización de métrica de equipo a individuo (Top 5 MVP). |
| Player Stream Links | ✅ Completo | Botones de stream directo en el hero de Top Fragger. |
| DB Update | ✅ Completo | Migración `add_kills_to_participants` ejecutada. |

## Futuro Próximo

- [ ] Soporte para múltiples rondas/partidas con pesos distintos.
- [ ] Exportación de resultados a Excel/PDF.
- [ ] Integración de Chat en vivo en el Leaderboard.

## Notas Técnicas

- Usar `toast.error()` o `toast.success()` para feedback de acciones.
- El componente `ConfirmModal` es reutilizable para cualquier acción destructiva.
- Las kills ahora se trackean a nivel de `participant_id` en la tabla `participants`.

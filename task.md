# Task Tracking — Tournament Leaderboard Platform

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

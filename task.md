# Task Tracking — Tournament Leaderboard Platform

## Estado actual

**Última actualización**: Setup inicial del proyecto

## Progreso

| Tarea | Estado | Notas |
|-------|--------|-------|
| 1. Setup del proyecto | ✅ Completo | Scaffolding, config, archivos de instrucciones |
| 2. Schema DB y migraciones | ✅ Completo | |
| 3. Autenticación | ✅ Completo | |
| 4. Scoring Engine + PBT | ✅ Completo | |
| 5. Checkpoint — Scoring Engine | ✅ Completo | |
| 6. Dashboard — Torneos | ✅ Completo | Creación y configuración de torneos |
| 7. Dashboard — Participantes | ✅ Completo | Gestión de equipos y participantes |
| 8. Dashboard — Submissions | ✅ Completo | Envío de scores por participantes |
| 9. Dashboard — Aprobación | ✅ Completo | Moderación de capturas y scores |
| 10. Checkpoint — Dashboard | ✅ Completo | |
| 11. Leaderboard público + Realtime | ✅ Completo | Vista pública de resultados |
| 12. Personalización visual | ✅ Completo | Temas y branding del torneo |
| 13. Formatos especiales | ⏳ Pendiente | Kill Race, BR, Eliminación |
| 14. Tests de integración y smoke | ⏳ Pendiente | |
| 15. Checkpoint final | ⏳ Pendiente | |
| 16. Deploy a Vercel | ⏳ Pendiente | |

## Próxima tarea

**Tarea 2**: Schema de base de datos y migraciones Supabase
- 2.1 Crear enums y tablas principales
- 2.2 Configurar RLS y políticas de seguridad
- 2.3 Crear clientes Supabase y tipos TypeScript

## Notas

- El workspace usa Next.js 14 con App Router
- TypeScript strict mode habilitado
- Paleta eSports configurada en tailwind.config.ts
- Vitest configurado con jsdom para tests de componentes

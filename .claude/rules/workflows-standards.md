# Workflow & Development Standards

## Planificación

1. **Leer el spec antes de implementar**: revisar `requirements.md`, `design.md` y `tasks.md`
2. **Una tarea a la vez**: no implementar funcionalidad de tareas futuras
3. **Verificar dependencias**: asegurarse de que las tareas previas están completas
4. **Preguntar antes de asumir**: si hay ambigüedad en los requisitos, preguntar al usuario

## Ejecución

1. **Implementar primero, testear después**: escribir el código antes de ejecutar tests
2. **Tests antes de continuar**: no marcar una tarea como completa sin tests pasando
3. **Actualización de Progreso (OBLIGATORIO)**:
    - Actualizar `task.md` con el estado de la tarea (✅, ⌛, ⏳).
    - Registrar avances, decisiones técnicas y problemas resueltos en `DEVLOG.md`.
4. **Commits atómicos**: cada tarea = un conjunto coherente de cambios
5. **No romper lo que funciona**: verificar que los tests existentes siguen pasando

## Verificación antes de marcar completo

```bash
# 1. TypeScript — sin errores de tipos
npm run typecheck
# o
tsc --noEmit

# 2. Tests — todos pasando
npm test
# o
vitest --run

# 3. Lint — sin warnings críticos
npm run lint
```

## Property-Based Tests

- Usar `fast-check` con mínimo 100 iteraciones por propiedad
- Anotar cada test con: `// Feature: tournament-leaderboard-platform, Property N`
- Incluir `**Validates: Requirements X.Y**` en el comentario del test
- Los tests PBT van en el mismo archivo que los unit tests del módulo

## Testing Strategy

### Unit tests
- Casos concretos y edge cases
- Inputs inválidos deben ser rechazados
- Outputs esperados verificados exactamente

### Property-based tests
- Propiedades universales que deben cumplirse para cualquier input válido
- Usar generadores inteligentes que respeten el dominio del problema
- Documentar qué propiedad del spec se está verificando

### Integration tests
- Flujos completos con Supabase local
- Verificar latencias (< 5s para actualizaciones de leaderboard)
- Verificar RLS y políticas de seguridad

### Smoke tests
- Verificar que el leaderboard público es accesible sin auth
- Verificar que los archivos de instrucciones existen

## Checkpoints

En las tareas de checkpoint (5, 10, 15):
1. Ejecutar `vitest --run` y verificar que todos los tests pasan
2. Ejecutar `tsc --noEmit` y verificar que no hay errores de tipos
3. Preguntar al usuario si hay dudas antes de continuar

## Scoring Engine — Reglas especiales

El Scoring Engine (`src/lib/scoring/engine.ts`) es **completamente puro**:
- Sin imports de Supabase
- Sin side effects
- Sin llamadas a APIs externas
- Solo funciones que toman inputs y retornan outputs
- Testeable con vitest sin mocks

## Supabase — Convenciones

- **snake_case** en la DB, **camelCase** en TypeScript
- Mapear explícitamente entre los dos en los Server Actions
- Usar el cliente server para Server Actions y Server Components
- Usar el cliente browser solo en Client Components con Realtime

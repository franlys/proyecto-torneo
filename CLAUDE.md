# Tournament Leaderboard Platform — Project Identity

## Identidad del proyecto

Plataforma profesional de torneos eSports. El producto principal es la **vista pública del leaderboard** — accesible sin autenticación, optimizada para espectadores, con diseño premium de alta calidad.

No es un proyecto genérico. Es una plataforma de competencia seria con estética eSports de alto nivel.

## Stack tecnológico

- **Framework**: Next.js 14+ (App Router)
- **Lenguaje**: TypeScript strict — sin `any`, sin `as unknown`
- **Base de datos**: Supabase (PostgreSQL + Realtime + Storage + Auth)
- **Estilos**: Tailwind CSS + shadcn/ui — sin CSS modules, sin styled-components
- **Animaciones**: Framer Motion — micro-interacciones fluidas, no decorativas
- **Validación**: Zod — todos los inputs validados antes de cualquier operación
- **Forms**: React Hook Form + Zod resolvers
- **State**: Zustand solo para estado UI mínimo (no para datos del servidor)
- **Deploy**: Vercel

## Estándares visuales premium

### Lo que SÍ hacemos
- Paleta eSports: neon-cyan (#00F5FF), neon-purple (#8B5CF6), gold (#FFD700), dark-bg (#0A0A0F)
- Tipografía impactante: Orbitron/Rajdhani para headings, Inter para UI
- Animaciones de posición en el leaderboard (rank up/down con Framer Motion)
- Glassmorphism sutil en cards del dashboard
- Gradientes oscuros con acentos de color neón
- Micro-interacciones en hover/focus states

### Anti-patterns a evitar (AI-slop)
- ❌ Diseños genéricos de "admin dashboard" con sidebar azul corporativo
- ❌ Colores pastel o paletas "Material Design" por defecto
- ❌ Componentes sin animaciones ni transiciones
- ❌ Tablas HTML sin estilos personalizados
- ❌ Formularios con labels grises y borders grises
- ❌ Botones con `bg-blue-500` sin contexto de marca
- ❌ Layouts centrados con `max-w-sm` para todo
- ❌ Iconos de emoji como decoración principal

## Arquitectura

Ver `.claude/rules/architecture-state.md` para reglas detalladas.

**Resumen**:
- Server Components para carga inicial y SEO
- Client Components solo para Realtime/animaciones/interactividad
- Server Actions para todas las mutaciones
- Zustand solo para estado UI mínimo (modales, tabs, etc.)

## Código

Ver `.claude/rules/code-style.md` para estándares detallados.

## Documentación de Progreso

Es **OBLIGATORIO** mantener actualizados los siguientes archivos durante el desarrollo:
- `task.md`: Seguimiento del estado de las tareas (✅, ⌛, ⏳).
- `DEVLOG.md`: Bitácora de avances, decisiones técnicas y contexto de resolución de problemas.

## Workflow

Ver `.claude/rules/workflows-standards.md` para el proceso detallado de desarrollo y estándares de actualización de progreso.

# Checklist: Ensanchado, Rediseño de Wallet, Rework de Rankings y Emojis

- [x] Perfil: Resolver espacio vacío lateral
  - [x] Cambiar `max-w-3xl` por `max-w-7xl px-4 md:px-8 mx-auto` en `src/app/(dashboard)/profile/page.tsx`
- [x] Wallet: Rediseño Premium
  - [x] Importar `Coins` y otros iconos necesarios en `WalletClient.tsx`
  - [x] Rediseñar la tarjeta de balance para emular una tarjeta de crédito virtual premium con degradados
  - [x] Unificar botones, inputs y estados visuales en la Wallet
  - [x] Reemplazar emojis por iconos tipo logo
- [x] Rankings: Modal de Detalles tipo Expediente
  - [x] Modificar el modal de detalles de jugador en `RankingsClient.tsx` para mostrar la cuadrícula de 6 estadísticas
  - [x] Añadir sección de historial de torneos con badges de puesto sin emojis
  - [x] Unificar comportamiento para jugadores nacionales y de comunidad
- [x] Purga de Emojis a Iconos vectoriales
  - [x] Cambiar emojis en `DashboardShell.tsx` (🪙, 👑, 👤, ⚡) por iconos Lucide
  - [x] Cambiar emojis en `ProfileStatsClient.tsx` (🪙, 👑, 👤, ⚡, 🎖️) por iconos Lucide
  - [x] Cambiar emojis en `RankingsClient.tsx` (👑, 🥈, 🥉) por iconos Lucide o textos estilizados
- [x] Verificación
  - [x] Ejecutar `npm run typecheck` para comprobar compatibilidad

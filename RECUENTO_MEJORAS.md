# 🛡️ Recuento de Mejoras y Estabilización del Proyecto

Este documento resume todas las intervenciones técnicas realizadas para corregir errores críticos y mejorar la experiencia visual de la plataforma de torneos.

---

## 1. Infraestructura y Seguridad (Backend)

### 📂 Almacenamiento (Supabase Storage)
- **Problema**: Error `400 Bad Request` al subir imágenes y falta de acceso público.
- **Solución**: Se configuró el bucket `evidences` y se crearon políticas de RLS para permitir:
  - `INSERT` para roles `anon` y `authenticated` (participantes).
  - `SELECT` público para que los logos se vean en la tabla de posiciones.

### 🗄️ Base de Datos (PostgreSQL)
- **Corrección de Esquema**: Se añadió la columna `avatar_url` a la tabla `participants` que faltaba en el sistema, permitiendo fotos de perfil individuales.
- **Permisos de Tabla (RLS)**: Se habilitaron políticas de seguridad en `evidence_files` para que los registros de metadata (quién subió qué) se guarden correctamente sin errores de violación de política.

---

## 2. Estabilidad de Frontend (React/Next.js)

### 💧 Solución de Errores de Hidratación (#425, #418, #423)
- **Problema**: El servidor y el navegador no coincidían al renderizar animaciones y gráficos, causando errores en la consola y parpadeos.
- **Solución**: Se implementó el patrón `isMounted` en:
  - `NumberTicker`: Las animaciones de puntos esperan a que la página cargue.
  - `TeamDetails`: Los gráficos de Recharts se renderizan solo en el cliente.
  - `MatchRecap`: Los resúmenes de partidas son ahora 100% estables.
  - `LeaderboardClient`: Se sincronizó el `host` (URL del sitio) para que los reproductores de Twitch/Kick no generen discrepancias.

---

## 3. Diseño y UI/UX (Cinematografía)

### 🎬 Video de Fondo y Expansión
- **Corrección Visual**: Se eliminaron errores de clase CSS (`w-all`) que cortaban el video.
- **Root Level Background**: Se movió el video a la raíz del sitio para que ocupe el **100% del Viewport**, ignorando los límites de las tablas.
- **Visibilidad**: Se hicieron los contenedores principales transparentes para que el video sea el protagonista y se suavizaron los gradientes oscuros.
- **Bucle Infinito**: Se reforzaron los parámetros de YouTube y HTML5 para que el video se repita infinitamente sin detenerse.

### 📐 Centrado y Layout
- **Balance**: Se aplicó un centrado vertical dinámico (`min-h-[90vh] flex justify-center`) para que el contenido de los torneos pequeños aparezca equilibrado en el centro de la pantalla.

---

## 4. Integración con ArenaCrypto — Revenue Share

- **2026-04-15**: Tabla `revenue_reports` — almacena comisiones recibidas de ArenaCrypto por torneos con apuestas.
- **2026-04-15**: `POST /api/revenue-report` — endpoint receptor de webhook, valida `x-ac-secret`, registra comisión.
- **2026-04-15**: Variable `AC_WEBHOOK_SECRET` configurada en Vercel de Proyecto-Torneos.
- **Pendiente**: Panel de ingresos en dashboard admin para visualizar `revenue_reports`.

---

## 5. Control de Match Point (WSOW) y Penalizaciones Manuales

### 🏆 Flujo de Validación de Match Point (Sin Auto-Cierre)
- **Cambio de Flujo**: Se deshabilitó el cierre automático del torneo a `'finished'` cuando un equipo en Match Point gana la última partida. Esto permite al staff revisar la legitimidad de la victoria.
- **Bloqueo de Siguiente Partida**: Mientras haya un ganador de Match Point pendiente de validación por parte del administrador, se bloquea la creación de nuevas partidas (tanto en el botón del panel del administrador como en la acción del servidor `addDynamicMatch`).
- **Alerta Administrativa**: Se incorporó una tarjeta de alerta amarilla prominente en el panel de control del torneo detallando que la victoria está bajo revisión, permitiendo al administrador finalizar el torneo de forma manual (subiendo la foto de gloria) o revisar evidencias para sancionar al equipo infractor.

### ⚠️ Sistema de Penalizaciones y Sanciones
- **Opciones de Sanción**: Se implementó una opción en el modal de edición de evidencias de partida (`SubmissionsManager.tsx`) para sancionar equipos. Las penalizaciones son:
  - **Ninguna (Puntos completos)**.
  - **Mitad de puntos (`half_points`)**: El puntaje total de la partida (kills + posición) se divide a la mitad (x0.5).
  - **Solo Kills sin multiplicador (`kills_only`)**: Se anulan los puntos o multiplicador de posición, sumando únicamente las kills base.
- **Persistencia**: Se almacena estructuradamente en el campo `ai_data` como `manual_penalty: 'half_points' | 'kills_only' | null`, persistiendo los datos sin requerir nuevas migraciones de base de datos.
- **Visualización y Visual Badges**: Se renderizan etiquetas rojas/naranjas en la tabla de evidencias (`⚠️ Sanción: 50% Pts` o `⚠️ Sanción: Solo Kills`) para identificar rápidamente a los equipos sancionados.

### 🎖️ Insignias de Match Point Permanentes
- **Persistencia Visual**: Se refactorizó la visualización del leaderboard público (`LeaderboardClient.tsx`) para mostrar la insignia `🎯 MATCH POINT` (y `🎯 MP` en móvil) a cualquier equipo elegible por puntos, independientemente de si el torneo está activo o finalizado, manteniendo el historial visual en el ranking.

---

## 6. Automatización de Apuestas, Colapsabilidad y Visualización de MVP (05-08-2026)

### 💰 Cierre Automático de Partidas y Liquidación de Apuestas
- **Auto-cierre**: Al presionar "Finalizar Torneo", el sistema actualiza automáticamente el estado de todas las partidas restantes a completadas (`is_completed = true, is_active = false`) y las sincroniza con ArenaCrypto.
- **Resolución Inmediata**: Las apuestas de encuentros que sí se jugaron se liquidan en base a los standings, distribuyendo las K-Coins inmediatamente.
- **Cancelación y Reembolso**: Los mercados de apuestas correspondientes a partidas futuras/no disputadas (por ejemplo, si el torneo termina en la partida 3 por Match Point pero había 5 planificadas) se cancelan y reembolsan en su totalidad a los usuarios de manera automática, liberando sus fondos.

### 👑 Coronación y Visualización del MVP
- **Cómputo Automático**: Si el administrador finaliza el torneo sin especificar un ID de MVP, el backend realiza un recuento atómico de las bajas de todas las partidas aprobadas y asigna el premio de K-Coins y las notificaciones al jugador con mayor puntaje (Top Fragger).
- **Badge Distintivo**: Se añadió un badge interactivo y parpadeante de `👑 MVP` junto al nombre del jugador coronado tanto en la tabla principal como en la vista de tarjetas en el Leaderboard público.
- **Badge de Torneo Finalizado**: Para torneos en estado `'finished'`, se reemplazó el cartel de fecha de inicio por un badge con el texto `🏆 Torneo Finalizado` en color esmeralda, evitando confusiones sobre fechas de inicio pasadas.

### 🛡️ Sanciones desde el Visor de Evidencias
- **Integración Directa**: Se añadió el selector de penalizaciones manuales (`Ninguna`, `Mitad de puntos`, `Solo Kills`) dentro de la interfaz sidebar del visor de imágenes (`DraggableEvidenceModal.tsx`). Esto permite al staff aplicar una sanción de forma inmediata mientras valida la imagen sin necesidad de abrir otro modal de edición.

### 📂 Colapsabilidad de Encuentros
- **Gestión Cómoda**: Se incorporó un sistema de colapso y despliegue por encuentro en la pestaña "Evidencias" (`SubmissionsManager.tsx`). Esto permite contraer las partidas anteriores ya validadas y centrar la atención solo en la partida activa.

### 👑 Gestión de Membresía VIP y Colaboradores
- **Acceso Directo para Administradores**: Se modificó la vista de la membresía ([SubscriptionClient.tsx](file:///C:/Users/elmae/Proyecto-torneos/src/app/(dashboard)/subscription/SubscriptionClient.tsx)) para detectar si el usuario logueado posee rol `SUPER_ADMIN` o `ADMIN`. De ser así, se le otorga **acceso VIP gratuito e ilimitado** de por vida, ocultando el grid de pagos de PayPal y mostrando un panel con todos sus beneficios activos.
- **Límite Ampliado de Colaboradores (Staff)**: Se mejoró la oferta de la membresía para streamers. Ahora, los streamers que posean una cuenta Free tienen un límite de **2 colaboradores**, mientras que los streamers con membresía **VIP Activa** disfrutan de un límite ampliado de hasta **5 colaboradores** de soporte en [streamer-staff.ts](file:///C:/Users/elmae/Proyecto-torneos/src/lib/actions/streamer-staff.ts).
- **Nuevos Beneficios en la Oferta**: Se actualizaron y enriquecieron visualmente las tarjetas de la membresía detallando el beneficio del incremento de colaboradores (máx. 5) y la opción de personalización avanzada de patrocinadores en la ficha del torneo.
- **Pago de VIP con K-Coins**: Se creó una acción segura en el servidor ([subscription-coins.ts](file:///C:/Users/elmae/Proyecto-torneos/src/lib/actions/subscription-coins.ts)) y se rediseñó el modal de Checkout para ofrecer pestañas de pago (Tarjeta/PayPal y K-Coins). Los usuarios pueden adquirir el pase VIP debitando K-Coins de su billetera a la tasa de cambio vigente, con registros de transacción inmediatos.
- **Restricción de Acceso por Rol**: Se restringió la visibilidad y acceso a la membresía VIP únicamente para los roles `STREAMER`, `SUPER_ADMIN` y `ADMIN`. Para los usuarios con rol `USER` (jugadores o staff colaboradores), el enlace de la barra lateral se oculta y la ruta `/subscription` muestra una vista informativa premium explicando por qué está reservada exclusivamente para organizadores y ofreciendo contactar a soporte para solicitar el rol de Streamer.

---

## 🚀 Estado Actual
- **Base de Datos**: Consistente y segura.
- **Storage**: Operativo para logos y evidencias.
- **UI**: Fluida, sin errores de consola, con vistas colapsables limpias e indicación visual de MVP.
- **Apuestas y MVP**: Resolución y liquidación automatizadas tanto por encuentro como por finalización de torneo (incluyendo cancelaciones y reembolsos).
- **Match Point & Penalizaciones**: Totalmente operativos y probados bajo vitest, con alertas dinámicas autolimitadas al estado activo del torneo.

> [!IMPORTANT]
> Los scripts finales de permisos están en la carpeta `supabase/migrations`. Si el servidor no los aplica solo, asegúrate de ejecutarlos en el Editor SQL de tu panel de Supabase.

---
*Documentación generada el 05-08-2026 por Antigravity AI.*

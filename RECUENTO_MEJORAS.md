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

## 🚀 Estado Actual
- **Base de Datos**: Consistente y segura.
- **Storage**: Operativo para logos y evidencias.
- **UI**: Fluida, sin errores de consola y visualmente impactante.
- **Match Point & Penalizaciones**: Totalmente operativos y probados bajo vitest.

> [!IMPORTANT]
> Los scripts finales de permisos están en la carpeta `supabase/migrations`. Si el servidor no los aplica solo, asegúrate de ejecutarlos en el Editor SQL de tu panel de Supabase.

---
*Documentación generada el 01-08-2026 por Antigravity AI.*

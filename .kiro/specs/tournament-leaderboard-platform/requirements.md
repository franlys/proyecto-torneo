# Requirements Document

## Introduction

Plataforma web profesional para la gestión y visualización de torneos competitivos. El sistema permite a creadores de torneos configurar competencias con múltiples modalidades (individual, duos, tríos, cuartetos), gestionar participantes, y publicar tablas de posiciones en tiempo real con métricas personalizables como Kill Rate, Pot Tops y VIP. Los participantes pueden registrar sus kills con evidencias adjuntas, y el público puede consultar las clasificaciones a través de una tabla pública completamente personalizable.

## Glossary

- **Tournament_Creator**: Usuario con rol de administrador que crea y gestiona un torneo.
- **Participant**: Jugador o equipo registrado en un torneo por el Tournament_Creator.
- **Team**: Agrupación de participantes según la modalidad (individual=1, duos=2, tríos=3, cuartetos=4).
- **Leaderboard**: Tabla de posiciones pública que muestra clasificaciones y métricas de un torneo.
- **Kill**: Eliminación registrada por un participante durante el torneo, acompañada de evidencia.
- **Evidence**: Archivo multimedia (imagen o video) adjunto a un registro de kill como prueba.
- **Kill_Rate**: Métrica calculada como el promedio de kills por partida del equipo.
- **Pot_Top**: Métrica que registra las veces que un equipo ha terminado en el top de una partida.
- **VIP**: Métrica de puntuación especial asignada manualmente o por criterios configurables por el Tournament_Creator.
- **Scoring_Rule**: Regla de puntuación definida por el Tournament_Creator que determina cómo se calculan los puntos.
- **Tournament_Mode**: Modalidad del torneo según tamaño de equipo (individual, duos, tríos, cuartetos).
- **Competition_Format**: Formato de competencia que define la estructura del torneo (Battle_Royale_Clasico, Kill_Race, Custom_Rooms, Eliminacion_Directa, Fase_de_Grupos).
- **Placement_Points**: Puntos otorgados a un equipo según su posición final en una partida, definidos en la tabla de puntos por posición configurada por el Tournament_Creator.
- **Kill_Points**: Puntos otorgados por cada kill registrada y aprobada, configurables por el Tournament_Creator.
- **Tiebreaker**: Criterio de desempate aplicado cuando dos o más equipos tienen el mismo puntaje total, evaluado en orden de prioridad.
- **Bracket**: Estructura de eliminación directa donde los equipos se enfrentan en rondas sucesivas (cuartos, semifinal, final) y son eliminados al perder.
- **Group_Stage**: Fase de grupos donde los equipos se dividen en grupos (A, B, C…) y compiten entre sí; los mejores clasificados de cada grupo avanzan a la siguiente ronda.
- **Tournament_Level**: Nivel de competencia del torneo, ya sea "casual" (1–3 partidas, reglas simples) o "profesional" (6–12 partidas, reglamento oficial, verificación de evidencias obligatoria).
- **Public_View**: Vista pública de la tabla de posiciones accesible sin autenticación.
- **Submission**: Registro de kills con evidencia enviado por un participante o capitán de equipo, asociado a una partida específica.
- **Match**: Partida individual dentro de un torneo, identificada por un número o nombre único.
- **Team_Captain**: Miembro designado de un equipo en modalidades de equipo (duos, tríos, cuartetos) con permisos exclusivos para registrar Submissions en nombre del equipo.

---

## Requirements

### Requirement 1: Creación y configuración de torneos

**User Story:** As a Tournament_Creator, I want to create and configure a tournament with custom rules, modalities, and scoring tables, so that I can manage competitions with specific formats and scoring criteria.

#### Acceptance Criteria

1. THE Tournament_Creator SHALL be able to create a tournament by providing a name, description, start date, end date, Tournament_Mode, Competition_Format, Tournament_Level, and total number of Matches.
2. WHEN a tournament is created, THE Platform SHALL assign a unique identifier and a shareable public URL to the tournament.
3. THE Tournament_Creator SHALL be able to define at least one Scoring_Rule specifying the Kill_Points value per kill and a Placement_Points table that assigns a point value to each finishing position.
4. WHEN a Tournament_Mode is selected, THE Platform SHALL enforce team size constraints (individual=1, duos=2, tríos=3, cuartetos=4).
5. THE Tournament_Creator SHALL be able to enable or disable each metric (Kill_Rate, Pot_Top, VIP) independently per tournament.
6. WHEN a tournament is saved, THE Platform SHALL validate that at least one Scoring_Rule is defined, that the Placement_Points table contains an entry for every finishing position from 1 to the maximum number of Teams, and that the total number of Matches is a positive integer before activating the tournament.
7. THE Tournament_Creator SHALL be able to update tournament configuration while the tournament status is "draft".
8. IF the Tournament_Creator attempts to modify configuration after the tournament status is "active", THEN THE Platform SHALL reject the modification and return a descriptive error message.
9. WHEN the Tournament_Level is set to "profesional", THE Platform SHALL require Evidence verification for every Submission before approval and SHALL enforce a minimum of 6 Matches and a maximum of 12 Matches.
10. WHEN the Tournament_Level is set to "casual", THE Platform SHALL allow a maximum of 3 Matches and SHALL not require Evidence verification for Submissions.
11. THE Tournament_Creator SHALL be able to provide a free-text tournament rules description of up to 5000 characters that is displayed in the Public_View.
12. THE Tournament_Creator SHALL be able to enable a tiebreaker Match option that, when activated, allows the Platform to schedule an additional Match between tied Teams when Tiebreaker criteria 1 and 2 are insufficient to resolve the tie.

---

### Requirement 2: Gestión de participantes

**User Story:** As a Tournament_Creator, I want to register and manage participants in my tournament, so that I can control who competes and organize them into teams.

#### Acceptance Criteria

1. THE Tournament_Creator SHALL be able to add participants to a tournament by providing a display name and optional contact identifier.
2. WHEN the Tournament_Mode is duos, tríos, or cuartetos, THE Tournament_Creator SHALL be able to group participants into Teams of the required size.
3. IF a Tournament_Creator attempts to add a Team with fewer members than the Tournament_Mode requires, THEN THE Platform SHALL reject the operation and display a validation error.
4. THE Tournament_Creator SHALL be able to remove a participant from a tournament while the tournament status is "draft".
5. WHEN a participant is removed, THE Platform SHALL recalculate all affected Leaderboard positions automatically.
6. THE Tournament_Creator SHALL be able to assign a unique team name and optional avatar to each Team.
7. THE Platform SHALL prevent duplicate participant names within the same tournament.
8. WHEN the Tournament_Mode is duos, tríos, or cuartetos, THE Tournament_Creator SHALL designate exactly one Team member as the Team_Captain at the time of team registration.
9. IF the Tournament_Creator attempts to save a Team in a non-individual Tournament_Mode without a designated Team_Captain, THEN THE Platform SHALL reject the operation and display a validation error.

---

### Requirement 3: Registro de kills con evidencias

**User Story:** As a Participant, I want to submit my kills with supporting evidence, so that my performance is accurately recorded and verifiable.

#### Acceptance Criteria

1. WHEN a Participant submits a kill record, THE Submission_System SHALL require the Participant to specify the Match identifier and attach at least one Evidence file (image or video).
2. THE Submission_System SHALL accept Evidence files in JPEG, PNG, GIF, MP4, and MOV formats with a maximum size of 50 MB per file.
3. IF an Evidence file exceeds 50 MB or has an unsupported format, THEN THE Submission_System SHALL reject the upload and display a descriptive error message.
4. WHEN a Submission is received, THE Platform SHALL store the kill count, timestamp, Match identifier, and associated Evidence references.
5. THE Tournament_Creator SHALL be able to approve or reject any Submission within the tournament management interface.
6. WHEN a Submission is approved, THE Platform SHALL update the Leaderboard metrics for the corresponding Team within 5 seconds.
7. WHEN a Submission is rejected, THE Platform SHALL notify the Participant with the rejection reason provided by the Tournament_Creator.
8. THE Participant SHALL be able to view the status (pending, approved, rejected) of all their Submissions.
9. WHEN the Tournament_Mode is duos, tríos, or cuartetos, THE Submission_System SHALL only accept Submissions from the Team_Captain of the corresponding Team.
10. IF a non-captain Team member attempts to submit a kill record, Evidence, or Pot_Top in a non-individual Tournament_Mode, THEN THE Submission_System SHALL reject the operation and display a descriptive error message.
11. IF a Participant attempts to submit a kill record for a Match identifier that does not exist in the tournament configuration, THEN THE Submission_System SHALL reject the Submission and display a descriptive error message.

---

### Requirement 4: Cálculo automático de métricas y puntuación

**User Story:** As a Tournament_Creator, I want the platform to automatically calculate scores and metrics using kills and placement, so that the leaderboard reflects accurate standings without manual intervention.

#### Acceptance Criteria

1. WHEN a Submission is approved, THE Scoring_Engine SHALL recalculate the total points for the affected Team using the active Scoring_Rules.
2. THE Scoring_Engine SHALL calculate a Team's total points per Match as the sum of the Placement_Points corresponding to the Team's finishing position in that Match plus the Kill_Points value multiplied by the number of approved kills in that Match.
3. THE Scoring_Engine SHALL calculate a Team's tournament total points as the sum of the total points across all Matches played.
4. THE Scoring_Engine SHALL calculate Kill_Rate as the total approved kills divided by the total number of Matches configured for the tournament.
5. THE Scoring_Engine SHALL calculate Pot_Top count as the total number of approved Pot_Top Submissions for the Team.
6. WHEN the Tournament_Creator assigns a VIP score to a Team, THE Scoring_Engine SHALL include the VIP value in the total point calculation.
7. THE Scoring_Engine SHALL rank Teams on the Leaderboard in descending order of tournament total points.
8. WHEN two or more Teams have identical tournament total points, THE Scoring_Engine SHALL apply Tiebreaker criteria in the following order: first, the Team with the greater total kills across all Matches ranks higher; second, if total kills are also equal, the Team with the better finishing position in the most recently completed Match ranks higher.
9. WHEN two or more Teams remain tied after applying Tiebreaker criteria 1 and 2, and the tiebreaker Match option is enabled, THE Scoring_Engine SHALL mark the tie as unresolved and notify the Tournament_Creator to schedule a tiebreaker Match.
10. THE Scoring_Engine SHALL recalculate all rankings after every approved or rejected Submission.
11. FOR ALL valid Scoring_Rule configurations, THE Scoring_Engine SHALL produce consistent rankings regardless of the order in which Submissions are approved.

---

### Requirement 5: Tabla de posiciones pública

**User Story:** As a public viewer, I want to see a real-time leaderboard for any tournament including its rules and scoring system, so that I can follow the competition standings and understand how points are awarded without needing an account.

#### Acceptance Criteria

1. THE Leaderboard SHALL be accessible via the tournament's public URL without requiring authentication.
2. WHEN a viewer accesses the Public_View, THE Leaderboard SHALL display current standings including team position, team name, tournament total points, Kill_Rate, Pot_Top count, and VIP score.
3. THE Leaderboard SHALL reflect approved Submissions within 10 seconds of approval.
4. WHILE a tournament is active, THE Leaderboard SHALL automatically refresh standings every 30 seconds without requiring a manual page reload.
5. THE Tournament_Creator SHALL be able to configure which metrics are visible in the Public_View.
6. THE Tournament_Creator SHALL be able to customize the Leaderboard visual theme including primary color, background, and font selection from a predefined set of options.
7. WHERE a custom theme is configured, THE Leaderboard SHALL apply the theme consistently across all Public_View elements.
8. THE Leaderboard SHALL display a tournament status indicator (upcoming, active, finished) at all times.
9. THE Leaderboard SHALL display a scoring information section showing the Placement_Points table (points per finishing position), the Kill_Points value per kill, and the Competition_Format of the tournament.
10. THE Leaderboard SHALL display the tournament rules text provided by the Tournament_Creator in a dedicated visible section of the Public_View.
11. THE Leaderboard SHALL display the total number of Matches configured for the tournament and the number of Matches already completed.
12. WHEN the Competition_Format is Eliminacion_Directa, THE Leaderboard SHALL display the Bracket structure showing current round, matchups, and advancement status for each Team.

---

### Requirement 6: Personalización visual de la tabla pública

**User Story:** As a Tournament_Creator, I want to fully customize the visual appearance of the public leaderboard, so that it matches my tournament's branding and provides a premium viewer experience.

#### Acceptance Criteria

1. THE Tournament_Creator SHALL be able to upload a tournament logo displayed in the Public_View header.
2. THE Tournament_Creator SHALL be able to select a color palette from at least 5 predefined professional themes.
3. THE Tournament_Creator SHALL be able to configure a custom banner image for the Public_View.
4. WHEN a custom logo or banner is uploaded, THE Platform SHALL accept files in JPEG, PNG, and SVG formats with a maximum size of 5 MB.
5. IF an uploaded asset exceeds 5 MB or has an unsupported format, THEN THE Platform SHALL reject the upload and display a descriptive error message.
6. THE Tournament_Creator SHALL be able to reorder the columns displayed in the Leaderboard table via drag-and-drop.
7. THE Tournament_Creator SHALL be able to toggle the visibility of each metric column in the Public_View independently.
8. WHEN customization settings are saved, THE Platform SHALL apply changes to the Public_View within 5 seconds.

---

### Requirement 7: Autenticación y roles

**User Story:** As a Tournament_Creator, I want a secure authentication system, so that only authorized users can manage tournaments and submissions.

#### Acceptance Criteria

1. THE Auth_System SHALL allow users to register with an email address and password.
2. WHEN a user registers, THE Auth_System SHALL send a verification email to the provided address before activating the account.
3. THE Auth_System SHALL allow registered users to authenticate using email and password.
4. IF a user provides incorrect credentials 5 consecutive times, THEN THE Auth_System SHALL lock the account for 15 minutes and notify the user via email.
5. THE Auth_System SHALL issue a session token with a maximum validity of 24 hours.
6. WHEN a session token expires, THE Platform SHALL redirect the user to the login page.
7. THE Platform SHALL enforce role-based access so that only the Tournament_Creator of a tournament can modify its configuration, participants, and Submissions.
8. THE Auth_System SHALL allow users to reset their password via a time-limited link sent to their registered email address.

---

### Requirement 9: Modalidades de formato de competencia

**User Story:** As a Tournament_Creator, I want to select a Competition_Format for my tournament, so that the platform enforces the correct structure, scoring logic, and advancement rules for each type of competition.

#### Acceptance Criteria

1. THE Tournament_Creator SHALL be able to select one Competition_Format when creating a tournament from the following options: Battle_Royale_Clasico, Kill_Race, Custom_Rooms, Eliminacion_Directa, and Fase_de_Grupos.
2. WHEN the Competition_Format is Battle_Royale_Clasico, THE Scoring_Engine SHALL calculate standings using the cumulative sum of Placement_Points and Kill_Points across all Matches.
3. WHEN the Competition_Format is Kill_Race, THE Scoring_Engine SHALL rank Teams by total approved kills within the configured time limit, and SHALL treat Placement_Points as zero for all positions.
4. WHEN the Competition_Format is Kill_Race, THE Tournament_Creator SHALL be required to specify a time limit in minutes for the Kill_Race session.
5. WHEN the Competition_Format is Custom_Rooms, THE Scoring_Engine SHALL calculate standings using the cumulative sum of Placement_Points and Kill_Points across all configured rounds.
6. WHEN the Competition_Format is Eliminacion_Directa, THE Platform SHALL generate a Bracket structure based on the number of registered Teams and SHALL advance the winning Team of each matchup to the next round.
7. WHEN the Competition_Format is Eliminacion_Directa and a Team loses a matchup, THE Platform SHALL mark the Team as eliminated and exclude it from subsequent rounds.
8. WHEN the Competition_Format is Fase_de_Grupos, THE Tournament_Creator SHALL be able to define the number of groups and assign Teams to each group before the tournament starts.
9. WHEN the Competition_Format is Fase_de_Grupos, THE Scoring_Engine SHALL calculate intra-group standings using cumulative Placement_Points and Kill_Points, and SHALL advance the top-ranked Teams from each group to the next phase according to the advancement rules configured by the Tournament_Creator.
10. IF the Tournament_Creator attempts to activate a tournament with Competition_Format Eliminacion_Directa and the number of registered Teams is not a power of 2, THEN THE Platform SHALL display a warning and offer to add bye slots to complete the Bracket.
11. WHEN the Competition_Format changes, THE Platform SHALL reset all existing Match results and Leaderboard data and notify the Tournament_Creator that reconfiguration is required.

---

### Requirement 8: Archivos de instrucciones y configuración del proyecto

**User Story:** As a developer, I want standardized project instruction files and configuration documents, so that the codebase maintains consistent architecture, code style, and workflow standards throughout development.

#### Acceptance Criteria

1. THE Project SHALL include a CLAUDE.md file at the repository root defining the project identity, visual premium standards, and anti-AI-slop guidelines.
2. THE Project SHALL include a CLAUDE.local.md file at the repository root documenting local environment notes and developer-specific configuration.
3. THE Project SHALL include a .claude/rules/architecture-state.md file defining technical architecture rules and state management patterns.
4. THE Project SHALL include a .claude/rules/code-style.md file defining TypeScript, React, and CSS coding standards.
5. THE Project SHALL include a .claude/rules/workflows-standards.md file defining planning, execution, and verification workflow standards.
6. THE Project SHALL include a task.md file at the repository root tracking pending tasks and current progress.
7. THE Project SHALL include a SKILLS_MASTER.md file documenting the active skill profiles: frontend-design, ui-ux-pro-max, emilkowalski-design, vercel-react-best-practices, vercel-composition-patterns, and deploy-to-vercel.
8. WHEN any instruction file is created or updated, THE Project SHALL maintain consistency between CLAUDE.md guidelines and the implementation patterns used in the codebase.

# Code Style Standards

## TypeScript

- **Strict mode siempre**: `"strict": true` en tsconfig.json
- **Sin `any`**: usar tipos explícitos o `unknown` con type guards
- **Sin `as` innecesarios**: si necesitas cast, algo está mal en el diseño
- **Tipos explícitos en funciones**: siempre declarar tipos de parámetros y retorno
- **Interfaces para objetos de datos**, `type` para unions y aliases

```typescript
// ✅ Correcto
function calculatePoints(kills: number, killPoints: number): number {
  return kills * killPoints;
}

// ❌ Incorrecto
function calculatePoints(kills: any, killPoints: any) {
  return kills * killPoints;
}
```

## React Components

- **Componentes funcionales siempre** — sin class components
- **Props tipadas explícitamente** con interface o type
- **Nombres descriptivos**: `TournamentCard`, no `Card`; `useLeaderboard`, no `useData`
- **Un componente por archivo** (excepto componentes muy pequeños relacionados)
- **Export default** para el componente principal del archivo

```typescript
// ✅ Correcto
interface TournamentCardProps {
  tournament: Tournament;
  onSelect: (id: string) => void;
}

export default function TournamentCard({ tournament, onSelect }: TournamentCardProps) {
  return (
    <div onClick={() => onSelect(tournament.id)}>
      {tournament.name}
    </div>
  );
}
```

## Estilos

- **Tailwind CSS siempre** — sin CSS modules, sin styled-components, sin inline styles
- **`cn()` utility** para clases condicionales (de shadcn/ui)
- **Variantes con `cva`** para componentes con múltiples estados
- **Paleta eSports**: usar los colores definidos en `tailwind.config.ts`

```typescript
// ✅ Correcto
import { cn } from "@/lib/utils";

<div className={cn(
  "rounded-lg border border-dark-border bg-dark-card p-4",
  isActive && "border-neon-cyan",
  className
)}>
```

## Validación

- **Zod para todos los inputs** — formularios, Server Actions, API routes
- **`safeParse` en Server Actions** — nunca `parse` (lanza excepciones)
- **Mensajes de error descriptivos** en español para el usuario

```typescript
// ✅ Correcto
const CreateTournamentSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255),
  totalMatches: z.number().int().positive("Debe ser un número positivo"),
});

const result = CreateTournamentSchema.safeParse(input);
if (!result.success) {
  return { success: false, error: result.error.flatten() };
}
```

## Imports

- **Path aliases**: usar `@/` siempre, nunca rutas relativas largas (`../../../`)
- **Orden de imports**: React → Next.js → librerías externas → internos (`@/`)
- **Named exports** para utilities y hooks; **default export** para componentes y páginas

## Error Handling

- **Server Actions retornan `{ success: boolean, error?: string, data?: T }`**
- **Nunca `throw` en Server Actions** — capturar y retornar error
- **Errores de Supabase** mapeados a mensajes legibles en español
- **UI**: errores inline con `Alert` de shadcn/ui, no `alert()` del browser

## Naming Conventions

- **Archivos**: `kebab-case.ts` para utilities, `PascalCase.tsx` para componentes
- **Variables/funciones**: `camelCase`
- **Tipos/Interfaces**: `PascalCase`
- **Constantes**: `UPPER_SNAKE_CASE`
- **Hooks**: `use` prefix — `useLeaderboard`, `useTournament`
- **Server Actions**: verbos — `createTournament`, `approveSubmission`

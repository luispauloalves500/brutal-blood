# BRUTAL BLOOD

Jogo de luta 2D em HTML5 Canvas + TypeScript.

Versão **0.9.2** — recompensas genéricas (paleta, título, galeria, música, skin, arena, final).

## Modos

- **Arcade** — 5 ruas até o chefe, 1 continue
- **Versus** — local, 2 jogadores
- **Treino** — dummy, hitboxes, frame data, scaling, frame advantage
- **Survival** — ondas infinitas, recorde salvo
- **Torneio** — chave de 4, semi e final
- **História** — campanha de 4 capítulos (Kharon, Nyx, Draven)

## Progressão (v0.9)

Roster de **20 slots** (5×4). 6 iniciais; 14 desbloqueáveis. Kharon, Nyx, Draven e Vespera são jogáveis. Os demais slots são placeholders até o moveset existir (`playable` separado de `unlocked`).

Zerar Arcade com cada inicial, sem Continue, em Difícil+, Blood Finishes e lutas secretas liberam o elenco. Saves antigos migram sem perder progresso.

Recompensas genéricas (`RewardDef`): paleta, título, skin, arena, música, galeria, final. `granted` ≠ `usable` — skin/arena EM BREVE não entram na luta. Paletas extra só aparecem depois do unlock.

| Nome | Estilo |
|---|---|
| **Kharon** | Execução brutal — foice, pressão curta, antiaéreo |
| **Nyx** | Assassina móvel — mixups, dash, projéteis |
| **Draven** | Boxe sujo — rushdown, armadura, command grab |
| **Vespera** | Zoning — véus, altares, controle de espaço |

## Combate (v0.7)

Counter, Punish, Clash, Throw Tech, Command Grab, Wake-up (normal / quick / delay), wall splat, damage/stun/gravity scaling, combo limit.

Lista de golpes lê **os mesmos dados do motor** (startup/active/recovery, vantagem, tags).

## Controles (P1)

| Ação | Tecla |
|---|---|
| Mover | A / D |
| Pulo | W |
| Agachar | S |
| Leve | J |
| Pesado | K |
| Chute | U |
| Especial | I |
| Super | O |
| Defesa | L |
| Pausa | Esc |

P2 usa o numpad. Gamepad e remapeamento estão nas configurações.

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:8080`.

```bash
npm run typecheck
npm run build
```

O combate roda 100% no cliente (`localStorage`). Auth/Postgres/Better Auth na pasta `server/` e `src/lib/auth` são restos do scaffold — **não são usados pelo jogo**.

## Stack

- Vite + TanStack Start
- React + TypeScript (menus / HUD)
- Canvas 2D, simulação 60 FPS independente do refresh
- Áudio procedural, save no `localStorage`

## Status

Kharon usa sheets dedicados com 6–16 frames (idle/walk 8, Super e Blood Finish 16). No Treino, o painel **Clip P1** reproduz cada animação. Nyx/Draven/Vespera ainda usam group sheets.

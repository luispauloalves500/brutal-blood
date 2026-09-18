# BRUTAL BLOOD

Jogo de luta 2D em HTML5 Canvas + TypeScript.

Versão **0.5** — Kharon, Nyx e Draven. Arcade, Versus, Treino, Survival e Torneio.

## Modos

- **Arcade** — 5 ruas até o chefe, 1 continue
- **Versus** — local, 2 jogadores
- **Treino** — hitboxes, frame data, hitstop
- **Survival** — ondas infinitas, recorde salvo
- **Torneio** — chave de 4, semi e final
- **História** — em breve

## Lutadores

| Nome | Estilo |
|---|---|
| **Kharon** | Execução brutal — foice, pressão curta, antiaéreo |
| **Nyx** | Assassina móvel — mixups, dash, projéteis |
| **Draven** | Boxe sujo — rushdown, armadura, command grab |

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

## Stack

- Vite + TanStack Start
- React + TypeScript
- Canvas 2D (simulação 60 FPS)
- Áudio procedural, save no `localStorage`

## Status

Fase 1–3 fechadas. Fase 4 em curso: Draven e Torneio jogáveis. História e o resto do elenco (Vespera, Gorr, Shai, Brakk, Mora) ainda bloqueados.

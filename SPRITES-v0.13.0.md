# BRUTAL BLOOD v0.13.0 — auditoria dos 31 estados

Modos do `SpriteAnimator`: **DEDICATED**, **CLIP_FALLBACK** (reusa outro clip dedicado, com `reverseFrames` quando faz sentido), **GROUP_FALLBACK**, **CANVAS**.

Nenhum estado jogável ficou MISSING: se não há arquivo próprio, o fallback aponta para um clip dedicado do mesmo lutador (nunca arte de outro personagem).

## Resumo

| Lutador | DEDICATED | CLIP_FALLBACK | GROUP | MISSING |
|---|---:|---:|---:|---:|
| Kharon | 29 | 2 | 0 | 0 |
| Vespera | 31 | 0 | 0 | 0 |
| Nyx | 9 | 22 | 0 | 0 |
| Draven | 9 | 22 | 0 | 0 |
| Gorr | 9 | 22 | 0 | 0 |
| Shai | 8 | 23 | 0 | 0 |

## Dedicados nesta versão

- **Kharon / Vespera** — pipeline quase completo (Vespera cobre os 31 estados).
- **Nyx** — idle, walk, dash, jump, block, light, heavy, hit, hitHeavy
- **Draven** — idle, walk, jump, crouch, block, light, heavy, hit, hitHeavy
- **Gorr** — idle, walk, jump, block, light, heavy, super, hit, hitHeavy
- **Shai** — idle, walk, jump, block, light, heavy, hit, hitHeavy

`walkBack` reutiliza `walk` em reverse. `jumpStart`/`fall` reutilizam `jump`. `blockLow` reutiliza `block`. `finish1` cai no Super (ou heavy se o Super também for fallback). `finish2` cai no heavy, para não copiar a finish1.

## Identidade

- **Gorr**: cabelo longo, armadura, espada grande. Folhas novas de idle/walk/block/light/heavy/jump/hit/super substituíram o group sheet careca. Fallback Canvas segue a mesma lock.
- **Shai**: cabelo prateado, máscara, preto/vermelho.
- **Nyx**: silhueta sombria, energia violeta.
- **Draven**: boxer/rushdown.

## Propositalmente para a próxima versão

- Nyx/Draven/Gorr/Shai ainda não têm clips únicos de medium, chutes, specials 2/3, knockdown, wakeup, intro, vitória, taunt, counter, aerial, throw e as duas finishes.
- Algumas folhas antigas de group (Nyx idle 418², Draven idle 194×236, Shai jump 224×230) continuam no disco; o jogo as usa quando o clip é dedicado a esse arquivo. Não foram redesenhadas para não mudar o rosto.
- Warden e Nihl continuam stand-ins e **não** entram em `FIGHTER_CONTENT`.
- Arenas seguem Canvas procedural (8 palcos, sem hazards novos).

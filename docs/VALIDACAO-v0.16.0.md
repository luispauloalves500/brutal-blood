# Validação — BRUTAL BLOOD 0.16.0

Correções de combate, sem sprite novo.

- Alto erra em quem está agachado. Baixo e projétil baixo erram no ar.
- Defesa aceita agachar no meio do bloqueio.
- Facing travado em ataque, dash, hit, queda, wakeup, KO e vitória.
- Simulação: 6 lutadores × 8 arenas, 240 frames cada, sem NaN, sem ataque preso, sem projétil vazando.
- `npm test`, `npm run typecheck`, `npm run build`.

O que continua sem animação própria: chute pesado, aéreo, agarrão, especiais 2 e 3, contra-golpe, provocação, intro, vitória e finais únicos de Nyx, Draven, Gorr e Shai. Idle antigo da Nyx e idle irregular do Draven. Warden e Nihl continuam de fora.

# BRUTAL BLOOD v0.11.0 — Gorr & Shai

## Gorr — O Devorador
- Arquétipo: grappler/peso-pesado.
- 1280 HP, alta defesa e força, mobilidade baixa.
- Armadura em golpes pesados e investida.
- Command grab dedicado: `Abraço da Cova`.
- Projétil de chão: `Tremor de Correntes`.
- Super de agarrão: `Banquete Final`.
- 2 Blood Finishes, combos próprios e História com 4 capítulos.

## Shai — Olho Carmesim
- Arquétipo: zoner móvel.
- Alta velocidade, dash forte e vida menor.
- Projétil rápido: `Agulha Carmesim`.
- Reposicionamento ofensivo: `Passo Fantasma`.
- Controle alto/antiaéreo: `Lua Sangrenta`.
- Super de longo alcance: `Olho do Eclipse`.
- 2 Blood Finishes, combos próprios e História com 4 capítulos.

## Integração
- Os dois são `playable: true` e entram nos seis lutadores iniciais.
- Asset manifests e paletas próprias adicionados.
- Portraits e cinco group sheets WebP transparentes por personagem.
- Fallback procedural exclusivo para cada um caso um asset falhe.
- Dusk volta a exigir Arcade com Gorr; Nara exige Arcade com Shai.
- Testes de regressão: 15/15 aprovados com `npm run test:game`.

## Validação pendente do ambiente
O `npm ci` não concluiu no tempo disponível deste ambiente, então `typecheck`/`build:static` completos não foram executados aqui. Os imports TypeScript usados pelo runner e a validação de assets/combo passaram no teste de regressão.

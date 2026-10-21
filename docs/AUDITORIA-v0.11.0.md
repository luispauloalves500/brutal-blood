# Auditoria — BRUTAL BLOOD v0.11.0

## Entrega

A versão 0.11.0 transforma **Gorr** e **Shai** de slots `EM BREVE` em personagens jogáveis completos do ponto de vista de gameplay e progressão.

### Gorr
- Grappler/peso-pesado.
- Moveset próprio com normais, aéreo, 3 especiais, Super, throw, counter e taunt.
- `Abraço da Cova` usa `commandGrab` real do motor.
- `Investida Carniceira` usa armadura e avanço.
- `Tremor de Correntes` usa projétil/onda de chão.
- 2 Blood Finishes.
- História de 4 capítulos.
- Portrait e sprites WebP transparentes.

### Shai
- Zoner móvel.
- Moveset próprio com projéteis, dash ofensivo, antiaéreo e Super de longo alcance.
- 2 Blood Finishes.
- História de 4 capítulos.
- Portrait e sprites WebP transparentes.

## Roster

Os seis slots iniciais agora são realmente jogáveis:
1. Kharon
2. Nyx
3. Draven
4. Vespera
5. Gorr
6. Shai

`PLAYABLE_INITIAL_IDS` passa a conter os seis, portanto o desbloqueio que exige todos os iniciais volta a representar o roster inicial completo.

## Progressão

- Dusk (#11) volta a exigir Arcade concluído com Gorr.
- Nara (#12) volta a exigir Arcade concluído com Shai.
- Gorr e Shai participam de Arcade, Survival, Torneio, Versus, Treino e História.

## Assets

Cada novo lutador possui:
- `portrait`: 720×960 WebP.
- `idle.webp`: 5 frames.
- `walk.webp`: 5 frames.
- `attack.webp`: Gorr 6 / Shai 5 frames.
- `hurt.webp`: 4 frames.
- `jump.webp`: 4 frames.

Os group sheets funcionam como fallback visual para todos os estados do moveset. Clips dedicados por golpe podem ser adicionados depois sem mudar o gameplay.

## Testes

`npm run test:game`:
- **15/15 testes aprovados**.
- Inclui validação de Gorr/Shai como `playable`, campanhas de 4 capítulos, combos válidos e existência real dos assets exigidos pelo loader.

## Limitação do ambiente

O `npm ci` não concluiu dentro do tempo disponível, portanto o bundle estático da pasta `jogar/` não pôde ser regenerado nesta sessão. Os novos assets foram copiados para a pasta de distribuição, mas o bundle JavaScript existente em `jogar/assets/` continua sendo o bundle anterior até um novo `npm run build:static` ser executado em um ambiente com as dependências instaladas.

O código-fonte em `src/` é a versão v0.11.0 e foi validado pelo runner de regressão baseado em Node/TypeScript stripping.

# BRUTAL BLOOD v0.10.1 — correções aplicadas

## O que foi corrigido

1. **Compatibilidade do comando de teste de jogo**
   - `npm run test:game` agora usa `node --experimental-strip-types scripts/test-game.mjs`.
   - Isso evita a falha do Node 22+ ao executar o runner com arquivos TypeScript auxiliares.

2. **Progressão impossível no build atual**
   - As verificações de `arcadeClearAllInitials` agora usam os **iniciais jogáveis da build atual**.
   - Isso impede que desbloqueios dependam de Gorr/Shai antes de eles serem realmente jogáveis.

3. **Cadeias de desbloqueio ajustadas**
   - Slot 11 (`DUSK`): agora desbloqueia com 2 personagens diferentes no Arcade.
   - Slot 12 (`NARA`): agora desbloqueia com 5 Blood Finishes.
   - Slot 14 (`VARK`): descrição atualizada para refletir os iniciais jogáveis.
   - Slot 19 (`ASHEN`): requisito de `arcadeClearCount` reduzido para 4, tornando a condição alcançável no build atual.

4. **Peso dos sprites da Vespera**
   - Todos os WebP de `public/fighters/vespera/` foram recomprimidos com transparência preservada.
   - Tamanho total dos clips caiu de aproximadamente **4.59 MB** para **2.58 MB**.

## Observações

- Esta entrega **não redesenha** a Vespera do zero; ela mantém a arte atual e reduz o peso dos assets.
- Gorr e Shai continuam como **iniciais configurados, porém `EM BREVE`**, preservando a estrutura de 20 slots.

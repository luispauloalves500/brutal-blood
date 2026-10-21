# BRUTAL BLOOD — Sprite Audit v0.9.3

## O que foi corrigido

- Removido o fundo rosa/magenta opaco dos 46 WebPs de gameplay existentes.
- Mantido o formato WebP com canal alpha real.
- Preservados grid, número de células e identidade visual dos personagens.
- Não foram recortados os portraits (`public/fighters/*.webp`), porque são artes de seleção com cenário próprio, não sprite de gameplay.
- O `walk.webp` da Vespera foi identificado como sheet estruturalmente quebrado (partes do corpo distribuídas em células erradas). O jogo passa a usar temporariamente `idle.webp` como fallback de caminhada para evitar renderizar fragmentos.

## Estado por personagem

### Kharon
- É o personagem visualmente mais completo.
- Possui clips dedicados para a maior parte das ações.
- Super e Blood Finish têm sheets próprios.
- Fundo magenta removido de todos os clips.
- Próximo trabalho nele deve ser apenas polimento fino, não reconstrução do pipeline.

### Nyx
- Sprites atuais estão limpos e transparentes.
- Ainda usa group sheets (`idle`, `walk`, `attack`, `hurt`, `jump`).
- Precisa receber clips dedicados seguindo o padrão do Kharon.

### Draven
- Sprites atuais estão limpos e transparentes.
- Group sheets estão visualmente utilizáveis.
- Precisa receber clips dedicados seguindo o padrão do Kharon.

### Vespera
- `idle`, `attack`, `hurt` e `jump` foram limpos.
- `walk.webp` original está mal montado e não deve ser usado como animação final.
- Até o redraw, o manifest usa `idle.webp` como fallback para walk/walkBack.
- Deve ser a primeira personagem a receber um novo walk dedicado.

## Próxima ordem recomendada

1. Refazer `Vespera/walk` corretamente.
2. Produzir kit dedicado completo da Nyx.
3. Produzir kit dedicado completo do Draven.
4. Produzir kit dedicado completo da Vespera.
5. Depois revisar efeitos de golpes/projéteis e arenas.

## Regras para os próximos sprites

- fundo 100% transparente;
- WebP;
- células com dimensões idênticas dentro do mesmo sheet;
- pés/pivot consistentes;
- nenhuma parte da arma ou corpo cortada;
- uma única direção de arte, usando espelhamento horizontal no jogo;
- manter rosto, roupa, arma, proporções e paleta do personagem;
- dedicated clips somente entram em `availableClips` quando o arquivo realmente existir.


## v0.9.4 — Vespera integrada

- Vespera recebeu novo conjunto WebP com alpha para idle, walk, walkBack, dash, jump, crouch, light, heavy, special1, Super, Blood Finish 1/2, block, hit, knockdown, wakeup e taunt.
- jumpStart/fall são derivados do novo jump.
- Ações secundárias sem arte exclusiva ainda reutilizam clips da própria Vespera nova; nenhum fallback troca de volta para o modelo legado durante a luta.
- Grids foram padronizados em 192×192 por célula e declarados explicitamente no manifest.
- Frame maps de ataques principais foram sincronizados com startup/active/recovery.
- O material-fonte era uma prancha de apresentação; a remoção de fundo foi feita por matte/inpainting. Pequenos halos do efeito artístico podem permanecer e devem ser tratados como polimento visual, não como fundo opaco.

## v0.10.0 — preservação e validação

Nenhum sprite foi substituído nesta atualização. Foram validadas as referências dos quatro lutadores e renderizadas amostras pelo motor. Blood Finish agora seleciona o clip correspondente e avança sua animação. A câmera mudou; hurtboxes continuam independentes das imagens. As pendências de clips exclusivos acima permanecem.


## v0.11.0 — Gorr e Shai

- Gorr e Shai receberam portraits e cinco group sheets próprios: `idle.webp`, `walk.webp`, `attack.webp`, `hurt.webp` e `jump.webp`.
- Os sheets possuem alpha/transparência e layouts específicos registrados em `fighterSheets`.
- Nesta etapa eles usam group fallback para cobrir todos os estados de combate, como Nyx/Draven; clips dedicados podem ser produzidos depois sem alterar o moveset.
- Gorr: 5 frames idle, 5 walk, 6 attack, 4 hurt, 4 jump.
- Shai: 5 frames idle, 5 walk, 5 attack, 4 hurt, 4 jump.

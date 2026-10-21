# Auditoria e evolução — BRUTAL BLOOD 0.10.0

Base: BRUTAL-BLOOD-v0.9.4-vespera-integrada.zip. Referência: prompt inicial anexado. A engine, o elenco jogável, os sprites, os menus e os modos existentes foram aproveitados. Esta entrega não declara o prompt completo: ele descreve uma produção maior que o conteúdo disponível.

## Correções implementadas

1. Escape/Start agora alternam pausa sem avançar a simulação no frame da mudança; P2 também pode pausar pelo gamepad.
2. Perda de foco ou ocultação da aba pausa a partida, limpa entradas e impede salto no relógio ao voltar.
3. Reinício limpa pausa, temporizadores internos, comandos, projéteis, finalização e estado da IA; o cronômetro é restaurado.
4. Finalizações e resultados usam tempo da simulação. Sair da partida invalida callbacks; pausar interrompe a cinematografia.
5. Blood Finish utiliza o botão efetivamente pressionado, bloqueia repetição e seleciona/avança o clip correto de finish1/finish2.
6. HUD mostra os comandos das duas finalizações e atualiza energia mesmo sem mudança de vida.
7. Gamepad guarda as bordas dos botões até o próximo passo de simulação. Um botão não dispara várias vezes em frames de recuperação.
8. Dash consome o duplo toque uma vez; reset limpa direções antigas.
9. Controles não interceptam campos de edição e seletores. Falhas de vibração são tratadas.
10. Defesa agachada funciona segurando baixo+defesa; sua hurtbox acompanha o agachamento. Agarrões vencem guarda.
11. Invulnerabilidade não concede dano, energia ou cancelamento falso ao atacante.
12. Projéteis da IA passam pelo mesmo fluxo de áudio/combate. Jogador e IA soltam o projétil depois do startup; interrupção antes disso cancela o disparo.
13. Projéteis preservam os dados do golpe de origem, incluindo altura baixa, stun e classificação de Super.
14. IA ajusta aproximação fora do alcance, conserva a sequência enquanto espera a janela de cancelamento e considera combos avançados nos níveis altos.
15. Time Over compara proporção de vida para não favorecer automaticamente lutadores de HP máximo maior.
16. Treino recupera ambos os lutadores após KO. HP infinito regenera após a sequência, sem restaurar vida em um estado morto; energia infinita vale para ambos.
17. Estatísticas de P1 usam o combo causado ao oponente e só creditam Blood Finish se P1 for o finalizador. Tempo ativo é acumulado ao encerrar a instância.
18. Arcade respeita a dificuldade selecionada, em vez de ignorá-la em favor da tabela fixa.
19. Música volta a tocar na luta e não duplica seu temporizador ao confirmar novamente. Intensidade reage à vida baixa/round final; ocultar a aba reduz volume.
20. Carregamento de imagens possui limite de espera e remove listeners. Falha em imagem crítica chega diretamente à tela de erro/repetição.
21. Interface informa Canvas 2D corretamente; controles que prometiam forçar GPU/VSync sem implementar isso foram removidos da tela.
22. Touch depende de ponteiro primário touch, sem aparecer em PC apenas por estreitar a janela.

## Conteúdo e apresentação adicionados

- Campanha Vespera: quatro capítulos, adversários, arenas, introduções, falas de vitória e final próprios.
- Modo Desafios: acertar três golpes, defender três ataques, combo de três hits, especial e Super. Objetivos dependem de acertos reais; conclusão salva por lutador e exibida em Progresso.
- Fita do dummy: grava os comandos P2 por até 600 passos (10 segundos a 60 Hz), com parar/repetir em loop. É gravação de entradas; o resultado depende da posição e das colisões.
- Prisão Subterrânea e Cidade em Ruínas, selecionáveis nas listas de arenas. O elenco de cenários passa de seis para oito.
- Mais planos de cenário, luzes, partículas ambientais, detalhes de piso e câmera mais próxima. Geometria procedural; não foi gerada arte raster nova.
- Alto contraste, redução de flashes de tela e comandos simplificados configuráveis. Não equivale a todo o pacote de acessibilidade do prompt.
- Distribuição estática em `jogar/`, com caminhos relativos; HTML, CSS, JS e WebPs separados. Fonte original preservada.
- Inicializador Windows e servidor local Node sem dependências extras para jogar o compilado.

## Comparativo honesto com o prompt

| Área | Situação nesta entrega |
|---|---|
| Arquitetura modular e simulação fixa | Existentes, preservadas; correções de ciclo de vida |
| Menu, seleção, pause e lista de golpes | Existentes; melhorias pontuais |
| 12 lutadores originais completos | **Pendente: quatro jogáveis.** Os slots planejados não são lutadores concluídos |
| Sprites e animações exclusivos para toda ação | Parcial. Kharon/Vespera têm clips dedicados; Nyx/Draven ainda usam group sheets e fallbacks |
| Combos, frames, hitboxes, guardas e cancelamento | Implementados na base e corrigidos parcialmente; balanceamento competitivo ainda requer partidas humanas |
| IA em seis dificuldades | Presente e aprimorada; não possui aprendizagem/adaptação persistente ao jogador |
| Blood Finish 1/2 | Comandos e efeitos presentes; clips e tempo corrigidos. A coreografia ainda reutiliza efeitos entre personagens |
| Arcade e História | Arcade de cinco encontros; histórias dos quatro personagens. Sem cutscenes animadas completas |
| Boss/sub-boss únicos com fases | **Pendente.** Encontros finais ainda usam lutadores existentes; o arquivo boss.ts era apenas uma definição de tipos |
| Treino completo | HP/energia, hitboxes, informação de frames, histórico, reset, dummy e gravação disponíveis |
| Desafios | Adicionados cinco fundamentos, com conclusão local |
| Torneio e Survival | Preservados; chave de quatro no Torneio e o outro lado resolvido automaticamente |
| Oito cenários | Disponíveis, procedurais. Sem arte detalhada dedicada, público completo ou objetos destrutíveis |
| Loading por luta e cache | Existentes; validação de referências, cancelamento e timeout aprimorados |
| WebGL/WebGPU | **Pendente.** Renderização efetiva Canvas 2D; aceleração interna depende do navegador |
| Benchmark medido e redução adaptativa | **Pendente.** Sugestão atual usa capacidades do dispositivo; não é benchmark de FPS |
| Música/voz exclusivas por lutador | **Pendente.** Áudio procedural, agora com intensidade dinâmica; não há dublagem gravada |
| Remapeamento de controles | Teclado disponível. Remapeamento completo de botões do gamepad/deadzone/sensibilidade ainda pendente |
| Acessibilidade completa | Parcial. Faltam escala de UI, modos de daltonismo e pacote completo de legendas |
| Inventário, desbloqueios, perfil e galeria | Estrutura presente; várias recompensas e personagens permanecem EM BREVE |
| Multiplayer online | Não implementado; sem NFT/marketplace ativo, conforme escopo inicial |

## Validação realizada

- `npm run typecheck`: aprovado.
- `npm run test:game`: 14 testes de regressão aprovados, incluindo pausa, restart, KO no treino, Time Over, IA/projéteis, finalizações, gamepad, dash, gravação, história, desafios, invulnerabilidade, agarrão/guarda e referências de conteúdo.
- `npm run build:static`: aprovado; distribuição compilada com Vite.
- 76 referências de imagens carregadas/validadas entre os quatro lutadores; renderização direta de todos pelo motor com Canvas local e inspeção de imagem da arena.
- Teste visual interativo de navegador **não concluído**: navegador remoto não acessou o servidor local. Não foi comprovado um fluxo completo de menus, áudio real, desempenho em dispositivos ou gamepad físico.
- Não foram revalidados os serviços de autenticação/banco do scaffold, que ficam fora da distribuição estática e não são usados pelo combate.

## Prioridades restantes

1. Sessão de jogo real em PC/gamepad para validar sensação, áudio, balanceamento e transições completas.
2. Clips dedicados e consistentes para Nyx/Draven e revisão de poses/colisões dos quatro lutadores.
3. Boss original com ações e fases reais, seguido de novos lutadores completos até atingir o elenco do prompt.
4. Arte própria para as oito arenas, trilhas exclusivas e cinematografia distinta para cada finalização.
5. Configuração completa de gamepads, acessibilidade restante e benchmark medido.

# Validação — BRUTAL BLOOD 0.13.0

Comandos executados nesta versão:

```text
npm run test:game
npm run typecheck
npm run validate:assets
```

Resultado:

- 26 testes de regressão, 0 falhas
- `tsc --noEmit` limpo
- 114 WebP verificados, 0 erros, 0 avisos
- os 6 iniciais cobrem os 31 estados com DEDICATED ou CLIP_FALLBACK seguro
- Service Worker continua com `__APP_VERSION__` substituído no `dist/` por `0.13.0`

O que **não** foi reivindicado:

- clips dedicados para todos os 31 estados de Nyx/Draven/Gorr/Shai
- Warden/Nihl finais
- multiplayer, servidor ou autenticação
- redesign de menus estáveis

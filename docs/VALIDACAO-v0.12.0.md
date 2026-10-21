# Validação — BRUTAL BLOOD 0.12.0

## Executado neste ambiente

- `npm run test`: **16/16 testes de regressão aprovados**.
- `npm run validate:assets`: **91 WebP verificados, 0 erros, 0 avisos**.
- `npm ci --ignore-scripts --dry-run --offline`: package/lock compatíveis; 132 pacotes no grafo reduzido.
- `node --check` nos scripts de Service Worker, manifest offline, servidor local e validador: aprovado.
- `dist/` servido localmente em porta alternativa: `index.html` e `offline-manifest.json` responderam HTTP 200.
- Manifest offline detectou os 6 iniciais: Kharon, Nyx, Draven, Vespera, Gorr e Shai.

## Limitação do ambiente

A instalação real de dependências (`npm ci`) ultrapassou o tempo disponível neste ambiente, então o bundle Vite não foi recompilado localmente depois da reorganização de fontes. O `dist/` incluído preserva o último bundle funcional e recebeu a camada offline/PWA da 0.12.0; no GitHub, o workflow incluído executará `npm ci`, testes, typecheck e um build novo antes do deploy.

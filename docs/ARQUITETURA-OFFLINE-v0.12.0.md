# BRUTAL BLOOD 0.12.0 — arquitetura offline/GitHub Pages

## Objetivo

A 0.12.0 transforma o projeto em um jogo estático puro. O runtime não depende de API, autenticação, banco de dados ou servidor de aplicação.

## Build único

`vite.config.ts` usa `base: "./"` e gera `dist/`. Isso evita caminhos absolutos quebrados quando o jogo é publicado em `https://usuario.github.io/repositorio/`.

## Registro de lutadores

`src/game/content/registry.ts` combina `CharacterDef` + `CharacterAssetManifest` dos personagens realmente implementados. A tela de seleção continua usando os 20 slots de progressão, mas um slot só entra em luta se existir no registro jogável.

## Offline

`public/sw.js` instala um Service Worker no mesmo escopo do GitHub Pages. `scripts/generate-offline-manifest.mjs` separa os arquivos em:

- **core**: HTML, JS/CSS compilados, UI, manifest e portraits;
- **initial**: sprite sheets dos lutadores iniciais jogáveis;
- **optional**: conteúdo futuro que pode ser armazenado sob demanda.

O cache é versionado pela versão do `package.json` e caches antigos são removidos na ativação.

## Save

O save continua em `localStorage`, com migrations existentes. A escrita agora preserva uma cópia `brutal-blood-save-backup` do estado anterior para recuperação caso o JSON principal seja corrompido.

## Asset gate

`npm run validate:assets` valida antes do build:

- portraits dos personagens implementados;
- group sheets mínimos;
- arquivos declarados em `availableClips`;
- assinatura e dimensões de WebP;
- presença de alpha nos sprites de gameplay;
- budget de tamanho por asset.

## CI/CD

`.github/workflows/pages.yml` executa testes, typecheck e build antes de publicar. Um push inválido não deve substituir a versão funcional do Pages.

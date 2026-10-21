# BRUTAL BLOOD — estrutura 0.21.0

```text
brutal-blood/
├── .github/workflows/pages.yml
├── dist/
├── docs/
├── public/fighters/            # portraits + clips dedicados
├── scripts/validate-assets.mjs
├── src/game/assets/characters/ # manifests com availableClips
├── src/standalone.tsx
└── vite.config.ts              # SPA, base ./
```

## Regras

- Lutador só entra em `FIGHTER_CONTENT` com `CharacterDef` + manifest real.
- Clip dedicado só entra em `availableClips` quando o WebP existe.
- Fallback usa o mesmo lutador (CLIP_FALLBACK / GROUP_FALLBACK). Nunca arte de outro.
- Clip emprestado desenha a folha do doador, mas o quadro segue o `frameMap` / `reverseFrames` do estado pedido.
- Gorr: cabelo longo + armadura + montante. Nunca careca/sem camisa.
- `npm run validate:assets` falha se um estado jogável não tiver fallback seguro.

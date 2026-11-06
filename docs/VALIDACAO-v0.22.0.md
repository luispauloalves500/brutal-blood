# Validação — BRUTAL BLOOD 0.22.0

Combos `route: "cancel"` foram conferidos contra `cancelInto` para os seis jogáveis. Jab cancela em jab. Especiais de meter/setup listados nas fichas cancelam para o chase indicado. Aéreo, contra e punish de throw usam `link`/`setup` e não abrem cancel indiscriminado.

Buffer de input: 0,2 s. Janela de Blood Finish: 6 s; cena do finish ~2,15 s com `attackFrame` proporcional ao timing do golpe cinemático.

`SpriteAnimator.sampleFrame` faz blend entre células adjacentes — interpolação de render, não frames de arte novos. Nyx/Draven/Gorr/Shai seguem com sheets de 4 células nos finais; Kharon/Vespera mantêm 16.

Oito arenas procedurais com props distintos; sem `public/stages/` de bitmap.

Gorr permanece berserker de cabelo longo, armadura e montante. Warden, Nihl e slots reservados fora.

Testes: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

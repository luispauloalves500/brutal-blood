# BRUTAL BLOOD — 0.21.0

Jogo de luta 2D em React + TypeScript + Canvas 2D. **100% client-side**, offline-first, pronto para GitHub Pages (`dist/` apenas).

## O que mudou na 0.21.0

O botão guarda o último ataque por um instante e sai quando o lutador pode agir ou cancelar. Baixo acerta a canela; leve fica no peito; pesado e especial ocupam mais o corpo. A CPU só continua o combo se o primeiro golpe acertou. A defesa baixa do Kharon é folha própria. O final percorre os quadros em vez de travar no primeiro. O som de impacto, bloqueio e a música deixam de ser um bipe solto.

## O que mudou na 0.20.0

Armadura e overhead deixam de ser só texto no treino. O pesado e a investida do Gorr, e o passo do Draven, tomam o dano e continuam o golpe. Agarrão e Super quebram a armadura. A Coroa Invertida da Vespera acerta quem está agachado; bloqueio em pé ainda segura.

## O que mudou na 0.19.0

Super de vários hits gasta o dano escrito na ficha, dividido nos ticks, e só derruba no último. Véu da Vespera e o eclipse da Shai continuam no ar até completar os hits, em vez de sumir no primeiro toque. A CPU não vira o corpo no meio do golpe. Projéteis deixam de ser um retângulo único: agulha, véu, altar, foice e onda têm silhueta própria.

## O que mudou na 0.18.0

Nyx, Draven, Gorr e Shai fecharam início do pulo, queda, defesa baixa e levantar com folha própria. Andar para trás continua o espelho do andar. Kharon ainda não tem defesa baixa própria. Warden, Nihl e os 14 slots seguem de fora. O framework do app foi atualizado por segurança.

## O que mudou na 0.17.0

Nyx, Draven, Gorr e Shai ganharam folhas próprias de chute pesado, aéreo, agarrão, especial 2, especial 3, contra-golpe, provocação, intro, vitória e os dois finais. O idle da Nyx e o idle do Draven foram refeitos em grade 2×2, no mesmo visual de cada um. Gorr continua o berserker de cabelo longo, armadura e montante. Andar para trás segue o espelho do andar. Warden, Nihl e os 14 slots reservados não entram.

## O que mudou na 0.16.0

- Golpe alto não acerta quem está agachado. Golpe baixo e onda rasteira não acertam quem está no ar.
- Dá para agachar durante a defesa, então o bloqueio baixo entra se o golpe vier depois.
- A direção não vira no meio do ataque, do dash, da queda ou do nocaute.
- A caixa do aéreo é mais curta. Andar contra a parede para, em vez de deslizar no lugar.
- Aterrissar esmaga o corpo por um instante. Sem folhas novas nesta versão.

## O que mudou na 0.15.0

- **Nenhuma folha nova.** Chute pesado, aéreo, agarrão, especial 2, especial 3, contra-golpe, provocação, intro, vitória e os finais continuam sem clip próprio.
- Esses estados deixam de cair todos no mesmo soco. Cada um reutiliza uma folha dedicada já existente do mesmo lutador: chute pesado e especial 3 usam o pesado, especial 2 usa o chute leve, aéreo usa o pulo, agarrão usa o médio, contra-golpe usa o dash, provocação usa o agachar, final 1 usa o Super, final 2 usa o pesado, intro e vitória usam o idle.
- O tempo da animação segue o golpe pedido (`frameMap`, `fps`, `reverseFrames`). Andar para trás inverte a folha de andar, em vez de copiar o quadro do walk.
- Nyx tenta o especial 2 como anti-aéreo, no mesmo critério de Draven e Vespera.

## O que mudou na 0.14.0

- Nyx, Draven, Gorr e Shai receberam clips dedicados de **agachar, dash, médio, chute leve, especial 1, knockdown e Super**.
- Gorr segue o lock de identidade: cabelo longo, armadura e montante. O fallback Canvas e as novas folhas não voltam ao stand-in careca.
- Wake-up passa a reutilizar o knockdown do próprio lutador quando ele existe.
- Kharon e Vespera continuam com o kit quase completo; Warden/Nihl e os 14 slots restantes não entram nesta versão.

## O que mudou na 0.13.0

- clips dedicados de idle/walk/block/light/heavy/jump/hit para os 4 lutadores em group-sheet
- treino com avanço de frame, cantos, dummy reversal e counter-hit forçado
- IA por arquétipo, intro LUTAR, Blood Finish uma vez, command grab vs throw

## Rodar

```bash
npm ci
npm run dev
```

Build estático:

```bash
npm run build
```

Windows: `INICIAR.bat` (serve `dist/`).

## Validação

```bash
npm test
npm run typecheck
```

## GitHub Pages

`base: "./"`. Workflow em `.github/workflows/pages.yml`. Source = GitHub Actions.

## Docs

- [`SPRITES-v0.15.0.md`](SPRITES-v0.15.0.md)
- [`docs/VALIDACAO-v0.21.0.md`](docs/VALIDACAO-v0.21.0.md)
- [`SPRITES-v0.14.0.md`](SPRITES-v0.14.0.md)

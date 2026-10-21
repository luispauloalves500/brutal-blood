# BRUTAL BLOOD v0.15.0 — estados ainda emprestados

Não entrou WebP novo. A 0.14.0 continua sendo a última leva de folhas dedicadas (agachar, dash, médio, chute leve, especial 1, knockdown, Super) para Nyx, Draven, Gorr e Shai.

O que mudou é o destino do fallback e o relógio do quadro:

| Estado ainda sem folha | Pixels emprestados | Tempo |
|---|---|---|
| walkBack | walk, invertido | fps do walkBack |
| jumpStart, fall | jump | do estado pedido |
| blockLow | block | do estado pedido |
| kickHeavy, special3, finish2 | heavy | frameMap do golpe |
| aerial | jump | frameMap do aéreo |
| throw | medium | frameMap do agarrão |
| special2 | kickLight | frameMap do especial 2 |
| wakeup | knockdown | do wakeup |
| finish1 | super | frameMap do final (não é performance própria) |
| counter | dash | frameMap do contra-golpe |
| taunt | crouch | do taunt |
| intro, victory | idle | do estado pedido |

Contagem dedicada não muda: Kharon 29, Vespera 31, Nyx/Draven/Gorr/Shai 15. Os outros 16 de cada um desses quatro são CLIP_FALLBACK, não animação nova.

Idle da Nyx (folha antiga 418²) e idle irregular do Draven não foram refeitos. Warden e Nihl seguem stand-in. Os 14 slots reservados continuam vazios.

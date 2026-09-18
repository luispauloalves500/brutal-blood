import type { Difficulty } from "../core/config";
import type { CharacterDef } from "../characters/types";
import { playable } from "../characters/roster";
import { otherFighter } from "./runs";

export type StoryBeat = {
  chapter: string;
  title: string;
  intro: string;
  winLine: string;
  opponentId: string;
  stageId: string;
  difficulty: Difficulty;
};

export type StoryCampaign = {
  fighterId: string;
  title: string;
  blurb: string;
  ending: string;
  beats: StoryBeat[];
};

const kharonStory: StoryCampaign = {
  fighterId: "kharon",
  title: "A LISTA",
  blurb: "Cada nome riscado. Cada dívida cobrada. A foice não aceita deserção.",
  ending: "A lista está em branco. O carrasco não descansa — só vira a página.",
  beats: [
    {
      chapter: "I",
      title: "Nome riscado",
      intro: "Nyx saiu da lista. A foice não aceita deserção. A arena abandonada ainda cheira a sentença.",
      winLine: "A lâmina caiu. O nome volta para o papel.",
      opponentId: "nyx",
      stageId: "abandoned",
      difficulty: "easy",
    },
    {
      chapter: "II",
      title: "Ferro no fosso",
      intro: "Draven cobra o sino. Kharon cobra o saldo. No distrito, só um dos dois sai de pé.",
      winLine: "O ferro quebrou. O sino calou.",
      opponentId: "draven",
      stageId: "industrial",
      difficulty: "hard",
    },
    {
      chapter: "III",
      title: "Nave sem lua",
      intro: "A catedral engoliu a luz. Nyx espera no altar — desta vez ela não vai sair da lista.",
      winLine: "O eclipse acaba na foice.",
      opponentId: "nyx",
      stageId: "cathedral",
      difficulty: "brutal",
    },
    {
      chapter: "IV",
      title: "Último nome",
      intro: "A Fortaleza Final. Só resta um nome — e ele usa ferro nos punhos.",
      winLine: "O último nome cai. A fortaleza reconhece o carrasco.",
      opponentId: "draven",
      stageId: "fortress",
      difficulty: "nightmare",
    },
  ],
};

const nyxStory: StoryCampaign = {
  fighterId: "nyx",
  title: "ECLIPSE",
  blurb: "A lua foi engolida. Nyx corta o espaço entre um passo e o outro.",
  ending: "O vazio não deixa rastros. A lua continua engolida.",
  beats: [
    {
      chapter: "I",
      title: "Atraso",
      intro: "Kharon chegou cedo. Nyx nunca chega — ela já passou. O templo ainda pinga.",
      winLine: "A sentença atrasou. A lâmina não.",
      opponentId: "kharon",
      stageId: "temple",
      difficulty: "easy",
    },
    {
      chapter: "II",
      title: "Sino quebrado",
      intro: "Draven fecha o fosso. Nyx corta o espaço entre os golpes. A floresta observa.",
      winLine: "O sino não tocou. Só o vazio.",
      opponentId: "draven",
      stageId: "forest",
      difficulty: "hard",
    },
    {
      chapter: "III",
      title: "Veredito invertido",
      intro: "A foice outra vez, na nave preta. Desta vez o nome na lista é o do carrasco.",
      winLine: "O verdugo cai no próprio altar.",
      opponentId: "kharon",
      stageId: "cathedral",
      difficulty: "brutal",
    },
    {
      chapter: "IV",
      title: "Lua morta",
      intro: "A fortaleza. Sem rastros. Sem testemunhas. O ferro espera no topo.",
      winLine: "A fortaleza esquece. Nyx já foi embora.",
      opponentId: "draven",
      stageId: "fortress",
      difficulty: "nightmare",
    },
  ],
};

const dravenStory: StoryCampaign = {
  fighterId: "draven",
  title: "O SINO",
  blurb: "No fosso, o ferro não se ajoelha. Draven sobe até o sino da fortaleza.",
  ending: "O sino tocou. Draven ainda está de pé. O ferro não se ajoelha.",
  beats: [
    {
      chapter: "I",
      title: "Primeiro round",
      intro: "Nyx entra no fosso como se o chão não existisse. Os punhos existem.",
      winLine: "A assassina pisou no ferro. O ferro não cede.",
      opponentId: "nyx",
      stageId: "industrial",
      difficulty: "easy",
    },
    {
      chapter: "II",
      title: "A dívida",
      intro: "Kharon veio cobrar. Draven não recua. A arena abandonada vira ringue.",
      winLine: "A foice encontrou o clinch. A dívida mudou de dono.",
      opponentId: "kharon",
      stageId: "abandoned",
      difficulty: "hard",
    },
    {
      chapter: "III",
      title: "Clinch na nave",
      intro: "A assassina volta na catedral. Os punhos já conhecem o vazio.",
      winLine: "O eclipse quebrou nos dentes de ferro.",
      opponentId: "nyx",
      stageId: "cathedral",
      difficulty: "brutal",
    },
    {
      chapter: "IV",
      title: "Sino da fortaleza",
      intro: "O carrasco espera no topo. O ferro sobe a escada. O sino já sabe o nome.",
      winLine: "O verdugo cai. O sino toca para o boxeador.",
      opponentId: "kharon",
      stageId: "fortress",
      difficulty: "nightmare",
    },
  ],
};

const CAMPAIGNS: Record<string, StoryCampaign> = {
  kharon: kharonStory,
  nyx: nyxStory,
  draven: dravenStory,
};

export function getStory(id: string): StoryCampaign {
  return CAMPAIGNS[id] ?? kharonStory;
}

export function hasStory(id: string) {
  return Boolean(CAMPAIGNS[id]);
}

export function storyOpponent(p1: CharacterDef, opponentId: string): CharacterDef {
  if (opponentId === p1.id) return otherFighter(p1.id);
  return playable.find((p) => p.id === opponentId) ?? otherFighter(p1.id);
}

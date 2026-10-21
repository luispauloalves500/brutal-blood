export type ChallengeEvent = { player: boolean; blocked: boolean; type: string; combo: number };
const TASKS = [
  { title: 'Acerte três golpes', target: 3, cpu: 'stand' as const, check: (e: ChallengeEvent) => e.player && !e.blocked },
  { title: 'Bloqueie três ataques', target: 3, cpu: 'attack' as const, check: (e: ChallengeEvent) => !e.player && e.blocked },
  { title: 'Conecte um combo de 3 hits', target: 1, cpu: 'stand' as const, check: (e: ChallengeEvent) => e.player && !e.blocked && e.combo >= 3 },
  { title: 'Acerte um especial', target: 1, cpu: 'stand' as const, check: (e: ChallengeEvent) => e.player && !e.blocked && e.type === 'special' },
  { title: 'Acerte um Super', target: 1, cpu: 'stand' as const, check: (e: ChallengeEvent) => e.player && !e.blocked && e.type === 'super' },
];
export class Challenges {
  index = 0;
  progress = 0;
  transition = 0;
  complete = false;
  get task() { return TASKS[Math.min(this.index, TASKS.length - 1)]; }
  get label() { return `${Math.min(this.index + 1, TASKS.length)}/${TASKS.length} · ${this.task.title} · ${this.progress}/${this.task.target}`; }
  hit(event: ChallengeEvent) {
    if (this.complete || this.transition > 0 || !this.task.check(event)) return;
    this.progress++;
    if (this.progress >= this.task.target) this.transition = 90;
  }
  tick(): 'next' | 'complete' | null {
    if (!this.transition || --this.transition > 0) return null;
    if (++this.index >= TASKS.length) { this.complete = true; return 'complete'; }
    this.progress = 0;
    return 'next';
  }
}

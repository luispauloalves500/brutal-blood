import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/game/input/Input.ts';
import { CommandBuffer } from '../src/game/combat/commands.ts';
import { TrainingRecorder } from '../src/game/input/TrainingRecorder.ts';
import { Match } from '../src/game/combat/Match.ts';
import { kharon } from '../src/game/characters/kharon.ts';
import { vespera } from '../src/game/characters/vespera.ts';
import { getStory, hasStory } from '../src/game/modes/story.ts';
import { DEFAULT_GRAPHICS, GAME } from '../src/game/core/config.ts';

const audio = new Proxy({}, {get: () => () => {}});
function match(mode = 'versus') {
  const m = new Match({ctx:{}, input:new Input(), p1Data:kharon, p2Data:vespera, mode,
    difficulty:'normal', stageId:'abandoned', gfx:{...DEFAULT_GRAPHICS}, audio});
  m.state='fight'; m.p1.reset(440,1); m.p2.reset(740,-1);
  return m;
}
function step(m, n=1) {for(let i=0;i<n;i++){m.step();m.input.endFrame();}}

test('pause and resume consume a frame without advancing combat', () => {
  const m=match(); const time=m.timer;
  m.input.injectCodes(['Escape']);step(m);assert.equal(m.paused,true);assert.equal(m.timer,time);
  m.input.injectCodes([]);step(m,30);assert.equal(m.timer,time);
  m.input.injectCodes(['Escape']);step(m);assert.equal(m.paused,false);assert.equal(m.timer,time);
  step(m);assert.ok(m.timer<time);
});
test('restart clears pause, stale timers, KO, projectiles and command history',()=>{
  const m=match();m.timer=3;m.paused=true;m.p1.health=0;m.p1.state='ko';m.projectiles.push({});
  m.restartRound();assert.equal(m.paused,false);assert.equal(m.timer,99);assert.equal(m.projectiles.length,0);assert.equal(m.p1.health,m.p1.maxHealth);
});
test('both training fighters recover after lethal damage even with infinite HP',()=>{
  const m=match('training');m.p1.health=0;m.p1.state='ko';m.p2.health=0;m.p2.state='ko';
  step(m,55);assert.ok(m.p1.health>0&&m.p2.health>0);assert.notEqual(m.p1.state,'ko');assert.notEqual(m.p2.state,'ko');
});
test('time over compares health percentage across asymmetric characters',()=>{
  const m=match();m.p1.health=m.p1.maxHealth*.49;m.p2.health=m.p2.maxHealth*.5;m.timer=0;
  step(m);assert.equal(m.p2.roundWins,1);assert.equal(m.p1.roundWins,0);
});
test('AI projectiles exist only after startup; interruption cancels pending release',()=>{
  const m=match('arcade'); m.ai.mode='stand';m.p2.meter=100;
  assert.equal(m.ai.tryMove('special1'),true);assert.equal(m.projectiles.length,0);
  step(m,vespera.moves.special1.startup);assert.ok(m.projectiles.length>0);
  const b=match('arcade');b.ai.mode='stand';b.p2.meter=100;b.ai.tryMove('special1');b.p2.attack=null;b.p2.state='hit';
  step(b,25);assert.equal(b.projectiles.length,0);
});
test('finish is triggered once, animates the chosen clip, waits for simulation and cannot call after disposal',()=>{
  const m=match();let results=0;m.onMatchEnd=()=>results++;m.finisher=m.p1;m.victim=m.p2;m.state='finish';
  m.playFinish({id:'finish2',name:'Test',type:'finish'});step(m,8);m.paused=true;step(m,180);assert.equal(results,0);
  m.paused=false;step(m,250);assert.equal(results,1);assert.equal(m.finishName,'Test');
  step(m,250);assert.equal(results,1);
  const b=match();b.onMatchEnd=()=>results++;b.state='ended';b.scheduleResult(true,.1);b.dispose();step(b,100);assert.equal(results,1);
});
test('gamepad press persists across render polls, fires once across catch-up steps',()=>{
  let pressed=false; const gp={buttons:Array.from({length:16},(_,i)=>({pressed:i===2&&pressed,value:i===2&&pressed?1:0})),axes:[0,0]};
  Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>[gp]},configurable:true});
  const i=new Input();i.poll();gp.buttons[2]={pressed:true,value:1};i.poll();i.poll();
  assert.equal(i.consume('p1','light'),true);assert.equal(i.consume('p1','light'),false);i.endFrame();assert.equal(i.consume('p1','light'),false);
  delete globalThis.navigator;
});
test('dash is not retriggered every simulation frame',()=>{
  const i=new Input(),b=new CommandBuffer();
  for(const keys of [['KeyD'],[],['KeyD']]){i.injectCodes(keys);b.tick(i,'p1',1);}
  assert.equal(b.consumeDash(),1);assert.equal(b.consumeDash(),0);
  b.reset();assert.equal(b.consumeDash(),0);
});
test('training tape has a ten-second cap and looping playback generates edges once',()=>{
  const i=new Input(),r=new TrainingRecorder();r.record();i.injectCodes(['Numpad1']);r.tick(i);i.endFrame();i.injectCodes([]);r.tick(i);r.stop(i);r.play();
  r.tick(i);assert.equal(i.consume('p2','light'),true);assert.equal(i.consume('p2','light'),false);
  r.tick(i);assert.equal(i.isDown('p2','light'),false);r.tick(i);assert.equal(i.consume('p2','light'),true);
  r.stop(i);r.record();for(let f=0;f<700;f++)r.tick(i);assert.equal(r.frames.length,600);assert.equal(r.mode,'idle');
});
test('Vespera has a distinct, playable four-chapter story',()=>{
  assert.equal(hasStory('vespera'),true);const s=getStory('vespera');assert.equal(s.fighterId,'vespera');assert.equal(s.beats.length,4);
});
test('Gorr and Shai are full playable initial fighters with Story campaigns',async()=>{
  const {playable}=await import('../src/game/characters/roster.ts');
  for(const id of ['gorr','shai']){
    assert.ok(playable.some((f)=>f.id===id),`${id} not playable`);
    assert.equal(hasStory(id),true);
    const s=getStory(id);assert.equal(s.fighterId,id);assert.equal(s.beats.length,4);
  }
});

test('challenge goals reject wrong events and complete all five missions', async()=>{
  const {Challenges}=await import('../src/game/modes/challenges.ts');const c=new Challenges();
  c.hit({player:false,blocked:false,type:'normal',combo:1});assert.equal(c.progress,0);
  const goals=[{player:true,blocked:false,type:'normal',combo:1},{player:false,blocked:true,type:'normal',combo:1},{player:true,blocked:false,type:'normal',combo:3},{player:true,blocked:false,type:'special',combo:1},{player:true,blocked:false,type:'super',combo:1}];
  for(const event of goals){for(let j=0;j<c.task.target;j++)c.hit(event);for(let f=0;f<90;f++)c.tick();}
  assert.equal(c.complete,true);
});
test('invulnerability grants neither damage, meter nor combo credit',()=>{
  const m=match();m.p2.invuln=1;const hp=m.p2.health;m.applyHit(m.p1,m.p2,kharon.moves.light);
  assert.equal(m.p2.health,hp);assert.equal(m.p1.meter,0);assert.equal(m.p1.cancelReady,false);
});
test('grabs beat guard and crouching guard changes hurtbox height',()=>{
  const m=match();m.p2.block(true);m.p2.crouching=true;assert.ok(m.p2.getHurtBox().h<m.p2.h);
  const hp=m.p2.health;m.applyHit(m.p1,m.p2,kharon.moves.throw);assert.ok(hp-m.p2.health>20);assert.equal(m.p2.blocking,false);
});
test('every selectable fighter references real assets and every combo references a move',async()=>{
  const {existsSync}=await import('node:fs'); const {fileURLToPath}=await import('node:url');
  const {playable}=await import('../src/game/characters/roster.ts');
  const {collectFightJobs}=await import('../src/game/assets/FightAssetLoader.ts');
  const {STAGES}=await import('../src/game/graphics/stages.ts');assert.equal(STAGES.length,8);
  for(const f of playable){for(const combo of f.combos)for(const id of combo.sequence)assert.ok(f.moves[id],`${f.id}/${id}`);
    for(const job of collectFightJobs({p1:f.id,p2:f.id,stage:'abandoned'}))assert.ok(existsSync(fileURLToPath(new URL('../public'+job.url,import.meta.url))),job.url);
  }
});
test('content registry keeps playable fighter definitions and asset manifests aligned', async()=>{
  const {FIGHTER_CONTENT,PLAYABLE_FIGHTER_IDS}=await import('../src/game/content/registry.ts');
  assert.equal(FIGHTER_CONTENT.length,6);
  assert.equal(new Set(PLAYABLE_FIGHTER_IDS).size,PLAYABLE_FIGHTER_IDS.length);
  for(const entry of FIGHTER_CONTENT){assert.equal(entry.def.id,entry.assets.id);assert.ok(entry.assets.clips.idle);}
});

test('the six initial fighters are selectable and each animation state resolves', async()=>{
  const {FIGHTER_CONTENT,PLAYABLE_FIGHTER_IDS}=await import('../src/game/content/registry.ts');
  const {ANIM_NAMES, classifyClip, clipInventory}=await import('../src/game/assets/clips.ts');
  assert.deepEqual([...PLAYABLE_FIGHTER_IDS].sort(), ['draven','gorr','kharon','nyx','shai','vespera']);
  assert.equal(ANIM_NAMES.length, 31);
  for (const entry of FIGHTER_CONTENT) {
    const inv = clipInventory(entry.assets);
    assert.equal(inv.missing.length, 0, `${entry.id} missing ${inv.missing.join(',')}`);
    assert.ok(inv.dedicated.includes('idle'), `${entry.id} idle must be dedicated`);
    for (const name of ANIM_NAMES) {
      const kind = classifyClip(entry.assets, name);
      assert.notEqual(kind, 'MISSING', `${entry.id}/${name}`);
      assert.ok(entry.assets.clips[name], `${entry.id} has no clip ${name}`);
    }
    for (const combo of entry.def.combos) {
      for (const id of combo.sequence) assert.ok(entry.def.moves[id], `${entry.id} combo ${combo.id} missing ${id}`);
    }
    assert.ok(entry.def.finishes.length >= 2, `${entry.id} needs two Blood Finishes`);
    assert.notEqual(entry.def.finishes[0].name, entry.def.finishes[1].name);
    assert.ok(entry.assets.palettes?.some((p)=>p.id==='default'));
  }
});

test('attack clips carry a frameMap aligned to startup/active/recovery', async()=>{
  const {FIGHTER_CONTENT}=await import('../src/game/content/registry.ts');
  const attacks = ['light','medium','heavy','kickLight','kickHeavy','aerial','throw','special1','special2','special3','super'];
  for (const entry of FIGHTER_CONTENT) {
    for (const id of attacks) {
      const clip = entry.assets.clips[id];
      const move = entry.def.moves[id];
      assert.ok(clip, `${entry.id}/${id} clip`);
      assert.ok(move, `${entry.id}/${id} move`);
      assert.ok(clip.frameMap && clip.frameMap.length >= move.startup + move.active + move.recovery - 2, `${entry.id}/${id} frameMap`);
    }
  }
});

test('mirror match boots without mixing palettes or cloning the wrong fighter', ()=>{
  const m = new Match({ctx:{}, input:new Input(), p1Data:kharon, p2Data:kharon, mode:'versus',
    difficulty:'normal', stageId:'abandoned', gfx:{...DEFAULT_GRAPHICS}, audio});
  assert.equal(m.p1.data.id, 'kharon');
  assert.equal(m.p2.data.id, 'kharon');
  assert.notEqual(m.p1.paletteId, m.p2.paletteId);
});

test('super consumes super meter and projectiles stay unique after startup', ()=>{
  const m=match();
  m.p1.superMeter=100; m.p1.meter=100;
  assert.equal(m.p1.startAttack(kharon.moves.super), true);
  assert.equal(m.p1.superMeter, 0);
  const v=match('arcade'); v.ai.mode='stand'; v.p2.meter=100;
  assert.equal(v.ai.tryMove('special1'), true);
  step(v, vespera.moves.special1.startup);
  const n=v.projectiles.length;
  step(v, 4);
  assert.equal(v.projectiles.length, n);
});

test('command grab beats block; normal throw loses only to an active strike', async()=>{
  const {gorr}=await import('../src/game/characters/gorr.ts');
  const grab=new Match({ctx:{}, input:new Input(), p1Data:gorr, p2Data:kharon, mode:'versus',
    difficulty:'normal', stageId:'abandoned', gfx:{...DEFAULT_GRAPHICS}, audio});
  grab.state='fight'; grab.p1.reset(440,1); grab.p2.reset(500,-1);
  grab.p2.block(true);
  const hp=grab.p2.health;
  grab.applyHit(grab.p1, grab.p2, gorr.moves.special2);
  assert.ok(grab.p2.health<hp);
  assert.equal(grab.p2.blocking, false);

  const thr=match();
  thr.p2.startAttack(kharon.moves.light);
  thr.p2.attackFrame=kharon.moves.light.startup;
  thr.p2.hitDone=false;
  thr.p1.x=thr.p2.x-40;
  thr.p1.startAttack(kharon.moves.throw);
  thr.p1.attackFrame=kharon.moves.throw.startup;
  const before=thr.p2.health;
  step(thr);
  assert.equal(thr.p1.hitDone, true);
  assert.equal(thr.p2.health, before);
});

test('wake-up grants invulnerability before the dummy can be hit', ()=>{
  const m=match();
  m.p2.state='knockdown'; m.p2.stun=0; m.p2.grounded=false;
  m.p2.y=GAME.FLOOR-m.p2.h+8; m.p2.vy=80;
  step(m, 4);
  assert.equal(m.p2.state, 'wakeup');
  assert.ok(m.p2.invuln>0);
  const hp=m.p2.health;
  m.applyHit(m.p1, m.p2, kharon.moves.light);
  assert.equal(m.p2.health, hp);
});

test('training reset, meter, HP, corners, frame advance and reversal CPU', ()=>{
  const m=match('training');
  m.p1.health=12; m.p1.meter=40; m.p1.superMeter=70; m.p1.x=90;
  m.resetHealth(); m.resetMeter();
  assert.equal(m.p1.health, m.p1.maxHealth);
  assert.equal(m.p1.meter, 0);
  assert.equal(m.p1.superMeter, 0);
  m.resetPositions('cornerP1');
  assert.ok(m.p1.x<120);
  m.resetPositions('cornerP2');
  assert.ok(m.p1.x>800);
  m.resetPositions();
  assert.ok(Math.abs(m.p1.x-440)<1);
  m.applyTraining({...m.training, frameAdvance:true, forceCounter:true, cpu:'reversal'});
  assert.equal(m.paused, true);
  assert.equal(m.ai.mode, 'reversal');
  const time=m.timer;
  m.state='fight';
  m.step();
  assert.equal(m.timer, time);
  m.advanceFrame();
  assert.equal(m.paused, true);
});

test('AI refuses missing moves and Gorr identity stays the armored grappler', async()=>{
  const {gorr}=await import('../src/game/characters/gorr.ts');
  const {gorrAssets}=await import('../src/game/assets/characters/gorr.ts');
  const {readFileSync}=await import('node:fs');
  const m=match('arcade');
  assert.equal(m.ai.tryMove('nope'), false);
  assert.equal(m.ai.tryMove('light'), true);
  assert.match(gorr.style, /Grappler|armadura/i);
  assert.ok(gorrAssets.availableClips.includes('idle'));
  assert.ok(gorrAssets.availableClips.includes('super'));
  const canvas=readFileSync(new URL('../src/game/graphics/drawFighter.ts', import.meta.url),'utf8');
  assert.match(canvas, /Identity lock: long hair/);
});

test('Blood Finish plays once and intro presents LUTAR', ()=>{
  const m=match();
  m.state='intro'; m.stateTime=1.2; m.message='ROUND 1';
  step(m);
  assert.equal(m.message, 'LUTAR');
  m.finisher=m.p1; m.victim=m.p2; m.state='finish';
  let results=0; m.onMatchEnd=()=>results++;
  m.playFinish({id:'finish1',name:'Mesa',type:'finish'});
  m.playFinish({id:'finish2',name:'Banquete',type:'finish'});
  assert.equal(m.finishName, 'Mesa');
  step(m, 8); m.paused=true; step(m, 40);
  assert.equal(results, 0);
});

test('service worker and runtime share version 0.21.0', async()=>{
  const {readFileSync}=await import('node:fs');
  const {GAME_VERSION}=await import('../src/game/core/version.ts');
  const pkg=JSON.parse(readFileSync(new URL('../package.json', import.meta.url),'utf8'));
  const sw=readFileSync(new URL('../public/sw.js', import.meta.url),'utf8');
  assert.equal(GAME_VERSION, '0.21.0');
  assert.equal(pkg.version, GAME_VERSION);
  assert.match(sw, /__APP_VERSION__/);
  assert.match(sw, /brutal-blood-core/);
});

test('Nyx Draven Gorr Shai ship dedicated crouch dash medium kick special knockdown super', async()=>{
  const {FIGHTER_CONTENT}=await import('../src/game/content/registry.ts');
  const {classifyClip}=await import('../src/game/assets/clips.ts');
  const need=['crouch','dash','medium','kickLight','kickHeavy','aerial','throw','special1','special2','special3','counter','taunt','intro','victory','finish1','finish2','knockdown','super','jumpStart','fall','blockLow','wakeup'];
  for (const id of ['nyx','draven','gorr','shai']) {
    const entry=FIGHTER_CONTENT.find((x)=>x.id===id);
    for (const name of need) {
      assert.equal(classifyClip(entry.assets, name), 'DEDICATED', `${id} ${name}`);
    }
  }
});

test('borrowed clips keep the requested timing and do not all reuse light', async()=>{
  const {nyxAssets}=await import('../src/game/assets/characters/nyx.ts');
  const {nyx}=await import('../src/game/characters/nyx.ts');
  const {FALLBACK_OF, classifyClip}=await import('../src/game/assets/clips.ts');
  const {SpriteAnimator}=await import('../src/game/graphics/SpriteAnimator.ts');
  assert.equal(FALLBACK_OF.kickHeavy, 'heavy');
  assert.equal(FALLBACK_OF.special2, 'kickLight');
  assert.equal(FALLBACK_OF.special3, 'heavy');
  assert.equal(FALLBACK_OF.aerial, 'jump');
  assert.equal(FALLBACK_OF.throw, 'medium');
  assert.equal(FALLBACK_OF.counter, 'dash');
  assert.equal(FALLBACK_OF.taunt, 'crouch');
  assert.equal(FALLBACK_OF.finish1, 'super');
  assert.equal(FALLBACK_OF.finish2, 'heavy');
  assert.equal(FALLBACK_OF.intro, 'idle');
  assert.equal(FALLBACK_OF.victory, 'idle');
  assert.equal(FALLBACK_OF.wakeup, 'knockdown');
  const stillBorrowed = ['walkBack'];
  for (const name of stillBorrowed) {
    assert.equal(classifyClip(nyxAssets, name), 'CLIP_FALLBACK', name);
    assert.notEqual(nyxAssets.clips[name].fallback, 'light', name);
  }
  for (const name of ['kickHeavy','special2','special3','aerial','throw','counter','taunt','finish1','finish2','intro','victory']) {
    assert.equal(classifyClip(nyxAssets, name), 'DEDICATED', name);
  }
  assert.equal(nyxAssets.clips.walkBack.reverseFrames, true);

  const images = new Map();
  const fake = { width: 384, height: 256 };
  for (const c of Object.values(nyxAssets.clips)) {
    if (c.src) images.set(c.src, fake);
  }
  const anim = new SpriteAnimator('nyx', { ...nyxAssets, images });
  const ctx = { save(){}, restore(){}, translate(){}, scale(){}, drawImage(){}, filter: '' };
  anim.draw(ctx, 'walkBack', 0, 0, 80, 160, 1, 0);
  assert.equal(anim.lastMode, 'CLIP_FALLBACK');
  assert.match(anim.lastSrc, /walk\.webp$/);
  assert.equal(anim.lastFrame, nyxAssets.clips.walk.frames - 1);

  const map = nyxAssets.clips.kickHeavy.frameMap;
  anim.draw(ctx, 'kickHeavy', 0, 0, 80, 160, 1, {
    time: 0, attack: nyx.moves.kickHeavy, attackFrame: 0,
  });
  assert.equal(anim.lastMode, 'DEDICATED');
  assert.match(anim.lastSrc, /kick-heavy\.webp$/);
  assert.equal(anim.lastFrame, map[0] % nyxAssets.clips.kickHeavy.frames);
});

test('crouch blocks highs, lows miss the air, and facing stays locked in an attack', async () => {
  const {gorr} = await import('../src/game/characters/gorr.ts');
  const m = match();
  m.state = 'fight';
  m.p1.reset(440, 1);
  m.p2.reset(500, -1);
  m.p2.block(true);
  m.p2.crouch(true);
  assert.equal(m.p2.crouching, true);
  assert.equal(m.p2.state, 'block');

  const stand = match();
  stand.state = 'fight';
  stand.p1.reset(440, 1);
  stand.p2.reset(500, -1);
  stand.p1.startAttack(kharon.moves.aerial);
  stand.p1.attackFrame = kharon.moves.aerial.startup;
  const standHp = stand.p2.health;
  stand.resolveHit(stand.p1, stand.p2);
  assert.ok(stand.p2.health < standHp, 'high connects against a standing body');

  m.p1.startAttack(kharon.moves.aerial);
  m.p1.attackFrame = kharon.moves.aerial.startup;
  const hp = m.p2.health;
  m.resolveHit(m.p1, m.p2);
  assert.equal(m.p2.health, hp, 'high must whiff on crouch');
  assert.equal(m.p1.hitDone, false);

  const low = match();
  low.state = 'fight';
  low.p1.reset(440, 1);
  low.p2.reset(500, -1);
  low.p2.grounded = false;
  low.p2.y = GAME.FLOOR - low.p2.h - 24;
  low.p1.startAttack(kharon.moves.kickLight);
  low.p1.attackFrame = kharon.moves.kickLight.startup;
  const airHp = low.p2.health;
  low.resolveHit(low.p1, low.p2);
  assert.equal(low.p2.health, airHp, 'low must whiff in the air');

  const wave = new Match({ctx:{}, input:new Input(), p1Data:gorr, p2Data:kharon, mode:'versus',
    difficulty:'normal', stageId:'prison', gfx:{...DEFAULT_GRAPHICS}, audio});
  wave.state = 'fight';
  wave.p1.reset(440, 1);
  wave.p2.reset(560, -1);
  wave.p2.grounded = false;
  wave.p2.y = GAME.FLOOR - wave.p2.h - 30;
  wave.projectiles.push({
    x: wave.p2.x + 8, y: wave.p2.y + 70, vx: 200, w: 70, h: 40,
    owner: wave.p1, damage: 80, knock: 100, life: 1, kind: 'wave', hit: false, hitstop: 4,
    move: gorr.moves.special3,
  });
  const waveHp = wave.p2.health;
  step(wave);
  assert.equal(wave.p2.health, waveHp, 'ground wave must miss a jumper');
  assert.equal(wave.projectiles.length, 1);

  const cross = match();
  cross.state = 'fight';
  cross.p1.reset(400, 1);
  cross.p2.reset(520, -1);
  cross.p1.startAttack(kharon.moves.heavy);
  cross.p1.x = 560;
  step(cross);
  assert.equal(cross.p1.facing, 1, 'attack facing must not flip on a cross-up');
  assert.ok(cross.p1.x >= 30 && cross.p1.x <= 1280 - 30 - cross.p1.w);

  const wall = match();
  wall.p1.reset(30, 1);
  wall.p1.x = 30;
  wall.p1.move(-1);
  assert.equal(wall.p1.vx, 0);
  assert.notEqual(wall.p1.state, 'walk');
});

test('every fighter survives a full exchange on every arena', async () => {
  const {PLAYABLE_FIGHTERS} = await import('../src/game/content/registry.ts');
  const {STAGES} = await import('../src/game/graphics/stages.ts');
  const buttons = ['light', 'medium', 'heavy', 'kickLight', 'kickHeavy'];
  assert.equal(PLAYABLE_FIGHTERS.length, 6);
  assert.equal(STAGES.length, 8);
  for (const stage of STAGES) {
    for (const a of PLAYABLE_FIGHTERS) {
      const b = PLAYABLE_FIGHTERS[(PLAYABLE_FIGHTERS.indexOf(a) + 1) % PLAYABLE_FIGHTERS.length];
      const m = new Match({ctx:{}, input:new Input(), p1Data:a, p2Data:b, mode:'arcade',
        difficulty:'nightmare', stageId:stage.id, gfx:{...DEFAULT_GRAPHICS}, audio});
      m.state = 'fight';
      m.p1.state = 'idle';
      m.p2.state = 'idle';
      let attackLock = 0;
      for (let i = 0; i < 240; i++) {
        if (m.state === 'fight' && m.p1.canAct() && m.p1.grounded && i % 18 === 0) {
          const id = buttons[i % buttons.length];
          m.p1.startAttack(a.moves[id]);
        }
        m.step();
        m.input.endFrame();
        for (const f of [m.p1, m.p2]) {
          assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.health), `${a.id} vs ${b.id} @ ${stage.id}`);
          assert.ok(f.health >= 0 && f.health <= f.maxHealth + 0.01);
          assert.ok(f.x >= 29 && f.x <= 1280 - f.w);
        }
        assert.ok(m.projectiles.length < 8, `${a.id} projectile leak`);
        attackLock = m.p1.state === 'attack' ? attackLock + 1 : 0;
        assert.ok(attackLock < 150, `${a.id} attack stuck`);
        if (m.state === 'ended') break;
      }
    }
  }
});

test('multi-hit supers spend their listed damage once', () => {
  const m = match();
  m.p1.data.stats.strength = 1;
  m.p2.data.stats.defense = 1;
  m.p2.health = 4000;
  const before = m.p2.health;
  m.applyHit(m.p1, m.p2, kharon.moves.super);
  assert.equal(m.p2.state, 'hit', 'early super hits must not knock down');
  assert.equal(m.p1.hitDone, false);
  for (let i = 0; i < 8 && !m.p1.hitDone; i++) m.applyHit(m.p1, m.p2, kharon.moves.super);
  const dealt = before - m.p2.health;
  assert.equal(m.p1.hitsLanded, kharon.moves.super.hits);
  assert.equal(m.p2.state, 'knockdown');
  assert.ok(dealt < kharon.moves.super.damage * 1.05, `super dealt ${dealt}`);
  assert.ok(dealt > kharon.moves.super.damage * 0.55, `super dealt ${dealt}`);
  assert.ok(m.p2.health > 0);

  const shot = new Match({ctx:{}, input:new Input(), p1Data:vespera, p2Data:kharon, mode:'versus',
    difficulty:'normal', stageId:'abandoned', gfx:{...DEFAULT_GRAPHICS}, audio});
  shot.state = 'fight';
  shot.p1.reset(400, 1);
  shot.p2.reset(450, -1);
  shot.p1.data.stats.strength = 1;
  shot.p2.data.stats.defense = 1;
  shot.p2.health = 4000;
  shot.p1.superMeter = 100;
  shot.projectiles.push({
    x: shot.p2.x + 12, y: shot.p2.y + 40, vx: 30, w: 44, h: 22,
    owner: shot.p1, damage: vespera.moves.super.damage, knock: vespera.moves.super.knockback,
    life: 2.4, kind: 'veil', hit: false, hitstop: vespera.moves.super.hitstop,
    move: vespera.moves.super, hitsLanded: 0,
  });
  const hp = shot.p2.health;
  step(shot);
  assert.ok(shot.p2.health < hp, 'veil super must connect');
  assert.equal(shot.p2.state, 'hit');
  assert.equal(shot.projectiles.length, 1, 'multi-hit veil stays out after the first tick');
  assert.ok(shot.projectiles[0].hitsLanded >= 1);
  step(shot, 80);
  const dealtShot = hp - shot.p2.health;
  assert.ok(dealtShot < vespera.moves.super.damage * 1.15, `veil dealt ${dealtShot}`);
  assert.ok(dealtShot > 40, `veil dealt ${dealtShot}`);
  assert.ok(shot.p2.health > 0);
  assert.equal(shot.projectiles.length, 0);
});

test('CPU does not flip facing in the middle of an attack', () => {
  const m = match('arcade');
  m.state = 'fight';
  m.p1.reset(300, 1);
  m.p2.reset(640, 1);
  m.p2.state = 'attack';
  m.p2.attack = vespera.moves.heavy;
  m.p2.attackFrame = 2;
  m.p2.hitDone = false;
  step(m, 6);
  assert.equal(m.p2.facing, 1);
});

test('armor keeps the swing and overheads beat a crouch guard', async () => {
  const {gorr} = await import('../src/game/characters/gorr.ts');
  const {vespera} = await import('../src/game/characters/vespera.ts');
  const boot = (p1, p2) => {
    const m = new Match({ctx:{}, input:new Input(), p1Data:p1, p2Data:p2, mode:'versus',
      difficulty:'normal', stageId:'abandoned', gfx:{...DEFAULT_GRAPHICS}, audio});
    m.state = 'fight';
    m.p1.reset(440, 1);
    m.p2.reset(520, -1);
    return m;
  };

  const m = boot(gorr, kharon);
  m.p1.startAttack(gorr.moves.heavy);
  m.p1.attackFrame = 3;
  const hp = m.p1.health;
  m.p2.startAttack(kharon.moves.light);
  m.p2.attackFrame = kharon.moves.light.startup;
  m.resolveHit(m.p2, m.p1);
  assert.ok(m.p1.health < hp, 'armor still takes damage');
  assert.equal(m.p1.state, 'attack');
  assert.equal(m.p1.attack?.id, 'heavy');
  assert.equal(m.lastEvent, 'ARMOR');

  const rec = boot(gorr, kharon);
  rec.p1.startAttack(gorr.moves.heavy);
  rec.p1.attackFrame = gorr.moves.heavy.startup + gorr.moves.heavy.active + 2;
  rec.p2.startAttack(kharon.moves.light);
  rec.p2.attackFrame = kharon.moves.light.startup;
  rec.resolveHit(rec.p2, rec.p1);
  assert.equal(rec.p1.state, 'hit', 'recovery has no armor');

  const thr = boot(gorr, kharon);
  thr.p1.x = thr.p2.x - 36;
  thr.p1.startAttack(gorr.moves.heavy);
  thr.p1.attackFrame = 3;
  thr.p2.startAttack(kharon.moves.throw);
  thr.p2.attackFrame = kharon.moves.throw.startup;
  thr.resolveHit(thr.p2, thr.p1);
  assert.notEqual(thr.p1.state, 'attack', 'throw breaks armor');

  const sup = boot(gorr, kharon);
  sup.p2.superMeter = 100;
  sup.p1.startAttack(gorr.moves.heavy);
  sup.p1.attackFrame = 3;
  assert.equal(sup.p2.startAttack(kharon.moves.super), true);
  sup.p2.attackFrame = kharon.moves.super.startup;
  sup.resolveHit(sup.p2, sup.p1);
  assert.notEqual(sup.p1.state, 'attack', 'super breaks armor');

  const oh = boot(vespera, kharon);
  oh.p2.block(true);
  oh.p2.crouch(true);
  oh.p1.startAttack(vespera.moves.kickHeavy);
  oh.p1.attackFrame = vespera.moves.kickHeavy.startup;
  const before = oh.p2.health;
  oh.resolveHit(oh.p1, oh.p2);
  assert.ok(before - oh.p2.health > 40, 'overhead hits crouch block');
  assert.equal(oh.p2.blocking, false);

  const stand = boot(vespera, kharon);
  stand.p2.block(true);
  stand.p1.startAttack(vespera.moves.kickHeavy);
  stand.p1.attackFrame = vespera.moves.kickHeavy.startup;
  const sb = stand.p2.health;
  stand.resolveHit(stand.p1, stand.p2);
  assert.equal(stand.p2.state, 'block');
  assert.ok(sb - stand.p2.health < 30, 'standing block still stops the overhead');
});

test('buffered attack comes out after stun and a whiff does not combo', () => {
  const m = match();
  m.state = 'fight';
  m.p1.reset(440, 1);
  m.p2.reset(760, -1);
  m.p1.state = 'hit';
  m.p1.stun = 0.1;
  m.input.injectCodes(['KeyJ']);
  step(m, 1);
  assert.notEqual(m.p1.attack?.id, 'light');
  m.input.injectCodes([]);
  step(m, 8);
  assert.equal(m.p1.attack?.id, 'light');

  const late = match();
  late.state = 'fight';
  late.p1.reset(440, 1);
  late.p1.state = 'hit';
  late.p1.stun = 0.6;
  late.input.injectCodes(['KeyJ']);
  step(late, 1);
  late.input.injectCodes([]);
  step(late, 20);
  assert.notEqual(late.p1.attack?.id, 'light');

  const cpu = match('arcade');
  cpu.ai.think = 5;
  cpu.ai.queue = ['medium'];
  cpu.ai.queueDelay = 0;
  cpu.p2.state = 'idle';
  cpu.p2.attack = null;
  cpu.p2.cancelReady = false;
  cpu.ai.update(GAME.FRAME, cpu.p1);
  assert.equal(cpu.ai.queue.length, 0);
  assert.equal(cpu.p2.attack, null);

  const hit = match('arcade');
  hit.ai.think = 5;
  hit.ai.queue = ['medium'];
  hit.ai.queueDelay = 0;
  hit.p2.startAttack(vespera.moves.light);
  hit.p2.cancelReady = true;
  hit.ai.update(GAME.FRAME, hit.p1);
  assert.equal(hit.p2.attack?.id, 'medium');
  assert.equal(hit.ai.queue.length, 0);
});

test('low attacks hit the shin and a finish walks its frames', async () => {
  const m = match();
  m.p1.startAttack(kharon.moves.kickLight);
  m.p1.attackFrame = kharon.moves.kickLight.startup;
  const low = m.p1.getAttackBox();
  const jabM = match();
  jabM.p1.startAttack(kharon.moves.light);
  jabM.p1.attackFrame = kharon.moves.light.startup;
  const jab = jabM.p1.getAttackBox();
  assert.ok(low && jab);
  assert.ok(low.y > m.p1.y + m.p1.h * 0.65, 'low box stays at the shin');
  assert.ok(low.y > jab.y + jab.h * 0.35, 'jab sits above the low');

  const fin = match();
  fin.state = 'finish';
  fin.finisher = fin.p1;
  fin.victim = fin.p2;
  fin.playFinish({ id: 'finish1', name: 'Degola', type: 'finish' });
  assert.equal(fin.p1.attackFrame, 0);
  step(fin, 28);
  assert.ok(fin.p1.attackFrame >= 8, `finish frame ${fin.p1.attackFrame}`);

  const {kharonAssets} = await import('../src/game/assets/characters/kharon.ts');
  const {classifyClip} = await import('../src/game/assets/clips.ts');
  assert.equal(classifyClip(kharonAssets, 'blockLow'), 'DEDICATED');
});


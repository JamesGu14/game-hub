// skills.js — 主动技能与冷却。实时释放（不受三选一冻结影响）。纯逻辑。
export const SKILLS = {
  nuke:   { id: 'nuke',   name: '核弹清场', icon: '☢️', cd: 30, kind: 'nuke' },
  freeze: { id: 'freeze', name: '冰冻领域', icon: '❄️', cd: 20, kind: 'freeze' },
};

export function makeSkillState(ids) {
  const st = {};
  for (const id of ids) st[id] = { cd: SKILLS[id].cd, ready: true, timer: 0 };
  return st;
}

export function tickCooldowns(state, dt) {
  for (const id of Object.keys(state)) {
    const s = state[id];
    if (s.ready) continue;
    s.timer += dt;
    if (s.timer >= s.cd) { s.ready = true; s.timer = 0; }
  }
}

export function activateSkill(state, id, ctx) {
  const s = state[id];
  if (!s || !s.ready) return false;
  const kind = SKILLS[id].kind;
  if (kind === 'nuke') {
    for (const e of ctx.enemies) { if (e.hp > 0) e.hp -= (ctx.nukeDmg || 60); }
  } else if (kind === 'freeze') {
    for (const e of ctx.enemies) { if (e.hp > 0) e.frozen = Math.max(e.frozen || 0, 3.0); }
  }
  s.ready = false; s.timer = 0;
  return true;
}

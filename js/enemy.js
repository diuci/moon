/* ============================================================
   enemy.js —— 敌人生成 / AI / 伤害结算 / 难度曲线
   敌人从竞技场四边之外涌入，随时间推移越来越密、越来越强。
   ============================================================ */
(function (G) {
  'use strict';

  const MOBDEF = G.MOBDEF, MOB = G.MOB;

  /* ---------- 难度曲线 ----------
     dk：难度系数（来自难度模式）1=中等，<1 简单（怪少且弱），>1 困难（怪密且强） */
  function diff(t, depth, dk) {
    const d = depth || 1;
    const m = dk || 1;
    return {
      /* 生成间隔（秒）：随时间指数收紧，难度越高间隔越短 */
      interval: Math.max(0.14, (1.90 / m) * Math.pow(0.9975, t)),
      /* 每批数量：难度越高越多 */
      batch: 1 + Math.floor(t / 32 * m) + Math.floor(d * 0.6),
      /* 血量 / 速度 / 伤害 倍率 */
      hpMul: (1 + t / 105) * (1 + (d - 1) * 0.55) * (m > 1 ? (1 + (m - 1) * 0.45) : 1),
      spdMul: 1 + Math.min(0.55, t / 320) + (d - 1) * 0.08,
      dmgMul: 1 + t / 240 + (d - 1) * 0.15
    };
  }

  /* ---------- 按时间筛选可出现的怪种 ---------- */
  function pickKind(t) {
    const cand = [];
    let total = 0;
    for (const k in MOBDEF) {
      const def = MOBDEF[k];
      if (t < def.from) continue;
      /* 新解锁的怪种在最初阶段权重渐增 */
      const fresh = Math.min(1, (t - def.from) / 60 + 0.35);
      const w = def.w * fresh;
      if (w > 0) { cand.push([k, w]); total += w; }
    }
    if (!cand.length) return 'slime';
    let r = Math.random() * total;
    for (const c of cand) { r -= c[1]; if (r <= 0) return c[0]; }
    return cand[cand.length - 1][0];
  }

  /* ---------- 生成一只怪（从四边之外随机位置） ---------- */
  function spawn(GA, kind, forcePos) {
    const def = MOBDEF[kind];
    let x, y;
    if (forcePos) { x = forcePos.x; y = forcePos.y; }
    else {
      const m = 26;
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { x = Math.random() * GA.W; y = -m; }
      else if (side === 1) { x = GA.W + m; y = Math.random() * GA.H; }
      else if (side === 2) { x = Math.random() * GA.W; y = GA.H + m; }
      else { x = -m; y = Math.random() * GA.H; }
    }
    const D = GA.D;
    const isBoss = kind === 'brute';
    const hp = def.hp * D.hpMul * (isBoss ? 1 : (0.9 + Math.random() * 0.25));
    GA.enemies.push({
      kind, x, y,
      hp, maxHp: hp,
      spd: def.spd * D.spdMul * (0.9 + Math.random() * 0.2),
      dmg: def.dmg * D.dmgMul,
      r: def.r, xp: def.xp,
      anim: Math.random() * 10,
      hit: 0, kbx: 0, kby: 0,
      atkCd: 0,
      boss: isBoss,
      dead: false
    });
  }

  /* ---------- 空间哈希：让怪群互相分离，不至于叠成一坨 ---------- */
  function separate(list, cell) {
    const grid = new Map();
    const key = (cx, cy) => cx * 73856093 ^ cy * 19349663;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const cx = Math.floor(e.x / cell), cy = Math.floor(e.y / cell);
      const k = key(cx, cy);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const cx = Math.floor(e.x / cell), cy = Math.floor(e.y / cell);
      let px = 0, py = 0, n = 0;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const arr = grid.get(key(cx + ox, cy + oy));
          if (!arr) continue;
          for (const j of arr) {
            if (j === i) continue;
            const o = list[j];
            const dx = e.x - o.x, dy = e.y - o.y;
            const d2 = dx * dx + dy * dy;
            const min = e.r + o.r;
            if (d2 > 0.01 && d2 < min * min) {
              const d = Math.sqrt(d2);
              const push = (min - d) / min;
              px += (dx / d) * push; py += (dy / d) * push;
              n++;
            }
          }
        }
      }
      if (n) { e.sepx = px * 0.9; e.sepy = py * 0.9; }
      else { e.sepx = 0; e.sepy = 0; }
    }
  }

  /* ---------- 每帧更新 ---------- */
  function update(GA, dt) {
    const p = GA.player, S = GA.stats;

    /* 生成节奏 */
    GA.spawnT -= dt;
    if (GA.spawnT <= 0) {
      const D = GA.D;
      GA.spawnT = D.interval;
      const n = D.batch;
      for (let i = 0; i < n; i++) {
        if (GA.enemies.length >= GA.cap) break;
        spawn(GA, pickKind(GA.t));
      }
    }

    const list = GA.enemies;
    separate(list, 26);

    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.anim += dt * (e.boss ? 4 : 7);
      if (e.hit > 0) e.hit -= dt;

      /* 朝玩家移动 */
      let dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;

      let vx = dx * e.spd + (e.sepx || 0) * 34;
      let vy = dy * e.spd + (e.sepy || 0) * 34;
      /* 击退衰减 */
      vx += e.kbx; vy += e.kby;
      e.kbx *= Math.pow(0.0008, dt); e.kby *= Math.pow(0.0008, dt);

      e.x += vx * dt; e.y += vy * dt;
      e.face = dx < 0 ? -1 : 1;

      /* 接触伤害（有内置攻击间隔） */
      e.atkCd -= dt;
      const touch = e.r + 7;
      if (d < touch && e.atkCd <= 0) {
        e.atkCd = 0.55;
        GA.hurtPlayer(e.dmg);
      }

      /* 荆棘光环持续灼烧 */
      if (S.thorn > 0 && d < S.thornR) {
        e.thornT = (e.thornT || 0) + dt;
        if (e.thornT >= 0.25) {
          e.thornT = 0;
          damage(GA, e, S.thorn, false, true);
        }
      }
    }

    /* 清理 */
    for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) list.splice(i, 1);
  }

  /* ---------- 造成伤害 ---------- */
  function damage(GA, e, dmg, crit, silent) {
    if (e.dead) return 0;
    const real = Math.max(1, Math.round(dmg));
    e.hp -= real;
    e.hit = 0.12;
    if (!silent) {
      /* 击退 */
      const p = GA.player;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = e.boss ? 22 : 62;
      e.kbx += (dx / d) * k; e.kby += (dy / d) * k;
      GA.pop(e.x, e.y - e.r - 2, real, crit);
      /* 吸血 */
      if (GA.stats.lifesteal > 0) {
        GA.player.hp = Math.min(GA.stats.maxHp, GA.player.hp + real * GA.stats.lifesteal);
      }
    }
    if (e.hp <= 0) kill(GA, e);
    return real;
  }

  /* ---------- 死亡 ---------- */
  function kill(GA, e) {
    if (e.dead) return;
    e.dead = true;
    GA.kills++;
    GA.killsTotal++;
    GA.burst(e.x, e.y, e.kind, e.boss);
    /* 爆裂花瓣 */
    if (GA.stats.boom > 0) {
      GA.shock(e.x, e.y, 30 + GA.stats.boom * 8, 16 * GA.stats.boom, '#ff9e3a');
      for (const o of GA.enemies) {
        if (o === e || o.dead) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) < 30 + GA.stats.boom * 8) {
          damage(GA, o, 10 * GA.stats.boom, false, true);
        }
      }
    }
    GA.onKill(e);
  }

  /* ---------- 绘制 ---------- */
  function draw(ctx, GA) {
    for (const e of GA.enemies) {
      const frames = MOB[e.kind];
      const img = frames[Math.floor(e.anim) % frames.length];
      const w = img.width, h = img.height;
      const x = Math.round(e.x - w / 2), y = Math.round(e.y - h / 2);

      /* 影子 */
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 2, y + h - 2, w - 4, 2);
      ctx.globalAlpha = 1;

      ctx.save();
      if (e.face === -1) {
        ctx.scale(-1, 1);
        ctx.drawImage(img, -Math.round(e.x) - w / 2, y);
      } else {
        ctx.drawImage(img, x, y);
      }
      ctx.restore();

      /* 受击闪白 */
      if (e.hit > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, e.hit * 6);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#fff';
        if (e.face === -1) {
          ctx.scale(-1, 1);
          ctx.drawImage(img, -Math.round(e.x) - w / 2, y);
        } else ctx.drawImage(img, x, y);
        ctx.restore();
      }

      /* 血条（仅在受损后显示） */
      if (e.hp < e.maxHp) {
        const bw = Math.max(10, w - 2);
        const bx = Math.round(e.x - bw / 2), by = y - 4;
        ctx.fillStyle = '#120c1c'; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
        ctx.fillStyle = '#3a1f2a'; ctx.fillRect(bx, by, bw, 2);
        ctx.fillStyle = e.boss ? '#ff9e3a' : '#ff5470';
        ctx.fillRect(bx, by, Math.max(0, bw * (e.hp / e.maxHp)), 2);
      }
    }
  }

  G.enemy = { spawn, update, damage, kill, draw, diff, pickKind };

})(window.PX = window.PX || {});

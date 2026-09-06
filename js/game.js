/* ============================================================
   game.js —— 主引擎：输入 / 玩家 / 弹幕 / 技能 / 波次 / 渲染
   ============================================================ */
(function (G) {
  'use strict';

  const W = 480, H = 300, BD = 14;           // 逻辑分辨率与藤蔓边框厚度
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  let BG = null, scale = 2, shake = 0;

  const $ = id => document.getElementById(id);

  /* ============================================================
     全局游戏状态
     ============================================================ */
  const GA = {
    W, H, BD, t: 0, depth: 1,
    enemies: [], bullets: [], parts: [], texts: [], shocks: [],
    drops: [],
    player: null, stats: null,
    kills: 0, killsTotal: 0, level: 1,
    nextKills: 50, killGap: 50,
    spawnT: 0.6, cap: 220, D: null,
    picked: {}, paused: false, over: false,
    mouse: { x: W / 2, y: H / 2 },
    /* 大厅 / 难度 / 胜利 */
    screen: 'lobby', goal: 5000, diffK: 1, diffName: '中等',
    selDiff: 'normal', selCls: 'warrior', selGender: 'f', gender: 'f',
    selWings: true, selWingColor: '#ffffff',
    wingsOn: true, wingColor: '#ffffff'
  };
  G.GAME = GA;

  /* 触屏设备判定（无头测试沙箱没有 matchMedia，需容错） */
  const IS_TOUCH = (typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(pointer:coarse)').matches);

  /* ============================================================
     存档：跨局累计击杀（localStorage 持久化；无头测试无该 API 时退化为内存）
     ============================================================ */
  const SAVE_KEY = 'yueguan_save_v1';
  const WING_UNLOCK = 50000;                 // 累计击杀达标 → 解锁奖励翅膀
  const store = {
    _mem: null,
    read() {
      if (this._mem) return this._mem;
      try { this._mem = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
      catch (e) { this._mem = {}; }
      return this._mem;
    },
    write(v) {
      this._mem = v;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch (e) { }
    }
  };
  (function loadSave() {
    const sv = store.read();
    GA.totalKills = sv.totalKills || 0;      // 历史累计击杀（跨局、跨刷新）
    if (sv.wingCol) GA.selWingColor = sv.wingCol;
  })();
  let saveTick = 0;
  function persistSave() {
    store.write({ totalKills: GA.totalKills, wingCol: GA.selWingColor });
  }
  function wingUnlocked() { return GA.totalKills >= WING_UNLOCK; }

  /* 关闭 / 切后台 / 刷新前立即落盘：保证「关掉再开也还在」 */
  function flushSave() { try { persistSave(); } catch (e) { } }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushSave);
    window.addEventListener('beforeunload', flushSave);
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushSave();
    });
  }

  /* 难度模式：胜利目标击杀数 + 怪物密度/强度系数 */
  const DIFFS = {
    easy:   { goal: 1000,  k: 0.68, name: '简单' },
    normal: { goal: 5000,  k: 1.0,  name: '中等' },
    hard:   { goal: 10000, k: 1.5,  name: '困难' }
  };

  /* ---------- 玩家初始属性 ---------- */
  function freshStats() {
    return {
      maxHp: 120, hp: 120,
      speed: 92,
      damage: 15,
      fireRate: 4.2,          // 每秒发数
      bulletSpd: 210,
      pierce: 0, multishot: 1,
      crit: 0.05, critDmg: 1.0,
      lifesteal: 0, armor: 0,
      mag: 12, reload: 1.05,
      thorn: 0, thornR: 46,
      homing: 0, boom: 0,
      starEvery: 99,
      petalN: 12, petalDmg: 1.1,
      qMul: 1, qRad: 0,                       // Q 玫瑰旋风：伤害倍率 / 额外半径
      cdQ: 5.5, cdE: 7.0, cdR: 18.0           // Q / E / R(大招) 冷却
    };
  }

  /* ---------- 开局 / 重置 ---------- */
  function reset() {
    GA.t = 0; GA.kills = 0; GA.level = 1;
    GA.nextKills = 50; GA.killGap = 50;
    GA.enemies.length = 0; GA.bullets.length = 0;
    GA.parts.length = 0; GA.texts.length = 0;
    GA.shocks.length = 0; GA.drops.length = 0;
    GA.picked = {}; GA.spawnT = 0.8; GA.over = false; GA.paused = false;
    GA.firing = false; GA.mouseActive = false;
    GA.touchAx = { x: 0, y: 0 };            // 触屏摇杆虚拟轴 [-1,1]
    GA.autoAtk = false;                      // 自动攻击开关
    GA.userPaused = false;                   // 玩家手动暂停（区别于升级弹窗暂停）
    GA.stats = freshStats();
    GA.cls = GA.cls || 'warrior';              // 职业由大厅选择决定，缺省战士
    GA.swapCd = 0;                             // 职业切换冷却
    GA.atkAnim = 0; GA.castFx = 0; GA.swingAng = 0;
    GA.res = {};
    for (const c in G.CLASS) GA.res[c] = resMax(c);
    GA.player = {
      x: W / 2, y: H / 2 - 6, dir: 0, flip: false,
      anim: 0, inv: 0, emptyT: 0, emptyCls: null,   // emptyCls：装填归属职业（切职业也不丢）
      fireT: 0, shotN: 0,
      recoil: 0, recoilA: 0,                // 重铳后坐力：剩余时间 / 射击朝向
      dash: 0, dashDx: 0, dashDy: 0,
      cdQ: 0, cdE: 0, cdR: 0, cdS: 0,
      hitFlash: 0
    };
    GA.D = G.enemy.diff(0, GA.depth);
    $('over').classList.remove('on');
    $('levelup').classList.remove('on');
    buildHudIcons();
    syncHud();
  }

  /* ============================================================
     画布与自适应缩放
     ============================================================ */
  function fit() {
    const pad = 24;
    const sw = (window.innerWidth - pad) / W;
    const sh = (window.innerHeight - pad) / H;
    /* 允许 <1 倍：窄屏手机（<480px）也能整块进视口，避免左右溢出把摇杆/攻击键挤出屏外 */
    scale = Math.max(0.5, Math.min(sw, sh));
    cv.width = Math.round(W * scale);
    cv.height = Math.round(H * scale);
    cv.style.width = cv.width + 'px';
    cv.style.height = cv.height + 'px';
    ctx.imageSmoothingEnabled = false;
    $('stage').style.width = cv.width + 'px';
    $('stage').style.height = cv.height + 'px';
  }

  /* ============================================================
     输入
     ============================================================ */
  /* ---------- 暂停切换（桌面 P / Esc 键 + 触控按钮共用） ---------- */
  function togglePause() {
    if (GA.screen !== 'play' || GA.over) return;
    if ($('levelup').classList.contains('on')) return;   // 升级弹窗中不可切换
    if (GA.paused) { GA.paused = false; GA.userPaused = false; $('pause').classList.remove('on'); }
    else { GA.paused = true; GA.userPaused = true; $('pause').classList.add('on'); }
  }

  const keys = {};
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'escape'].includes(k)) e.preventDefault();
    if (k === 'p' || k === 'escape') { togglePause(); return; }   // 键盘暂停 / 继续
    if (GA.over || GA.paused) return;
    if (k === 'q') skillQ();
    if (k === 'e') skillE();
    if (k === 'r') skillR();
    if (k === ' ') skillS();
    if (k === 'f') swapClass();
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  cv.addEventListener('mousemove', e => {
    const r = cv.getBoundingClientRect();
    GA.mouse.x = (e.clientX - r.left) / scale;
    GA.mouse.y = (e.clientY - r.top) / scale;
    GA.mouseActive = true;
  });
  /* 鼠标左键 = 普攻（按住连射） */
  cv.addEventListener('mousedown', e => {
    if (e.button === 0) { GA.firing = true; GA.mouseActive = true; }
  });
  addEventListener('mouseup', e => { if (e.button === 0) GA.firing = false; });
  cv.addEventListener('mouseleave', () => { GA.firing = false; });
  /* 触屏普攻键（右上角） */
  const atkBtn = document.getElementById('atkBtn');
  const atkOn = e => { if (e) e.preventDefault(); GA.firing = true; GA.mouseActive = false; };
  const atkOff = e => { if (e) e.preventDefault(); GA.firing = false; };
  if (atkBtn) {
    atkBtn.addEventListener('mousedown', atkOn);
    atkBtn.addEventListener('touchstart', atkOn, { passive: false });
    atkBtn.addEventListener('mouseup', atkOff);
    atkBtn.addEventListener('mouseleave', atkOff);
    atkBtn.addEventListener('touchend', atkOff, { passive: false });
    atkBtn.addEventListener('touchcancel', atkOff, { passive: false });
  }

  const down = k => !!keys[k];
  GA._keys = keys;                    // 供自动化测试注入输入
  const axisX = () => (down('d') || down('arrowright') ? 1 : 0) - (down('a') || down('arrowleft') ? 1 : 0) + GA.touchAx.x;
  const axisY = () => (down('s') || down('arrowdown') ? 1 : 0) - (down('w') || down('arrowup') ? 1 : 0) + GA.touchAx.y;

  /* 瞄准目标：全自动 —— 有怪就锁定最近怪，没有怪才退化为「角色朝向」。
     鼠标只负责开火（point & click），不再决定攻击方向。 */
  const DIRVEC = [[0, 1], [0, -1], [1, 0], [-1, 0]];   // p.dir: 0下 1上 2右 3左
  function aimTarget() {
    const e = nearestEnemy(GA.player.x, GA.player.y);   // 自动锁定最近怪物
    if (e) return e;
    const p = GA.player, v = DIRVEC[p.dir] || DIRVEC[1]; // 无怪时朝当前朝向
    return { x: p.x + v[0] * 60, y: p.y + v[1] * 60 };
  }
  GA.aim = aimTarget;

  /* ============================================================
     特效工具（供 enemy.js 调用）
     ============================================================ */
  GA.pop = function (x, y, v, crit) {
    if (GA.texts.length > 60) return;
    GA.texts.push({
      x: x + (Math.random() * 6 - 3), y,
      txt: String(v), life: crit ? 0.75 : 0.55,
      max: crit ? 0.75 : 0.55,
      crit: !!crit, vy: crit ? -34 : -26
    });
  };

  GA.burst = function (x, y, kind, boss) {
    const cols = { slime: '#5fd35f', bat: '#7b4bd6', skel: '#e8e6f0', rose: '#ff6b8a', wisp: '#7fe6ff', brute: '#8d8aa3' };
    const col = cols[kind] || '#ff9ecb';
    const n = boss ? 34 : 10;
    for (let i = 0; i < n; i++) {
      if (GA.parts.length > 420) break;
      const a = Math.random() * Math.PI * 2, s = (boss ? 60 : 34) * (0.4 + Math.random());
      GA.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 12,
        life: 0.4 + Math.random() * 0.5, max: 0.9,
        col, size: boss ? 3 : 2, g: 120
      });
    }
    /* 花瓣 */
    for (let i = 0; i < (boss ? 10 : 3); i++) {
      const a = Math.random() * Math.PI * 2;
      GA.parts.push({
        x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40,
        life: 0.9, max: 0.9, col: null,
        img: G.PETAL[Math.floor(Math.random() * G.PETAL.length)], g: 40
      });
    }
  };

  GA.shock = function (x, y, r, dmg, col) {
    GA.shocks.push({ x, y, r: 4, maxR: r, life: 0.32, max: 0.32, col: col || '#ffd166' });
    if (dmg) for (const e of GA.enemies) {
      if (Math.hypot(e.x - x, e.y - y) < r) G.enemy.damage(GA, e, dmg, false, true);
    }
  };

  GA.hurtPlayer = function (dmg) {
    const p = GA.player, S = GA.stats;
    if (p.inv > 0 || GA.over) return;
    /* 奖励翅膀「羽护」：穿上时受到伤害 -25%（与升级护甲叠加，总减免上限 75%） */
    const wingDef = GA.wingsOn ? 0.25 : 0;
    const real = Math.max(1, dmg * (1 - Math.min(0.75, S.armor + wingDef)));
    S.hp -= real;
    p.inv = 0.62;
    p.hitFlash = 0.25;
    if (G.audio) G.audio.sfx('hurt');
    shake = Math.min(9, shake + 4.5);
    GA.pop(p.x, p.y - 16, Math.round(real), false, true);
    if (S.hp <= 0) { S.hp = 0; gameOver(); }
  };

  GA.onKill = function (e) {
    GA.totalKills++;                          // 跨局累计击杀（存档用）
    if (++saveTick >= 10) { saveTick = 0; persistSave(); }
    if (G.audio) G.audio.sfx('kill');
    if (GA.kills >= GA.nextKills) triggerLevel();
    syncHud();
  };

  /* ============================================================
     射击
     ============================================================ */
  function nearestEnemy(x, y) {
    let best = null, bd = 1e9;
    for (const e of GA.enemies) {
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /* ---------- 职业资源上限（受「花匣」卡加成） ---------- */
  function resMax(cls) {
    const bonus = Math.max(0, Math.floor((GA.stats.mag - 12) / 8));
    const base = G.CLASS[cls].resMax;
    return base + (cls === 'warrior' ? bonus : bonus * 5);
  }

  /* ---------- 切换职业：F 键循环 4 职业，15 秒冷却 ---------- */
  function swapClass() {
    if (GA.swapCd > 0 || GA.over || GA.paused || GA.screen !== 'play') return;
    const keys = Object.keys(G.CLASS);
    setClass(keys[(keys.indexOf(GA.cls) + 1) % keys.length]);
  }
  /* 直接设定职业（HUD 槽点击 / 战斗内切换） */
  function setClass(to) {
    if (to === GA.cls || GA.swapCd > 0 || GA.over || GA.paused) return;
    GA.cls = to;
    GA.swapCd = 15;
    const col = { warrior: '#ffd166', mage: '#ff9ecb', gunner: '#ffe07a', archer: '#9bff7a' }[to] || '#ffd166';
    GA.shock(GA.player.x, GA.player.y, 44, 0, col);
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      GA.parts.push({
        x: GA.player.x, y: GA.player.y,
        vx: Math.cos(a) * 80, vy: Math.sin(a) * 80,
        life: 0.7, max: 0.7, col, size: 2, g: -20
      });
    }
    shake = Math.min(8, shake + 3);
    syncHud();
  }

  /* ---------- 统一攻击入口 ---------- */
  function attack(C) {
    const p = GA.player;
    GA.res[GA.cls] -= C.cost;
    if (GA.cls === 'warrior') meleeSwing(C); else castBolt(C);
    if (GA.res[GA.cls] < C.cost && C.empty > 0) {
      p.emptyT = C.empty * GA.stats.reload;
      p.emptyCls = GA.cls;                        // 记住是哪个职业在装填
      if (GA.cls === 'gunner') reloadFx();        // 重铳：退空弹匣 + 装填提示
    }
    syncHud();
  }

  /* ---------- 重铳换弹：空弹匣落地 + 装填提示 ---------- */
  function reloadFx() {
    const p = GA.player;
    GA.parts.push({                            // 退下的空弹匣
      x: p.x + 4, y: p.y + 2, vx: 34, vy: -55,
      life: 0.5, max: 0.5, col: '#8a6b2f', size: 2, g: 420
    });
    GA.shock(p.x, p.y - 4, 14, 0, '#9fb0c9');
    GA.texts.push({
      x: p.x - 8, y: p.y - 24, txt: '装填', life: 0.7, max: 0.7,
      crit: true, vy: -22
    });
  }

  /* ---------- 战士：扇形横斩 ---------- */
  function meleeSwing(C) {
    const p = GA.player, S = GA.stats;
    const a = aimTarget();
    const base = Math.atan2(a.y - p.y, a.x - p.x);
    GA.swingAng = base;
    GA.atkAnim = 0.26;
    if (G.audio) G.audio.sfx('swing');

    p.shotN++;
    const isStar = (p.shotN % S.starEvery) === 0;
    const dmg = S.damage * C.dmgMul * (isStar ? 2.0 : 1);
    let any = false;

    for (const e of GA.enemies) {
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > C.range + e.r) continue;
      let da = Math.atan2(dy, dx) - base;
      da = ((da + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(da) > C.arc / 2) continue;
      const ang = Math.atan2(dy, dx);
      const crit = Math.random() < S.crit;
      const dealt = dmg * (crit ? 2 + S.critDmg : 1);
      G.enemy.damage(GA, e, dealt, crit);
      const k = C.knock * (e.boss ? 0.35 : 1);
      e.kbx += Math.cos(ang) * k; e.kby += Math.sin(ang) * k;
      /* 吸血：把本次伤害的一部分转为回血（受击上限保护） */
      if (C.leech) {
        const heal = dealt * C.leech;
        if (heal > 0) S.hp = Math.min(S.maxHp, S.hp + heal);
      }
      any = true;
    }

    /* 剑气弧 */
    for (let i = 0; i < 18; i++) {
      const a = base - C.arc / 2 + C.arc * (i / 17);
      for (let j = 0; j < 2; j++) {
        const rr = C.range * (0.5 + j * 0.45);
        GA.parts.push({
          x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr,
          vx: Math.cos(a) * 34, vy: Math.sin(a) * 34,
          life: 0.16 + j * 0.06, max: 0.28,
          col: j ? '#ffd166' : '#ffffff', size: 2, g: 0
        });
      }
    }
    if (isStar) GA.shock(p.x, p.y, C.range * 1.15, dmg * 0.5, '#ffd166');
    if (any) shake = Math.min(7, shake + 1.6);
  }

  /* ---------- 远程职业通用：法师魔弹 / 枪手弹丸 / 游侠穿箭 ---------- */
  function castBolt(C) {
    const p = GA.player, S = GA.stats;
    /* 瞄准优先级：鼠标(桌面) → 最近怪物(自动辅助) → 当前朝向(可空射/远射)
       这样不必贴近怪物也能攻击，且能朝任意方向自由开火 */
    const a = aimTarget();
    const base = Math.atan2(a.y - p.y, a.x - p.x);
    GA.castFx = 0.14;
    p.shotN++;
    const isStar = (p.shotN % S.starEvery) === 0;
    const spd = C.bulletSpd || S.bulletSpd;
    const pierce = S.pierce + (C.basePierce || 0);
    const type = C.bulletType || 'orb';

    if (isStar) {
      GA.bullets.push({
        x: p.x, y: p.y,           vx: Math.cos(base) * 250, vy: Math.sin(base) * 250,
        dmg: S.damage * 2.6, r: 6, pierce: 99, life: 2.2, star: true,
        homing: Math.max(1, S.homing), hits: [], ang: base, type: 'star', splash: 0
      });
      GA.shock(p.x, p.y, 16, 0, '#ffd166');
    } else {
      const n = S.multishot;
      for (let i = 0; i < n; i++) {
        const sp = (n === 1) ? 0 : (i / (n - 1) - 0.5) * 0.30;
        const crit = Math.random() < S.crit;
        const a = base + sp + (Math.random() - 0.5) * 0.05;
        const dmg = S.damage * C.dmgMul * (crit ? (2 + S.critDmg) : 1);
        GA.bullets.push({
          x: p.x, y: p.y - 1,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          dmg, r: type === 'arrow' ? 3 : 4, pierce, life: 2.2,
          crit, homing: S.homing, hits: [], ang: a, star: false,
          type, splash: C.splash || 0
        });
      }
    }

    /* 开火特效按武器分化：重铳(火光/抛壳/后坐) · 长弓(气浪) · 法杖(魔光) */
    if (type === 'bullet') muzzleFx(base);
    else if (type === 'arrow') bowFx(base);
    else orbFx(base);
    if (G.audio) G.audio.sfx('shoot');
  }

  /* ---------- 重铳开火：枪口焰 + 硝烟 + 抛壳 + 后坐力 ---------- */
  function muzzleFx(a) {
    const p = GA.player;
    const mx = p.x + Math.cos(a) * 12, my = p.y - 1 + Math.sin(a) * 12;
    /* 枪口焰：沿射向的锥形火舌，白→金→橙三层 */
    for (let i = 0; i < 9; i++) {
      const sa = a + (Math.random() - 0.5) * 0.8;
      const sp = 110 + Math.random() * 170;
      GA.parts.push({
        x: mx, y: my, vx: Math.cos(sa) * sp, vy: Math.sin(sa) * sp,
        life: 0.09 + Math.random() * 0.08, max: 0.17,
        col: i % 3 === 0 ? '#fff6c8' : (i % 3 === 1 ? '#ffd166' : '#ff8c2b'),
        size: i % 3 === 0 ? 3 : 2, g: 0
      });
    }
    /* 硝烟：慢速上浮的灰团 */
    for (let i = 0; i < 3; i++) {
      const sa = a + (Math.random() - 0.5) * 1.4;
      GA.parts.push({
        x: mx, y: my, vx: Math.cos(sa) * 26, vy: Math.sin(sa) * 26 - 12,
        life: 0.42, max: 0.42, col: '#6b5f70', size: 2, g: -8
      });
    }
    /* 抛壳：侧向弹出，带重力落地 */
    const side = Math.random() < 0.5 ? 1 : -1;
    GA.parts.push({
      x: mx, y: my,
      vx: Math.cos(a + side * 1.75) * 95 - Math.cos(a) * 20,
      vy: Math.sin(a + side * 1.75) * 95 - 55,
      life: 0.6, max: 0.6, col: '#e8b84b', size: 2, g: 420
    });
    GA.shock(mx, my, 10, 0, '#ffd166');
    p.recoil = 0.17; p.recoilA = a;
  }

  /* ---------- 长弓开火：弓弦气浪 + 轻微后坐 ---------- */
  function bowFx(a) {
    const p = GA.player;
    const mx = p.x + Math.cos(a) * 9, my = p.y - 1 + Math.sin(a) * 9;
    for (let i = 0; i < 4; i++) {
      const sa = a + (Math.random() - 0.5) * 0.5;
      GA.parts.push({
        x: mx, y: my, vx: Math.cos(sa) * 70, vy: Math.sin(sa) * 70,
        life: 0.16, max: 0.16, col: '#9bff7a', size: 2, g: 0
      });
    }
    p.recoil = 0.07; p.recoilA = a;
  }

  /* ---------- 法杖开火：魔光 ---------- */
  function orbFx(a) {
    const p = GA.player;
    for (let i = 0; i < 3; i++) {
      const sa = a + (Math.random() - 0.5) * 0.7;
      GA.parts.push({
        x: p.x + Math.cos(a) * 9, y: p.y - 1 + Math.sin(a) * 9,
        vx: Math.cos(sa) * 55, vy: Math.sin(sa) * 55,
        life: 0.18, max: 0.18, col: '#ffb8da', size: 2, g: 0
      });
    }
  }

  /* ============================================================
     技能
     ============================================================ */
  function skillQ() {                        // Q：玫瑰旋风（身周 AoE）
    const p = GA.player, S = GA.stats;
    if (p.cdQ > 0 || GA.over) return;
    p.cdQ = S.cdQ;
    const R = 92 + S.qRad, dmg = S.damage * 1.3 * S.qMul;
    for (const e of GA.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < R + e.r) {
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        G.enemy.damage(GA, e, dmg, false);
        e.kbx += Math.cos(a) * 130; e.kby += Math.sin(a) * 130;
      }
    }
    GA.shock(p.x, p.y, R, 0, '#ff6b8a');
    GA.shock(p.x, p.y, R * 0.62, 0.05, '#ffd166');
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 130;
      GA.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, max: 0.5, col: '#ff9ecb', size: 2, g: 0 });
    }
    shake = Math.min(8, shake + 4);
    GA.pop(p.x, p.y - 22, '玫瑰旋风', true);
    syncHud();
  }

  function skillE() {                        // E：星辉冲刺（突进 + 路径伤害 + 无敌帧）
    const p = GA.player, S = GA.stats;
    if (p.cdE > 0 || GA.over) return;
    p.cdE = S.cdE;
    const aim = aimTarget();
    let dx = aim.x - p.x, dy = aim.y - p.y;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const dist = 132;
    const tx = Math.max(BD + 4, Math.min(W - BD - 4, p.x + dx * dist));
    const ty = Math.max(BD + 4, Math.min(H - BD - 4, p.y + dy * dist));
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const x = p.x + (tx - p.x) * i / steps, y = p.y + (ty - p.y) * i / steps;
      for (const e of GA.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - x, e.y - y) < 26 + e.r)
          G.enemy.damage(GA, e, S.damage * 0.8, false);
      }
      GA.parts.push({ x, y, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, life: 0.3, max: 0.3, col: '#fff6c8', size: 2, g: 0 });
    }
    p.x = tx; p.y = ty;
    p.inv = Math.max(p.inv, 0.36);
    GA.shock(p.x, p.y, 26, 0, '#fff6c8');
    GA.pop(p.x, p.y - 22, '星辉冲刺', true);
    syncHud();
  }

  function skillR() {                        // R：月华绽放（大招 · 全屏强震）
    const p = GA.player, S = GA.stats;
    if (p.cdR > 0 || GA.over) return;
    p.cdR = S.cdR;
    const R = 212, dmg = S.damage * 4.8;
    for (const e of GA.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < R + e.r) {
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        const fall = 1 - d / (R + e.r) * 0.4;        // 越近越痛
        G.enemy.damage(GA, e, dmg * fall, false);
        e.kbx += Math.cos(a) * 240; e.kby += Math.sin(a) * 240;
      }
    }
    GA.shock(p.x, p.y, R, 0, '#ffd166');
    GA.shock(p.x, p.y, R * 0.7, 0.06, '#ff9ecb');
    GA.shock(p.x, p.y, R * 0.4, 0.12, '#fff6c8');
    for (let i = 0; i < 64; i++) {
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 230;
      GA.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7, max: 0.7, col: i % 2 ? '#ffd166' : '#ff9ecb', size: 3, g: 0 });
    }
    shake = Math.min(10, shake + 7);
    GA.pop(p.x, p.y - 26, '★ 月华绽放 ★', true);
    syncHud();
  }

  function skillS() {                        // 空格翻滚
    const p = GA.player;
    if (p.cdS > 0 || GA.over) return;
    p.cdS = 1.1;
    const aim = aimTarget();
    let dx = p.x - aim.x, dy = p.y - aim.y;
    const l = Math.hypot(dx, dy) || 1;
    p.dashDx = dx / l; p.dashDy = dy / l;
    p.dash = 0.16; p.inv = Math.max(p.inv, 0.40);
  }

  /* ============================================================
     升级：三选一
     ============================================================ */
  function triggerLevel() {
    GA.kills -= GA.nextKills;
    GA.killGap += 10;
    GA.nextKills = GA.killGap;
    GA.level++;
    GA.paused = true;
    if (G.audio) G.audio.sfx('level');

    const cards = G.drawCards(GA.picked, 3);
    const box = $('cards');
    box.innerHTML = '';
    cards.forEach(c => {
      const el = document.createElement('div');
      el.className = 'card';
      const ic = document.createElement('canvas');
      ic.width = 16; ic.height = 16;
      const ig = ic.getContext('2d');
      ig.imageSmoothingEnabled = false;
      ig.drawImage(G.icon(c.icon), 0, 0);
      const tag = document.createElement('div');
      tag.className = 'r c' + c.rarity;
      tag.textContent = ['', '普 通', '稀 有', '史 诗'][c.rarity];
      const t = document.createElement('div'); t.className = 't'; t.textContent = c.name;
      const d = document.createElement('div'); d.className = 'd'; d.textContent = c.desc();
      const own = document.createElement('div');
      own.className = 'd';
      own.style.cssText = 'margin-top:5px;color:#7d719a';
      own.textContent = '已持有 ' + (GA.picked[c.id] || 0) + ' / ' + c.max;
      el.append(ic, tag, t, d, own);
      el.onclick = () => {
        c.apply(GA.stats);
        GA.picked[c.id] = (GA.picked[c.id] || 0) + 1;
        $('levelup').classList.remove('on');
        GA.paused = false;
        /* 升级光环 */
        GA.shock(GA.player.x, GA.player.y, 46, 0, '#ffd166');
        for (let i = 0; i < 22; i++) {
          const a = Math.random() * Math.PI * 2;
          GA.parts.push({
            x: GA.player.x, y: GA.player.y,
            vx: Math.cos(a) * 70, vy: Math.sin(a) * 70,
            life: 0.8, max: 0.8, col: '#ffd166', size: 2, g: -30
          });
        }
        syncHud();
      };
      box.appendChild(el);
    });
    $('lvlsub').textContent = '第 ' + GA.level + ' 次境界提升 · 击杀 ' + GA.killsTotal + ' 选择一枚祝福铭刻于身';
    $('levelup').classList.add('on');
  }

  /* ============================================================
     主循环
     ============================================================ */
  function update(dt) {
    const p = GA.player, S = GA.stats;
    GA.t += dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 26);

    /* 难度与波次 */
    GA.D = G.enemy.diff(GA.t, GA.depth, GA.diffK);

    /* --- 移动 --- */
    const ax = axisX(), ay = axisY();
    let mvx = ax, mvy = ay;
    const ml = Math.hypot(mvx, mvy);
    if (ml > 0) { mvx /= ml; mvy /= ml; }

    let spd = S.speed;
    if (p.dash > 0) {
      p.dash -= dt;
      spd = S.speed * 5.2;
      mvx = p.dashDx; mvy = p.dashDy;
      if (Math.random() < 0.6) {
        GA.parts.push({
          x: p.x, y: p.y, vx: 0, vy: 0,
          life: 0.28, max: 0.28, col: '#8fe36b', size: 2, g: 0
        });
      }
    }
    p.x += mvx * spd * dt;
    p.y += mvy * spd * dt;
    const pad = BD + 4;
    p.x = Math.max(pad, Math.min(W - pad, p.x));
    p.y = Math.max(pad, Math.min(H - pad, p.y));

    /* 朝向与行走动画 */
    if (ml > 0 || p.dash > 0) {
      p.anim += dt * (p.dash > 0 ? 14 : 8.5);
      if (Math.abs(mvy) > Math.abs(mvx) * 1.15) p.dir = mvy > 0 ? 0 : 1;
      else { p.dir = mvx < 0 ? 3 : 2; }
    } else p.anim = 0;

    /* --- 计时器 --- */
    if (p.inv > 0) p.inv -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    if (p.cdQ > 0) p.cdQ -= dt;
    if (p.cdE > 0) p.cdE -= dt;
    if (p.cdR > 0) p.cdR -= dt;
    if (p.cdS > 0) p.cdS -= dt;

    /* --- 职业资源与攻击 --- */
    const C = G.CLASS[GA.cls];
    const maxRes = resMax(GA.cls);
    if (p.emptyT > 0) {
      p.emptyT -= dt;
      if (p.emptyT <= 0) {
        /* 回满「触发装填的那个职业」，中途切职业也不会回错 */
        const ec = p.emptyCls || GA.cls;
        GA.res[ec] = resMax(ec);
        p.emptyCls = null;
      }
    } else if (C.regen > 0) {
      GA.res[GA.cls] = Math.min(maxRes, GA.res[GA.cls] + C.regen * dt);
    }
    /* 兜底：无被动回复的职业（重铳/战士）若资源为空且未在装填，自动补一次装填，避免卡死无法攻击 */
    if (p.emptyT <= 0 && C.empty > 0 && C.regen === 0 && GA.res[GA.cls] < C.cost) {
      p.emptyT = C.empty * S.reload;
      p.emptyCls = GA.cls;
    }
    /* 非活跃职业也在后台缓慢回充，切换过去不会空资源 */
    for (const c in G.CLASS) {
      if (c === GA.cls) continue;
      const cm = resMax(c);
      if (GA.res[c] < cm) GA.res[c] = Math.min(cm, GA.res[c] + G.CLASS[c].regen * dt);
    }
    if (GA.atkAnim > 0) GA.atkAnim -= dt;
    if (GA.castFx > 0) GA.castFx -= dt;
    if (GA.swapCd > 0) GA.swapCd -= dt;
    if (p.recoil > 0) p.recoil -= dt;

    /* 普攻：按住鼠标左键 / 触屏普攻键才开火；开启自动攻击时持续开火 */
    if (p.emptyT <= 0 && (GA.firing || GA.autoAtk)) {
      p.fireT -= dt;
      if (p.fireT <= 0 && GA.res[GA.cls] >= C.cost) {
        p.fireT = (1 / S.fireRate) * C.cdMul;
        attack(C);
      }
    }

    /* --- 荆棘光环视觉 --- */
    if (S.thorn > 0 && Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2;
      GA.parts.push({
        x: p.x + Math.cos(a) * S.thornR, y: p.y + Math.sin(a) * S.thornR,
        vx: 0, vy: -18, life: 0.5, max: 0.5, col: '#8fe36b', size: 1, g: 0
      });
    }

    /* --- 子弹 --- */
    for (let i = GA.bullets.length - 1; i >= 0; i--) {
      const b = GA.bullets[i];
      b.life -= dt;
      if (b.life <= 0) { GA.bullets.splice(i, 1); continue; }

      /* 追踪 */
      if (b.homing > 0) {
        const tgt = nearestEnemy(b.x, b.y);
        if (tgt) {
          const want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
          let cur = Math.atan2(b.vy, b.vx);
          let df = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          const turn = Math.min(Math.abs(df), 4.5 * b.homing * dt) * Math.sign(df);
          const na = cur + turn;
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
          b.ang = na;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;

      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) { GA.bullets.splice(i, 1); continue; }

      /* 命中检测 */
      let done = false;
      for (const e of GA.enemies) {
        if (e.dead || b.hits.indexOf(e) >= 0) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          b.hits.push(e);
          G.enemy.damage(GA, e, b.dmg, b.crit);
          /* 法师魔弹：命中溅射 */
          if (b.splash) {
            for (const o of GA.enemies) {
              if (o === e || o.dead || b.hits.indexOf(o) >= 0) continue;
              if (Math.hypot(o.x - e.x, o.y - e.y) < b.splash) {
                b.hits.push(o);
                G.enemy.damage(GA, o, b.dmg * 0.5, false, true);
              }
            }
            GA.shock(b.x, b.y, b.splash, 0, '#ff9ecb');
          }
          if (b.pierce <= 0) { done = true; break; }
          b.pierce--;
        }
      }
      if (done) {
        GA.bullets.splice(i, 1);
        continue;
      }
      /* 拖尾 */
      if (!b.petal && Math.random() < 0.5) {
        GA.parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.12, max: 0.12, col: b.star ? '#ffd166' : '#fff6c8', size: 1, g: 0 });
      }
    }

    /* --- 敌人 --- */
    G.enemy.update(GA, dt);

    /* --- 粒子 / 飘字 / 冲击波 --- */
    for (let i = GA.parts.length - 1; i >= 0; i--) {
      const q = GA.parts[i];
      q.life -= dt;
      if (q.life <= 0) { GA.parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vy += (q.g || 0) * dt;
      q.vx *= Math.pow(0.12, dt);
    }
    for (let i = GA.texts.length - 1; i >= 0; i--) {
      const q = GA.texts[i];
      q.life -= dt;
      if (q.life <= 0) { GA.texts.splice(i, 1); continue; }
      q.y += q.vy * dt; q.vy += 62 * dt;
    }
    for (let i = GA.shocks.length - 1; i >= 0; i--) {
      const q = GA.shocks[i];
      q.life -= dt;
      if (q.life <= 0) { GA.shocks.splice(i, 1); continue; }
      q.r = q.maxR * (1 - q.life / q.max);
    }

    /* 法阵回血（站中央缓慢回复） */
    if (Math.hypot(p.x - W / 2, p.y - H / 2) < 46 && S.hp < S.maxHp) {
      S.hp = Math.min(S.maxHp, S.hp + dt * 3.0);
    }

    /* 胜利：累计击杀达到目标 */
    if (GA.screen === 'play' && GA.killsTotal >= GA.goal) gameWin();
  }

  /* ============================================================
     渲染
     ============================================================ */
  function render() {
    const p = GA.player, S = GA.stats;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);

    ctx.drawImage(BG, 0, 0);

    /* 星芒法阵 */
    G.scene.altar(ctx, W / 2, H / 2, GA.t);

    /* 大厅：女孩站在中央法阵上，仅做待机展示（不启动战斗） */
    if (GA.screen === 'lobby') {
      const fy = Math.sin(GA.t * 3) * 1.5;
      drawHero(GA.selCls, GA.selGender, W / 2, H / 2 - 6 + fy, 0);
      return;
    }

    /* 荆棘光环 */
    if (S.thorn > 0) {
      ctx.globalAlpha = 0.20 + Math.sin(GA.t * 3) * 0.05;
      G.scene.pxRing(ctx, p.x, p.y, S.thornR, '#8fe36b', 1);
      ctx.globalAlpha = 1;
    }

    /* 敌人 */
    G.enemy.draw(ctx, GA);

    /* 子弹 */
    for (const b of GA.bullets) {
      if (b.star) {
        ctx.drawImage(G.STAR, Math.round(b.x - 3.5), Math.round(b.y - 3.5));
      } else if (b.type === 'bullet') {
        const a = b.ang || 0;
        ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(a);
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff8c2b';   // 曳光拖尾
        ctx.fillRect(-10, -1, 8, 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffd166'; ctx.fillRect(-3, -1, 7, 2);   // 弹身
        ctx.fillStyle = '#fff6c8'; ctx.fillRect(3, -1, 2, 2);    // 弹头亮尖
        ctx.restore();
      } else if (b.type === 'arrow') {
        const a = b.ang || 0;
        ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(a);
        ctx.fillStyle = '#cfd3e0'; ctx.fillRect(-4, -1, 7, 2);
        ctx.fillStyle = '#9bff7a'; ctx.fillRect(-4, -1, 4, 2);
        ctx.fillStyle = '#ff6b8a'; ctx.fillRect(3, -2, 2, 4);
        ctx.restore();
      } else if (b.type === 'orb') {
        const c = b.crit ? '#ffd166' : '#fff6c8';
        ctx.fillStyle = c; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
        ctx.fillStyle = '#ff9ecb';
        ctx.fillRect(Math.round(b.x - Math.cos(b.ang) * 3) - 1, Math.round(b.y - Math.sin(b.ang) * 3) - 1, 1, 1);
      } else if (b.petal) {
        const img = G.PETAL[1];
        ctx.drawImage(img, Math.round(b.x - 3), Math.round(b.y - 3));
      } else if (b.moon) {
        ctx.fillStyle = '#b388ff';
        ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
        ctx.fillStyle = '#e0d0ff';
        ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
      } else {
        const c = b.crit ? '#ffd166' : '#fff6c8';
        ctx.fillStyle = c; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
        ctx.fillStyle = '#ff9ecb';
        ctx.fillRect(Math.round(b.x - Math.cos(b.ang) * 3) - 1, Math.round(b.y - Math.sin(b.ang) * 3) - 1, 1, 1);
      }
    }

    /* 玩家（22×26 精灵，始终正面；脚底落在 p.y+6） */
    const img = G.HEROES[GA.cls][GA.gender][Math.floor(p.anim) % 3];
    const px = Math.round(p.x - 11), py = Math.round(p.y - 20);
    /* 影子 */
    ctx.globalAlpha = 0.30; ctx.fillStyle = '#000';
    ctx.fillRect(px + 5, py + 24, 12, 3); ctx.globalAlpha = 1;
    /* 装饰羽翼（身后） */
    drawWings(ctx, p.x, p.y, GA.t, GA.wingsOn, GA.wingColor);
    /* 无敌闪烁 */
    const blink = p.inv > 0 && Math.floor(p.inv * 20) % 2 === 0;
    if (!blink) {
      ctx.drawImage(img, px, py);
      if (p.hitFlash > 0) {
        ctx.save();
        ctx.globalAlpha = p.hitFlash * 3;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#ff6b8a';
        ctx.fillRect(px, py, 22, 26);
        ctx.restore();
      }
      drawWeapon();
    }
    /* 冲刺残影 */
    if (p.dash > 0) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(img, px - p.dashDx * 6, py - p.dashDy * 6);
      ctx.globalAlpha = 1;
    }

    /* 粒子 */
    for (const q of GA.parts) {
      ctx.globalAlpha = Math.min(1, q.life / q.max * 1.6);
      if (q.img) ctx.drawImage(q.img, Math.round(q.x - 3), Math.round(q.y - 3));
      else { ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); }
    }
    ctx.globalAlpha = 1;

    /* 冲击波 */
    for (const q of GA.shocks) {
      ctx.globalAlpha = (q.life / q.max) * 0.8;
      G.scene.pxRing(ctx, q.x, q.y, q.r, q.col, 2);
    }
    ctx.globalAlpha = 1;

    /* 飘字 */
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    for (const q of GA.texts) {
      ctx.globalAlpha = Math.min(1, q.life / q.max * 1.8);
      ctx.fillStyle = q.crit ? '#ffd166' : '#fff';
      if (q.crit) ctx.font = 'bold 10px monospace'; else ctx.font = '8px monospace';
      ctx.fillText(q.txt, Math.round(q.x), Math.round(q.y));
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    /* 暗角 */
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(6,3,12,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    /* 低血量红边 */
    if (S.hp / S.maxHp < 0.3) {
      ctx.globalAlpha = 0.16 + Math.sin(GA.t * 6) * 0.08;
      const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
      rg.addColorStop(0, 'rgba(255,0,40,0)');
      rg.addColorStop(1, 'rgba(255,0,40,0.9)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  /* ============================================================
     HUD
     ============================================================ */
  /* 大厅待机展示：女孩站在中央法阵上，无武器 */
  function drawHero(cls, gender, x, y, anim) {
    const img = G.HEROES[cls][gender][Math.floor(anim) % 3];
    const px = Math.round(x - 11), py = Math.round(y - 20);
    ctx.globalAlpha = 0.30; ctx.fillStyle = '#000';
    ctx.fillRect(px + 5, py + 24, 12, 3); ctx.globalAlpha = 1;
    drawWings(ctx, x, y, GA.t, GA.selWings, GA.selWingColor); // 装饰羽翼（身后）
    ctx.drawImage(img, px, py);
  }

  /* 装饰羽翼：纯视觉，画在角色身后，缓慢扇动，无任何属性加成。
     颜色由 color 决定，膜=实色、骨=压暗、高光=提亮；on=false 时不画。 */
  function mix(hex, f) {                           // f∈[-1,1]：>0 提亮 <0 压暗
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    else { r *= (1 + f); g *= (1 + f); b *= (1 + f); }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  function drawWings(ctx, x, y, t, on, color) {
    if (!on) return;                               // 可穿脱：脱下则不绘制
    const cx = x, cy = y - 12;                     // 锚定上背/肩
    const flap = Math.sin(t * 3) * 1.8;             // 扇动幅度
    const membrane = color;                        // 实色膜（不再透明）
    const bone = mix(color, -0.34);                // 翅骨（压暗）
    const hi = mix(color, 0.42);                   // 高光（提亮）
    const seg = (dir) => {                         // dir +1 右 / -1 左
      const s = dir;
      const L = [
        { dx: 3,  dy: 3,                w: 6, h: 7 },
        { dx: 7,  dy: -1 + flap,        w: 7, h: 8 },
        { dx: 12, dy: -5 + flap * 1.5,  w: 6, h: 7 },
        { dx: 16, dy: -9 + flap * 2,    w: 4, h: 5 }
      ];
      for (const b of L) {
        const bx = s > 0 ? cx + b.dx : cx - b.dx - b.w;
        ctx.fillStyle = membrane;
        ctx.fillRect(bx, cy + b.dy, b.w, b.h);
        ctx.fillStyle = bone;                       // 下缘翅骨
        ctx.fillRect(bx, cy + b.dy + b.h - 1, b.w, 1);
      }
      ctx.fillStyle = hi;                           // 翅根高光
      ctx.fillRect(cx + (s > 0 ? 2 : -4), cy + 2, 2, 4);
    };
    ctx.save();
    seg(1); seg(-1);
    ctx.restore();
  }

  /* 武器锚点：正面角色，武器随瞄准方向摆到身前 */
  function drawWeapon() {
    const p = GA.player;
    const C = G.CLASS[GA.cls];
    const aim = GA.aim();
    const a = Math.atan2(aim.y - p.y, aim.x - p.x);
    let flip = Math.cos(a) < 0;
    let frame = 0, ox = 0, oy = -5;

    if (GA.cls === 'warrior') {
      if (GA.atkAnim > 0) {                       // 挥砍：武器随攻击方向甩出
        frame = Math.min(2, Math.floor((0.26 - GA.atkAnim) / 0.087));
        ox = Math.cos(GA.swingAng) * 12;
        oy = Math.sin(GA.swingAng) * 12 - 4;
        flip = Math.cos(GA.swingAng) < 0;
      }
    } else {
      frame = GA.castFx > 0 ? 1 : 0;              // 施法瞬间水晶充能
    }

    /* 后坐力：开火瞬间武器沿射击反方向后座（重铳最强） */
    let rx = 0, ry = 0;
    if (p.recoil > 0) {
      const k = Math.min(1, p.recoil / 0.17);
      const back = (GA.cls === 'gunner' ? 5 : 2) * k;
      rx = -Math.cos(p.recoilA) * back;
      ry = -Math.sin(p.recoilA) * back;
    }

    const wimg = C.weapon[frame];
    const cx = Math.round(p.x + ox + rx), cy = Math.round(p.y + oy + ry);
    ctx.save();
    if (flip) {
      ctx.scale(-1, 1);
      ctx.drawImage(wimg, -cx - 9, cy - 9);
    } else {
      ctx.drawImage(wimg, cx - 9, cy - 9);
    }
    ctx.restore();
  }

  let hudT = 0;
  function syncHud() {
    if (!GA.player) return; /* 大厅待机：HUD 隐藏，player 尚未创建 */
    const S = GA.stats, p = GA.player;
    const C = G.CLASS[GA.cls];
    const hpPct = Math.max(0, S.hp / S.maxHp) * 100;
    $('hpfill').style.width = hpPct + '%';
    $('hptxt').textContent = Math.ceil(S.hp) + '/' + Math.round(S.maxHp);
    const need = GA.nextKills;
    const cur = Math.max(0, need - GA.kills);
    $('xpfill').style.width = (100 - cur / need * 100) + '%';
    $('xptxt').textContent = '击杀 ' + (need - cur) + ' / ' + need + ' 触发提升';
    $('lv').textContent = 'Lv.' + GA.level;
    $('kill').textContent = '击杀 ' + GA.killsTotal;

    /* 资源名随职业变化（弹药读数移到左上角 #ammoHud） */
    const maxRes = resMax(GA.cls);
    const resName = { warrior: '架 势', mage: '法 力', gunner: '弹 药', archer: '箭 袋' };
    $('ammoHud').textContent = resName[GA.cls] + '  ' + (p.emptyT > 0
      ? '⟳ ' + Math.ceil(p.emptyT * 10) / 10 + 's'
      : Math.floor(GA.res[GA.cls]) + ' / ' + maxRes)
      + (GA.wingsOn ? ' · 羽护25%' : '');

    /* 四个职业槽高亮 + 切换冷却 */
    const cmap = { clW: 'warrior', clM: 'mage', clG: 'gunner', clA: 'archer' };
    for (const id in cmap) $(id).classList.toggle('on', GA.cls === cmap[id]);
    $('swapInfo').textContent = GA.swapCd > 0
      ? '冷却 ' + Math.ceil(GA.swapCd) + 's'
      : (IS_TOUCH ? '切换职业 · 就绪' : 'F 切换职业 · 就绪');
    $('swapInfo').classList.toggle('wait', GA.swapCd > 0);

    /* 顶部目标进度 */
    $('goal').textContent = '目标 ' + GA.goal + ' 杀 · 已杀 ' + GA.killsTotal;
  }

  function buildHudIcons() {
    [['icQ', 'petal'], ['icE', 'star'], ['icR', 'moon'],
     ['icCW', 'sword'], ['icCM', 'staff'], ['icCG', 'gun'], ['icCA', 'bow']].forEach(([id, kind]) => {
      const c = $(id), g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, 16, 16);
      g.drawImage(G.icon(kind), 0, 0);
    });
    /* 点击职业槽：战斗中切换，大厅中记录选择 */
    const cmap = { clW: 'warrior', clM: 'mage', clG: 'gunner', clA: 'archer' };
    for (const id in cmap) {
      $(id).onclick = () => { if (GA.screen === 'play') setClass(cmap[id]); else GA.selCls = cmap[id]; };
    }
  }

  function tickHud(dt) {
    if (!GA.player) return; /* 大厅待机：无需刷新血条/技能冷却 */
    hudT += dt;
    const m = Math.floor(GA.t / 60), s = Math.floor(GA.t % 60);
    $('clock').textContent = m + ':' + String(s).padStart(2, '0');
    const wave = 1 + Math.floor(GA.t / 30);
    $('wave').textContent = '第 ' + wave + ' 波 · 深度 ' + GA.depth;
    const p = GA.player;
    [['cdQ', p.cdQ], ['cdE', p.cdE], ['cdR', p.cdR]].forEach(([id, v]) => {
      const el = $(id);
      if (v > 0) { el.style.display = 'flex'; el.textContent = v.toFixed(1); }
      else el.style.display = 'none';
    });
    if (hudT > 0.1) { hudT = 0; syncHud(); }
  }

  /* ============================================================
     死亡
     ============================================================ */
  function gameOver() {
    GA.over = true;
    persistSave();
    const m = Math.floor(GA.t / 60), s = Math.floor(GA.t % 60);
    $('overst').innerHTML =
      '坚持 <b>' + m + ':' + String(s).padStart(2, '0') + '</b> · 击杀 <b>' + GA.killsTotal + '</b><br>' +
      '境界 <b>Lv.' + GA.level + '</b> · 目标 <b>' + GA.goal + '</b> 杀未达成';
    $('over').classList.add('on');
    $('hud').classList.add('hidden');
  }

  function gameWin() {
    GA.over = true;
    persistSave();
    const m = Math.floor(GA.t / 60), s = Math.floor(GA.t % 60);
    $('winst').innerHTML =
      '达成 <b>' + GA.diffName + '</b> 目标 · 击杀 <b>' + GA.killsTotal + '</b><br>' +
      '用时 <b>' + m + ':' + String(s).padStart(2, '0') + '</b> · 境界 <b>Lv.' + GA.level + '</b>';
    $('win').classList.add('on');
    $('hud').classList.add('hidden');
  }

  /* 返回大厅：女孩居中待机，等待选择 */
  function showLobby() {
    GA.screen = 'lobby';
    GA.over = false; GA.paused = false; GA.userPaused = false;
    $('over').classList.remove('on');
    $('win').classList.remove('on');
    $('levelup').classList.remove('on');
    $('hud').classList.add('hidden');
    $('lobby').classList.add('on');
    if (G.audio) G.audio.showTopBtns(true);
    syncWingUI();
    syncHud();
  }

  /* 开始游戏：应用大厅选择的难度与职业 */
  function startGame() {
    const d = DIFFS[GA.selDiff] || DIFFS.normal;
    GA.diffK = d.k; GA.goal = d.goal; GA.diffName = d.name;
    GA.cls = GA.selCls || 'warrior';
    GA.gender = GA.selGender || 'f';
    GA.wingsOn = wingUnlocked() && GA.selWings;
    GA.wingColor = GA.selWingColor;
    reset();
    GA.screen = 'play';
    $('lobby').classList.remove('on');
    $('hud').classList.remove('hidden');
    if (G.audio) { G.audio.unlock(); G.audio.showTopBtns(false); }
    syncHud();
    G.enemy.spawn(GA, 'slime');
    G.enemy.spawn(GA, 'slime');
  }

  /* 大厅按钮绑定（只绑定一次） */
  function bindLobby() {
    const diffRow = $('diffRow'), clsRow = $('clsRow'), genRow = $('genRow');
    diffRow.querySelectorAll('.pick-btn').forEach(b => b.onclick = () => {
      GA.selDiff = b.dataset.d;
      diffRow.querySelectorAll('.pick-btn').forEach(x => x.classList.toggle('on', x === b));
    });
    clsRow.querySelectorAll('.pick-btn').forEach(b => b.onclick = () => {
      GA.selCls = b.dataset.c;
      clsRow.querySelectorAll('.pick-btn').forEach(x => x.classList.toggle('on', x === b));
      drawLobbyGirl();
    });
    genRow.querySelectorAll('.pick-btn').forEach(b => b.onclick = () => {
      GA.selGender = b.dataset.g;
      genRow.querySelectorAll('.pick-btn').forEach(x => x.classList.toggle('on', x === b));
      drawLobbyGirl();
    });
    /* 翅膀：累计击杀达 5 万解锁 → 穿上/脱下 + 颜色自选 */
    const wingRow = $('wingRow'), wingColorRow = $('wingColorRow');
    wingRow.querySelectorAll('.pick-btn').forEach(b => b.onclick = () => {
      if (!wingUnlocked()) return;
      GA.selWings = b.dataset.w === '1';
      wingRow.querySelectorAll('.pick-btn').forEach(x => x.classList.toggle('on', x === b));
      drawLobbyGirl(); persistSave();
    });
    wingColorRow.querySelectorAll('.swatch').forEach(b => b.onclick = () => {
      if (!wingUnlocked()) return;
      GA.selWingColor = b.dataset.col;
      wingColorRow.querySelectorAll('.swatch').forEach(x => x.classList.toggle('on', x === b));
      drawLobbyGirl(); persistSave();
    });
    syncWingUI();
    $('startBtn').onclick = startGame;
    $('overHome').onclick = showLobby;
    $('again').onclick = startGame;
    $('winHome').onclick = showLobby;
    $('winAgain').onclick = startGame;
    drawLobbyGirl();
  }

  /* 翅膀解锁状态 → 大厅 UI（未达标时锁定按钮并显示进度） */
  function syncWingUI() {
    const ok = wingUnlocked();
    $('wingPick').classList.toggle('locked', !ok);
    $('wingLock').textContent = ok
      ? '已解锁 · 穿上后获得「羽护」：受到伤害 -25%'
      : '🔒 累计击杀 ' + GA.totalKills + ' / ' + WING_UNLOCK + ' 解锁（每局击杀都会累计存档）';
  }

  function drawLobbyGirl() {
    const c = $('lobbyGirl'), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    const sx = Math.round(c.width / 2 - 11), sy = 2;   // 居中放精灵，上方留翅膀
    const showW = wingUnlocked() && GA.selWings;
    if (showW) drawWings(g, sx + 11, sy + 20, GA.t, showW, GA.selWingColor);
    g.drawImage(G.HEROES[GA.selCls][GA.selGender][0], sx, sy);
  }

  /* 暴露给无头测试 / 调试 */
  GA.startGame = startGame;
  GA.showLobby = showLobby;
  GA.syncWingUI = syncWingUI;

  /* ============================================================
     触屏 / 移动端控制（虚拟摇杆 · 攻击键 · 自动攻击开关 · 暂停）
     ============================================================ */
  function bindTouchUI() {
    /* ---------- 虚拟摇杆（左下角移动键） ---------- */
    const base = $('moveBtn'), knob = $('moveKnob');
    if (base && knob) {
      const R = 34;                       // 旋钮最大偏移
      let tid = null;
      const setFrom = (cx, cy) => {
        const r = base.getBoundingClientRect();
        const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
        let dx = cx - ox, dy = cy - oy;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        GA.touchAx.x = dx / R; GA.touchAx.y = dy / R;
      };
      const end = () => {
        tid = null;
        knob.style.transform = 'translate(0,0)';
        GA.touchAx.x = 0; GA.touchAx.y = 0;
      };
      base.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.changedTouches[0]; tid = t.identifier; setFrom(t.clientX, t.clientY);
      }, { passive: false });
      base.addEventListener('touchmove', e => {
        e.preventDefault();
        for (const t of e.changedTouches) if (t.identifier === tid) setFrom(t.clientX, t.clientY);
      }, { passive: false });
      base.addEventListener('touchend', e => {
        for (const t of e.changedTouches) if (t.identifier === tid) end();
      });
      base.addEventListener('touchcancel', e => {
        for (const t of e.changedTouches) if (t.identifier === tid) end();
      });
      /* 鼠标兜底（桌面端也能拖动测试） */
      let md = false;
      base.addEventListener('mousedown', e => { md = true; setFrom(e.clientX, e.clientY); });
      addEventListener('mousemove', e => { if (md) setFrom(e.clientX, e.clientY); });
      addEventListener('mouseup', () => { if (md) { md = false; end(); } });
    }

    /* ---------- 自动攻击开关 ---------- */
    const autoBtn = $('autoBtn');
    if (autoBtn) autoBtn.addEventListener('click', () => {
      GA.autoAtk = !GA.autoAtk;
      autoBtn.classList.toggle('on', GA.autoAtk);
      autoBtn.textContent = GA.autoAtk ? '自 开' : '自 关';
    });

    /* ---------- 暂停（按钮复用 togglePause，与键盘 P/Esc 一致） ---------- */
    const pauseBtn = $('pauseBtn');
    if (pauseBtn) pauseBtn.addEventListener('click', e => { e.preventDefault(); togglePause(); });
    const pResume = $('pResume'); if (pResume) pResume.addEventListener('click', () => togglePause());
    const pHome = $('pHome'); if (pHome) pHome.addEventListener('click', () => {
      togglePause(); showLobby();
    });

    /* ---------- 技能槽点击（移动端释放 Q/E/R） ---------- */
    document.querySelectorAll('.slot[data-skill]').forEach(el => {
      el.addEventListener('click', () => {
        if (GA.screen !== 'play' || GA.over || GA.paused) return;
        const f = { q: skillQ, e: skillE, r: skillR }[el.dataset.skill];
        if (f) f();
      });
    });

    /* ---------- 职业切换按钮（仅触屏：点一下切换下一个职业，等同 F 键） ---------- */
    const swapInfo = $('swapInfo');
    if (swapInfo && IS_TOUCH) swapInfo.addEventListener('click', () => swapClass());
  }

  /* ============================================================
     启动
     ============================================================ */
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;                 // 防止切标签页后大跳
    if (GA.screen === 'play' && !GA.paused && !GA.over) {
      update(dt);
      tickHud(dt);
    } else {
      GA.t += dt;                            // 大厅 / 暂停时仍推进时间，驱动法阵与女孩动画
    }
    render();
    requestAnimationFrame(frame);
  }

  /* 玩法说明：按设备切换操作文案（桌面用键鼠、触控用摇杆/攻击键/技能槽） */
  function adaptHelp() {
    const body = document.querySelector('#helpPanel .pbody');
    if (!body) return;
    if (IS_TOUCH) {
      body.innerHTML =
        '<b>目标</b> 守住星芒法阵，达成击杀目标即胜利，阵亡则本局结束。<br>' +
        '<b>移动</b> 左下角虚拟摇杆，拖动控制方向。<br>' +
        '<b>攻击</b> 自动锁定最近的怪物，按住右下角「攻击」键开火；也可开「自动攻击」托管。<br>' +
        '<b>技能</b> 点右侧技能槽：旋风／星冲／月华；翻滚闪避为电脑端空格键。<br>' +
        '<b>职业</b> 点底部「切换职业」按钮循环切换（15 秒冷却）。<br>' +
        '<b>翅膀</b> 累计击杀达 5 万解锁，穿上后获得「羽护」减伤 25%。';
    }
  }

  /* ---------- 全屏按钮 + 首次载入透明提示 ----------
     绑定所有 .fs-btn（局内左上角 #fsBtn 与大厅左上角 #lobbyFs 共用一套逻辑） */
  function bindFs() {
    const btns = document.querySelectorAll('.fs-btn');
    const hint = $('fsHint'), go = $('fsGo'), skip = $('fsSkip');
    const fsOn = () => !!document.fullscreenElement;
    const sync = () => { btns.forEach(b => b.classList.toggle('on', fsOn())); };
    const enter = () => {
      try {
        if (!fsOn()) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      } catch (e) { /* 沙箱 / 不支持时静默 */ }
    };
    btns.forEach(b => b.addEventListener('click', e => { e.preventDefault(); enter(); }));
    document.addEventListener('fullscreenchange', sync);
    function hide() { if (hint) hint.classList.remove('on'); }
    if (go) go.addEventListener('click', () => { enter(); hide(); });
    if (skip) skip.addEventListener('click', hide);
    // 页面首次载入：弹出透明全屏提示（背景透明，仅中央一张轻卡片）
    if (hint) hint.classList.add('on');
    sync();
  }

  function boot() {
    fit();
    addEventListener('resize', fit);
    BG = G.scene.build(W, H);
    bindLobby();
    bindTouchUI();
    bindFs();                           // 左上角全屏按钮 + 首次载入透明提示
    if (G.audio) G.audio.bindUI();      // 右上角 玩法说明 / 设置 面板
    showLobby();
    requestAnimationFrame(frame);
  }

  boot();

})(window.PX = window.PX || {});

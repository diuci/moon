/* ============================================================
   pixel.js —— 像素精灵绘制（女孩主角 / 各类怪物）
   全部在 16x16 或更大尺寸的离屏画布上以 1px 为单位绘制，
   运行时放大绘制并关闭插值，保持像素颗粒感。
   ============================================================ */
(function (G) {
  'use strict';

  function mkc(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return c;
  }
  G.mkc = mkc;

  /* ---------- 调色板 ---------- */
  const PAL = {
    K: '#1c1020',   // 描边（加深，提升暗背景下清晰度）
    H1: '#ff9ecb',  // 头发亮（樱粉）
    H2: '#e56ba4',  // 头发暗
    H3: '#fff0f8',  // 头发高光（更亮）
    S1: '#ffdcc0',  // 肤色（提亮）
    S2: '#e6a986',  // 肤色暗
    E1: '#3b2b45',  // 眼
    E2: '#8fe3ff',  // 眼高光（更亮）
    D1: '#9168ff',  // 裙子（提亮）
    D2: '#6a4ee0',  // 裙子暗
    W1: '#fdf3ff',  // 白衣领 / 袜
    O1: '#ffd166',  // 蝴蝶结 / 金饰
    O2: '#c88b2a',
    B1: '#8fe36b',  // 藤蔓绿
    B2: '#4aa83f',
    R1: '#ff6b8a',  // 玫瑰红
    R2: '#c9304f'
  };
  G.PAL = PAL;

  /* ============================================================
     主角：四职业 x 男女 像素角色
     dir: 0=正面 1=背面 2=侧面
     f:   0=站立 1=踏步A 2=踏步B
     ============================================================ */
  /* ---------- 自动描边：给无轮廓的像素底稿加 1px 深色描边 ---------- */
  function outlined(w, h, drawFn, col) {
    const a = mkc(w, h);
    drawFn(a.getContext('2d'));
    /* 生成纯色剪影 */
    const sil = mkc(w, h), sg = sil.getContext('2d');
    sg.drawImage(a, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = col || '#170c20';
    sg.fillRect(0, 0, w, h);
    /* 八向扩张一圈后叠回本体 */
    const out = mkc(w + 2, h + 2), og = out.getContext('2d');
    for (const o of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      og.drawImage(sil, 1 + o[0], 1 + o[1]);
    }
    og.drawImage(a, 1, 1);
    return out;
  }
  G.outlined = outlined;

  /* ============================================================
     主角：四职业 x 男女 像素角色
     20×24 底稿 + 自动描边 → 输出 22×26
     dir: 0=正面 1=背面 2=侧面(右) 3=侧面(左)
     f:   0=站立 1=踏步A 2=踏步B
     ============================================================ */
  /* ============================================================
     主角：四职业 × 男女 的像素角色（始终正面 · 20x24 底稿 + 描边 → 22x26）
     f: 0=站立 1=踏步A 2=踏步B
     外观约定（用户指定）：
       法师 = 樱粉双马尾（沿用原主角）
       战士 = 金发 · 长发 · 女生
       游侠 = 棕色 · 双丸子头
       枪手 = 青色 · 短发
     男生 = 独立利落短发 + 长裤 + 发带（与女生发型完全不同，不做长发/马尾/丸子头）
     ============================================================ */
  const LOOK = {
    mage:    { h1: '#ff9ecb', h2: '#dd6ba0', h3: '#ffeaf6', d1: '#8a66ff', d2: '#6a44e0', d3: '#4d2fb0', style: 'twin' },
    warrior: { h1: '#ffd96b', h2: '#e0a83a', h3: '#fff1c0', d1: '#e85d6a', d2: '#c23b4a', d3: '#7d2230', style: 'long' },
    archer:  { h1: '#b07a45', h2: '#8a5a30', h3: '#d8a878', d1: '#7fcf6b', d2: '#4f9e44', d3: '#356b2e', style: 'bun' },
    gunner:  { h1: '#7fe0d8', h2: '#3fa89e', h3: '#c8fff7', d1: '#5a7fd8', d2: '#3a55b0', d3: '#243a80', style: 'short' }
  };

  function drawChar(g, opt, gender, f) {
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const bob = f === 0 ? 0 : -1;              // 走动时身体起伏
    const tw = f === 1 ? 1 : 0;                // 走动时发丝摆动
    const H1 = opt.h1, H2 = opt.h2, H3 = opt.h3;
    const S1 = '#ffd9bb', S2 = '#e8ab86';
    const E1 = '#3b2b45', E2 = '#7fdcff', E3 = '#ff8fa8';   // E1=眼 E2=眼顶高光 E3=腮红
    const D1 = opt.d1, D2 = opt.d2, D3 = opt.d3;
    const W1 = '#fdf3ff', O1 = '#ffd166', O2 = '#c88b2a';

    /* --- 后发（仅女生：依职业发型；男生无长发 / 马尾 / 丸子头，改用独立短发） --- */
    if (gender !== 'm') {
      if (opt.style === 'twin') {
        P(1, 8 + tw, 4, 9, H2); P(1, 8 + tw, 4, 3, H1);
        P(0, 12 + tw, 2, 5, H2); P(1, 16 + tw, 3, 2, H1);
        P(15, 8 - tw, 4, 9, H2); P(15, 8 - tw, 4, 3, H1);
        P(18, 12 - tw, 2, 5, H2); P(16, 16 - tw, 3, 2, H1);
      } else if (opt.style === 'long') {
        P(3, 6 + bob, 14, 14, H2); P(3, 6 + bob, 14, 3, H1);
        P(4, 16 + bob, 12, 4, H1);
        P(2, 9 + bob, 2, 9, H2); P(16, 9 + bob, 2, 9, H2);
      } else if (opt.style === 'bun') {
        /* 双丸子头：两团在头顶两侧 */
        P(1, 3 + bob, 5, 5, H2); P(2, 3 + bob, 3, 3, H1); P(1, 5 + bob, 4, 2, H3);
        P(14, 3 + bob, 5, 5, H2); P(15, 3 + bob, 3, 3, H1); P(15, 5 + bob, 4, 2, H3);
        P(4, 7 + bob, 12, 8, H2); P(4, 7 + bob, 12, 3, H1);
      } else { /* short */
        P(3, 5 + bob, 14, 8, H2); P(3, 5 + bob, 14, 3, H1);
        P(2, 8 + bob, 2, 4, H2); P(16, 8 + bob, 2, 4, H2);
      }
    }

    /* --- 头发顶部（仅女生；男生短发在脸部之后统一绘制） --- */
    if (gender !== 'm') {
      P(5, 1 + bob, 10, 2, H1);
      P(4, 3 + bob, 12, 4, H1);
      P(6, 1 + bob, 3, 1, H3);
      P(5, 3 + bob, 6, 1, H3);
      P(4, 4 + bob, 1, 3, H2);
      P(15, 4 + bob, 1, 3, H2);
    }

    /* --- 脸 --- */
    P(6, 5 + bob, 8, 7, S1);
    P(6, 10 + bob, 8, 2, S2);

    /* --- 头发（女生刘海 / 男生利落短发） --- */
    if (gender === 'm') {
      /* 男生：盖顶发盖 + 短鬓 + 短刘海（整体绘于脸之后，与女生的长发/双马尾/丸子头完全不同） */
      P(4, 2 + bob, 12, 4, H1);            // 头顶发盖
      P(3, 4 + bob, 14, 4, H1);            // 上颅
      P(3, 5 + bob, 2, 5, H2);             // 左鬓（短）
      P(15, 5 + bob, 2, 5, H2);            // 右鬓（短）
      P(5, 5 + bob, 10, 2, H1);            // 短刘海
      P(5, 6 + bob, 1, 2, H1); P(14, 6 + bob, 1, 2, H1);
    } else {
      P(5, 5 + bob, 10, 2, H1);
      P(6, 7 + bob, 2, 1, H1);
      P(12, 7 + bob, 2, 1, H1);
      P(5, 6 + bob, 1, 2, H1);
      P(14, 6 + bob, 1, 2, H1);
    }

    /* --- 五官（正面：大眼 + 高光 + 腮红 + 嘴） --- */
    P(7, 8 + bob, 2, 3, E1);
    P(11, 8 + bob, 2, 3, E1);
    P(7, 8 + bob, 2, 1, E2);
    P(11, 8 + bob, 2, 1, E2);
    P(8, 9 + bob, 1, 1, '#ffffff');
    P(12, 9 + bob, 1, 1, '#ffffff');
    P(6, 10 + bob, 2, 1, E3);
    P(12, 10 + bob, 2, 1, E3);
    P(9, 11 + bob, 2, 1, '#c9566f');

    /* --- 头部饰物：女=蝴蝶结 男=发带 --- */
    if (gender === 'm') {
      P(4, 4 + bob, 12, 1, O1);
      P(4, 4 + bob, 3, 1, O2); P(13, 4 + bob, 3, 1, O2);
    } else {
      P(2, 2 + bob, 4, 3, O1); P(3, 3 + bob, 2, 1, O2);
      P(14, 2 + bob, 4, 3, O1); P(15, 3 + bob, 2, 1, O2);
    }

    /* --- 颈与上身 --- */
    P(9, 12 + bob, 2, 1, S2);
    P(7, 12 + bob, 6, 4, D1);
    P(8, 12 + bob, 4, 2, W1);
    P(9, 14 + bob, 2, 1, O1);

    /* --- 手臂 --- */
    P(5, 13 + bob, 2, 3, S1); P(13, 13 + bob, 2, 3, S1);
    P(5, 15 + bob, 2, 1, W1); P(13, 15 + bob, 2, 1, W1);

    /* --- 下身：女裙 / 男裤 --- */
    if (gender === 'm') {
      P(6, 16 + bob, 3, 4, D2); P(11, 16 + bob, 3, 4, D2);
      P(6, 20 + bob, 3, 2, D1); P(11, 20 + bob, 3, 2, D1);
      P(5, 22, 3, 1, O2); P(12, 22, 3, 1, O2);     // 鞋
    } else {
      P(6, 16 + bob, 8, 3, D2);
      P(5, 19 + bob, 10, 2, D1);
      P(4, 21, 12, 1, D3);
      P(7, 16 + bob, 1, 3, D3);
      P(12, 16 + bob, 1, 3, D3);
      P(6, 19 + bob, 1, 2, D2);
      P(13, 19 + bob, 1, 2, D2);
    }

    /* --- 过膝袜与鞋（仅女生；男生已在裤脚画鞋） --- */
    if (gender !== 'm') {
      if (f === 1) { P(7, 22, 2, 1, W1); P(11, 22, 2, 1, W1); P(7, 23, 2, 1, O2); P(11, 23, 2, 1, O2); }
      else if (f === 2) { P(8, 22, 2, 1, W1); P(10, 22, 2, 1, W1); P(8, 23, 2, 1, O2); P(10, 23, 2, 1, O2); }
      else { P(7, 22, 3, 1, W1); P(10, 22, 3, 1, W1); P(7, 23, 3, 1, O2); P(10, 23, 3, 1, O2); }
    }
  }

  /* 预先烘焙：四职业 x 男女 x 3 帧 → G.HEROES[cls][gender][frame]（22x26） */
  const HEROES = {};
  ['warrior', 'mage', 'gunner', 'archer'].forEach(cls => {
    HEROES[cls] = {};
    ['f', 'm'].forEach(gender => {
      HEROES[cls][gender] = [0, 1, 2].map(f =>
        outlined(20, 24, gg => drawChar(gg, LOOK[cls], gender, f)));
    });
  });
  G.HEROES = HEROES;

  /* ============================================================
     怪物
     ============================================================ */

  /* 史莱姆 —— 缓慢、量大、低血 */
  function slime(f) {
    const c = mkc(14, 14), g = c.getContext('2d');
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const sq = f ? 1 : 0;                        // 挤压动画
    P(3 - sq, 3 + sq, 8, 8 - sq, '#5fd35f');
    P(3 - sq, 3 + sq, 8, 2, '#8bf08b');
    P(2, 5, 1, 5, '#3fa63f'); P(11, 5, 1, 5, '#3fa63f');
    P(3 - sq, 11, 8, 1, '#2d7a2d');
    P(5, 6 + sq, 1, 2, '#123'); P(8, 6 + sq, 1, 2, '#123');
    P(5, 6 + sq, 1, 1, '#fff'); P(8, 6 + sq, 1, 1, '#fff');
    P(6, 9 + sq, 2, 1, '#2d7a2d');
    P(1, 9 + sq, 2, 1, '#3fa63f'); P(11, 9 + sq, 2, 1, '#3fa63f');
    return c;
  }

  /* 蝙蝠 —— 高速、脆皮 */
  function bat(f) {
    const c = mkc(14, 14), g = c.getContext('2d');
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const up = f ? 1 : 0;
    P(6, 5, 4, 5, '#7b4bd6');                   // 身体
    P(6, 4, 1, 2, '#7b4bd6'); P(9, 4, 1, 2, '#7b4bd6');  // 耳
    P(7, 6, 1, 2, '#ff4d6d'); P(8, 6, 1, 2, '#ff4d6d');  // 眼
    P(1, 4 - up, 4, 4, '#5b2fa8');              // 左翼
    P(0, 5 - up, 2, 3, '#4a2490');
    P(9, 4 - up, 4, 4, '#5b2fa8');              // 右翼
    P(12, 5 - up, 2, 3, '#4a2490');
    P(6, 10, 4, 1, '#3c1d75');
    return c;
  }

  /* 骷髅 —— 中速中血，会挥骨刀 */
  function skel(f) {
    const c = mkc(14, 16), g = c.getContext('2d');
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const s = f ? 1 : 0;
    P(4, 2, 7, 6, '#e8e6f0');                   // 头骨
    P(4, 8, 7, 1, '#c9c6d8');
    P(5, 4, 2, 2, '#2a1a2e'); P(9, 4, 2, 2, '#2a1a2e');
    P(6, 5, 1, 1, '#ff6b8a'); P(10, 5, 1, 1, '#ff6b8a');
    P(6, 7, 3, 1, '#c9c6d8');
    P(5, 9, 5, 4, '#ddd9e8');                   // 胸廓
    P(6, 10, 1, 2, '#a8a4bb'); P(8, 10, 1, 2, '#a8a4bb');
    P(5, 13, 2, 3, '#e8e6f0'); P(8, 13, 2, 3, '#e8e6f0');
    P(2, 9 + s, 3, 2, '#e8e6f0');               // 手臂
    P(10, 9 - s, 3, 2, '#e8e6f0');
    P(11, 5 - s, 2, 6, '#cfc9dd');              // 骨刀
    P(11, 4 - s, 1, 2, '#fff');
    return c;
  }

  /* 玫瑰妖 —— 冲锋型，死亡炸开花瓣 */
  function rose(f) {
    const c = mkc(14, 14), g = c.getContext('2d');
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const s = f ? 1 : 0;
    P(5, 6, 5, 5, PAL.R2);                      // 花心
    P(4, 5 + s, 2, 3, PAL.R1); P(9, 5 + s, 2, 3, PAL.R1);
    P(5, 4 + s, 5, 2, PAL.R1); P(6, 3 + s, 3, 1, PAL.R1);
    P(6, 7, 3, 3, '#7a1526');
    P(6, 8, 1, 1, '#ffd166'); P(8, 8, 1, 1, '#ffd166');
    P(6, 11, 3, 2, PAL.B2);                     // 茎
    P(3, 9, 3, 1, PAL.B1); P(9, 9, 3, 1, PAL.B1);
    P(2, 8 - s, 2, 2, PAL.B2); P(11, 8 + s, 2, 2, PAL.B2);
    return c;
  }

  /* 幽魂 —— 高速、半透明、血低但难缠 */
  function wisp(f) {
    const c = mkc(14, 14), g = c.getContext('2d');
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const s = f ? 1 : 0;
    P(4, 3 + s, 7, 7, '#7fe6ff');
    P(3, 5 + s, 1, 5, '#7fe6ff'); P(11, 5 + s, 1, 5, '#7fe6ff');
    P(5, 10 + s, 5, 1, '#4fb8d8');
    if (f) { P(5, 11, 2, 1, '#4fb8d8'); P(8, 11, 2, 1, '#4fb8d8'); }
    else { P(4, 11, 7, 1, '#4fb8d8'); }
    P(5, 6 + s, 2, 2, '#0d2b33'); P(9, 6 + s, 1, 2, '#0d2b33');
    P(6, 9 + s, 3, 1, '#0d2b33');
    return c;
  }

  /* 石像鬼 —— 精英，厚血高伤 */
  function brute(f) {
    const c = mkc(20, 20), g = c.getContext('2d');
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const s = f ? 1 : 0;
    P(5, 2 + s, 10, 8, '#8d8aa3');              // 头
    P(4, 4 + s, 1, 5, '#6d6a82'); P(15, 4 + s, 1, 5, '#6d6a82');
    P(6, 5 + s, 3, 2, '#ffb300'); P(11, 5 + s, 3, 2, '#ffb300');
    P(8, 8 + s, 4, 2, '#5c5972');
    P(6, 3 + s, 2, 2, '#a9a6be');
    P(3, 10, 14, 7, '#7a7791');                 // 躯干
    P(4, 11, 12, 2, '#8d8aa3');
    P(0, 10 + s, 4, 6, '#6d6a82');              // 双臂
    P(16, 10 - s, 4, 6, '#6d6a82');
    P(0, 16 + s, 4, 3, '#5c5972');
    P(16, 16 - s, 4, 3, '#5c5972');
    P(4, 17, 4, 3, '#6d6a82'); P(11, 17, 4, 3, '#6d6a82');
    return c;
  }

  /* 每类怪物烘焙两帧 */
  const MOB = {
    slime: [slime(0), slime(1)],
    bat: [bat(0), bat(1)],
    skel: [skel(0), skel(1)],
    rose: [rose(0), rose(1)],
    wisp: [wisp(0), wisp(1)],
    brute: [brute(0), brute(1)]
  };
  G.MOB = MOB;

  /* 怪物属性表：血 / 速 / 伤害 / 半径 / 出现权重随时间变化 */
  G.MOBDEF = {
    slime: { hp: 11, spd: 26, dmg: 8, r: 6, xp: 1, from: 0, w: 10 },
    bat: { hp: 9, spd: 66, dmg: 6, r: 5, xp: 1, from: 22, w: 8 },
    skel: { hp: 26, spd: 40, dmg: 12, r: 6, xp: 2, from: 50, w: 9 },
    wisp: { hp: 16, spd: 82, dmg: 7, r: 5, xp: 2, from: 85, w: 7 },
    rose: { hp: 34, spd: 52, dmg: 15, r: 6, xp: 3, from: 120, w: 8 },
    brute: { hp: 190, spd: 24, dmg: 26, r: 9, xp: 12, from: 165, w: 3 }
  };

  /* ============================================================
     特效像素：玫瑰花瓣 / 星芒 / 心
     ============================================================ */
  function petal(col) {
    const c = mkc(6, 6), g = c.getContext('2d');
    const P = (x, y, w, h, cc) => { g.fillStyle = cc; g.fillRect(x, y, w, h); };
    P(2, 1, 2, 4, col); P(1, 2, 4, 2, col);
    P(2, 2, 1, 1, '#fff');
    return c;
  }
  G.PETAL = [petal('#ff9ecb'), petal('#ffd166'), petal('#b388ff')];

  function star() {
    const c = mkc(7, 7), g = c.getContext('2d');
    const P = (x, y, w, h, cc) => { g.fillStyle = cc; g.fillRect(x, y, w, h); };
    P(3, 0, 1, 7, '#fff6c8'); P(0, 3, 7, 1, '#fff6c8');
    P(2, 2, 3, 3, '#ffd166'); P(1, 3, 5, 1, '#ffd166'); P(3, 1, 1, 5, '#ffd166');
    return c;
  }
  G.STAR = star();

  /* ============================================================
     武器：战士长剑（3 帧挥砍） / 法师玫瑰法杖（2 帧充能）
     ============================================================ */

  /* 逐点粗线，用于绘制任意角度的剑身 */
  function pxLine(g, x0, y0, x1, y1, col, th) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0, n = 0;
    const o = (th - 1) >> 1;
    while (n++ < 300) {
      g.fillStyle = col;
      g.fillRect(x - o, y - o, th, th);
      if (x === x1 && y === y1) break;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
  G.pxLine = pxLine;

  /* 长剑：f=0 扬起 / 1 横斩 / 2 收势 */
  function sword(f) {
    const ang = [-1.20, 0.02, 0.82][f] || 0;
    return outlined(16, 16, g => {
      const cx = 7, cy = 11;
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const nx = -uy, ny = ux;                       // 剑身法线
      /* 剑柄与配重球 */
      pxLine(g, cx, cy, cx - ux * 4, cy - uy * 4, '#7a4a20', 3);
      pxLine(g, cx - ux * 4, cy - uy * 4, cx - ux * 5, cy - uy * 5, '#ffd166', 3);
      /* 护手 */
      pxLine(g, cx - nx * 4, cy - ny * 4, cx + nx * 4, cy + ny * 4, '#ffd166', 2);
      pxLine(g, cx - nx * 4, cy - ny * 4, cx + nx * 4, cy + ny * 4, '#fff6c8', 1);
      /* 剑身 */
      pxLine(g, cx + ux * 1, cy + uy * 1, cx + ux * 9, cy + uy * 9, '#8f9ab5', 3);
      pxLine(g, cx + ux * 1, cy + uy * 1, cx + ux * 9, cy + uy * 9, '#e4ebf7', 2);
      pxLine(g, cx + ux * 2 - nx, cy + uy * 2 - ny, cx + ux * 8 - nx, cy + uy * 8 - ny, '#ffffff', 1);
      /* 剑尖 */
      pxLine(g, cx + ux * 9, cy + uy * 9, cx + ux * 11, cy + uy * 11, '#f2f6ff', 2);
      pxLine(g, cx + ux * 10, cy + uy * 10, cx + ux * 11, cy + uy * 11, '#ffffff', 1);
      /* 剑脊上的玫瑰刻纹 */
      g.fillStyle = '#ff6b8a';
      g.fillRect(Math.round(cx + ux * 3) - 1, Math.round(cy + uy * 3) - 1, 2, 2);
    }, '#150b1e');
  }

  /* 玫瑰法杖：f=0 常态 / 1 充能 */
  function staff(f) {
    return outlined(16, 16, g => {
      const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      /* 杖身 */
      pxLine(g, 12, 14, 6, 5, '#7a4a20', 3);
      pxLine(g, 12, 14, 6, 5, '#c08a4a', 1);
      /* 缠绕藤蔓与叶 */
      P(10, 12, 2, 1, '#4aa83f'); P(8, 9, 2, 1, '#8fe36b'); P(7, 7, 2, 1, '#4aa83f');
      P(10, 11, 1, 2, '#5fbf4c'); P(6, 8, 1, 1, '#8fe36b');
      /* 顶端水晶（菱形） */
      const bx = 4, by = 0;
      P(bx + 2, by, 1, 1, '#ff9ecb');
      P(bx + 1, by + 1, 3, 1, '#ffb8da');
      P(bx, by + 2, 5, 1, '#ffd6ea');
      P(bx + 1, by + 3, 3, 1, '#ff9ecb');
      P(bx + 2, by + 4, 1, 1, '#e0699f');
      P(bx + 2, by + 2, 1, 1, '#ffffff');
      if (f) {                                   /* 充能：外圈光点 */
        P(bx + 2, by - 1, 1, 1, '#fff6c8');
        P(bx - 1, by + 2, 1, 1, '#fff6c8');
        P(bx + 5, by + 2, 1, 1, '#fff6c8');
        P(bx + 2, by + 5, 1, 1, '#fff6c8');
        P(bx, by, 1, 1, '#ffd166'); P(bx + 4, by, 1, 1, '#ffd166');
      }
      /* 杖头托座 */
      P(4, 5, 4, 1, '#ffd166'); P(5, 6, 2, 1, '#c88b2a');
    }, '#150b1e');
  }

  /* 玫瑰魔枪：f=0 待机 / 1 射击吐火 */
  function gun(f) {
    return outlined(16, 16, g => {
      const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      P(4, 11, 3, 4, '#7a4a20'); P(4, 11, 3, 1, '#c08a4a');      // 枪柄
      P(6, 9, 7, 3, '#6b7280'); P(6, 9, 7, 1, '#aeb6c4'); P(7, 11, 5, 1, '#4a5160'); // 机匣
      P(12, 9, 4, 2, '#8f9ab5'); P(13, 9, 3, 1, '#e4ebf7');     // 枪管
      P(15, 8, 1, 4, '#ffd166'); P(14, 9, 1, 2, '#ff6b8a');      // 枪口金环 + 玫瑰
      P(6, 12, 2, 2, '#4a5160');                                // 扳机护圈
      if (f) {                                                   // 枪口火花
        P(15, 7, 3, 1, '#fff6c8'); P(16, 9, 4, 1, '#ffd166'); P(15, 10, 3, 1, '#ff9ecb');
        P(18, 8, 2, 1, '#fff');
      }
    }, '#150b1e');
  }

  /* 玫瑰长弓：f=0 待机 / 1 拉满 */
  function bow(f) {
    return outlined(16, 16, g => {
      const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      P(3, 3, 2, 2, '#8a5a2a'); P(2, 5, 2, 6, '#c08a4a'); P(3, 11, 2, 2, '#8a5a2a'); P(3, 4, 1, 8, '#e0b070'); // 木弓臂
      P(4, 3, 1, 1, '#fff'); P(5, 5, 1, 1, '#fff'); P(5, 9, 1, 1, '#fff'); P(4, 13, 1, 1, '#fff'); // 弓弦
      if (f) { P(5, 7, 9, 1, '#cfd3e0'); P(13, 6, 2, 3, '#ff6b8a'); P(5, 6, 1, 3, '#8fe36b'); } // 拉满：箭在弦上
      else { P(5, 7, 6, 1, '#cfd3e0'); P(10, 6, 1, 3, '#8fe36b'); }                              // 待机：箭搭弦
    }, '#150b1e');
  }

  /* 烘焙武器帧 */
  const SWORD = [sword(0), sword(1), sword(2)];
  const STAFF = [staff(0), staff(1)];
  const GUN = [gun(0), gun(1)];
  const BOW = [bow(0), bow(1)];
  G.SWORD = SWORD; G.STAFF = STAFF; G.GUN = GUN; G.BOW = BOW;

  /* 职业配置：战士 / 法师 / 枪手 / 游侠 */
  G.CLASS = {
    warrior: {
      key: 'warrior', name: '战 士', icon: 'sword', weapon: SWORD,
      resMax: 11, regen: 0, empty: 1.0,           // 架势：耗尽后约 1s 才恢复满
      cost: 1, cdMul: 1.5, dmgMul: 2.7,
      range: 106, arc: 1.4, knock: 165,           // 扇形近战判定（长剑横扫，无需贴脸）
      leech: 0.05,                                 // 每次命中回血（伤害的 5%）
      tip: '近身横斩 · 扇形范围 · 强击退 · 吸血'
    },
    mage: {
      key: 'mage', name: '法 师', icon: 'staff', weapon: STAFF,
      resMax: 24, regen: 5.5, empty: 0,            // 法力：持续回复（更顺）
      cost: 1, cdMul: 0.78, dmgMul: 1.05,
      range: 0, arc: 0, knock: 44, splash: 24,     // 远程魔弹 + 溅射
      bulletType: 'orb', bulletSpd: 210, bcol: '#ffb8da',
      tip: '远程魔弹 · 命中溅射 · 消耗法力'
    },
    gunner: {
      key: 'gunner', name: '枪 手', icon: 'gun', weapon: GUN,
      resMax: 6, regen: 0, empty: 1.25,        // 弹仓 6 发 · 打空后约 1.3s 装填（重铳节奏）
      cost: 1, cdMul: 1.75, dmgMul: 3.0,       // 全场最慢射速 · 最高单发伤害
      range: 0, arc: 0, knock: 150, splash: 0, // 强击退，一枪一个
      bulletType: 'bullet', bulletSpd: 470, bcol: '#ffd166', basePierce: 1,
      tip: '重铳狙击 · 慢射高伤 · 强击退 · 六发装填'
    },
    archer: {
      key: 'archer', name: '游 侠', icon: 'bow', weapon: BOW,
      resMax: 24, regen: 8, empty: 0,           // 箭袋：持续回复（速射）
      cost: 1, cdMul: 0.62, dmgMul: 1.2,        // 疾射 · 单发偏低
      range: 0, arc: 0, knock: 45, splash: 0,
      bulletType: 'arrow', bulletSpd: 400, bcol: '#9bff7a', basePierce: 3, // 贯穿 3 个
      tip: '疾射穿云箭 · 一箭贯穿三敌 · 箭袋自回'
    }
  };

})(window.PX = window.PX || {});

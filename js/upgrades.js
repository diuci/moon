/* ============================================================
   upgrades.js —— 境界提升卡池 / 图标绘制
   ============================================================ */
(function (G) {
  'use strict';

  const mkc = G.mkc;
  function P(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

  /* ============================================================
     16x16 图标
     ============================================================ */
  function icon(kind) {
    const c = mkc(16, 16), g = c.getContext('2d');
    const K = '#2a1a2e';
    switch (kind) {

      /* 武器：玫瑰法杖 */
      case 'weapon':
        P(g, 7, 2, 2, 11, '#8a5a2a');        P(g, 7, 2, 1, 11, '#c08a4a');
        P(g, 5, 1, 6, 4, '#ff6b8a');
        P(g, 6, 2, 4, 2, '#ff9ecb');
        P(g, 7, 3, 2, 1, '#ffd166');
        P(g, 4, 5, 2, 2, '#4aa83f');
        P(g, 10, 6, 2, 2, '#8fe36b');
        P(g, 6, 12, 4, 2, '#ffd166');
        break;

      /* 战士：长剑 */
      case 'sword':
        P(g, 7, 2, 2, 8, '#e4ebf7'); P(g, 8, 3, 1, 7, '#8f9ab5');
        P(g, 7, 2, 1, 8, '#ffffff');
        P(g, 6, 1, 4, 1, '#f2f6ff'); P(g, 7, 0, 2, 1, '#ffffff');
        P(g, 3, 10, 10, 2, '#ffd166'); P(g, 4, 10, 8, 1, '#fff6c8');
        P(g, 7, 12, 2, 3, '#7a4a20'); P(g, 7, 15, 2, 1, '#ffd166');
        P(g, 8, 4, 1, 4, '#ff6b8a');
        break;

      /* 法师：玫瑰法杖 */
      case 'staff':
        G.pxLine(g, 12, 14, 6, 5, '#7a4a20', 3);
        G.pxLine(g, 12, 14, 6, 5, '#c08a4a', 1);
        P(g, 4, 5, 4, 1, '#ffd166'); P(g, 5, 6, 2, 1, '#c88b2a');
        P(g, 5, 4, 3, 1, '#ffb8da');
        P(g, 4, 3, 5, 1, '#ffd6ea');
        P(g, 5, 2, 3, 1, '#ff9ecb');
        P(g, 6, 1, 1, 1, '#ffffff');
        P(g, 6, 0, 1, 1, '#fff6c8');
        P(g, 9, 10, 2, 1, '#8fe36b'); P(g, 7, 8, 1, 1, '#4aa83f');
        break;

      /* 枪手：玫瑰魔枪 */
      case 'gun':
        P(g, 4, 11, 3, 4, '#7a4a20'); P(g, 4, 11, 3, 1, '#c08a4a');
        P(g, 6, 9, 7, 3, '#6b7280'); P(g, 6, 9, 7, 1, '#aeb6c4'); P(g, 7, 11, 5, 1, '#4a5160');
        P(g, 12, 9, 4, 2, '#8f9ab5'); P(g, 13, 9, 3, 1, '#e4ebf7');
        P(g, 15, 8, 1, 4, '#ffd166'); P(g, 14, 9, 1, 2, '#ff6b8a');
        P(g, 6, 12, 2, 2, '#4a5160');
        P(g, 15, 7, 3, 1, '#fff6c8'); P(g, 16, 9, 4, 1, '#ffd166'); P(g, 15, 10, 3, 1, '#ff9ecb');
        break;

      /* 游侠：玫瑰长弓 */
      case 'bow':
        P(g, 3, 3, 2, 2, '#8a5a2a'); P(g, 2, 5, 2, 6, '#c08a4a'); P(g, 3, 11, 2, 2, '#8a5a2a'); P(g, 3, 4, 1, 8, '#e0b070');
        P(g, 4, 3, 1, 1, '#fff'); P(g, 5, 5, 1, 1, '#fff'); P(g, 5, 9, 1, 1, '#fff'); P(g, 4, 13, 1, 1, '#fff');
        P(g, 5, 7, 9, 1, '#cfd3e0'); P(g, 13, 6, 2, 3, '#ff6b8a'); P(g, 5, 6, 1, 3, '#8fe36b');
        break;

      /* Q：花瓣爆散 */
      case 'petal':
        [[8, 2], [13, 6], [11, 12], [5, 12], [3, 6]].forEach((p, i) => {
          const col = ['#ff9ecb', '#ffd166', '#b388ff', '#ff6b8a', '#8fe36b'][i];
          P(g, p[0] - 1, p[1] - 2, 3, 5, col);
          P(g, p[0] - 2, p[1] - 1, 5, 3, col);
          P(g, p[0] - 1, p[1] - 1, 2, 1, '#fff');
        });
        P(g, 7, 7, 3, 3, '#fff6c8');
        break;

      /* E：疾风冲刺 */
      case 'dash':
        P(g, 2, 7, 9, 2, '#8fe36b');
        P(g, 2, 6, 1, 4, '#8fe36b');
        P(g, 2, 5, 2, 1, '#8fe36b'); P(g, 2, 10, 2, 1, '#8fe36b');
        P(g, 11, 4, 2, 8, '#7fe6ff');
        P(g, 13, 5, 2, 6, '#4fb8d8');
        P(g, 10, 7, 3, 2, '#fff');
        break;

      /* R：追月飞弹 */
      case 'moon':
        G.pxCircle(g, 9, 7, 5, '#fff6c8');
        G.pxCircle(g, 9, 7, 4, '#ffd166');
        P(g, 7, 5, 2, 2, '#e8b23a');
        P(g, 2, 11, 3, 3, '#b388ff');
        P(g, 3, 12, 2, 1, '#e0d0ff');
        P(g, 5, 9, 2, 1, '#7fe6ff');
        P(g, 4, 7, 1, 1, '#7fe6ff');
        break;

      /* 生命 */
      case 'hp':
        P(g, 3, 4, 10, 3, '#ff6b8a'); P(g, 2, 5, 12, 3, '#ff6b8a');
        P(g, 3, 8, 10, 2, '#ff6b8a'); P(g, 5, 10, 6, 2, '#ff6b8a');
        P(g, 7, 11, 2, 2, '#ff6b8a');
        P(g, 4, 5, 3, 2, '#ff9ecb'); P(g, 4, 4, 4, 1, '#ffd9bb');
        break;

      /* 伤害 */
      case 'dmg':
        P(g, 4, 12, 2, 3, '#8a5a2a');
        P(g, 9, 2, 2, 10, '#cfd3e0'); P(g, 10, 2, 1, 10, '#fff');
        P(g, 8, 1, 4, 3, '#8fe36b'); P(g, 9, 2, 2, 1, '#d9ffe0');
        P(g, 2, 6, 3, 2, '#ffd166'); P(g, 12, 9, 3, 2, '#ffd166');
        break;

      /* 射速 */
      case 'rate':
        P(g, 2, 4, 3, 8, '#ffd166'); P(g, 3, 3, 1, 10, '#fff6c8');
        P(g, 7, 5, 3, 6, '#ffd166'); P(g, 8, 4, 1, 8, '#fff6c8');
        P(g, 12, 6, 3, 4, '#c88b2a');
        break;

      /* 移速 */
      case 'speed':
        P(g, 2, 3, 2, 10, '#7fe6ff'); P(g, 5, 2, 2, 12, '#4fb8d8');
        P(g, 8, 5, 3, 6, '#7fe6ff');
        P(g, 12, 4, 3, 2, '#e0f8ff'); P(g, 13, 9, 3, 2, '#e0f8ff');
        break;

      /* 多重弹 */
      case 'multi':
        [4, 8, 12].forEach((y, i) => {
          P(g, 2, y - 1, 4, 3, '#ff9ecb');
          P(g, 6, y - 1, 5, 3, '#ffd166');
          P(g, 12, y - 1, 3, 3, '#b388ff');
          P(g, 3, y, 2, 1, '#fff');
        });
        break;

      /* 穿透 */
      case 'pierce':
        P(g, 1, 7, 11, 3, '#cfd3e0'); P(g, 1, 8, 11, 1, '#fff');
        P(g, 12, 6, 3, 5, '#ff6b8a'); P(g, 14, 7, 1, 3, '#ff9ecb');
        P(g, 6, 2, 2, 4, '#8fe36b'); P(g, 5, 1, 4, 2, '#8fe36b');
        P(g, 6, 11, 2, 4, '#4aa83f');
        break;

      /* 吸血 */
      case 'steal':
        P(g, 4, 3, 8, 2, '#ff6b8a'); P(g, 3, 5, 10, 7, '#ff6b8a');
        P(g, 4, 12, 8, 2, '#c9304f'); P(g, 6, 14, 4, 1, '#c9304f');
        P(g, 5, 6, 3, 2, '#ff9ecb');
        P(g, 7, 4, 2, 2, '#8fe36b'); P(g, 6, 3, 4, 1, '#4aa83f');
        break;

      /* 暴击 */
      case 'crit':
        P(g, 8, 1, 3, 7, '#cfd3e0'); P(g, 9, 1, 1, 7, '#fff');
        P(g, 6, 8, 3, 3, '#ffd166'); P(g, 9, 10, 4, 2, '#ffd166');
        P(g, 2, 11, 4, 4, '#ff6b8a'); P(g, 11, 3, 4, 4, '#ff6b8a');
        break;

      /* 荆棘光环 */
      case 'thorn':
        G.pxCircle(g, 8, 8, 7, '#4aa83f');
        G.pxCircle(g, 8, 8, 5, '#8fe36b');
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          P(g, Math.round(8 + Math.cos(a) * 6) - 1, Math.round(8 + Math.sin(a) * 6) - 1, 2, 2, '#c9304f');
        }
        P(g, 7, 7, 2, 2, '#ffd166');
        break;

      /* 护甲 */
      case 'armor':
        P(g, 4, 2, 8, 3, '#8d8aa3'); P(g, 3, 4, 10, 8, '#8d8aa3');
        P(g, 4, 12, 8, 2, '#6d6a82'); P(g, 6, 13, 4, 1, '#6d6a82');
        P(g, 5, 3, 6, 2, '#a9a6be'); P(g, 6, 6, 4, 5, '#6d6a82');
        P(g, 7, 7, 2, 3, '#ffd166');
        break;

      /* 弹匣 */
      case 'mag':
        P(g, 3, 3, 10, 11, '#5b3fd6'); P(g, 4, 4, 8, 3, '#7c5cff');
        P(g, 5, 8, 2, 5, '#ffd166'); P(g, 8, 8, 2, 5, '#ffd166');
        P(g, 11, 8, 1, 5, '#ffd166');
        P(g, 3, 2, 10, 1, '#ffd166');
        break;

      /* 追踪 */
      case 'homing':
        P(g, 2, 12, 2, 2, '#7fe6ff');
        P(g, 3, 10, 2, 2, '#7fe6ff'); P(g, 5, 8, 2, 2, '#b388ff');
        P(g, 7, 6, 2, 2, '#b388ff'); P(g, 9, 4, 3, 3, '#ff9ecb');
        P(g, 13, 2, 3, 3, '#ff6b8a');
        P(g, 12, 1, 1, 1, '#fff');
        break;

      /* 减冷却 */
      case 'cd':
        G.pxCircle(g, 8, 8, 6, '#ffd166');
        G.pxCircle(g, 8, 8, 5, '#2a1a2e');
        P(g, 7, 4, 2, 5, '#ffd166'); P(g, 7, 8, 4, 2, '#ffd166');
        P(g, 2, 2, 2, 2, '#7fe6ff'); P(g, 12, 12, 2, 2, '#7fe6ff');
        break;

      /* 爆炸 */
      case 'boom':
        G.pxCircle(g, 8, 8, 6, '#ff9e3a');
        G.pxCircle(g, 8, 8, 4, '#ffd166');
        G.pxCircle(g, 8, 8, 2, '#fff6c8');
        [[1, 2], [13, 3], [2, 13], [12, 12], [8, 0]].forEach(p => P(g, p[0], p[1], 2, 2, '#ff6b8a'));
        break;

      /* 星辉弹 */
      case 'star':
        P(g, 7, 1, 2, 14, '#fff6c8'); P(g, 1, 7, 14, 2, '#fff6c8');
        P(g, 5, 5, 6, 6, '#ffd166'); P(g, 6, 6, 4, 4, '#fff6c8');
        P(g, 3, 3, 2, 2, '#b388ff'); P(g, 11, 11, 2, 2, '#b388ff');
        break;

      /* 治疗 */
      case 'heal':
        P(g, 6, 2, 4, 12, '#8fe36b'); P(g, 2, 6, 12, 4, '#8fe36b');
        P(g, 7, 3, 2, 10, '#d9ffe0'); P(g, 3, 7, 10, 2, '#d9ffe0');
        P(g, 6, 6, 4, 4, '#fff');
        break;
    }
    return c;
  }
  G.icon = icon;

  /* ============================================================
     卡池
     rarity: 1 普通 / 2 稀有 / 3 史诗
     ============================================================ */
  const POOL = [
    {
      id: 'hp', name: '坚韧之蕊', rarity: 1, icon: 'hp', max: 99,
      desc: () => '生命上限 +28，并立刻回复等量生命',
      apply: s => { s.maxHp += 28; s.hp = Math.min(s.maxHp, s.hp + 28); }
    },
    {
      id: 'heal', name: '治愈之露', rarity: 1, icon: 'heal', max: 99,
      desc: () => '立刻回复 55% 生命，生命上限 +8',
      apply: s => { s.maxHp += 8; s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.55); }
    },
    {
      id: 'dmg', name: '锐 刺', rarity: 1, icon: 'dmg', max: 99,
      desc: () => '子弹伤害 +22%',
      apply: s => { s.damage *= 1.22; }
    },
    {
      id: 'rate', name: '疾 奏', rarity: 1, icon: 'rate', max: 99,
      desc: () => '射速 +20%',
      apply: s => { s.fireRate *= 1.20; }
    },
    {
      id: 'speed', name: '轻 步', rarity: 1, icon: 'speed', max: 99,
      desc: () => '移动速度 +12%',
      apply: s => { s.speed *= 1.12; }
    },
    {
      id: 'mag', name: '花 匣', rarity: 1, icon: 'mag', max: 99,
      desc: () => '攻击资源上限提升（架势/法力/弹药/箭袋），换弹更快',
      apply: s => { s.mag += 8; s.reload *= 0.82; }
    },
    {
      id: 'crit', name: '锋 芒', rarity: 2, icon: 'crit', max: 6,
      desc: () => '暴击率 +12%（暴击造成 2 倍伤害）',
      apply: s => { s.crit += 0.12; }
    },
    {
      id: 'critdmg', name: '裂 空', rarity: 2, icon: 'dmg', max: 6,
      desc: () => '暴击伤害 +45%',
      apply: s => { s.critDmg += 0.45; }
    },
    {
      id: 'steal', name: '饮 露', rarity: 2, icon: 'steal', max: 5,
      desc: () => '造成伤害的 5% 转化为生命',
      apply: s => { s.lifesteal += 0.05; }
    },
    {
      id: 'armor', name: '藤 甲', rarity: 2, icon: 'armor', max: 5,
      desc: () => '受到的伤害 -11%',
      apply: s => { s.armor = 1 - (1 - s.armor) * 0.89; }
    },
    {
      id: 'cd', name: '秘仪回响', rarity: 2, icon: 'cd', max: 4,
      desc: () => 'Q / E / R 冷却各 -22%',
      apply: s => { s.cdQ *= 0.78; s.cdE *= 0.78; s.cdR *= 0.78; }
    },
    {
      id: 'pierce', name: '贯 叶', rarity: 2, icon: 'pierce', max: 4,
      desc: () => '子弹穿透 +1 个目标',
      apply: s => { s.pierce += 1; }
    },
    {
      id: 'multi', name: '花 雨', rarity: 3, icon: 'multi', max: 4,
      desc: () => '每次射击多发射 1 发子弹（散射）',
      apply: s => { s.multishot += 1; }
    },
    {
      id: 'thorn', name: '荆棘之环', rarity: 3, icon: 'thorn', max: 5,
      desc: () => '身周荆棘光环，每秒灼烧靠近的敌人',
      apply: s => { s.thorn += 8; }
    },
    {
      id: 'homing', name: '追 月', rarity: 3, icon: 'homing', max: 3,
      desc: () => '子弹获得追踪能力，自动咬住敌人',
      apply: s => { s.homing += 1; }
    },
    {
      id: 'boom', name: '爆裂花瓣', rarity: 3, icon: 'boom', max: 4,
      desc: () => '击杀敌人时炸开，对周围造成伤害',
      apply: s => { s.boom += 1; }
    },
    {
      id: 'star', name: '星辉弹幕', rarity: 3, icon: 'star', max: 3,
      desc: () => '每第 5 发射出贯穿星弹，伤害 ×2.6',
      apply: s => { s.starEvery = Math.max(3, s.starEvery - 2); }
    },
    {
      id: 'petal', name: '玫瑰秘仪', rarity: 2, icon: 'petal', max: 4,
      desc: () => 'Q 玫瑰旋风：伤害 +30%，范围 +16',
      apply: s => { s.qMul *= 1.3; s.qRad += 16; }
    }
  ];
  G.POOL = POOL;

  /* 按稀有度加权抽 3 张不重复、未达上限的卡 */
  function draw(picked, n) {
    const avail = POOL.filter(c => (picked[c.id] || 0) < c.max);
    const weight = { 1: 100, 2: 46, 3: 18 };
    const out = [];
    const bag = avail.slice();
    while (out.length < (n || 3) && bag.length) {
      let total = 0;
      for (const c of bag) total += weight[c.rarity];
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < bag.length; i++) {
        r -= weight[bag[i].rarity];
        if (r <= 0) { idx = i; break; }
      }
      out.push(bag.splice(idx, 1)[0]);
    }
    return out;
  }
  G.drawCards = draw;

})(window.PX = window.PX || {});

/* ============================================================
   scene.js —— 遗失月冕场景
   静态部分（石砖地面 / 藤蔓边框 / 石柱）烘焙到离屏画布；
   中央星芒法阵与飘落花瓣逐帧绘制。
   ============================================================ */
(function (G) {
  'use strict';

  /* 确定性伪随机，保证每次生成的庭院布局一致 */
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* 逐点画 1px 圆（保持像素颗粒，不用抗锯齿的 arc） */
  function pxCircle(g, cx, cy, r, col) {
    g.fillStyle = col;
    let x = r, y = 0, err = 1 - r;
    while (x >= y) {
      const pts = [
        [x, y], [y, x], [-x, y], [-y, x],
        [-x, -y], [-y, -x], [x, -y], [y, -x]
      ];
      for (const p of pts) g.fillRect(Math.round(cx + p[0]), Math.round(cy + p[1]), 1, 1);
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
  }
  G.pxCircle = pxCircle;

  /* 像素圆环 */
  function pxRing(g, cx, cy, r, col, thick) {
    for (let i = 0; i < (thick || 1); i++) pxCircle(g, cx, cy, r - i, col);
  }

  /* 旋转的像素多边形（用于八芒星） */
  function pxPoly(g, cx, cy, r, sides, rot, col) {
    g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + i * Math.PI * 2 / sides;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.fill();
  }

  /* ============================================================
     烘焙静态背景
     ============================================================ */
  /* 像素实心圆（逐行扫描，边缘保持像素颗粒，不用抗锯齿 arc） */
  function pxDisc(g, cx, cy, r, col) {
    g.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
      g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  }

  /* ============================================================
     烘焙静态背景
     ============================================================ */
  function build(W, H) {
    const c = G.mkc(W, H), g = c.getContext('2d');
    const R = rng(20260902);

    drawTiles(g, W, H, R);          // 石砖地面 + 磨损
    drawDais(g, W, H, R);           // 中央法阵石台
    drawGarden(g, 40, 40, R);       // 四角玫瑰园
    drawGarden(g, W - 78, 40, R);
    drawGarden(g, 40, H - 78, R);
    drawGarden(g, W - 78, H - 78, R);
    drawArch(g, W, H);              // 北侧玫瑰拱门
    drawBorder(g, W, H, 14, R);     // 藤蔓边框
    drawPillar(g, 20, 20);          // 四角石柱
    drawPillar(g, W - 36, 20);
    drawPillar(g, 20, H - 40);
    drawPillar(g, W - 36, H - 40);
    drawLight(g, W, H, R);          // 透过藤蔓洒下的光斑
    scatter(g, W, H, R);            // 散落花瓣与落叶
    return c;
  }

  /* ---------- 石砖地面：三色调 + 磨损 + 裂纹 + 缺角 ---------- */
  function drawTiles(g, W, H, R) {
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    P(0, 0, W, H, '#241c33');
    const T = 32;
    for (let y = 0; y < H; y += T) {
      for (let x = 0; x < W; x += T) {
        const t = R();
        const base = t < 0.34 ? '#2b2239' : (t < 0.72 ? '#261e33' : '#2f2640');
        P(x, y, T, T, base);
        /* 砖缝：上方/左方高光，下方/右方阴影 */
        P(x, y, T, 1, '#3d3152');
        P(x, y, 1, T, '#3d3152');
        P(x, y + T - 1, T, 1, '#1a1428');
        P(x + T - 1, y, 1, T, '#1a1428');
        /* 缺角 */
        if (R() < 0.30) {
          const cn = 2 + Math.floor(R() * 3);
          const cx = x + Math.floor(R() * T), cy = y + Math.floor(R() * T);
          P(cx, cy, cn, 1, '#1f1830');
          P(cx, cy, 1, cn, '#1f1830');
        }
        /* 细裂纹 */
        if (R() < 0.34) {
          let cx = x + 4 + Math.floor(R() * 22), cy = y + 4 + Math.floor(R() * 22);
          const len = 4 + Math.floor(R() * 8);
          for (let i = 0; i < len; i++) {
            P(cx, cy, 1, 1, '#1d1630');
            cx += R() < 0.5 ? 1 : 0;
            cy += R() < 0.5 ? 0 : 1;
          }
        }
        /* 磨损浅斑 */
        if (R() < 0.28) {
          const cx = x + Math.floor(R() * 26), cy = y + Math.floor(R() * 26);
          P(cx, cy, 2 + Math.floor(R() * 5), 1, '#352b47');
        }
        /* 苔藓 */
        if (R() < 0.13) {
          const cx = x + Math.floor(R() * 24), cy = y + Math.floor(R() * 24);
          P(cx, cy, 3, 2, '#33502f');
          P(cx + 1, cy - 1, 2, 1, '#3f6339');
          if (R() < 0.4) P(cx - 2, cy + 1, 2, 1, '#2c4529');
        }
      }
    }
    /* 整体压暗四周，突出中央 */
    const grd = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 260);
    grd.addColorStop(0, 'rgba(70,38,84,0.30)');
    grd.addColorStop(1, 'rgba(14,9,22,0.55)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  }

  /* ---------- 中央法阵石台：三层同心台阶 + 十二道石缝 ---------- */
  function drawDais(g, W, H, R) {
    const cx = W / 2, cy = H / 2;
    /* 三层石阶 */
    pxDisc(g, cx, cy, 92, '#191325');
    pxDisc(g, cx, cy, 88, '#4a3f63');
    pxDisc(g, cx, cy, 84, '#3a3050');
    pxDisc(g, cx, cy, 78, '#2e2542');
    /* 外沿高光 */
    for (let i = 0; i < 360; i += 2) {
      const a = i * Math.PI / 180;
      const x = Math.round(cx + Math.cos(a) * 87), y = Math.round(cy + Math.sin(a) * 87);
      if (Math.sin(a) < 0) { g.fillStyle = '#6b5c8c'; g.fillRect(x, y, 1, 1); }
    }
    /* 十二道石缝 */
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + 0.13;
      for (let r = 78; r < 88; r++) {
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        g.fillStyle = '#241c36';
        g.fillRect(x, y, 1, 1);
      }
      /* 缝端符石 */
      const ex = Math.round(cx + Math.cos(a) * 82), ey = Math.round(cy + Math.sin(a) * 82);
      g.fillStyle = '#5a4c78'; g.fillRect(ex - 1, ey - 1, 3, 3);
      g.fillStyle = '#7d6ca8'; g.fillRect(ex - 1, ey - 1, 2, 1);
    }
    /* 台面斑驳 */
    for (let i = 0; i < 70; i++) {
      const a = R() * Math.PI * 2, r = R() * 76;
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      g.fillStyle = R() < 0.5 ? '#241c36' : '#3d3358';
      g.fillRect(x, y, 1 + Math.floor(R() * 2), 1);
    }
    /* 台缘苔痕 */
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * (80 + R() * 6));
      const y = Math.round(cy + Math.sin(a) * (80 + R() * 6));
      g.fillStyle = '#33502f'; g.fillRect(x, y, 2, 1);
    }
  }

  /* ---------- 四角玫瑰园：石围栏 + 泥土 + 玫瑰丛 ---------- */
  function drawGarden(g, x, y, R) {
    const P = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(x + a, y + b, w, h); };
    const w = 38, h = 38;
    /* 泥土 */
    P(2, 2, w - 4, h - 4, '#241a1a');
    /* 石围栏：上下左右 */
    for (let i = 0; i < w; i += 6) {
      P(i, 0, 5, 3, '#6d6a82'); P(i, 1, 5, 1, '#8d8aa3');
      P(i, h - 3, 5, 3, '#5c5972'); P(i, h - 3, 5, 1, '#7a7791');
    }
    for (let i = 3; i < h - 3; i += 6) {
      P(0, i, 3, 5, '#6d6a82'); P(0, i, 1, 5, '#8d8aa3');
      P(w - 3, i, 3, 5, '#5c5972'); P(w - 3, i, 1, 5, '#7a7791');
    }
    /* 玫瑰丛 */
    for (let i = 0; i < 7; i++) {
      const bx = 6 + R() * (w - 14), by = 6 + R() * (h - 14);
      /* 枝 */
      P(bx, by + 2, 1, 4, '#3f6339');
      /* 叶 */
      P(bx - 2, by + 2, 2, 1, '#4aa83f');
      P(bx + 2, by + 3, 2, 1, '#8fe36b');
      /* 花 */
      P(bx - 1, by - 1, 3, 3, '#c9304f');
      P(bx, by, 2, 2, '#ff6b8a');
      P(bx, by, 1, 1, '#ffd166');
    }
    /* 土面碎石 */
    for (let i = 0; i < 10; i++) {
      P(4 + R() * (w - 8), 4 + R() * (h - 8), 1, 1, '#3a2c2c');
    }
  }

  /* ---------- 北侧玫瑰拱门（庭院入口） ---------- */
  function drawArch(g, W, H) {
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const cx = Math.round(W / 2), top = 14;
    const lx = cx - 34, rx = cx + 26;            // 两根门柱
    /* 门洞阴影 */
    P(lx + 8, top, 44, 26, '#150f22');
    /* 门柱 */
    [lx, rx].forEach((px, i) => {
      P(px, top, 8, 30, '#4a4363');
      P(px, top, 8, 2, '#635a82');
      P(px, top, 2, 30, '#635a82');
      P(px + 6, top, 2, 30, '#332d47');
      P(px + 1, top + 6, 6, 1, '#332d47');
      P(px + 1, top + 14, 6, 1, '#332d47');
      P(px + 1, top + 22, 6, 1, '#332d47');
      /* 柱头 */
      P(px - 1, top - 3, 10, 3, '#6d6a82');
      P(px - 1, top - 3, 10, 1, '#8d8aa3');
      /* 柱脚 */
      P(px - 2, top + 30, 12, 3, '#5c5972');
    });
    /* 拱形藤蔓 */
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = Math.PI * (1 + t);
      const ax = cx + Math.cos(a) * 34;
      const ay = top - 2 + Math.sin(a) * 22;
      g.fillStyle = '#4aa83f';
      g.fillRect(Math.round(ax), Math.round(ay), 2, 2);
      if (i % 5 === 0) {
        g.fillStyle = '#8fe36b';
        g.fillRect(Math.round(ax) - 1, Math.round(ay) - 2, 3, 2);
      }
      /* 拱上的玫瑰 */
      if (i % 9 === 3) {
        g.fillStyle = '#c9304f';
        g.fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 4, 4);
        g.fillStyle = '#ff6b8a';
        g.fillRect(Math.round(ax), Math.round(ay), 2, 2);
        g.fillStyle = '#ffd166';
        g.fillRect(Math.round(ax), Math.round(ay), 1, 1);
      }
    }
  }

  /* ---------- 光斑：藤蔓缝隙洒下的暖光 ---------- */
  function drawLight(g, W, H, R) {
    for (let i = 0; i < 7; i++) {
      const x = 50 + R() * (W - 100), y = 50 + R() * (H - 100);
      const r = 22 + R() * 30;
      const grd = g.createRadialGradient(x, y, 2, x, y, r);
      grd.addColorStop(0, 'rgba(255,214,140,0.13)');
      grd.addColorStop(1, 'rgba(255,214,140,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    /* 边框内侧投影 */
    const sh = g.createLinearGradient(0, 0, 0, 40);
    sh.addColorStop(0, 'rgba(0,0,0,0.45)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(0, 14, W, 40);
    const sh2 = g.createLinearGradient(0, H, 0, H - 40);
    sh2.addColorStop(0, 'rgba(0,0,0,0.45)');
    sh2.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh2; g.fillRect(0, H - 54, W, 40);
    const sh3 = g.createLinearGradient(0, 0, 40, 0);
    sh3.addColorStop(0, 'rgba(0,0,0,0.40)');
    sh3.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh3; g.fillRect(14, 0, 40, H);
    const sh4 = g.createLinearGradient(W, 0, W - 40, 0);
    sh4.addColorStop(0, 'rgba(0,0,0,0.40)');
    sh4.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh4; g.fillRect(W - 54, 0, 40, H);
  }

  /* ---------- 散落花瓣与落叶 ---------- */
  function scatter(g, W, H, R) {
    const cols = ['#ff9ecb', '#ffd166', '#c88b2a', '#e56ba4', '#8fe36b', '#6b4a2a'];
    for (let i = 0; i < 46; i++) {
      const x = 20 + R() * (W - 40), y = 20 + R() * (H - 40);
      const col = cols[Math.floor(R() * cols.length)];
      g.fillStyle = col;
      g.fillRect(x, y, 2, 1);
      g.fillRect(x + 1, y + 1, 2, 1);
      if (R() < 0.4) g.fillRect(x - 1, y + 1, 1, 1);
    }
  }

  /* 藤蔓边框 */
  function drawBorder(g, W, H, BD, R) {
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

    /* 底土 */
    P(0, 0, W, BD, '#1c2a1a'); P(0, H - BD, W, BD, '#1c2a1a');
    P(0, 0, BD, H, '#1c2a1a'); P(W - BD, 0, BD, H, '#1c2a1a');
    P(0, BD - 2, W, 2, '#141f13'); P(0, H - BD, W, 2, '#141f13');
    P(BD - 2, 0, 2, H, '#141f13'); P(W - BD, 0, 2, H, '#141f13');

    /* 沿四边铺藤蔓 */
    const vine = (x0, y0, x1, y1, seed) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.floor(len / 3);
      const dx = (x1 - x0) / len, dy = (y1 - y0) / len;
      const nx = -dy, ny = dx;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const wave = Math.sin(t * Math.PI * 7 + seed) * 3.2;
        const bx = x0 + (x1 - x0) * t + nx * wave;
        const by = y0 + (y1 - y0) * t + ny * wave;
        g.fillStyle = '#4aa83f';
        g.fillRect(Math.round(bx), Math.round(by), 2, 2);
        /* 叶子 */
        if (i % 5 === 0) {
          const side = (i % 10 === 0) ? 1 : -1;
          g.fillStyle = '#8fe36b';
          g.fillRect(Math.round(bx + nx * 3 * side), Math.round(by + ny * 3 * side), 3, 2);
          g.fillStyle = '#5fbf4c';
          g.fillRect(Math.round(bx + nx * 4 * side), Math.round(by + ny * 4 * side), 2, 1);
        }
        /* 玫瑰 */
        if (i % 23 === 7) {
          const rr = 3;
          g.fillStyle = '#c9304f';
          g.fillRect(Math.round(bx) - 1, Math.round(by) - 1, rr + 1, rr + 1);
          g.fillStyle = '#ff6b8a';
          g.fillRect(Math.round(bx), Math.round(by), 2, 2);
          g.fillStyle = '#ffd166';
          g.fillRect(Math.round(bx), Math.round(by), 1, 1);
        }
        /* 尖刺 */
        if (i % 13 === 4) {
          g.fillStyle = '#2f6b2c';
          g.fillRect(Math.round(bx - nx * 4), Math.round(by - ny * 4), 1, 1);
        }
      }
    };

    vine(BD - 6, BD - 7, W - BD + 6, BD - 7, 0.4);
    vine(BD - 6, H - BD + 7, W - BD + 6, H - BD + 7, 2.1);
    vine(BD - 7, BD - 6, BD - 7, H - BD + 6, 3.7);
    vine(W - BD + 7, BD - 6, W - BD + 7, H - BD + 6, 5.2);
  }

  /* 角落石柱 */
  function drawPillar(g, x, y) {
    const P = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(x + a, y + b, w, h); };
    P(0, 0, 16, 20, '#3b3450');
    P(0, 0, 16, 2, '#544a70');
    P(0, 0, 2, 20, '#544a70');
    P(14, 0, 2, 20, '#2a2438');
    P(0, 18, 16, 2, '#2a2438');
    P(4, 4, 8, 1, '#2f2942');
    P(4, 9, 8, 1, '#2f2942');
    P(4, 14, 8, 1, '#2f2942');
    /* 柱顶缠绕的藤与花 */
    P(1, 2, 3, 2, '#4aa83f'); P(12, 3, 3, 2, '#8fe36b');
    P(6, 1, 3, 3, '#c9304f'); P(7, 2, 1, 1, '#ff6b8a');
  }

  /* ============================================================
     逐帧：中央星芒法阵
     ============================================================ */
  function altar(g, cx, cy, t, R0) {
    const R = R0 || 66;
    g.save();
    g.globalAlpha = 0.9;

    /* 外圈双环 */
    pxRing(g, cx, cy, R, '#ffd166', 1);
    pxRing(g, cx, cy, R - 5, 'rgba(255,209,102,0.45)', 1);

    /* 十二枚符文 */
    for (let i = 0; i < 12; i++) {
      const a = t * 0.16 + i * Math.PI / 6;
      const x = cx + Math.cos(a) * (R - 9), y = cy + Math.sin(a) * (R - 9);
      const hot = (i + Math.floor(t * 2)) % 12 < 3;
      g.fillStyle = hot ? '#fff6c8' : '#c88b2a';
      g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      g.fillStyle = hot ? '#ffd166' : '#8a5f1c';
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }

    /* 八芒星 */
    const pulse = 0.55 + Math.sin(t * 1.6) * 0.12;
    g.globalAlpha = 0.20 + pulse * 0.16;
    g.fillStyle = '#ffd166';
    pxPoly(g, cx, cy, R - 12, 4, t * 0.22, '#ffd166');
    pxPoly(g, cx, cy, R - 12, 4, t * 0.22 + Math.PI / 4, '#ffd166');

    /* 内圈与核心 */
    g.globalAlpha = 0.95;
    pxRing(g, cx, cy, 30, '#ffd166', 1);
    pxRing(g, cx, cy, 27, 'rgba(255,209,102,0.35)', 1);

    g.globalAlpha = 0.30 + pulse * 0.18;
    pxPoly(g, cx, cy, 20, 6, -t * 0.3, '#ffe9a8');

    g.globalAlpha = 0.85;
    pxRing(g, cx, cy, 9, '#fff6c8', 1);
    g.globalAlpha = 0.5 + Math.sin(t * 3) * 0.25;
    g.fillStyle = '#ffd166';
    g.fillRect(cx - 3, cy - 3, 7, 7);

    g.restore();
  }

  G.scene = { build, altar, pxRing, pxPoly, rng };

})(window.PX = window.PX || {});

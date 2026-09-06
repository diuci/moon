/* ============================================================
   audio.js —— 音乐 / 音效 / 设置
   · 纯程序化生成（WebAudio），不依赖任何外部音频文件
   · BGM：C 大调抒情循环（三角波主旋律连奏 + 三角波贝斯 + 正弦铺底和弦，弱节奏）
   · 设置：主音量 / 音乐开关 / 音效开关 / 亮度，localStorage 持久化
   ============================================================ */
(function (G) {
  'use strict';

  const SAVE_KEY = 'yueguan_set_v1';
  const DEF = { vol: 70, mus: 1, sfx: 1, bri: 100 };

  function load() {
    try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); }
    catch (e) { return Object.assign({}, DEF); }
  }
  function save(S) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }

  const S = load();

  /* ---------- 音频节点 ---------- */
  let ctx = null, master = null, musGain = null, melFlt = null, sfxGain = null, noiseBuf = null;
  let vibLfo = null, vibGain = null, delay = null, fbGain = null, wetGain = null;
  let playing = false, step = 0, nextT = 0, timer = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;                       // 无 WebAudio（含无头测试）→ 全部静默
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = S.vol / 100; master.connect(ctx.destination);
    musGain = ctx.createGain(); musGain.gain.value = S.mus ? 0.40 : 0; musGain.connect(master);
    /* 旋律低通：压掉高频毛刺，整体更柔和 */
    melFlt = ctx.createBiquadFilter(); melFlt.type = 'lowpass';
    melFlt.frequency.value = 1800; melFlt.Q.value = 0.6; melFlt.connect(musGain);
    /* 旋律颤音 LFO：让三角波更有「歌唱」感（±5.5Hz 轻微摆动） */
    vibLfo = ctx.createOscillator(); vibLfo.type = 'sine'; vibLfo.frequency.value = 5.2;
    vibGain = ctx.createGain(); vibGain.gain.value = 5.5;
    vibLfo.connect(vibGain); vibLfo.start();
    /* 旋律空间感：短延迟回声（干声 + 湿声 双路进 musGain）；无 createDelay 环境（无头测试）跳过 */
    if (typeof ctx.createDelay === 'function') {
      delay = ctx.createDelay(); delay.delayTime.value = 0.26;
      fbGain = ctx.createGain(); fbGain.gain.value = 0.26;
      wetGain = ctx.createGain(); wetGain.gain.value = 0.16;
      melFlt.connect(delay); delay.connect(fbGain); fbGain.connect(delay); delay.connect(wetGain); wetGain.connect(musGain);
    }
    sfxGain = ctx.createGain(); sfxGain.gain.value = S.sfx ? 0.9 : 0; sfxGain.connect(master);
    /* 噪声源（踩镲 / 挥砍声） */
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  const f = (m) => 440 * Math.pow(2, (m - 69) / 12);   // MIDI → 频率

  function tone(freq, t, dur, type, gain, dest, glideTo, vib) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, glideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    if (vib && vibGain) { try { vibGain.connect(o.frequency); } catch (e) { } }
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(t, dur, gain, dest, hp) {
    if (!ctx || !noiseBuf) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const g = ctx.createGain(), flt = ctx.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = hp || 4000;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt); flt.connect(g); g.connect(dest);
    s.start(t); s.stop(t + dur + 0.02);
  }

  /* ---------- BGM：抒情循环（32 个八分音符为一轮，弱节奏） ---------- */
  const BPM = 96, STEP = 60 / BPM / 2;
  /* 旋律：C 大调、级进为主、留气口的「歌唱」线条（每 2 步一个音，中间呼吸） */
  const MEL = [
    72, -1, 74, -1, 76, -1, 74, -1,   // C5 · D5 · E5 · D5
    72, -1, 71, -1, 69, -1, 67, -1,   // C5 · B4 · A4 · G4
    69, -1, 71, -1, 72, -1, 71, -1,   // A4 · B4 · C5 · B4
    69, -1, 67, -1, 64, -1, 67, -1    // A4 · G4 · E4 · G4
  ];
  /* 低音：I–V–vi–IV 进行（每小节重音一个根音，长音轻铺，不跳动） */
  const BASS = [48, 43, 45, 41];              // C  G  Am F（对应 4 小节）
  /* 柔和铺底和弦（每小节一个，正弦波低增益，做厚度床） */
  const PAD = [
    [60, 64, 67],   // C  (C E G)
    [55, 59, 62],   // G  (G B D)
    [57, 60, 64],   // Am (A C E)
    [53, 57, 60]    // F  (F A C)
  ];

  function tick() {
    if (!ctx || !playing) return;
    if (!S.mus) { stopMusic(); return; }          // 兜底：开关关着就绝不排新音符
    const ahead = ctx.currentTime + 0.3;
    while (nextT < ahead) {
      const s = step % 32;
      const m = MEL[s];
      /* 旋律：三角波长音连奏（legato）+ 颤音，低频低通更柔 */
      if (m > 0) tone(f(m), nextT, STEP * 1.7, 'triangle', 0.085, melFlt, null, true);
      if (s % 8 === 0) {                          // 仅小节重音：贝斯 + 铺底，去掉稳定踩镲
        tone(f(BASS[(s / 8) | 0]), nextT, STEP * 7, 'triangle', 0.16, musGain);
        const ch = PAD[(s / 8) | 0];
        for (let i = 0; i < ch.length; i++) tone(f(ch[i]), nextT, STEP * 7.4, 'sine', 0.038, musGain);
      }
      nextT += STEP; step++;
    }
  }
  /* 重建音乐总线：把旧的 gain 节点整个丢弃，已排程但还没响的音符会随之失效
     （仅 clearInterval 是不够的——提前 0.3s 排程的音符仍会播完） */
  function rebuildMus() {
    if (!ctx) return;
    try { musGain.disconnect(); } catch (e) { }
    musGain = ctx.createGain();
    musGain.gain.value = 0;
    musGain.connect(master);
    try { melFlt.disconnect(); } catch (e) { }     // 旋律线重接到新总线，重启后能正常出声
    melFlt.connect(musGain);
    if (delay) {                                    // 回声路径：melFlt→delay→(反馈)→wet→新总线
      melFlt.connect(delay);
      try { wetGain.disconnect(); } catch (e) { }
      wetGain.connect(musGain);
    }
  }

  function startMusic() {
    if (!ensure()) return;
    if (!S.mus) { stopMusic(); return; }          // 开关关着 → 绝不启动
    if (playing) return;
    playing = true; step = 0; nextT = ctx.currentTime + 0.08;
    musGain.gain.value = 0.40;                    // 确保总线是开的
    tick();
    timer = setInterval(tick, 60);
  }
  function stopMusic() {
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    rebuildMus();                                  // 硬切断：旧音符立即失声
  }

  /* ---------- 音效 ---------- */
  let lastSfx = 0;
  function sfx(kind) {
    if (!ctx || !S.sfx) return;
    const now = ctx.currentTime;
    if (kind !== 'kill' && now - lastSfx < 0.035) return;   // 高密度开火时限流
    lastSfx = now;
    if (kind === 'shoot') tone(620, now, 0.07, 'square', 0.10, sfxGain, 300);
    else if (kind === 'swing') noise(now, 0.10, 0.16, sfxGain, 1200);
    else if (kind === 'kill') { tone(880, now, 0.06, 'square', 0.10, sfxGain); tone(1320, now + 0.05, 0.08, 'square', 0.09, sfxGain); }
    else if (kind === 'hurt') tone(240, now, 0.18, 'sawtooth', 0.16, sfxGain, 80);
    else if (kind === 'level') { tone(f(72), now, 0.10, 'square', 0.12, sfxGain); tone(f(76), now + 0.09, 0.10, 'square', 0.12, sfxGain); tone(f(79), now + 0.18, 0.14, 'square', 0.12, sfxGain); tone(f(84), now + 0.27, 0.18, 'square', 0.12, sfxGain); }
    else if (kind === 'pick') tone(1046, now, 0.09, 'triangle', 0.14, sfxGain);
  }

  /* ---------- 设置应用 ---------- */
  function apply() {
    if (ctx) {
      master.gain.value = S.vol / 100;
      sfxGain.gain.value = S.sfx ? 0.9 : 0;
      if (S.mus) musGain.gain.value = 0.40;
      else stopMusic();                 // 关音乐：停调度 + 重建总线，双保险
    }
    const st = document.getElementById('stage');
    if (st) st.style.filter = S.bri === 100 ? '' : 'brightness(' + (S.bri / 100) + ')';
  }

  /* 首次用户手势后才能启动音频（浏览器自动播放策略） */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    apply();                                  // 先按当前设置摆正总线，再决定是否播放
    if (S.mus) startMusic(); else stopMusic();
  }

  /* ---------- UI 绑定：右上角「玩法说明 / 设置」 ---------- */
  function $(id) { return document.getElementById(id); }
  function bindUI() {
    const helpBtn = $('helpBtn'), setBtn = $('setBtn'), legalBtn = $('legalBtn');
    const helpPanel = $('helpPanel'), setPanel = $('setPanel'), legalPanel = $('legalPanel');
    const topbtns = $('topbtns');
    if (!helpBtn || !setBtn) return;

    const closeAll = () => { helpPanel.classList.remove('on'); setPanel.classList.remove('on'); if (legalPanel) legalPanel.classList.remove('on'); };
    helpBtn.onclick = () => {
      const was = helpPanel.classList.contains('on');
      closeAll(); helpPanel.classList.toggle('on', !was); sfx('pick');
    };
    setBtn.onclick = () => {
      const was = setPanel.classList.contains('on');
      closeAll(); setPanel.classList.toggle('on', !was); sfx('pick');
    };
    if (legalBtn) legalBtn.onclick = () => {
      const was = legalPanel.classList.contains('on');
      closeAll(); legalPanel.classList.toggle('on', !was); sfx('pick');
    };
    document.querySelectorAll('.pclose').forEach(b => b.onclick = () => {
      const p = $(b.getAttribute('data-close'));
      if (p) p.classList.remove('on');
    });
    const pSet = $('pSet');                       // 暂停面板里的「设置」
    if (pSet) pSet.onclick = () => { closeAll(); setPanel.classList.add('on'); };

    /* 主音量 */
    const volR = $('volRange'), volV = $('volVal');
    volR.value = S.vol; volV.textContent = S.vol;
    volR.oninput = () => { S.vol = +volR.value; volV.textContent = S.vol; apply(); save(S); };

    /* 亮度 */
    const briR = $('briRange'), briV = $('briVal');
    briR.value = S.bri; briV.textContent = S.bri;
    briR.oninput = () => { S.bri = +briR.value; briV.textContent = S.bri; apply(); save(S); };

    /* 音乐 / 音效 开关 */
    const musBtn = $('musBtn'), sfxBtn = $('sfxBtn');
    const syncTgl = () => {
      musBtn.textContent = S.mus ? '开' : '关';
      musBtn.classList.toggle('on', !!S.mus);
      sfxBtn.textContent = S.sfx ? '开' : '关';
      sfxBtn.classList.toggle('on', !!S.sfx);
    };
    syncTgl();
    musBtn.onclick = () => {
      S.mus = S.mus ? 0 : 1; syncTgl(); save(S);
      if (S.mus) { apply(); unlock(); sfx('pick'); }
      else { stopMusic(); apply(); }            // 先硬停调度，再摆正总线
    };
    sfxBtn.onclick = () => {
      S.sfx = S.sfx ? 0 : 1; syncTgl(); apply(); save(S);
      if (S.sfx) sfx('pick');
    };

    /* 恢复默认：音量 70 / 音乐开 / 音效开 / 亮度 100 */
    const rsSet = $('resetSet');
    if (rsSet) rsSet.onclick = () => {
      S.vol = DEF.vol; S.mus = DEF.mus; S.sfx = DEF.sfx; S.bri = DEF.bri;
      volR.value = S.vol; volV.textContent = S.vol;
      briR.value = S.bri; briV.textContent = S.bri;
      syncTgl(); save(S);
      if (S.mus) { apply(); unlock(); if (S.sfx) sfx('pick'); }
      else { stopMusic(); apply(); }
    };

    apply();
    /* 右上角按钮只在可见时由 game.js 加 .on；此处仅确保面板初始关闭 */
    if (topbtns) topbtns.classList.remove('on');
  }

  G.audio = {
    unlock, startMusic, stopMusic, sfx, apply, bindUI,
    get settings() { return S; },
    isPlaying() { return playing; },
    /* 无头测试用：读出三条总线的实际增益 */
    gains() {
      if (!ctx) return null;
      return { master: master.gain.value, mus: musGain.gain.value, sfx: sfxGain.gain.value };
    },
    showTopBtns(on) { const t = $('topbtns'); if (t) t.classList.toggle('on', !!on); }
  };

  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
})(window.PX = window.PX || {});

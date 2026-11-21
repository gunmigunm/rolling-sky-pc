/* Rolling Sky PC - 键位映射 + 自动游玩 Bot */
(function () {
  'use strict';

  var DEF = { sens: 12, jumpMs: 560, dragMs: 45, vision: false };

  var cfg = {
    sens: DEF.sens,      // 拨动幅度（占画面宽度百分比）
    jumpMs: DEF.jumpMs,  // 自动跳跃间隔
    dragMs: DEF.dragMs,  // 一次拨动的手势时长
    vision: DEF.vision   // 视觉避障
  };

  try {
    var saved = JSON.parse(localStorage.getItem('rsBotCfg') || '{}');
    for (var k in cfg) if (typeof saved[k] === typeof cfg[k]) cfg[k] = saved[k];
  } catch (e) {}

  function save() {
    try { localStorage.setItem('rsBotCfg', JSON.stringify(cfg)); } catch (e) {}
  }

  var state = { on: false, lastJump: 0, lastSteer: 0, lastNudge: 0, statusEl: null, raf: 0 };

  function canvas() {
    return document.querySelector('#gameContainer canvas') || document.querySelector('canvas');
  }

  function fire(type, x, y, extra) {
    var c = canvas();
    if (!c) return;
    var init = {
      bubbles: true, cancelable: true, composed: true,
      clientX: x, clientY: y, screenX: x, screenY: y,
      button: 0, buttons: type === 'mouseup' ? 0 : 1, detail: 1, view: window
    };
    if (extra) for (var k in extra) init[k] = extra[k];
    c.dispatchEvent(new MouseEvent(type, init));
    document.dispatchEvent(new MouseEvent(type, init));
  }

  function pressPoint() {
    var c = canvas(); if (!c) return null;
    var r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.78, w: r.width, left: r.left };
  }

  // 一次“点按”= 跳
  function tap() {
    var p = pressPoint(); if (!p) return;
    fire('mousedown', p.x, p.y);
    setTimeout(function () { fire('mouseup', p.x, p.y); }, 30);
  }

  // 一次“横向拨动”= 左右移一格；幅度由灵敏度滑块决定，中间插几帧 mousemove 让游戏跟手
  function nudge(dir, forceStepPx) {
    var p = pressPoint(); if (!p) return;
    var step = forceStepPx != null ? forceStepPx : p.w * (cfg.sens / 100);
    step = Math.max(6, Math.min(step, p.w * 0.42)) * dir;

    var fromX = p.x, toX = p.x + step, y = p.y;
    var dur = Math.max(8, cfg.dragMs);
    var frames = 4;
    fire('mousedown', fromX, y);
    for (var i = 1; i <= frames; i++) {
      (function (tt) {
        setTimeout(function () { fire('mousemove', fromX + (toX - fromX) * tt, y); }, Math.round(dur * tt));
      })(i / frames);
    }
    setTimeout(function () { fire('mousemove', toX, y); fire('mouseup', toX, y); }, dur);
  }

  function throttledNudge(dir) {
    var now = performance.now();
    if (now - state.lastNudge < 90) return;
    state.lastNudge = now;
    nudge(dir);
  }

  /* ---------- HUD / 滑块面板 ---------- */

  function buildPanel() {
    var el = document.createElement('div');
    el.id = 'rs-bot-hud';
    el.style.cssText = [
      'position:fixed', 'left:8px', 'bottom:8px', 'z-index:99',
      'font:12px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif', 'color:#fff',
      'background:rgba(0,0,0,.62)', 'padding:8px 10px', 'border-radius:10px',
      'pointer-events:auto', 'white-space:pre', 'user-select:none',
      'box-shadow:0 4px 14px rgba(0,0,0,.35)', 'max-width:230px'
    ].join(';');

    var tip = document.createElement('div');
    tip.style.cssText = 'opacity:.75;font-size:11px;margin-bottom:6px';
    tip.textContent = 'F8 自动游玩 · F9 跳速 · F10 视觉 · 方向键/AD 移动 · 空格 跳';
    el.appendChild(tip);

    var line = document.createElement('div');
    line.style.cssText = 'font-size:11px;opacity:.9;margin-bottom:6px';
    el.appendChild(line);
    state.statusEl = line;

    function row(label, min, max, step, value, fmt, onInput) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'margin:5px 0';

      var lab = document.createElement('div');
      lab.style.cssText = 'display:flex;justify-content:space-between;gap:8px;font-size:11px';
      var name = document.createElement('span');
      name.textContent = label;
      var val = document.createElement('span');
      val.style.cssText = 'font-variant-numeric:tabular-nums;opacity:.85';
      val.textContent = fmt(value);
      lab.appendChild(name); lab.appendChild(val);

      var input = document.createElement('input');
      input.type = 'range';
      input.min = min; input.max = max; input.step = step; input.value = value;
      input.style.cssText = 'width:100%;height:14px;margin:2px 0 0;accent-color:#4da3ff;cursor:pointer';

      input.addEventListener('input', function () {
        var v = parseFloat(input.value);
        val.textContent = fmt(v);
        onInput(v);
      });
      // 拖滑块时别让方向键/空格漏给游戏
      input.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      input.addEventListener('keydown', function (e) { e.stopPropagation(); });

      wrap.appendChild(lab); wrap.appendChild(input);
      el.appendChild(wrap);
      return { set: function (v) { input.value = v; val.textContent = fmt(v); } };
    }

    var sensRow = row('灵敏度（拨动幅度）', 4, 30, 1, cfg.sens,
      function (v) { return String(Math.round(v)); },
      function (v) { cfg.sens = v; save(); });

    var jumpRow = row('自动跳跃节奏', 250, 1500, 10, cfg.jumpMs,
      function (v) { return Math.round(v) + 'ms'; },
      function (v) { cfg.jumpMs = v; save(); });

    var dragRow = row('拨动手势时长', 10, 140, 5, cfg.dragMs,
      function (v) { return Math.round(v) + 'ms'; },
      function (v) { cfg.dragMs = v; save(); });

    state.sensRow = sensRow; state.jumpRow = jumpRow; state.dragRow = dragRow;

    var visionBtn = document.createElement('button');
    visionBtn.style.cssText = 'margin-top:6px;width:100%;font:11px system-ui;color:#fff;background:#2a2a2a;' +
      'border:1px solid #4da3ff;border-radius:6px;padding:4px 0;cursor:pointer';
    function paintVision() { visionBtn.textContent = '视觉避障：' + (cfg.vision ? '开（实验）' : '关'); }
    paintVision();
    visionBtn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    visionBtn.addEventListener('click', function () {
      cfg.vision = !cfg.vision; save(); paintVision(); setStatus();
    });
    el.appendChild(visionBtn);

    var resetBtn = document.createElement('button');
    resetBtn.style.cssText = 'margin-top:5px;width:100%;font:11px system-ui;color:#bbb;background:transparent;' +
      'border:1px solid #555;border-radius:6px;padding:4px 0;cursor:pointer';
    resetBtn.textContent = '恢复默认';
    resetBtn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    resetBtn.addEventListener('click', function () {
      cfg.sens = DEF.sens; cfg.jumpMs = DEF.jumpMs; cfg.dragMs = DEF.dragMs;
      save();
      sensRow.set(cfg.sens); jumpRow.set(cfg.jumpMs); dragRow.set(cfg.dragMs);
      setStatus();
    });
    el.appendChild(resetBtn);

    document.body.appendChild(el);
    state.panel = el;
    setStatus();
  }

  function setStatus() {
    if (!state.statusEl) return;
    state.statusEl.textContent = state.on
      ? '自动游玩：开（F8 关）' + (cfg.vision ? ' · 视觉开' : '')
      : '自动游玩：关（F8 开）';
  }

  /* ---------- 自动游玩 ---------- */

  function pixelBot() {
    if (!state.on) return;
    var now = performance.now();
    if (now - state.lastJump > cfg.jumpMs) {
      state.lastJump = now;
      tap();
    }
    if (cfg.vision && now - state.lastSteer > 260) {
      state.lastSteer = now;
      steer();
    }
    state.raf = requestAnimationFrame(pixelBot);
  }

  // 极简视觉：取一条扫描线，找“最亮的连续段”当作通路，把球朝它推
  var buf = null, bufCtx = null;
  function steer() {
    var c = canvas(); if (!c) return;
    var w = 96, h = 96;
    if (!buf) {
      buf = document.createElement('canvas');
      buf.width = w; buf.height = h;
      bufCtx = buf.getContext('2d', { willReadFrequently: true });
    }
    try { bufCtx.drawImage(c, 0, 0, w, h); } catch (e) { return; }
    var data;
    try { data = bufCtx.getImageData(0, Math.round(h * 0.45), w, 1).data; } catch (e) { return; }
    var bestStart = 0, bestLen = 0, curStart = 0, curLen = 0;
    for (var i = 0; i < w; i++) {
      var r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if ((r + g + b) / 3 > 70) {
        if (curLen === 0) curStart = i;
        curLen++;
        if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
      } else curLen = 0;
    }
    if (bestLen < 8) return;
    var target = (bestStart + bestLen / 2) / w;
    var dead = 0.08;
    if (target < 0.5 - dead) throttledNudge(-1);
    else if (target > 0.5 + dead) throttledNudge(1);
  }

  function toggle() {
    state.on = !state.on;
    if (state.on) {
      state.lastJump = 0;
      state.raf = requestAnimationFrame(pixelBot);
    } else {
      cancelAnimationFrame(state.raf);
    }
    setStatus();
  }

  function isTyping(e) {
    var t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  }

  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var k = e.key;
    var typing = isTyping(e);
    if (!typing && (k === 'ArrowLeft' || k === 'a' || k === 'A')) { throttledNudge(-1); e.preventDefault(); }
    else if (!typing && (k === 'ArrowRight' || k === 'd' || k === 'D')) { throttledNudge(1); e.preventDefault(); }
    else if (!typing && (k === ' ' || k === 'Spacebar')) { tap(); e.preventDefault(); }
    else if (k === 'F8') { toggle(); e.preventDefault(); }
    else if (k === 'F9') {
      cfg.jumpMs = cfg.jumpMs >= 1200 ? 320 : cfg.jumpMs + 280;
      save();
      if (state.jumpRow) state.jumpRow.set(cfg.jumpMs);
      setStatus();
      e.preventDefault();
    } else if (k === 'F10') {
      cfg.vision = !cfg.vision; save(); setStatus();
      e.preventDefault();
    }
  }, true);

  function boot() {
    if (!document.body) return;
    buildPanel();
    setTimeout(function () {
      var c = canvas();
      if (c) c.style.cursor = 'crosshair';
    }, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

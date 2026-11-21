/* Rolling Sky PC - 键位映射 + 自动游玩 Bot（实验） */
(function () {
  'use strict';
  var state = { on: false, jumpMs: 560, lastJump: 0, vision: false, lastSteer: 0, statusEl: null, raf: 0 };

  function canvas() { return document.querySelector('#gameContainer canvas') || document.querySelector('canvas'); }

  function fire(type, x, y) {
    var c = canvas(); if (!c) return;
    var init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y,
      button: 0, buttons: type === 'mouseup' ? 0 : 1, detail: 1, view: window };
    c.dispatchEvent(new MouseEvent(type, init));
    document.dispatchEvent(new MouseEvent(type, init));
  }

  function tap() {
    var c = canvas(); if (!c) return;
    var r = c.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height * 0.8;
    fire('mousedown', x, y);
    setTimeout(function () { fire('mouseup', x, y); }, 30);
  }

  function nudge(dir) {
    var c = canvas(); if (!c) return;
    var r = c.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height * 0.8;
    var step = Math.max(12, r.width * 0.12) * dir;
    fire('mousedown', x, y);
    setTimeout(function () { fire('mousemove', x + step, y); }, 10);
    setTimeout(function () { fire('mouseup', x + step, y); }, 46);
  }

  var buf = null, bufCtx = null;
  function steer() {
    var c = canvas(); if (!c) return;
    var w = 96, h = 96;
    if (!buf) { buf = document.createElement('canvas'); buf.width = w; buf.height = h; bufCtx = buf.getContext('2d', { willReadFrequently: true }); }
    try { bufCtx.drawImage(c, 0, 0, w, h); } catch (e) { return; }
    var data;
    try { data = bufCtx.getImageData(0, Math.round(h * 0.45), w, 1).data; } catch (e) { return; }
    var bestStart = 0, bestLen = 0, curStart = 0, curLen = 0;
    for (var i = 0; i < w; i++) {
      var lum = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
      if (lum > 70) { if (curLen === 0) curStart = i; curLen++; if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; } } else curLen = 0;
    }
    if (bestLen < 8) return;
    var target = (bestStart + bestLen / 2) / w;
    if (target < 0.42) nudge(-1); else if (target > 0.58) nudge(1);
  }

  function pixelBot() {
    if (!state.on) return;
    var now = performance.now();
    if (now - state.lastJump > state.jumpMs) { state.lastJump = now; tap(); }
    if (state.vision && now - state.lastSteer > 260) { state.lastSteer = now; steer(); }
    state.raf = requestAnimationFrame(pixelBot);
  }

  function status(t) { if (state.statusEl) state.statusEl.textContent = t; }

  function overlay() {
    if (state.statusEl) return;
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font:12px/1.5 system-ui;color:#fff;background:rgba(0,0,0,.55);padding:6px 9px;border-radius:8px;pointer-events:none;white-space:pre';
    el.textContent = 'F8 自动游玩 / F9 跳速 / 方向键 移动 / 空格 跳';
    document.body.appendChild(el);
    state.statusEl = el;
  }

  function toggle() {
    state.on = !state.on;
    if (state.on) { state.lastJump = 0; status('自动游玩：开（F8 关）'); state.raf = requestAnimationFrame(pixelBot); }
    else { cancelAnimationFrame(state.raf); status('自动游玩：关（F8 开）'); }
  }

  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { nudge(-1); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { nudge(1); e.preventDefault(); }
    else if (k === ' ') { tap(); e.preventDefault(); }
    else if (k === 'F8') { toggle(); e.preventDefault(); }
    else if (k === 'F9') { state.jumpMs = state.jumpMs === 560 ? 900 : (state.jumpMs === 900 ? 320 : 560); status('跳跃间隔：' + state.jumpMs + 'ms'); e.preventDefault(); }
    else if (k === 'F10') { state.vision = !state.vision; status('视觉避障：' + (state.vision ? '开（实验）' : '关')); e.preventDefault(); }
  }, true);

  window.addEventListener('load', function () { overlay(); });
  setTimeout(overlay, 500);
})();

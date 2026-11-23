(() => {
  'use strict';
  const W = 480, H = 720, GRASS = 50, SHOULDER = 25, LANES = 5, LANE_W = 66;
  const PPM = 8, PLAYER_Y = 550, START_KM = 23;
  const ROAD_L = GRASS + SHOULDER, ROAD_R = W - GRASS - SHOULDER;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  let R = Math.random;                       // sorteio do trânsito: aleatório offline, com semente online
  const rrand = (a, b) => a + R() * (b - a);
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const laneX = i => ROAD_L + LANE_W * (i + 0.5);
  const fmtKm = m => (m / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FONT = '"Chakra Petch", "Segoe UI", sans-serif';

  function hash(n) {
    n = n | 0;
    n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4;
    n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15;
    return (n >>> 0) / 4294967296;
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = f < 0 ? 0 : 255, a = Math.abs(f);
    r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // ---------- contexto de desenho ----------
  const cv = $('game'), gctx = cv.getContext('2d');
  let ctx = gctx;
  function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  let now = 0;

  // ---------- dados ----------
  const CARS = [
    { id: 'urbano', name: 'Urbano GT', desc: 'Hatch ágil e fácil de guiar', len: 68, w: 37, ws: [.18, .17], roof: [.35, .30], rear: [.65, .12], top: 140, acc: 44, brk: 120, hnd: 1.12 },
    { id: 'relampago', name: 'Relâmpago', desc: 'Cupê esportivo equilibrado', len: 78, w: 38, ws: [.20, .15], roof: [.35, .26], rear: [.61, .13], top: 165, acc: 52, brk: 125, hnd: 1.0 },
    { id: 'trovao', name: 'Trovão V8', desc: 'Muscle car, forte e pesado', len: 86, w: 41, ws: [.22, .14], roof: [.38, .24], rear: [.62, .12], top: 185, acc: 60, brk: 115, hnd: .88, stripes: true },
    { id: 'fantasma', name: 'Fantasma R', desc: 'Supercarro de pista', len: 84, w: 40, ws: [.26, .12], roof: [.40, .20], rear: [.60, .10], top: 205, acc: 68, brk: 140, hnd: .98, wing: true }
  ];
  const TUNES = [
    { k: 'motor', name: 'Motor', desc: '+8 km/h de velocidade máxima' },
    { k: 'turbo', name: 'Turbo', desc: '+5 de aceleração' },
    { k: 'pneus', name: 'Pneus e freios', desc: 'Mais direção e frenagem' }
  ];
  const TUNE_COST = [150, 250, 400, 600, 900];
  const COLORS = ['#ffb42e', '#e5483a', '#2f7fd6', '#27b36a', '#f2f2ee', '#1c1f24', '#9b5de5', '#ff6fa8'];
  const TRAFFIC = [
    { kind: 'truck', len: 116, w: 42, vmin: 34, vmax: 44, weight: .07 },
    { kind: 'car', len: 92, w: 40, ws: [.10, .16], roof: [.28, .50], rear: null, vmin: 40, vmax: 50, weight: .23 },
    { kind: 'car', len: 78, w: 38, ws: [.20, .15], roof: [.35, .26], rear: [.61, .13], vmin: 55, vmax: 65, weight: .22 },
    { kind: 'car', len: 68, w: 37, ws: [.18, .17], roof: [.35, .30], rear: [.65, .12], vmin: 55, vmax: 65, weight: .22 },
    { kind: 'car', len: 80, w: 39, ws: [.22, .14], roof: [.36, .24], rear: [.62, .12], vmin: 72, vmax: 90, weight: .14 },
    { kind: 'car', len: 74, w: 38, ws: [.25, .13], roof: [.39, .22], rear: [.60, .11], vmin: 75, vmax: 88, weight: .12 }
  ];

  // ---------- estradas ----------
  const WORDS = ['PIXO', 'ZONA', 'RUA', 'CRIA', 'LOKO', 'MANO', 'SP'];
  const NY_ROOF = ['#6d7077', '#7b746b', '#5b5f67', '#8b6e5d', '#767b82'];
  const BR_ROOF = ['#b4532f', '#c9743a', '#9c4a2e', '#6f8493', '#8b8a82', '#c06a3c'];

  const TH = {
    sakura: {
      name: 'Avenida Sakura', sub: 'Tóquio, com cerejeiras nos acostamentos',
      thumb: 'linear-gradient(90deg,#f2a7bf 0 24%,#5a7b55 24% 30%,#2b2b33 30% 70%,#5a7b55 70% 76%,#f2a7bf 76%)',
      ground: '#5a7b55', asphalt: '#2b2b33', shoulder: '#35353d', paint: '#efeadb', km: '#1d4f9c',
      cars: ['#f4f4f2', '#f4f4f2', '#d9dbe0', '#202228', '#e8a0b8', '#9fc3e0', '#b83a3a', '#c9d9a8'],
      sides(zb, zt, zy) {
        for (let i = Math.floor(zb / 6) - 1; i <= Math.ceil(zt / 6) + 1; i++) {
          for (let s = 0; s < 2; s++) {
            const h = hash(i * 7 + s * 131 + 5);
            const cx = s === 0 ? 24 + (h - .5) * 6 : W - 24 - (h - .5) * 6;
            const cy = zy(i * 6 + h * 2), r = 17 + hash(i * 3 + s + 9) * 5;
            ctx.fillStyle = 'rgba(20,30,20,.28)'; circ(cx + 3, cy + 4, r);
            ctx.fillStyle = '#e58aa8'; circ(cx, cy, r);
            for (let k = 0; k < 5; k++) {
              const a = hash(i * 11 + k + s * 50) * 6.283, d = hash(i * 13 + k * 3 + s) * r * .55;
              ctx.fillStyle = k % 2 ? '#f6b4c8' : '#ffdbe6';
              circ(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * .42);
            }
          }
        }
      },
      edge(zb, zt, zy) {
        ctx.fillStyle = '#a9a7b4'; ctx.fillRect(GRASS, 0, 4, H); ctx.fillRect(W - GRASS - 4, 0, 4, H);
        ctx.fillStyle = '#e8e4ee';
        for (let i = Math.floor(zb / 10); i <= Math.ceil(zt / 10); i++) { const y = zy(i * 10); ctx.fillRect(GRASS - 3, y - 1.5, 3, 3); ctx.fillRect(W - GRASS, y - 1.5, 3, 3); }
      },
      deco(zb, zt, zy) {
        ctx.fillStyle = 'rgba(255,196,214,.6)';
        for (let i = Math.floor(zb / 3) - 1; i <= Math.ceil(zt / 3); i++) {
          for (let k = 0; k < 2; k++) circ(GRASS + hash(i * 13 + k * 7 + 1) * (W - 2 * GRASS), zy(i * 3 + hash(i * 5 + k) * 3), 1.3 + hash(i + k * 3) * 1.2);
        }
      },
      over(zb, zt, zy) {
        for (let m = Math.floor((zb - 250) / 500); m <= Math.ceil((zt - 250) / 500); m++) {
          if (m < 0) continue;
          const y = zy(m * 500 + 250);
          ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(GRASS - 8, y + 6, W - 2 * GRASS + 16, 14);
          ctx.fillStyle = '#b3221b'; circ(GRASS + 2, y, 6); circ(W - GRASS - 2, y, 6);
          ctx.fillStyle = '#c4281f'; ctx.fillRect(GRASS - 4, y - 3, W - 2 * GRASS + 8, 6);
          ctx.fillStyle = '#1c1a1d'; ctx.fillRect(GRASS - 14, y - 10, W - 2 * GRASS + 28, 8);
        }
      }
    },

    ny: {
      name: 'Avenida Nova York', sub: 'Quarteirões, táxis e faixas de pedestre',
      thumb: 'linear-gradient(90deg,#6d7077 0 24%,#8c8c88 24% 30%,#232326 30% 70%,#8c8c88 70% 76%,#7b746b 76%)',
      ground: '#1b1c20', asphalt: '#232326', shoulder: '#2d2e32', paint: '#efeee8', leftLine: '#f2c230', km: null,
      cars: ['#f7c32a', '#f7c32a', '#f7c32a', '#f7c32a', '#202226', '#e9e9e5', '#8a8f96', '#3f5f8a'],
      sides(zb, zt, zy) {
        for (let i = Math.floor(zb / 36) - 1; i <= Math.ceil(zt / 36); i++) {
          const len = 29 + hash(i * 5 + 2) * 5, yTop = zy(i * 36 + len), hh = zy(i * 36) - yTop;
          for (let s = 0; s < 2; s++) {
            const x0 = s === 0 ? 0 : W - (GRASS - 10), w = GRASS - 10;
            ctx.fillStyle = NY_ROOF[Math.floor(hash(i * 3 + s * 17 + 4) * NY_ROOF.length)];
            ctx.fillRect(x0, yTop, w, hh);
            ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x0, yTop, w, 3);
            ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 3, yTop + 3, w - 6, hh - 6);
            ctx.fillStyle = 'rgba(255,255,255,.18)';
            for (let k = 0; k < 3; k++) ctx.fillRect(x0 + 5 + hash(i * 9 + s * 5 + k) * (w - 18), yTop + 10 + hash(i * 7 + s * 3 + k * 2) * (hh - 26), 9, 7);
            if (hash(i * 4 + s * 9) > .55) {
              ctx.fillStyle = '#5a4332'; circ(x0 + w / 2, yTop + hh * (.3 + hash(i + s) * .4), 8);
              ctx.fillStyle = '#7a5a40'; circ(x0 + w / 2, yTop + hh * (.3 + hash(i + s) * .4), 5);
            }
          }
        }
        ctx.fillStyle = '#8c8c88'; ctx.fillRect(GRASS - 10, 0, 10, H); ctx.fillRect(W - GRASS, 0, 10, H);
      },
      edge() { ctx.fillStyle = '#b9b9b3'; ctx.fillRect(GRASS, 0, 3, H); ctx.fillRect(W - GRASS - 3, 0, 3, H); },
      deco(zb, zt, zy) {
        for (let i = Math.floor(zb / 36) - 1; i <= Math.ceil(zt / 36); i++) {
          if (((i % 4) + 4) % 4 !== 0) continue;
          const len = 29 + hash(i * 5 + 2) * 5, y = zy(i * 36 + (len + 36) / 2);
          ctx.fillStyle = 'rgba(240,240,235,.85)';
          for (let x = ROAD_L + 8; x < ROAD_R - 6; x += 16) ctx.fillRect(x, y - 16, 8, 32);
          ctx.fillRect(ROAD_L, y - 24, ROAD_R - ROAD_L, 3);
        }
        ctx.fillStyle = 'rgba(240,240,235,.5)';
        for (let i = Math.floor(zb / 120) - 1; i <= Math.ceil(zt / 120); i++) {
          const y = zy(i * 120 + 60);
          for (let l = 0; l < LANES; l++) {
            const x = laneX(l);
            ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x - 8, y - 6); ctx.lineTo(x - 3, y - 6); ctx.lineTo(x - 3, y + 14);
            ctx.lineTo(x + 3, y + 14); ctx.lineTo(x + 3, y - 6); ctx.lineTo(x + 8, y - 6); ctx.closePath(); ctx.fill();
          }
        }
        for (let i = Math.floor(zb / 55) - 1; i <= Math.ceil(zt / 55); i++) {
          if (hash(i * 11 + 3) > .5) continue;
          const x = ROAD_L + 20 + hash(i * 7 + 5) * (ROAD_R - ROAD_L - 40), y = zy(i * 55 + hash(i * 3 + 1) * 40);
          ctx.fillStyle = '#17181a'; circ(x, y, 8);
          ctx.strokeStyle = '#3a3b3f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 8, 0, 6.2832); ctx.stroke();
          if (hash(i * 5 + 8) > .3) {
            for (let k = 0; k < 3; k++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.14 - k * .03) + ')'; circ(x + Math.sin(now * 1.3 + k + i) * 4, y - 6 - k * 9, 7 + k * 3); }
          }
        }
      },
      over(zb, zt, zy) {
        for (let m = Math.floor((zb - 400) / 800); m <= Math.ceil((zt - 400) / 800); m++) {
          if (m < 0) continue;
          const y = zy(m * 800 + 400);
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(ROAD_L + 6, y + 8, ROAD_R - ROAD_L - 12, 34);
          ctx.fillStyle = '#5b5f67'; ctx.fillRect(GRASS - 6, y - 4, 8, 8); ctx.fillRect(W - GRASS - 2, y - 4, 8, 8);
          ctx.fillStyle = '#1f6b45'; ctx.fillRect(ROAD_L + 4, y - 18, ROAD_R - ROAD_L - 8, 34);
          ctx.strokeStyle = '#f2f2ee'; ctx.lineWidth = 2; ctx.strokeRect(ROAD_L + 7, y - 15, ROAD_R - ROAD_L - 14, 28);
          ctx.fillStyle = '#f2f2ee'; ctx.font = '700 15px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('UPTOWN  ↑  AVENUE', W / 2, y - 1);
        }
      }
    },

    br: {
      name: 'Rua Brasil', sub: 'Pixações no asfalto e muros coloridos',
      thumb: 'linear-gradient(90deg,#b4532f 0 20%,#d9cfb6 20% 30%,#33312f 30% 70%,#d9cfb6 70% 80%,#6f8493 80%)',
      ground: '#6a6256', asphalt: '#33312f', shoulder: '#3b3936', paint: '#e9e6da', km: '#1f6b3a',
      cars: ['#e9e9e4', '#e9e9e4', '#b8bbbe', '#25272b', '#a93226', '#2f5d8a', '#d4a017'],
      sides(zb, zt, zy) {
        for (let i = Math.floor(zb / 18) - 1; i <= Math.ceil(zt / 18); i++) {
          const len = 14 + hash(i * 7 + 1) * 2.5, yTop = zy(i * 18 + len), hh = zy(i * 18) - yTop;
          for (let s = 0; s < 2; s++) {
            const x0 = s === 0 ? 0 : W - (GRASS - 9), w = GRASS - 9;
            ctx.fillStyle = BR_ROOF[Math.floor(hash(i * 3 + s * 17 + 4) * BR_ROOF.length)];
            ctx.fillRect(x0, yTop, w, hh);
            ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x0, yTop + hh / 2 - 1.5, w, 3);
            ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
            for (let y = yTop + 6; y < yTop + hh; y += 6) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke(); }
            if (hash(i * 5 + s * 3 + 2) > .62) { ctx.fillStyle = '#2b6cb0'; circ(x0 + w / 2, yTop + hh * .5, 8); ctx.fillStyle = '#4a90d9'; circ(x0 + w / 2, yTop + hh * .5, 5); }
            if (hash(i * 9 + s * 5 + 6) > .5) {
              const px = s === 0 ? GRASS * .5 : W - GRASS * .5, py = zy(i * 18 + len + (18 - len) / 2);
              for (let k = 0; k < 6; k++) {
                const a = k * 1.047;
                ctx.fillStyle = k % 2 ? '#2f7d3a' : '#3f9a4a';
                ctx.beginPath(); ctx.ellipse(px + Math.cos(a) * 7, py + Math.sin(a) * 7, 8, 3, a, 0, 6.2832); ctx.fill();
              }
              ctx.fillStyle = '#1d5a28'; circ(px, py, 3);
            }
          }
        }
      },
      edge(zb, zt, zy) {
        ctx.fillStyle = '#d9cfb6'; ctx.fillRect(GRASS - 9, 0, 9, H); ctx.fillRect(W - GRASS, 0, 9, H);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(GRASS - 1, 0, 1, H); ctx.fillRect(W - GRASS, 0, 1, H);
        const cols = ['#1b1b1b', '#c0392b', '#2a6fb0'];
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = Math.floor(zb / 12) - 1; i <= Math.ceil(zt / 12); i++) {
          for (let s = 0; s < 2; s++) {
            if (hash(i * 7 + s * 29 + 3) > .55) continue;
            const x = s === 0 ? GRASS - 4.5 : W - GRASS + 4.5, y = zy(i * 12 + 6);
            const c = cols[Math.floor(hash(i * 3 + s) * 3)];
            ctx.fillStyle = c; ctx.globalAlpha = .55; ctx.fillRect(x - 4.5, y - 14, 9, 28); ctx.globalAlpha = 1;
            ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2);
            ctx.font = '700 9px ' + FONT; ctx.fillStyle = c === '#1b1b1b' ? '#f2f2ee' : '#fff';
            ctx.fillText(WORDS[Math.floor(hash(i * 5 + s * 3 + 1) * WORDS.length)], 0, 0);
            ctx.restore();
          }
        }
      },
      deco(zb, zt, zy) {
        for (let i = Math.floor(zb / 30) - 1; i <= Math.ceil(zt / 30); i++) {
          if (hash(i * 13 + 1) > .5) continue;
          ctx.fillStyle = 'rgba(0,0,0,.14)';
          ctx.fillRect(ROAD_L + hash(i * 3 + 2) * (ROAD_R - ROAD_L - 80), zy(i * 30 + hash(i * 5) * 20), 40 + hash(i * 7) * 40, 20 + hash(i * 11) * 10);
        }
        const inks = ['rgba(240,240,235,.55)', 'rgba(240,200,60,.55)', 'rgba(210,50,40,.55)'];
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = Math.floor(zb / 48) - 1; i <= Math.ceil(zt / 48); i++) {
          if (hash(i * 17 + 3) > .6) continue;
          const word = WORDS[Math.floor(hash(i * 5 + 1) * WORDS.length)];
          const x = ROAD_L + 30 + hash(i * 9 + 7) * (ROAD_R - ROAD_L - 60);
          const y0 = zy(i * 48 + hash(i * 3) * 20), size = 15 + hash(i * 2) * 5;
          ctx.fillStyle = inks[Math.floor(hash(i * 19) * 3)];
          ctx.font = '700 ' + size + 'px ' + FONT;
          for (let k = 0; k < word.length; k++) {
            ctx.save(); ctx.translate(x, y0 - k * size * 1.9); ctx.scale(.75, 1.7);
            ctx.fillText(word[k], 0, 0); ctx.restore();
          }
        }
      },
      over(zb, zt, zy) {
        for (let m = Math.floor((zb - 350) / 700); m <= Math.ceil((zt - 350) / 700); m++) {
          if (m < 0) continue;
          const y = zy(m * 700 + 350);
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(GRASS - 10, y + 8, W - 2 * GRASS + 20, 20);
          ctx.fillStyle = '#7d7d78'; ctx.fillRect(GRASS - 12, y - 10, 8, 20); ctx.fillRect(W - GRASS + 4, y - 10, 8, 20);
          ctx.fillStyle = '#9a9a95'; ctx.fillRect(GRASS - 12, y - 8, W - 2 * GRASS + 24, 16);
          ctx.fillStyle = '#b9b9b3'; ctx.fillRect(GRASS - 12, y - 8, W - 2 * GRASS + 24, 4);
          ctx.fillStyle = '#d88a2a'; for (let x = GRASS - 12; x < W - GRASS + 12; x += 24) ctx.fillRect(x, y + 4, 12, 3);
        }
      }
    }
  };
  const ROAD_IDS = ['sakura', 'ny', 'br'];

  function drawRoad(z, th) {
    const zb = z - (H - PLAYER_Y) / PPM - 6, zt = z + PLAYER_Y / PPM + 6;
    const zy = q => PLAYER_Y - (q - z) * PPM;
    ctx.fillStyle = th.ground; ctx.fillRect(0, 0, W, H);
    th.sides(zb, zt, zy);
    ctx.fillStyle = th.shoulder; ctx.fillRect(GRASS, 0, W - 2 * GRASS, H);
    ctx.fillStyle = th.asphalt; ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
    ctx.fillStyle = 'rgba(255,255,255,.04)';
    for (let i = Math.floor(zb / 25); i <= Math.ceil(zt / 25); i++) ctx.fillRect(ROAD_L, zy(i * 25), ROAD_R - ROAD_L, 2);
    th.edge(zb, zt, zy);
    th.deco(zb, zt, zy);
    ctx.fillStyle = th.leftLine || th.paint; ctx.fillRect(ROAD_L - 1.5, 0, 3, H);
    ctx.fillStyle = th.paint; ctx.fillRect(ROAD_R - 1.5, 0, 3, H);
    const per = 70, off = (PLAYER_Y + z * PPM) % per;
    for (let y = off - per; y < H + per; y += per) for (let k = 1; k < LANES; k++) ctx.fillRect(ROAD_L + LANE_W * k - 1.5, y, 3, 36);
    if (th.km) {
      for (let m = Math.floor(zb / 500); m <= Math.ceil(zt / 500); m++) {
        if (m < 0) continue;
        const y = zy(m * 500);
        ctx.fillStyle = '#e8e6dd'; rr(W - GRASS + 4, y - 10, 38, 20, 3); ctx.fill();
        ctx.fillStyle = th.km; rr(W - GRASS + 5.5, y - 8.5, 35, 17, 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 9px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('KM ' + (START_KM + m * 0.5).toFixed(1).replace('.', ','), W - GRASS + 23, y + 0.5);
      }
    }
    return { zb, zt, zy };
  }

  // ---------- veículos ----------
  function drawTruck(x, y, t, body, o) {
    const w = t.w, h = t.len;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(-w / 2 + 3, -h / 2 + 5, w, h, 6); ctx.fill();
    ctx.fillStyle = '#0b0c0e';
    for (const fy of [-.32, .2, .36]) { rr(-w / 2 - 2, h * fy - 8, 5, 16, 2); ctx.fill(); rr(w / 2 - 3, h * fy - 8, 5, 16, 2); ctx.fill(); }
    ctx.fillStyle = '#dcdad2'; rr(-w / 2, -h / 2 + 32, w, h - 32, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.12)';
    for (let k = 0; k < 6; k++) { const yy = -h / 2 + 42 + k * 12; ctx.beginPath(); ctx.moveTo(-w / 2 + 3, yy); ctx.lineTo(w / 2 - 3, yy); ctx.stroke(); }
    ctx.fillStyle = body; rr(-w / 2 + 2, -h / 2, w - 4, 34, 6); ctx.fill();
    ctx.fillStyle = '#10151b'; rr(-w / 2 + 6, -h / 2 + 7, w - 12, 10, 3); ctx.fill();
    ctx.fillStyle = shade(body, .18); rr(-w / 2 + 5, -h / 2 + 19, w - 10, 11, 3); ctx.fill();
    ctx.fillStyle = '#fff4c2'; rr(-w / 2 + 4, -h / 2 + 1.5, 8, 4, 2); ctx.fill(); rr(w / 2 - 12, -h / 2 + 1.5, 8, 4, 2); ctx.fill();
    ctx.fillStyle = '#c42a22'; rr(-w / 2 + 3, h / 2 - 5.5, 9, 4, 2); ctx.fill(); rr(w / 2 - 12, h / 2 - 5.5, 9, 4, 2); ctx.fill();
    signal(o, w, h);
    ctx.restore();
  }
  function signal(o, w, h) {
    if (!o || !o.signal || Math.floor(now * 3) % 2) return;
    ctx.fillStyle = '#ffa000';
    const sx = o.signal < 0 ? -w / 2 - 1 : w / 2 - 3;
    ctx.fillRect(sx, -h / 2 + 8, 4, 6); ctx.fillRect(sx, h / 2 - 12, 4, 6);
  }
  function drawCar(x, y, t, body, roof, o) {
    o = o || {};
    if (t.kind === 'truck') { drawTruck(x, y, t, body, o); return; }
    const w = t.w, h = t.len;
    ctx.save(); ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.glow) {
      ctx.save(); ctx.shadowColor = body; ctx.shadowBlur = 24; ctx.globalAlpha = .45; ctx.fillStyle = body;
      rr(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 12); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(-w / 2 + 3, -h / 2 + 5, w, h, 9); ctx.fill();
    ctx.fillStyle = '#0b0c0e';
    for (const fy of [-.28, .3]) { rr(-w / 2 - 2, h * fy - 8, 5, 16, 2); ctx.fill(); rr(w / 2 - 3, h * fy - 8, 5, 16, 2); ctx.fill(); }
    ctx.fillStyle = body; rr(-w / 2, -h / 2, w, h, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
    rr(-w / 2 - 3, -h / 2 + h * .27, 4, 6, 2); ctx.fill(); rr(w / 2 - 1, -h / 2 + h * .27, 4, 6, 2); ctx.fill();
    if (o.stripes) {
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillRect(-6, -h / 2 + 3, 4, h - 6); ctx.fillRect(2, -h / 2 + 3, 4, h - 6);
    }
    ctx.fillStyle = '#10151b';
    rr(-w / 2 + 5, -h / 2 + h * t.ws[0], w - 10, h * t.ws[1], 4); ctx.fill();
    if (t.rear) { rr(-w / 2 + 6, -h / 2 + h * t.rear[0], w - 12, h * t.rear[1], 4); ctx.fill(); }
    ctx.fillStyle = roof; rr(-w / 2 + 4, -h / 2 + h * t.roof[0], w - 8, h * t.roof[1], 5); ctx.fill();
    if (o.wing) {
      ctx.fillStyle = '#14161a'; ctx.fillRect(-w / 2 + 6, h / 2 - 12, 3, 8); ctx.fillRect(w / 2 - 9, h / 2 - 12, 3, 8);
      rr(-w / 2 - 2, h / 2 - 8, w + 4, 6, 2); ctx.fill();
    }
    ctx.fillStyle = '#fff4c2';
    rr(-w / 2 + 3, -h / 2 + 1.5, 8, 4, 2); ctx.fill(); rr(w / 2 - 11, -h / 2 + 1.5, 8, 4, 2); ctx.fill();
    if (o.brake) { ctx.shadowColor = '#ff3b30'; ctx.shadowBlur = 12; }
    ctx.fillStyle = o.brake ? '#ff6a5c' : '#c42a22';
    rr(-w / 2 + 3, h / 2 - 5.5, 9, 4, 2); ctx.fill(); rr(w / 2 - 12, h / 2 - 5.5, 9, 4, 2); ctx.fill();
    ctx.shadowBlur = 0;
    signal(o, w, h);
    ctx.restore();
  }
  function playerLook(carId, tune, color) {
    const c = CARS.find(k => k.id === carId);
    return {
      spec: c, body: color, roof: shade(color, -.28),
      opt: { stripes: !!c.stripes, wing: !!c.wing || tune.turbo >= 3, glow: tune.motor + tune.turbo + tune.pneus >= 10 }
    };
  }

  // ---------- conta e progresso ----------
  const STORE = 'speedstriet.v1';
  let db = { users: {}, last: '' };
  try { const raw = localStorage.getItem(STORE); if (raw) db = JSON.parse(raw); } catch (e) { /* sem armazenamento */ }
  if (!db || typeof db !== 'object' || !db.users) db = { users: {}, last: '' };
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* ignora */ } }
  function newSave() { return { credits: 300, car: 'urbano', color: COLORS[0], road: 'sakura', tune: {}, best: {} }; }
  function cleanSave(s) {
    s = s && typeof s === 'object' ? s : newSave();
    if (typeof s.credits !== 'number') s.credits = 300;
    if (!CARS.some(c => c.id === s.car)) s.car = 'urbano';
    if (typeof s.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.color)) s.color = COLORS[0];
    if (!TH[s.road]) s.road = 'sakura';
    if (!s.tune || typeof s.tune !== 'object') s.tune = {};
    if (!s.best || typeof s.best !== 'object') s.best = {};
    if (typeof s.pid !== 'string' || !s.pid) s.pid = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    return s;
  }
  async function sha(s) {
    try {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      let h = 5381; for (const ch of s) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
      return 'x' + (h >>> 0).toString(16);
    }
  }
  let me = null, save = null;
  const tuneOf = id => save.tune[id] || (save.tune[id] = { motor: 0, turbo: 0, pneus: 0 });
  function derive(id) {
    const c = CARS.find(k => k.id === id), t = tuneOf(id);
    return { car: c, tune: t, top: c.top + 8 * t.motor, acc: c.acc + 5 * t.turbo, brk: c.brk + 8 * t.pneus, hnd: c.hnd + .05 * t.pneus };
  }

  // ---------- telas ----------
  let screen = 'menu';
  const screens = { menu: $('sc-menu'), garage: $('sc-garage'), rooms: $('sc-rooms'), game: $('sc-game') };
  function show(name) {
    screen = name;
    for (const k in screens) screens[k].hidden = k !== name;
    window.scrollTo(0, 0);
    if (name === 'game') fit();
  }

  // login
  const uEl = $('user'), pEl = $('pass'), errEl = $('login-err');
  if (db.last && db.users[db.last]) uEl.value = db.users[db.last].name;
  $('login').addEventListener('submit', async e => {
    e.preventDefault();
    errEl.textContent = '';
    const name = uEl.value.trim(), pw = pEl.value;
    if (name.length < 2) { errEl.textContent = 'Digite um usuário com pelo menos 2 letras.'; return; }
    if (pw.length < 3) { errEl.textContent = 'A senha precisa ter pelo menos 3 caracteres.'; return; }
    const key = name.toLowerCase();
    let u = db.users[key];
    if (u) {
      if (await sha(u.salt + pw) !== u.hash) { errEl.textContent = 'Senha incorreta para este usuário.'; return; }
    } else {
      const salt = Math.random().toString(36).slice(2);
      u = db.users[key] = { name, salt, hash: await sha(salt + pw), save: newSave() };
    }
    u.save = cleanSave(u.save);
    me = u; save = u.save; db.last = key; persist();
    pEl.value = '';
    openGarage();
  });
  $('g-logout').addEventListener('click', () => { me = null; save = null; show('menu'); pEl.focus(); });

  // ---------- garagem ----------
  const pvCv = $('pv'), pvCtx = pvCv.getContext('2d');
  const pv = { z: 0, cars: [] };
  function pvSpawn(z) {
    const t = pickType(), pal = TH[save.road].cars;
    const lane = [0, 1, 3, 4][Math.floor(Math.random() * 4)];
    return { lane, x: laneX(lane), z, t, body: pal[Math.floor(Math.random() * pal.length)], roof: null };
  }
  function openGarage() {
    pv.z = 0; pv.cars = [pvSpawn(30), pvSpawn(60), pvSpawn(95)];
    show('garage');
    renderGarage();
  }
  function barV(v) { return Math.round(clamp(v, 0, 1) * 100) + '%'; }
  function renderGarage() {
    $('g-user').textContent = me.name;
    $('g-credits').textContent = save.credits;
    // carros
    const carsEl = $('cars');
    carsEl.innerHTML = '';
    for (const c of CARS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card'; b.dataset.car = c.id; b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(save.car === c.id));
      const d = derive(c.id);
      b.innerHTML = '<canvas width="88" height="152"></canvas><span class="info"><strong>' + c.name + '</strong><small>' + c.desc + '</small>' +
        '<span class="bars"><span class="bar">Vel<i style="--v:' + barV(d.top / 280) + '"></i></span><span class="bar">Acel<i style="--v:' + barV(d.acc / 100) + '"></i></span><span class="bar">Dir<i style="--v:' + barV((d.hnd - .7) / .8) + '"></i></span></span></span>';
      carsEl.appendChild(b);
      const look = playerLook(c.id, d.tune, save.color), mc = b.querySelector('canvas').getContext('2d');
      const prev = ctx; ctx = mc; mc.clearRect(0, 0, 88, 152);
      drawCar(44, 76, c, look.body, look.roof, look.opt);
      ctx = prev;
    }
    // cores
    const sw = $('swatches');
    sw.innerHTML = '';
    for (const col of COLORS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sw'; b.style.background = col; b.dataset.color = col; b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', 'Cor ' + col); b.setAttribute('aria-checked', String(save.color.toLowerCase() === col));
      sw.appendChild(b);
    }
    const lab = document.createElement('label');
    lab.className = 'custom';
    lab.innerHTML = 'Outra cor <input type="color" id="custom-color" value="' + save.color + '">';
    sw.appendChild(lab);
    // tuning
    const d = derive(save.car), tEl = $('tunes');
    tEl.innerHTML = '';
    for (const t of TUNES) {
      const lvl = d.tune[t.k], maxed = lvl >= TUNE_COST.length, cost = TUNE_COST[lvl];
      const row = document.createElement('div');
      row.className = 'tune';
      row.innerHTML = '<div><strong>' + t.name + '</strong><small>' + t.desc + '</small></div>' +
        '<div class="side"><span class="pips" aria-label="Nível ' + lvl + ' de 5">' + [0, 1, 2, 3, 4].map(i => '<i class="' + (i < lvl ? 'on' : '') + '"></i>').join('') + '</span>' +
        '<button type="button" class="buy" data-tune="' + t.k + '"' + (maxed || save.credits < cost ? ' disabled' : '') + '>' + (maxed ? 'Máximo' : 'Melhorar ' + cost) + '</button></div>';
      tEl.appendChild(row);
    }
    $('stats').innerHTML =
      '<div>Velocidade máx. <b>' + d.top + ' km/h</b></div><div>Aceleração <b>' + d.acc + '</b></div>' +
      '<div>Direção <b>' + d.hnd.toFixed(2).replace('.', ',') + '</b></div><div>Freio <b>' + d.brk + '</b></div>';
    // estradas
    const rEl = $('roads');
    rEl.innerHTML = '';
    for (const id of ROAD_IDS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'road'; b.dataset.road = id; b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(save.road === id));
      b.innerHTML = '<span class="thumb" style="background:' + TH[id].thumb + '"></span><strong>' + TH[id].name + '</strong><small>' + TH[id].sub + '</small>';
      rEl.appendChild(b);
    }
    $('pv-name').textContent = d.car.name + ' · ' + TH[save.road].name;
  }
  $('cars').addEventListener('click', e => { const b = e.target.closest('[data-car]'); if (b) { save.car = b.dataset.car; persist(); renderGarage(); } });
  $('swatches').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (b) { save.color = b.dataset.color; persist(); renderGarage(); } });
  $('swatches').addEventListener('input', e => {
    if (e.target.id === 'custom-color') {
      save.color = e.target.value; persist();
      const keep = e.target.value;
      renderGarage();
      const ci = $('custom-color'); if (ci) ci.value = keep;
    }
  });
  $('tunes').addEventListener('click', e => {
    const b = e.target.closest('[data-tune]'); if (!b) return;
    const t = tuneOf(save.car), k = b.dataset.tune, cost = TUNE_COST[t[k]];
    if (cost === undefined || save.credits < cost) return;
    save.credits -= cost; t[k]++; persist(); renderGarage();
  });
  $('roads').addEventListener('click', e => { const b = e.target.closest('[data-road]'); if (b) { save.road = b.dataset.road; persist(); renderGarage(); } });
  $('go').addEventListener('click', startRace);

  function updatePreview(dt) {
    pv.z += 14 * dt;
    for (const c of pv.cars) {
      c.z += 6 * dt;
      if (c.z < pv.z - 25) { const n = pvSpawn(pv.z + 75 + Math.random() * 20); Object.assign(c, n); }
    }
  }
  function renderPreview() {
    const prev = ctx; ctx = pvCtx; ctx.setTransform(1, 0, 0, 1, 0, 0);
    const th = TH[save.road], g = drawRoad(pv.z, th);
    for (const c of pv.cars) {
      if (!c.roof) c.roof = shade(c.body, .18);
      drawCar(c.x, PLAYER_Y - (c.z - pv.z) * PPM, c.t, c.body, c.roof, {});
    }
    const look = playerLook(save.car, tuneOf(save.car), save.color);
    drawCar(laneX(2), PLAYER_Y, look.spec, look.body, look.roof, look.opt);
    th.over(g.zb, g.zt, g.zy);
    ctx = prev;
  }

  // ---------- corrida ----------
  const hudEl = $('hud'), padEl = $('pad'), gcol = $('gcol'), overlay = $('overlay');
  const gFill = $('g-fill'), speedbox = $('speedbox');
  const sSpeed = $('s-speed'), sDist = $('s-dist'), sPass = $('s-pass'), sBest = $('s-best'), sCred = $('s-cred');
  let state = 'idle', roadId = 'sakura', theme = TH.sakura;
  let p, stat, cars, rings, spawnAcc, nextGap, overtakes, crashT, flash, scrape, cdT, goT, earned, newBest, hornHeld = false, look;
  let paidM = 0, earnedTotal = 0, runDone = false, dirtySave = false, lastSaveAt = 0;
  let onl = null;   // corrida online em andamento
  const keys = { left: false, right: false, gas: false, brake: false, horn: false };

  function pickType() {
    let r = R(), a = 0;
    for (const t of TRAFFIC) { a += t.weight; if (r < a) return t; }
    return TRAFFIC[2];
  }
  function spawnRow(z) {
    const r = R(), n = r < .62 ? 1 : r < .93 ? 2 : 3;
    const order = [0, 1, 2, 3, 4];
    for (let i = 4; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    let placed = 0;
    for (const lane of order) {
      if (placed >= n) break;
      if (cars.some(c => c.lane === lane && Math.abs(c.z - z) < 30)) continue;
      const t = pickType(), pal = theme.cars, body = pal[Math.floor(R() * pal.length)];
      const v = rrand(t.vmin, t.vmax);
      cars.push({ lane, x: laneX(lane), z, t, body, roof: shade(body, .18), v, vNow: v, passed: false, react: 0, next: -1, sig: 0, boost: 0 });
      placed++;
    }
  }
  function reset() {
    stat = derive(save.car);
    look = playerLook(save.car, stat.tune, save.color);
    p = { x: laneX(2), z: 0, v: 80, vx: 0, rot: 0, honkCd: 0 };
    cars = []; rings = [];
    overtakes = 0; spawnAcc = 0; nextGap = rrand(30, 48); crashT = 0; flash = 0; scrape = false; earned = 0; newBest = false; goT = 0;
    paidM = 0; earnedTotal = 0; runDone = false; dirtySave = false;
    for (let z = 34; z <= 100; z += rrand(32, 46)) spawnRow(z);
    updateHud();
  }
  function updateHud() {
    sSpeed.textContent = Math.round(p.v);
    gFill.style.width = clamp(p.v / stat.top, 0, 1) * 100 + '%';
    speedbox.classList.toggle('slow', p.v < 60);
    sDist.textContent = fmtKm(p.z);
    sPass.textContent = overtakes;
    sBest.textContent = fmtKm(save.best[roadId] || 0);
    sCred.textContent = save.credits;
  }
  function startRace() {
    onl = null; R = Math.random;
    roadId = save.road; theme = TH[roadId];
    $('t-road').textContent = theme.name; $('t-time').textContent = '';
    reset();
    $('g-mark').style.left = (60 / stat.top * 100) + '%';
    overlay.hidden = true; $('rank').hidden = true; ovLast = '';
    $('ov-tag').textContent = 'Fim da corrida'; $('ov-title').textContent = 'Batida';
    $('ov-rank').hidden = true; $('ov-again').hidden = false;
    $('ov-garage').textContent = 'Garagem'; $('ov-garage').disabled = false;
    $('t-garage').textContent = 'Garagem';
    cdT = 3; state = 'countdown';
    show('game');
  }
  function finishRun() {
    if (runDone) return;
    runDone = true;
    earnedTotal += overtakes * 5; earned = earnedTotal;
    save.credits += overtakes * 5;
    const b = save.best[roadId] || 0;
    newBest = p.z > b && p.z > 50;
    if (newBest) save.best[roadId] = p.z;
    persist();
  }
  function crash() {
    state = 'crashing'; crashT = .8; flash = 1; p.rot = 0;
    finishRun();
    if (onl) writeProgress(true);
    updateHud();
  }
  function showOver() {
    if (onl) { renderOnlineOver(); return; }
    $('ov-text').textContent = fmtKm(p.z) + ' km e ' + overtakes + (overtakes === 1 ? ' ultrapassagem. ' : ' ultrapassagens. ') + '+' + earned + ' créditos.' + (newBest ? ' Novo recorde nesta estrada.' : '');
    overlay.hidden = false;
    $('ov-again').focus({ preventScroll: true });
  }
  $('ov-again').addEventListener('click', () => { if (state === 'over' && !onl) startRace(); });
  $('ov-garage').addEventListener('click', () => {
    if (state !== 'over') return;
    if (onl) { if (!$('ov-garage').disabled) leaveToRooms(); } else { state = 'idle'; openGarage(); }
  });
  $('t-garage').addEventListener('click', () => {
    if (state === 'crashing') return;
    if (state === 'running') { finishRun(); if (onl) writeProgress(true); }
    if (onl) { leaveToRooms(); return; }
    state = 'idle'; openGarage();
  });

  // buzina
  let ac = null;
  function beep() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended' && ac.resume) ac.resume();
      const t = ac.currentTime;
      [392, 494].forEach(f => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .35);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + .4);
      });
    } catch (e) { /* sem áudio */ }
  }
  function honk() {
    if (state !== 'running' || p.honkCd > 0) return;
    p.honkCd = 1.2; rings.push({ t: 0 }); beep();
    for (const c of cars) {
      if (c.z > p.z + 2 && c.z < p.z + 75 && Math.abs(c.x - p.x) < LANE_W * .75 && c.react <= 0) { c.react = rand(.2, .6); c.next = -2; }
    }
  }
  function clearLane(c) {
    const opts = [c.lane - 1, c.lane + 1].filter(l => l >= 0 && l < LANES && !cars.some(d => d !== c && d.lane === l && Math.abs(d.z - c.z) < 24));
    if (opts.length) { c.lane = opts[Math.floor(Math.random() * opts.length)]; c.sig = c.lane * LANE_W + ROAD_L < c.x ? -1 : 1; c.sigT = 1.2; }
    else c.boost = 3;
  }

  // entrada
  const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', KeyH: 'horn' };
  window.addEventListener('keydown', e => {
    if (screen !== 'game') return;
    if (e.target && e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) {
      if (state !== 'over') e.preventDefault();
      else return;
    }
    const k = keyMap[e.code];
    if (k) { keys[k] = true; e.preventDefault(); return; }
    if (e.code === 'Space') { e.preventDefault(); if (state === 'running') keys.horn = true; else if (state === 'over' && !onl) startRace(); return; }
    if (e.code === 'Enter' && state === 'over' && !onl) { e.preventDefault(); startRace(); }
  });
  window.addEventListener('keyup', e => {
    const k = keyMap[e.code];
    if (k) { keys[k] = false; if (screen === 'game') e.preventDefault(); }
    if (e.code === 'Space') keys.horn = false;
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  padEl.querySelectorAll('button').forEach(b => {
    const k = b.dataset.k;
    const down = e => { e.preventDefault(); keys[k] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) { /* ok */ } };
    const up = () => { keys[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  });

  // física
  function update(dt) {
    if (state === 'countdown') { cdT -= dt; if (cdT <= 0) { state = 'running'; goT = .8; } return; }
    if (goT > 0) goT -= dt;
    for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > .7) rings.splice(i, 1); }
    if (state === 'crashing') {
      crashT -= dt; flash = Math.max(0, flash - dt * 1.6); p.rot += dt * 4.5;
      if (crashT <= 0) { state = 'over'; showOver(); }
      return;
    }
    if (state !== 'running') return;

    p.honkCd = Math.max(0, p.honkCd - dt);
    if (keys.horn && !hornHeld) honk();
    hornHeld = keys.horn;

    if (onl) {
      const tm = Date.now();
      if (tm >= onl.endAt) { endOnlineRun(); return; }
      if (tm - onl.lastW > 1200) { onl.lastW = tm; writeProgress(false); }
      const tt = fmtT(onl.endAt - tm);
      if (tt !== lastTT) { lastTT = tt; $('t-time').textContent = tt; }
    }

    const eff = clamp(1.15 - p.v / stat.top, .12, 1);
    if (keys.gas) p.v += stat.acc * eff * dt; else if (keys.brake) p.v -= stat.brk * dt; else p.v -= 7 * dt;

    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const latMax = (95 + .45 * Math.min(p.v, 160)) * stat.hnd;
    p.vx += (dir * latMax - p.vx) * Math.min(1, dt * 7);
    p.x += p.vx * dt;
    const hw = stat.car.w / 2 + 2, minX = ROAD_L + hw, maxX = ROAD_R - hw;   // o carro não sai do asfalto
    scrape = false;
    if (p.x < minX) { p.x = minX; p.vx = 0; scrape = true; }
    if (p.x > maxX) { p.x = maxX; p.vx = 0; scrape = true; }
    if (scrape) p.v -= 35 * dt;
    p.v = clamp(p.v, 30, stat.top);
    p.z += (p.v / 3.6) * dt;
    const meters = Math.floor(p.z / 10);   // 1 crédito a cada 10 m, salvo na hora
    if (meters > paidM) { const d = meters - paidM; paidM = meters; save.credits += d; earnedTotal += d; earned = earnedTotal; dirtySave = true; }
    if (dirtySave && now - lastSaveAt > 1) { persist(); dirtySave = false; lastSaveAt = now; }

    spawnAcc += (p.v / 3.6) * dt;
    if (spawnAcc >= nextGap) {
      spawnAcc = 0;
      nextGap = rrand(34, 58) * (1 - Math.min(.25, p.z / 30000));
      spawnRow(p.z + 82);
    }
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      if (c.react > 0) { c.react -= dt; if (c.react <= 0 && c.next === -2) { c.next = -1; clearLane(c); } }
      if (c.sigT > 0) { c.sigT -= dt; if (c.sigT <= 0) c.sig = 0; }
      if (c.boost > 0) c.boost -= dt;
      let want = c.v + (c.boost > 0 ? 14 : 0), lead = null;
      for (const d of cars) if (d !== c && d.lane === c.lane && d.z > c.z && (!lead || d.z < lead.z)) lead = d;
      c.vNow = want;
      if (lead) {
        const gap = lead.z - c.z - (c.t.len + lead.t.len) / 2 / PPM - 3;
        if (gap < 6) c.vNow = Math.min(want, lead.vNow);
        if (gap < 0) c.z += gap;
      }
      c.z += (c.vNow / 3.6) * dt;
      const dx = laneX(c.lane) - c.x, step = 55 * dt;
      c.x += clamp(dx, -step, step);
      if (!c.passed && c.z < p.z - 6) { c.passed = true; overtakes++; }
      if (c.z < p.z - 40 || c.z > p.z + 150) { cars.splice(i, 1); continue; }
      const ddx = Math.abs(c.x - p.x), ddy = Math.abs(c.z - p.z) * PPM;
      if (ddx < (stat.car.w + c.t.w) / 2 - 3 && ddy < (stat.car.len + c.t.len) / 2 - 6) { crash(); return; }
    }
    updateHud();
  }

  // desenho do jogo
  let vign = null;
  function renderGame() {
    ctx = gctx;
    ctx.save();
    if (state === 'crashing' && !reduceMotion) ctx.translate((Math.random() - .5) * 10 * Math.min(1, crashT * 2), (Math.random() - .5) * 10 * Math.min(1, crashT * 2));
    const g = drawRoad(p.z, theme);
    if (state !== 'over') {
      const gr = ctx.createLinearGradient(0, PLAYER_Y - 40, 0, PLAYER_Y - 260);
      gr.addColorStop(0, 'rgba(255,236,170,.16)'); gr.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(p.x - 14, PLAYER_Y - 38); ctx.lineTo(p.x + 14, PLAYER_Y - 38);
      ctx.lineTo(p.x + 60, PLAYER_Y - 260); ctx.lineTo(p.x - 60, PLAYER_Y - 260); ctx.closePath(); ctx.fill();
    }
    for (const c of cars) {
      const y = PLAYER_Y - (c.z - p.z) * PPM;
      if (y < -90 || y > H + 90) continue;
      drawCar(c.x, y, c.t, c.body, c.roof, { signal: c.sig });
    }
    const crashed = state === 'crashing' || state === 'over';
    drawCar(p.x, PLAYER_Y, look.spec, look.body, look.roof, Object.assign({}, look.opt, {
      brake: keys.brake && state === 'running', rot: crashed ? p.rot : p.vx / 450
    }));
    theme.over(g.zb, g.zt, g.zy);
    for (const r of rings) {
      ctx.strokeStyle = 'rgba(255,220,120,' + (1 - r.t / .7).toFixed(2) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, PLAYER_Y - 40, 24 + r.t * 320, -Math.PI * .8, -Math.PI * .2); ctx.stroke();
    }
    if (scrape && state === 'running') {
      ctx.strokeStyle = '#ffcf6b'; ctx.lineWidth = 2;
      const sx = p.x < W / 2 ? ROAD_L : ROAD_R;
      for (let i = 0; i < 6; i++) {
        const sy = PLAYER_Y + rand(-30, 30), l = rand(4, 12);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (p.x < W / 2 ? l : -l), sy + rand(2, 8)); ctx.stroke();
      }
    }
    ctx.restore();
    if (!vign) { vign = ctx.createLinearGradient(0, 0, 0, 170); vign.addColorStop(0, 'rgba(0,0,0,.4)'); vign.addColorStop(1, 'rgba(0,0,0,0)'); }
    ctx.fillStyle = vign; ctx.fillRect(0, 0, W, 170);
    if (flash > 0) { ctx.fillStyle = 'rgba(255,90,71,' + (.45 * flash).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    if (state === 'countdown' || goT > 0) {
      ctx.fillStyle = 'rgba(14,16,19,.35)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 120px ' + FONT;
      ctx.fillStyle = '#ffb42e';
      ctx.fillText(state === 'countdown' ? String(Math.max(1, Math.ceil(cdT))) : 'VAI!', W / 2, H / 2 - 40);
    }
  }

  // tamanho
  function fit() {
    if (screen !== 'game') return;
    for (let pass = 0; pass < 2; pass++) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cs = getComputedStyle(document.body);
      const avail = document.body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      let w = Math.min(avail, 520);
      gcol.style.width = w + 'px';
      let others = 0;
      for (const el of gcol.children) if (el.id !== 'stage') others += el.offsetHeight;
      const reserved = others + (gcol.children.length - 1) * 10 + 24 + 4;
      const maxH = Math.max(260, window.innerHeight - reserved);
      w = Math.max(240, Math.min(w, (maxH * W) / H));
      gcol.style.width = w + 'px';
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    vign = null;
  }
  window.addEventListener('resize', fit);

  // laço principal
  let last = 0;
  function frame(t) {
    const dt = Math.min(.05, (t - last) / 1000 || 0);
    last = t; now = t / 1000;
    if (screen === 'game' && p) { update(dt); renderGame(); }
    else if (screen === 'garage' && save) { updatePreview(dt); renderPreview(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- online ----------
  const ROOM_IDS = ['sala-1', 'sala-2', 'sala-3', 'sala-4', 'sala-5'];
  const CAP = 5, RACE_MAX = 180, PRIZES = [400, 200, 100], STALE_LOBBY = 45000, STALE_RACE = 12000;
  let dbx = null, canWrite = null, onlineChecked = false, subscribed = false, slow = false;
  let roomsData = {}, playersData = [], gotRooms = false, gotPlayers = false;
  let cur = null, roomMsg = '', lastHtml = '', lastBeat = 0, writing = false, pendingFinal = false, rejoining = false;
  let rankHtml = '', ovLast = '', lastTT = '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  async function initOnline() {
    try {
      const c = window.claude;
      if (c && typeof c.use === 'function') {
        dbx = await c.use('db');
        if (dbx) { const u = await c.use('user'); if (u && u.can) canWrite = await u.can('data.write'); }
      }
    } catch (e) { dbx = null; }
    onlineChecked = true;
    refreshOnlineUi();
  }
  function refreshOnlineUi() {
    const b = $('go-online'), n = $('online-note');
    if (!onlineChecked) { b.disabled = true; n.textContent = 'Verificando o modo online...'; return; }
    if (!dbx) { b.disabled = true; n.textContent = 'O modo online só funciona na página publicada no Claude. Aqui você joga offline.'; return; }
    b.disabled = false;
    n.textContent = canWrite === false
      ? 'Você pode ver as salas, mas precisa de acesso de colaborador para entrar numa corrida.'
      : 'Online: até 5 amigos por sala. 1º lugar ganha 400 créditos, 2º 200 e 3º 100.';
  }

  function subscribeRooms() {
    if (!dbx || subscribed) return;
    subscribed = true;
    const onErr = e => { roomMsg = 'Erro ao ler as salas (' + ((e && e.code) || 'desconhecido') + ').'; renderRooms(true); };
    dbx.collection('rooms').onSnapshot(s => {
      roomsData = {}; s.docs.forEach(d => { roomsData[d.id] = d.data() || {}; });
      gotRooms = true; onRoomsChanged();
    }, onErr);
    dbx.collection('players').onSnapshot(s => {
      playersData = s.docs.map(d => Object.assign({}, d.data()));
      gotPlayers = true; onRoomsChanged();
    }, onErr);
    setTimeout(() => { if (!(gotRooms && gotPlayers)) { slow = true; renderRooms(true); } }, 10000);
  }

  function roomState(id) {
    const r = roomsData[id] || {}, round = r.round || 0, status = r.status || 'open', t = Date.now();
    let ps = playersData.filter(q => q.room === id && q.round === round);
    ps.sort((a, b) => ((a.joinedAt || 0) - (b.joinedAt || 0)) || (a.pid < b.pid ? -1 : 1));
    if (status === 'open') ps = ps.filter(q => t - (q.ts || 0) < STALE_LOBBY);
    ps = ps.slice(0, CAP);
    let phase = 'open';
    if (status === 'racing') {
      const startAt = r.startAt || 0, endAt = startAt + RACE_MAX * 1000;
      const gone = q => !q.done && t > startAt + STALE_RACE && t - (q.ts || 0) > STALE_RACE;
      const allDone = ps.length > 0 && ps.every(q => q.done || gone(q));
      phase = (t > endAt + 4000 || allDone) ? 'finished' : (t < startAt ? 'countdown' : 'racing');
    }
    return { id, round, status, phase, startAt: r.startAt || 0, seed: r.seed || 1, road: r.road, players: ps };
  }
  function ranking(rs) {
    return rs.players.map(q => {
      let d = q.done ? (q.final || 0) : (q.dist || 0);
      if (onl && onl.id === rs.id && q.pid === save.pid) d = Math.round(p.z);
      return { q, d };
    }).sort((a, b) => (b.d - a.d) || (a.q.pid < b.q.pid ? -1 : 1));
  }

  function badgeHtml(ph) {
    return ph === 'open' ? '<span class="badge">Aberta</span>' : ph === 'finished' ? '<span class="badge done">Encerrada</span>' : '<span class="badge live">Em corrida</span>';
  }
  function plistHtml(rs, slots) {
    const items = rs.players.map(q => '<li><i style="background:' + esc(q.color) + '"></i><span>' + esc(q.name) + (q.pid === save.pid ? ' (você)' : '') + '</span></li>');
    if (slots) while (items.length < CAP) items.push('<li class="empty">Vaga livre</li>');
    if (!items.length) items.push('<li class="empty">Ninguém ainda</li>');
    return '<ul class="plist">' + items.join('') + '</ul>';
  }
  function gridHtml() {
    const cards = ROOM_IDS.map(id => {
      const rs = roomState(id), n = id.replace('sala-', '');
      const racing = rs.phase === 'racing' || rs.phase === 'countdown';
      const full = rs.phase === 'open' && rs.players.length >= CAP;
      const off = racing || full || canWrite === false;
      const label = racing ? 'Em andamento' : full ? 'Sala cheia' : 'Entrar';
      return '<div class="rm"><div class="rmh"><strong>Sala ' + n + '</strong>' + badgeHtml(rs.phase) + '</div>' +
        '<span class="cnt">' + rs.players.length + ' de ' + CAP + ' pilotos</span>' + plistHtml(rs, false) +
        '<button class="buy" type="button" data-join="' + id + '"' + (off ? ' disabled' : '') + '>' + label + '</button></div>';
    });
    return '<div class="roomgrid">' + cards.join('') + '</div>';
  }
  function lobbyHtml() {
    const rs = roomState(cur.id), n = cur.id.replace('sala-', '');
    let status = '', actions = '';
    if (rs.phase === 'open') {
      status = rs.players.length < 2 ? 'Espere pelo menos mais um piloto para começar.' : 'Tudo pronto. Qualquer piloto pode iniciar a corrida.';
      actions = '<button class="primary" type="button" data-start="1"' + (rs.players.length < 2 || canWrite === false ? ' disabled' : '') + '>Iniciar corrida</button>';
    } else if (rs.phase === 'finished') {
      status = 'Rodada encerrada. Comece outra quando todos estiverem prontos.';
      actions = '<button class="primary" type="button" data-newround="1">Nova rodada</button>';
    } else status = 'A corrida está começando...';
    return '<div class="lobby"><div class="panel"><div class="rmh"><strong>Sala ' + n + '</strong>' + badgeHtml(rs.phase) + '</div>' +
      plistHtml(rs, true) + '<span class="cnt">' + status + '</span>' +
      '<div class="actions">' + actions + '<button class="ghost" type="button" data-leave="1">Sair da sala</button></div></div></div>';
  }
  function renderRooms(force) {
    if (screen !== 'rooms' || !save) return;
    $('r-credits').textContent = save.credits;
    let html;
    if (!dbx) html = '<p class="fine">Modo online indisponível aqui.</p>';
    else if (!(gotRooms && gotPlayers)) html = '<p class="fine">' + (slow ? 'Ainda não consegui falar com o servidor. Verifique a internet.' : 'Carregando salas...') + '</p>';
    else html = cur ? lobbyHtml() : gridHtml();
    if (roomMsg) html = '<p class="err">' + esc(roomMsg) + '</p>' + html;
    if (force || html !== lastHtml) { $('roomview').innerHTML = html; lastHtml = html; }
  }
  function openRooms() { roomMsg = ''; show('rooms'); subscribeRooms(); renderRooms(true); }

  async function joinRoom(id) {
    if (!dbx || !save) return;
    const rs = roomState(id);
    if (rs.phase === 'racing' || rs.phase === 'countdown') { roomMsg = 'Essa sala já está em corrida.'; renderRooms(true); return; }
    const mine = rs.players.some(q => q.pid === save.pid);
    if (!mine && rs.phase === 'open' && rs.players.length >= CAP) { roomMsg = 'Sala cheia (5 pilotos).'; renderRooms(true); return; }
    try {
      let round = rs.round;
      if (rs.phase === 'finished') { round = rs.round + 1; await dbx.doc('rooms/' + id).set({ round, status: 'open' }); }
      const t = Date.now();
      await dbx.doc('players/' + id + '__' + save.pid).set({ room: id, pid: save.pid, name: me.name, color: save.color, round, joinedAt: t, ts: t, dist: 0, alive: true, done: false, final: 0 });
      cur = { id, round, t, started: -1 }; roomMsg = ''; lastBeat = t;
    } catch (e) {
      const ro = e && e.code === 'invalid_argument';
      if (ro) canWrite = false;
      roomMsg = ro ? 'Seu acesso é só de leitura. Peça ao dono do jogo acesso de colaborador.' : 'Não consegui entrar na sala. Tente de novo.';
    }
    renderRooms(true);
  }
  async function leaveRoom() {
    const c = cur; cur = null; renderRooms(true);
    if (c && dbx && save) { try { await dbx.doc('players/' + c.id + '__' + save.pid).delete(); } catch (e) { /* ok */ } }
  }
  async function startRoom() {
    if (!cur || !dbx) return;
    const rs = roomState(cur.id);
    if (rs.phase !== 'open' || rs.players.length < 2) return;
    try {
      await dbx.doc('rooms/' + cur.id).set({ round: rs.round, status: 'racing', seed: Math.floor(Math.random() * 2147483646) + 1, startAt: Date.now() + 5000, road: save.road });
    } catch (e) { roomMsg = 'Não consegui iniciar a corrida. Tente de novo.'; renderRooms(true); }
  }
  async function newRound() {
    if (!cur || !dbx) return;
    const rs = roomState(cur.id);
    try { await dbx.doc('rooms/' + cur.id).set({ round: rs.round + 1, status: 'open' }); }
    catch (e) { roomMsg = 'Não consegui abrir a nova rodada.'; renderRooms(true); }
  }

  function onRoomsChanged() {
    if (onl) onlineUpdate(roomState(onl.id));
    renderRooms();
    if (!cur || screen !== 'rooms') return;
    const rs = roomState(cur.id);
    if (rs.round !== cur.round && rs.phase === 'open' && !rejoining) {
      rejoining = true;
      joinRoom(cur.id).then(() => { rejoining = false; }, () => { rejoining = false; });
      return;
    }
    const mine = rs.players.some(q => q.pid === save.pid);
    if (!onl && mine && rs.round === cur.round && (rs.phase === 'countdown' || rs.phase === 'racing') && cur.started !== rs.round) {
      cur.started = rs.round; startOnline(rs);
    }
  }

  function startOnline(rs) {
    R = mulberry(rs.seed);
    roadId = TH[rs.road] ? rs.road : 'sakura'; theme = TH[roadId];
    onl = { id: rs.id, round: rs.round, endAt: rs.startAt + RACE_MAX * 1000, lastW: 0, claimed: false, prize: 0 };
    $('t-road').textContent = theme.name + ' · Sala ' + rs.id.replace('sala-', '');
    reset();
    $('g-mark').style.left = (60 / stat.top * 100) + '%';
    overlay.hidden = true; ovLast = ''; rankHtml = ''; lastTT = '';
    $('rank').hidden = false; $('t-garage').textContent = 'Sair';
    cdT = Math.max(0, (rs.startAt - Date.now()) / 1000); state = 'countdown';
    show('game');
  }
  async function writeProgress(final) {
    if (!onl || !dbx) return;
    if (writing) { if (final) pendingFinal = true; return; }
    writing = true;
    const ref = dbx.doc('players/' + onl.id + '__' + save.pid);
    const data = { dist: Math.round(p.z), ts: Date.now() };
    if (final) { data.done = true; data.final = Math.round(p.z); data.alive = false; }
    try { await ref.update(data); } catch (e) { /* tenta de novo no próximo ciclo */ }
    writing = false;
    if (pendingFinal) { pendingFinal = false; writeProgress(true); }
  }
  function endOnlineRun() {
    if (state !== 'running') return;
    finishRun(); state = 'over'; writeProgress(true); showOver();
  }
  function renderRank(rs) {
    const html = ranking(rs).map((r, i) =>
      '<span class="rk' + (r.q.pid === save.pid ? ' me' : '') + (r.q.done ? ' fin' : '') + '"><i style="background:' + esc(r.q.color) + '"></i>' +
      (i + 1) + 'º ' + esc(r.q.name) + ' ' + fmtKm(r.d) + ' km</span>').join('');
    if (html !== rankHtml) { $('rank').innerHTML = html; rankHtml = html; }
  }
  function onlineUpdate(rs) {
    renderRank(rs);
    if (rs.phase === 'finished' && state === 'running') endOnlineRun();
    if (state === 'over') renderOnlineOver();
  }
  function renderOnlineOver() {
    const rs = roomState(onl.id), fin = rs.phase === 'finished';
    const rk = ranking(rs), idx = rk.findIndex(r => r.q.pid === save.pid);
    if (fin && !onl.claimed) {
      onl.claimed = true;
      if (rs.players.length >= 2 && idx >= 0 && idx < PRIZES.length) {
        onl.prize = PRIZES[idx]; save.credits += onl.prize; earnedTotal += onl.prize; earned = earnedTotal;
        persist(); updateHud();
      }
    }
    $('ov-tag').textContent = fin ? 'Resultado da sala' : 'Aguardando os outros pilotos';
    $('ov-title').textContent = fin ? (idx === 0 ? 'Você venceu!' : (idx >= 0 ? (idx + 1) + 'º lugar' : 'Fim')) : 'Você terminou';
    $('ov-text').textContent = fmtKm(p.z) + ' km · +' + earnedTotal + ' créditos' + (onl.prize ? ' (prêmio de ' + onl.prize + ' incluído)' : '');
    const ul = $('ov-rank'); ul.hidden = false;
    const html = rk.map((r, i) =>
      '<li><span>' + (i + 1) + 'º ' + esc(r.q.name) + '</span><b>' + fmtKm(r.d) + ' km' + (fin && PRIZES[i] && rs.players.length >= 2 ? ' · +' + PRIZES[i] : '') + '</b></li>').join('');
    if (html !== ovLast) { ul.innerHTML = html; ovLast = html; }
    $('ov-again').hidden = true;
    const g = $('ov-garage'); g.textContent = 'Voltar às salas'; g.disabled = !fin;
    overlay.hidden = false;
  }
  function leaveToRooms() {
    onl = null; state = 'idle'; R = Math.random;
    $('rank').hidden = true; $('t-time').textContent = '';
    openRooms();
  }

  function tick() {
    if (!dbx || !save) return;
    if (screen === 'rooms') {
      if (cur) {
        const rs = roomState(cur.id), mine = rs.players.some(q => q.pid === save.pid);
        if (rs.phase === 'open' && !mine && Date.now() - cur.t > 4000) { roomMsg = 'Sala cheia: outro piloto entrou antes de você.'; leaveRoom(); }
        else if (rs.phase === 'open' && mine && Date.now() - lastBeat > 15000) {
          lastBeat = Date.now();
          dbx.doc('players/' + cur.id + '__' + save.pid).update({ ts: lastBeat }).catch(() => {});
        }
      }
      renderRooms();
    }
    if (onl) onlineUpdate(roomState(onl.id));
  }

  $('go-online').addEventListener('click', () => { if (dbx && save) openRooms(); });
  $('r-back').addEventListener('click', () => { leaveRoom(); openGarage(); });
  $('roomview').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.join) joinRoom(b.dataset.join);
    else if (b.dataset.start) startRoom();
    else if (b.dataset.leave) leaveRoom();
    else if (b.dataset.newround) newRound();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && save) persist(); });
  window.addEventListener('pagehide', () => { if (save) persist(); });
  initOnline();
  setInterval(tick, 1000);

  // gancho de teste e atualização ao vivo
  window.__speedStriet = { get state() { return state; }, get screen() { return screen; }, get credits() { return save ? save.credits : null; } };
})();

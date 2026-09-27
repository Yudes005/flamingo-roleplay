/* ============================================================
   ZVUCI M MENIJA (flamingo_mmenu)
   Svi zvuci se prave u kodu (Web Audio) - nema mp3 fajlova.
   Uključi/isključi i jačina: Podešavanja -> Opšte -> Zvuk
   (currentPlayer.settings.menuSounds / menuVolume).

   Upotreba iz drugih skripti:
     flSound.play('click')            // klik
     flSound.play('win', { tier: 3 }) // dobitak iz kutije (0-4)
   Dugme može da ima data-sfx="ime" (drugi zvuk) ili data-sfx="none" (bez zvuka).
   ============================================================ */
(() => {
  let ctx = null;
  let master = null;
  let wet = null;          // "eho" za lepše zvonjenje nagrada
  let noiseBuf = null;
  let lastTick = 0;

  // retkost -> jačina zvuka dobitka (0 = obično ... 4 = ekskluzivno)
  const TIER = { obicno: 0, retko: 1, epsko: 2, legendarno: 3, ekskluzivno: 4 };

  function settings() {
    return (typeof currentPlayer !== 'undefined' && currentPlayer && currentPlayer.settings) || {};
  }

  function enabled() { return settings().menuSounds !== false; }

  function volume() {
    const v = Number(settings().menuVolume);
    return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) / 100 : 0.6;
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);

      master = ctx.createGain();
      master.connect(comp);

      // jednostavan eho: delay -> lowpass -> feedback
      wet = ctx.createGain();
      wet.gain.value = 0.32;
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.12;
      const fb = ctx.createGain();
      fb.gain.value = 0.3;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      wet.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(master);

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    master.gain.value = volume() * 0.9;
    return ctx;
  }

  // ---------- osnovni gradivni blokovi ----------
  function tone({ freq, to, type = 'sine', at = 0, dur = 0.2, gain = 0.1, attack = 0.004, echo = 0, detune = 0 }) {
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    if (detune) osc.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    if (echo > 0) {
      const e = ctx.createGain();
      e.gain.value = echo;
      g.connect(e);
      e.connect(wet);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ at = 0, dur = 0.2, gain = 0.08, type = 'bandpass', freq = 1000, to, q = 1, attack = 0.005 }) {
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  function sparkle(at, count, from, spread, gain) {
    for (let i = 0; i < count; i++) {
      tone({
        freq: from + Math.random() * spread,
        type: 'sine',
        at: at + i * 0.045 + Math.random() * 0.02,
        dur: 0.28,
        gain: gain * (1 - i / (count + 2)),
        echo: 0.6
      });
    }
  }

  // note (Hz)
  const N = { C4: 261.6, G4: 392, C5: 523.3, E5: 659.3, G5: 784, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093 };

  function arp(notes, step, opts) {
    notes.forEach((f, i) => tone(Object.assign({ freq: f, at: (opts.at || 0) + i * step }, opts)));
  }

  // ---------- zvuci ----------
  const SOUNDS = {
    click() {
      tone({ freq: 1900, type: 'triangle', dur: 0.045, gain: 0.05 });
      tone({ freq: 950, type: 'sine', dur: 0.03, gain: 0.03 });
    },

    soft() {
      tone({ freq: 1400, type: 'sine', dur: 0.05, gain: 0.035 });
    },

    slide() {
      const now = performance.now();
      if (now - lastTick < 45) return;
      lastTick = now;
      tone({ freq: 2400 + Math.random() * 300, type: 'triangle', dur: 0.022, gain: 0.03 });
    },

    open() {
      noise({ dur: 0.3, gain: 0.05, type: 'bandpass', freq: 380, to: 2400, q: 0.8, attack: 0.08 });
      tone({ freq: N.E5, type: 'sine', at: 0.08, dur: 0.3, gain: 0.04, echo: 0.4 });
      tone({ freq: N.A5, type: 'sine', at: 0.14, dur: 0.35, gain: 0.035, echo: 0.4 });
    },

    close() {
      noise({ dur: 0.22, gain: 0.045, type: 'bandpass', freq: 2200, to: 380, q: 0.8, attack: 0.02 });
    },

    buy() {
      // "zveckanje" novčića
      tone({ freq: 1567, type: 'triangle', dur: 0.22, gain: 0.08, echo: 0.4 });
      tone({ freq: 2093, type: 'triangle', at: 0.07, dur: 0.32, gain: 0.08, echo: 0.5 });
      tone({ freq: 3136, type: 'sine', at: 0.07, dur: 0.16, gain: 0.025 });
    },

    sell() {
      [1760, 2093, 2637].forEach((f, i) => {
        tone({ freq: f, type: 'triangle', at: i * 0.065, dur: 0.2, gain: 0.07, echo: 0.4 });
      });
    },

    activate() {
      tone({ freq: N.C5, type: 'triangle', dur: 0.18, gain: 0.07 });
      tone({ freq: N.G5, type: 'triangle', at: 0.08, dur: 0.3, gain: 0.07, echo: 0.4 });
    },

    reward() {
      arp([N.E5, N.G5, N.C6, N.E6], 0.065, { type: 'triangle', dur: 0.4, gain: 0.075, echo: 0.55 });
      sparkle(0.26, 4, 2400, 900, 0.03);
    },

    error() {
      tone({ freq: 170, type: 'square', dur: 0.1, gain: 0.035 });
      tone({ freq: 140, type: 'square', at: 0.13, dur: 0.14, gain: 0.035 });
    },

    spinStart() {
      noise({ dur: 0.7, gain: 0.06, type: 'lowpass', freq: 250, to: 3200, q: 0.7, attack: 0.3 });
      tone({ freq: 110, to: 240, type: 'sine', dur: 0.55, gain: 0.06, attack: 0.2 });
    },

    // jedna kartica prošla ispod linije
    tick(opts) {
      const now = performance.now();
      if (now - lastTick < 26) return;
      lastTick = now;
      const p = (opts && opts.pitch) || 1;
      tone({ freq: 1500 * p + Math.random() * 120, type: 'triangle', dur: 0.03, gain: 0.06 });
      noise({ dur: 0.018, gain: 0.03, type: 'highpass', freq: 3500, q: 0.7, attack: 0.001 });
    },

    // tuđi redak drop u traci "Dropovi"
    drop() {
      tone({ freq: N.E6, type: 'sine', dur: 0.12, gain: 0.03, echo: 0.4 });
      tone({ freq: N.G6, type: 'sine', at: 0.07, dur: 0.18, gain: 0.03, echo: 0.4 });
    },

    win(opts) {
      const tier = Math.max(0, Math.min(4, (opts && opts.tier) || 0));

      if (tier === 0) {
        tone({ freq: N.E5, type: 'triangle', dur: 0.3, gain: 0.08, echo: 0.3 });
        tone({ freq: N.C6, type: 'triangle', at: 0.09, dur: 0.4, gain: 0.08, echo: 0.4 });
        return;
      }

      if (tier === 1) {
        arp([N.C5, N.E5, N.G5, N.C6], 0.075, { type: 'triangle', dur: 0.42, gain: 0.08, echo: 0.45 });
        return;
      }

      if (tier === 2) {
        arp([N.C5, N.E5, N.G5, N.C6, N.E6], 0.07, { type: 'triangle', dur: 0.5, gain: 0.08, echo: 0.55 });
        sparkle(0.38, 6, 2200, 1400, 0.035);
        return;
      }

      // legendarno / ekskluzivno: udar + akord + iskre
      tone({ freq: 70, to: 42, type: 'sine', dur: 0.7, gain: 0.28, attack: 0.005 });
      noise({ dur: 0.35, gain: 0.1, type: 'lowpass', freq: 1800, to: 200, q: 0.5, attack: 0.003 });

      const chord = tier === 4 ? [N.C5, N.E5, N.G5, N.C6, N.E6] : [N.C5, N.E5, N.G5, N.C6];
      chord.forEach(f => {
        tone({ freq: f, type: 'triangle', at: 0.04, dur: 1.4, gain: 0.045, attack: 0.02, echo: 0.5 });
        tone({ freq: f, type: 'sine', at: 0.04, dur: 1.4, gain: 0.03, attack: 0.02, detune: 8 });
      });

      arp([N.C6, N.E6, N.G6, N.C7], 0.06, { at: 0.25, type: 'sine', dur: 0.4, gain: 0.05, echo: 0.6 });
      sparkle(0.5, tier === 4 ? 14 : 8, 2600, 2000, 0.035);

      if (tier === 4) {
        // drugi talas za ekskluzivno
        [N.G4, N.C5, N.E5, N.G5].forEach(f => tone({ freq: f * 2, type: 'triangle', at: 0.85, dur: 1.2, gain: 0.035, attack: 0.02, echo: 0.6 }));
        sparkle(1.05, 8, 3000, 2200, 0.028);
      }
    }
  };

  function play(name, opts) {
    if (!enabled() || !SOUNDS[name]) return;
    try {
      if (!ensure()) return;
      if (master.gain.value <= 0.001) return;
      SOUNDS[name](opts);
    } catch (e) { console.warn('[flamingo_mmenu] zvuk', name, e); /* zvuk nikad ne sme da sruši meni */ }
  }

  function tierOf(rarityId) {
    const rar = typeof pkRarityInfo === 'function' ? pkRarityInfo(rarityId) : null;
    if (rar && Number.isFinite(Number(rar.zvuk))) return Number(rar.zvuk);
    if (rarityId in TIER) return TIER[rarityId];
    return rar && rar.highlight ? 3 : 1;
  }

  window.flSound = { play, tierOf };

  /* ============================================================
     AUTOMATSKI ZVUCI
     ============================================================ */

  // klik na bilo koje dugme u meniju (osim ako ima data-sfx)
  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, .pk-switch, .fl-switch, .fl-theme-card');
    if (!el || el.disabled) return;
    const custom = el.closest('[data-sfx]');
    if (custom) {
      if (custom.dataset.sfx !== 'none') play(custom.dataset.sfx);
      return;
    }
    if (el.matches('.mmenu-rail-sub-item, .pk-count, .pk-tab, .fl-settings-nav-item')) play('soft');
    else play('click');
  }, true);

  document.addEventListener('keydown', (e) => {
    const app = document.getElementById('app');
    if (e.key === 'Escape' && app && !app.classList.contains('hidden')) play('close');
  });

  // odgovori servera
  const REWARD_ACTIONS = ['dailyRewardClaimed', 'playtimeMilestoneClaimed', 'milestoneClaimed', 'dailyTaskClaimed', 'referralEarningsCollected', 'referralCodeRedeemed'];

  window.addEventListener('message', (event) => {
    const d = event.data || {};
    const r = d.result || {};

    if (d.action === 'openMenu') { setTimeout(() => play('open'), 30); return; }
    if (d.action === 'closeMenu') { play('close'); return; }

    if (REWARD_ACTIONS.includes(d.action)) { play(r.success ? 'reward' : 'error'); return; }
    if (d.action === 'referralCodeCreated') { play(r.success ? 'activate' : 'error'); return; }
    if (d.action === 'moneyPackagePurchased') { play(r.success ? 'buy' : 'error'); return; }

    if (d.action === 'paketiResult') {
      if (r.ok === false) play('error');
      else if (r.bought) play('buy');
      else if (r.sold) play('sell');
      else if (r.activated) play('activate');
      return;
    }

    if (d.action === 'paketiDrop' && d.drop) {
      const me = typeof currentPlayer !== 'undefined' && currentPlayer ? currentPlayer.serverId : null;
      if (d.drop.by !== me && tierOf(d.drop.rarity) >= 3) play('drop');
    }
  });
})();

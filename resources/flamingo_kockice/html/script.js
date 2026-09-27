// ============================================================
//  FLAMINGO KOCKICE - zvuk bacanja
//  Zvuk se pravi uzivo (Web Audio), pa ne treba nikakav .ogg/.mp3:
//  1) kockice se tresu u ruci (gusti, brzi "klikovi")
//  2) padaju na sto i odskacu (sve redji i tisi udarci)
// ============================================================

let ctx = null;

function audio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

// Jedan udarac kockice: kratak sum kroz bandpass filter (zvuci kao
// plastika/kost o drvo). Svaki udarac ima malo drugaciju "boju".
function hit(ac, dest, time, volume, bright) {
    const length = 0.03 + Math.random() * 0.02;
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * length), ac.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
        const decay = Math.pow(1 - i / data.length, 5);
        data[i] = (Math.random() * 2 - 1) * decay;
    }

    const src = ac.createBufferSource();
    src.buffer = buffer;

    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = (bright ? 3200 : 1800) + Math.random() * 1800;
    band.Q.value = 1.5 + Math.random() * 2.5;

    // Tup "tok" ispod klika - daje osecaj da je kockica pala na sto.
    const body = ac.createOscillator();
    body.type = 'sine';
    body.frequency.value = 420 + Math.random() * 260;
    const bodyGain = ac.createGain();
    bodyGain.gain.setValueAtTime(bright ? 0 : volume * 0.35, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

    const gain = ac.createGain();
    gain.gain.value = volume;

    src.connect(band);
    band.connect(gain);
    gain.connect(dest);

    body.connect(bodyGain);
    bodyGain.connect(dest);

    src.start(time);
    body.start(time);
    body.stop(time + 0.05);
}

function roll(volume, duration) {
    const ac = audio();

    const master = ac.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume));
    master.connect(ac.destination);

    let t = ac.currentTime + 0.03;
    const end = t + Math.max(0.8, duration);

    // 1) Tresenje u ruci - ~55% trajanja
    const shakeEnd = t + (end - t) * 0.55;
    while (t < shakeEnd) {
        hit(ac, master, t, 0.25 + Math.random() * 0.25, true);
        hit(ac, master, t + 0.008 + Math.random() * 0.012, 0.15 + Math.random() * 0.2, true);
        t += 0.05 + Math.random() * 0.05;
    }

    // 2) Bacanje na sto - dve kockice odskacu sve redje i tise
    t += 0.14;
    let gap = 0.08;
    let vol = 1.0;

    while (t < end && vol > 0.06) {
        hit(ac, master, t, vol, false);
        hit(ac, master, t + 0.015 + Math.random() * 0.03, vol * 0.75, false);
        t += gap;
        gap *= 1.3;
        vol *= 0.7;
    }
}

window.addEventListener('message', (event) => {
    const data = event.data || {};

    if (data.action === 'roll') {
        try {
            roll(Number(data.volume) || 0.6, Number(data.duration) || 2);
        } catch (e) {
            // zvuk nije kritican - igra ide dalje i bez njega
        }
    }
});

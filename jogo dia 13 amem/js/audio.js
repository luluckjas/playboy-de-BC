// Todos os sons gerados com WebAudio (sem arquivos), incluindo a trilha 8-bit.

// ---------- Trilha: "Rodeio 8-bit" (original) ----------
// 120 BPM, passo = colcheia (0.25s). 30 compassos x 8 passos = 240 passos = 60 segundos.
// Progressão de sertanejo universitário: Am - F - C - G.
// Notação da melodia: nota (ex. E5), "-" segura a nota anterior, "." pausa.

const BPM = 120;
const STEP = 60 / BPM / 2;

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const freq = n => {
    const m = n.match(/^([A-G]#?)(\d)$/);
    return 440 * 2 ** ((NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
};

const CHORDS = {
    Am: { root: 'A2', arp: ['A4', 'C5', 'E5', 'C5'] },
    F:  { root: 'F2', arp: ['F4', 'A4', 'C5', 'A4'] },
    C:  { root: 'C3', arp: ['C5', 'E5', 'G5', 'E5'] },
    G:  { root: 'G2', arp: ['G4', 'B4', 'D5', 'B4'] },
};

const MEL_A = [
    'E5 . E5 D5 C5 . A4 .',
    'C5 . C5 D5 C5 . A4 G4',
    'G4 . C5 . E5 . D5 C5',
    'D5 - - . B4 . G4 .',
    'E5 . E5 G5 A5 . G5 E5',
    'F5 . E5 D5 C5 . D5 .',
    'E5 . G5 . E5 D5 C5 .',
    'D5 - - - B4 - D5 .',
];
const MEL_B = [
    'A5 . A5 . G5 . E5 G5',
    'A5 . C6 . A5 . G5 .',
    'G5 . E5 . C5 . E5 G5',
    'G5 - F5 - E5 - D5 .',
    'A5 . A5 . G5 . E5 G5',
    'A5 . C6 . D6 . C6 A5',
    'G5 . E5 G5 C6 - B5 -',
    'B5 - - - G5 - - .',
];
// O "break": só bateria acelerada, baixo e uns gritos de sintetizador
const MEL_BREAK = [
    'A5 . . . . . . .',
    '. . . . A5 . A5 .',
    'C6 . . . . . . .',
    'D6 - - - B5 - - -',
];

// k = bumbo, s = caixa, h = chimbal, d = chimbal dobrado (semicolcheias)
const DRUMS = {
    intro: ['k h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
    beat:  ['k h', 'h', 'h', 'k h', 's h', 'h', 'k h', 'h'],
    break: ['k d', 'd', 'k d', 'k d', 's d', 'd', 'k d', 's d'],
};

const SECTIONS = [
    { bars: 2, chords: ['Am', 'G'], drums: 'intro', arp: true },
    { bars: 8, lead: MEL_A, drums: 'beat', bass: true },
    { bars: 8, lead: MEL_B, drums: 'beat', bass: true, arp: true },
    { bars: 4, chords: ['Am', 'Am', 'F', 'G'], lead: MEL_BREAK, drums: 'break', bass: true },
    { bars: 8, lead: MEL_A, drums: 'beat', bass: true, arp: true },
];

function buildSong() {
    const steps = [];
    for (const sec of SECTIONS) {
        const prog = sec.chords || ['Am', 'F', 'C', 'G'];
        for (let b = 0; b < sec.bars; b++) {
            const chord = CHORDS[prog[b % prog.length]];
            const mel = sec.lead ? sec.lead[b].split(' ') : null;
            for (let s = 0; s < 8; s++) {
                const st = { drums: DRUMS[sec.drums][s].split(' '), bass: null, arp: null, lead: null };
                if (sec.bass) {
                    const pat = [1, 0, 2, 0, 1, 1, 2, 0][s]; // tônica / oitava
                    if (pat) st.bass = freq(chord.root) * pat;
                }
                if (sec.arp) st.arp = freq(chord.arp[s % 4]);
                if (mel && mel[s] !== '.' && mel[s] !== '-') {
                    let len = 1;
                    while (mel[s + len] === '-') len++;
                    st.lead = [freq(mel[s]), len];
                }
                steps.push(st);
            }
        }
    }
    return steps;
}
const SONG = buildSong();

export class Audio {
    constructor() {
        this.ctx = null;
        this.musicOn = true;
        this.playing = false;
    }

    init() {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.5;
        this.musicBus.connect(this.ctx.destination);
        // Ruído branco reaproveitado por bateria e efeitos
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }

    // Navegadores só liberam áudio depois de uma interação do usuário
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    // Toca uma nota em tempo absoluto `t`
    osc(f, t, dur, type, vol, dest, slideTo = null, sustain = false) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        g.gain.setValueAtTime(vol, t);
        if (sustain) {
            g.gain.setValueAtTime(vol, t + dur * 0.8);
            g.gain.linearRampToValueAtTime(0.0001, t + dur);
        } else {
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        }
        o.connect(g).connect(dest);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    noiseAt(t, dur, vol, dest, highpass = 0) {
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
        src.buffer = this.noiseBuf;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        let node = src;
        if (highpass) {
            const f = this.ctx.createBiquadFilter();
            f.type = 'highpass';
            f.frequency.value = highpass;
            node = node.connect(f);
        }
        node.connect(g).connect(dest);
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.02);
    }

    tone(f, start, dur, type = 'square', vol = 0.15, slideTo = null) {
        this.osc(f, this.ctx.currentTime + start, dur, type, vol, this.sfxBus, slideTo);
    }

    noise(start, dur, vol = 0.2) {
        this.noiseAt(this.ctx.currentTime + start, dur, vol, this.sfxBus);
    }

    // ---------- Música ----------

    // Toca o mp3 do jogador, se existir: primeiro musicas/faseN.mp3, depois musicas/musica.mp3.
    // Se nenhum existir, toca a trilha 8-bit.
    playLevelMusic(num) {
        const candidates = [`musicas/fase${num}.mp3`, 'musicas/musica.mp3'];
        const token = this.musicToken = (this.musicToken || 0) + 1;
        const tryNext = (i) => {
            if (token !== this.musicToken) return; // outra fase já pediu outra música
            if (i >= candidates.length) {
                this.stopFile();
                this.startChip();
                return;
            }
            const src = candidates[i];
            // Mesma música da fase anterior: continua de onde estava
            if (this.file && this.file.srcName === src) {
                this.stopChip();
                if (this.file.paused) this.file.play().catch(() => {});
                return;
            }
            const el = document.createElement('audio');
            el.loop = true;
            el.volume = this.musicOn ? 0.8 : 0;
            el.srcName = src;
            el.addEventListener('canplay', () => {
                if (token !== this.musicToken) return;
                this.stopChip();
                this.stopFile();
                this.file = el;
                el.play().catch(() => {});
            }, { once: true });
            el.addEventListener('error', () => tryNext(i + 1), { once: true });
            el.src = src;
        };
        tryNext(0);
    }

    stopMusic() {
        this.musicToken = (this.musicToken || 0) + 1;
        this.stopChip();
        this.stopFile();
    }

    stopFile() {
        if (this.file) { this.file.pause(); this.file = null; }
    }

    // Trilha 8-bit
    startChip() {
        if (!this.ctx || this.playing) return;
        this.resume();
        this.playing = true;
        this.step = 0;
        this.nextTime = 0;
        // Agenda as notas um pouquinho à frente (técnica de "lookahead")
        this.timer = setInterval(() => this.schedule(), 25);
    }

    stopChip() {
        this.playing = false;
        clearInterval(this.timer);
    }

    toggleMute() {
        this.musicOn = !this.musicOn;
        if (this.musicBus) this.musicBus.gain.value = this.musicOn ? 0.5 : 0;
        if (this.file) this.file.volume = this.musicOn ? 0.8 : 0;
    }

    schedule() {
        // Enquanto o navegador não libera o áudio, não agenda nada
        if (this.ctx.state !== 'running') { this.resume(); return; }
        const now = this.ctx.currentTime;
        // Se a aba ficou em segundo plano, não tenta "recuperar" as notas perdidas
        if (this.nextTime < now - 0.2) this.nextTime = now + 0.05;
        while (this.nextTime < now + 0.12) {
            this.playStep(SONG[this.step], this.nextTime);
            this.nextTime += STEP;
            this.step = (this.step + 1) % SONG.length;
        }
    }

    playStep(st, t) {
        const bus = this.musicBus;
        for (const d of st.drums) {
            if (d === 'k') this.osc(160, t, 0.14, 'sine', 0.6, bus, 40);
            if (d === 's') { this.noiseAt(t, 0.14, 0.3, bus, 1500); this.osc(220, t, 0.08, 'triangle', 0.15, bus); }
            if (d === 'h') this.noiseAt(t, 0.03, 0.08, bus, 7000);
            if (d === 'd') { this.noiseAt(t, 0.03, 0.08, bus, 7000); this.noiseAt(t + STEP / 2, 0.03, 0.06, bus, 7000); }
        }
        if (st.bass) this.osc(st.bass, t, STEP * 0.9, 'triangle', 0.35, bus, null, true);
        if (st.arp) this.osc(st.arp, t, STEP * 0.5, 'square', 0.035, bus);
        if (st.lead) this.osc(st.lead[0], t, st.lead[1] * STEP * 0.95, 'square', 0.07, bus, null, true);
    }

    // ---------- Efeitos ----------

    playSfx(type) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        switch (type) {
            case 'hit': this.noise(0, 0.08, 0.25); this.tone(180, 0, 0.08, 'square', 0.12, 80); break;
            case 'bigHit': this.noise(0, 0.15, 0.35); this.tone(140, 0, 0.18, 'sawtooth', 0.15, 50); break;
            case 'whoosh': this.noise(0, 0.1, 0.08); break;
            case 'jump': this.tone(300, 0, 0.15, 'square', 0.08, 600); break;
            case 'hurt': this.tone(400, 0, 0.2, 'sawtooth', 0.15, 120); break;
            // "Pix recebido": plim-plim agudo
            case 'pix': this.tone(1318, 0, 0.12, 'sine', 0.2); this.tone(1760, 0.1, 0.25, 'sine', 0.2); break;
            case 'lasso': this.noise(0, 0.15, 0.06); this.tone(220, 0, 0.18, 'triangle', 0.08, 660); break;
            // "Twang" do cordão laçando
            case 'catch': this.tone(110, 0, 0.25, 'sawtooth', 0.15, 70); this.tone(880, 0, 0.08, 'square', 0.08); break;
            case 'denied': this.tone(150, 0, 0.1, 'square', 0.06); break;
            case 'ostFull': [659, 784, 988, 1318].forEach((f, i) => this.tone(f, i * 0.06, 0.12, 'square', 0.08)); break;
            case 'camarote':
                this.noise(0, 0.6, 0.35);
                this.tone(55, 0, 0.6, 'sawtooth', 0.25, 30);
                [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.15 + i * 0.05, 0.4, 'square', 0.07));
                break;
            case 'throw': this.tone(500, 0, 0.15, 'triangle', 0.06, 900); break;
            case 'glass': this.noise(0, 0.2, 0.3); this.tone(2200, 0, 0.1, 'square', 0.05, 1200); break;
            case 'charge': this.tone(90, 0, 0.4, 'sawtooth', 0.12, 220); break;
            case 'heal': [523, 659, 784].forEach((f, i) => this.tone(f, i * 0.07, 0.15, 'triangle', 0.15)); break;
            case 'powerup': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.05, 0.1, 'square', 0.08)); break;
            case 'vendor': this.tone(660, 0, 0.1, 'square', 0.06); this.tone(880, 0.12, 0.1, 'square', 0.06); break;
            case 'coin': this.tone(1568, 0, 0.08, 'sine', 0.1); break;
            case 'buy': [784, 1046, 1318].forEach((f, i) => this.tone(f, i * 0.05, 0.1, 'square', 0.08)); break;
            case 'break': this.noise(0, 0.12, 0.25); this.tone(300, 0, 0.1, 'square', 0.08, 120); break;
            case 'boom': this.noise(0, 0.5, 0.4); this.tone(80, 0, 0.5, 'sawtooth', 0.25, 30); break;
            case 'wave': this.noise(0, 1.0, 0.25); break;
            case 'honk': this.tone(330, 0, 0.25, 'square', 0.12); this.tone(415, 0, 0.25, 'square', 0.1); this.tone(330, 0.35, 0.4, 'square', 0.12); break;
            case 'moo': this.tone(140, 0, 0.6, 'sawtooth', 0.15, 90); this.tone(70, 0, 0.6, 'square', 0.08, 50); break;
            case 'good': this.tone(988, 0, 0.08, 'square', 0.08); this.tone(1318, 0.06, 0.1, 'square', 0.08); break;
            case 'bark': this.tone(600, 0, 0.06, 'square', 0.08, 300); this.tone(500, 0.08, 0.06, 'square', 0.07, 250); break;
            case 'crit': this.tone(1760, 0, 0.1, 'square', 0.08, 2600); this.noise(0, 0.1, 0.2); break;
            case 'start': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.08, 0.15, 'square', 0.1)); break;
            case 'victory': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, i * 0.12, 0.3, 'square', 0.12)); break;
            case 'gameover': [392, 330, 262, 196].forEach((f, i) => this.tone(f, i * 0.2, 0.3, 'triangle', 0.15)); break;
        }
    }
}

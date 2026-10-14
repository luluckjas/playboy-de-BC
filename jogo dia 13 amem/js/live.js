// Live do Thiago: chat ao vivo comentando a luta, seguidores e desafios do chat.

const USERS = [
    '@peao_raiz', '@bc_vibes', '@agro_e_pop', '@rainha_do_pix', '@tiozao_do_churras',
    '@camarote_vip', '@surfista_bc', '@sofrencia_24h', '@funk_da_barra', '@mae_do_thiago',
    '@hater_profissional', '@fa_clube_do_xerife', '@queijo_coalho_fan', '@aba_reta_crew',
];
const COLORS = ['#ff3fa4', '#00e5ff', '#32ff7e', '#ffd700', '#b388ff', '#ff9f1a'];

const LINES = {
    hit: ['KKKKK', 'que tapa!!', 'BRABO', 'amassou', 'olha o combo 🔥', 'pancada seca'],
    combo: ['COMBO INSANO', 'clipa isso!!', 'rei da orla', 'MITOU', 'tá on fire'],
    hurt: ['apanhou kkkk', 'tá fraco hein', 'vou dar unfollow', 'que vergonha', 'L', 'levou essa'],
    kill: ['+1 peão', 'manda pro camarote', 'PIX ENVIADO 💸', 'segue o líder', 'de base'],
    lasso: ['YEEHAW 🤠', 'laçou bonito', 'cordão de ouro é roubado', 'vem cá vem'],
    special: ['CAMAROTEEEE', '🍾🍾🍾', 'OPEN BAR', 'a tela tremeu aqui'],
    idle: ['bora thiago', 'cadê a ação?', 'primeira vez aqui', 'de onde vc é?', 'salve BC', 'manda salve', 'que live boa'],
    pickup: ['boné brabo', 'queijo coalho é vida', 'drip absurdo'],
    bull: ['RODEIOOO', 'segura peão!!', '8 SEGUNDOS', 'touro brabo 🐂'],
    steal: ['o cowboy roubou teu pix kkk', 'PEGA ELE', 'perdeu o pix'],
    event: ['oq ta acontecendo', 'CAOS', 'kkkkkkk socorro', 'que isso'],
    fail: ['VAIIIIA', 'falhou kkkk', 'unfollow geral', 'decepção'],
    win: ['CUMPRIU!!', 'respeita', 'merece o pix', 'GG'],
};

const CHALLENGES = [
    { id: 'combo', text: 'Faz um combo de 8 hits!', time: 15, goal: 8 },
    { id: 'laco', text: 'Laça 2 inimigos!', time: 15, goal: 2 },
    { id: 'semdano', text: 'Fica 10s sem apanhar!', time: 10, goal: 0 },
    { id: 'aereo', text: 'Acerta 3 chutes aéreos!', time: 15, goal: 3 },
    { id: 'kills', text: 'Derruba 3 em 12 segundos!', time: 12, goal: 3 },
];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export class Live {
    constructor() {
        this.followers = 1200;
        this.chat = [];
        this.challenge = null;
        this.challengeTimer = 10;
        this.idleTimer = 2;
        this.milestone = 1;
    }

    get followersText() {
        const f = this.followers;
        return f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${f}`;
    }

    // Mais seguidores = mais Pix por inimigo (até 2x)
    get pixMult() { return Math.min(2, 1 + this.followers / 25000); }

    say(kind, chance = 1) {
        if (Math.random() > chance) return;
        const user = pick(USERS);
        this.chat.push({ user, text: pick(LINES[kind]), color: COLORS[USERS.indexOf(user) % COLORS.length], t: 0 });
        if (this.chat.length > 7) this.chat.shift();
    }

    gain(n, game) {
        this.followers = Math.max(0, Math.round(this.followers + n));
        // A cada 5 mil seguidores alguém manda uma doação
        const m = Math.floor(this.followers / 5000);
        if (m > this.milestone) {
            this.milestone = m;
            const p = game.player;
            game.items.drop(p.x + p.facing * 60, p.y, Math.random() < 0.5 ? 'queijo' : 'turbinado');
            this.chat.push({ user: pick(USERS), text: `DOOU R$ 50 💸 pelos ${m * 5}k!`, color: '#32ff7e', t: 0 });
            game.ui.narrate(`${m * 5} mil seguidores! Chegou doação!`);
            game.audio.playSfx('powerup');
        }
    }

    newLevel() {
        this.challenge = null;
        this.challengeTimer = 10;
        this.chat.push({ user: '@sistema', text: 'Thiago está AO VIVO 🔴', color: '#ff3366', t: 0 });
    }

    // ---- Ganchos chamados pelo jogo ----
    onHit(hits, game) {
        this.gain(4, game);
        this.say(hits >= 6 ? 'combo' : 'hit', hits >= 6 ? 0.25 : 0.12);
        if (this.challenge?.id === 'combo' && hits >= 8) this.complete(game);
    }
    onHurt(game) {
        this.gain(-40, game);
        this.say('hurt', 0.7);
        if (this.challenge?.id === 'semdano') this.fail(game);
    }
    onKill(game) { this.gain(60, game); this.say('kill', 0.4); this.progress('kills', game); }
    onLasso(game) { this.gain(30, game); this.say('lasso', 0.6); this.progress('laco', game); }
    onAirHit(game) { this.progress('aereo', game); }
    onSpecial(game) { this.gain(300, game); this.say('special'); this.say('special'); }
    onPickup() { this.say('pickup', 0.4); }
    onBull(game) { this.gain(200, game); this.say('bull'); this.say('bull'); }
    onSteal() { this.say('steal', 0.7); }
    onEvent() { this.say('event'); this.say('event', 0.6); }

    progress(id, game) {
        const c = this.challenge;
        if (!c || c.id !== id) return;
        c.count++;
        if (c.count >= c.goal) this.complete(game);
    }

    complete(game) {
        this.challenge = null;
        this.challengeTimer = 14 + Math.random() * 8;
        game.ui.coins += 300;
        game.ui.pixPopup(300);
        this.gain(600, game);
        this.say('win'); this.say('win');
        game.ui.narrate('Desafio do chat cumprido! +R$ 300');
        game.audio.playSfx('powerup');
        // O chat manda um presente: ostentação ou boné
        if (Math.random() < 0.5) game.gainOstentacao(40);
        else game.items.drop(game.player.x + game.player.facing * 50, game.player.y, pick(['sorte', 'blindado', 'turbinado']));
    }

    fail(game) {
        this.challenge = null;
        this.challengeTimer = 14 + Math.random() * 8;
        this.gain(-300, game);
        this.say('fail'); this.say('fail');
        game.ui.narrate('Falhou no desafio... o chat tá vaiando!');
        game.audio.playSfx('denied');
    }

    update(dt, game) {
        for (const m of this.chat) m.t += dt;

        // Chat conversando sozinho
        this.idleTimer -= dt;
        if (this.idleTimer <= 0) {
            this.idleTimer = 2.5 + Math.random() * 2.5;
            this.say('idle');
            this.gain(5 + Math.random() * 10, game);
        }

        // Desafios só aparecem quando tem briga rolando
        const c = this.challenge;
        if (!c) {
            if (game.level.active) this.challengeTimer -= dt;
            if (this.challengeTimer <= 0) {
                const def = pick(CHALLENGES);
                this.challenge = { ...def, left: def.time, count: 0 };
                this.chat.push({ user: pick(USERS), text: `DESAFIO: ${def.text}`, color: '#ffd700', t: 0 });
                game.ui.narrate(`O chat desafiou: ${def.text}`);
                game.audio.playSfx('vendor');
            }
        } else {
            c.left -= dt;
            if (c.left <= 0) {
                if (c.id === 'semdano') this.complete(game);
                else this.fail(game);
            }
        }
    }

    draw(ctx, time) {
        const x = 800, w = 214;
        ctx.save();
        ctx.translate(0, 74); // abaixo do minimapa
        ctx.textAlign = 'left';
        // Cabeçalho da live
        ctx.fillStyle = 'rgba(20,0,40,0.75)';
        ctx.fillRect(x, 54, w, 26);
        ctx.fillStyle = Math.floor(time * 2) % 2 ? '#ff3366' : '#aa1133';
        ctx.beginPath(); ctx.arc(x + 14, 67, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px Arial';
        ctx.fillText('AO VIVO', x + 26, 72);
        ctx.fillStyle = '#ffb3dc';
        ctx.fillText(`👁 ${this.followersText}`, x + 100, 72);
        ctx.fillStyle = '#32ff7e';
        ctx.font = 'bold 11px Arial';
        ctx.fillText(`Pix x${this.pixMult.toFixed(1)}`, x + 160, 72);

        let y = 84;
        // Desafio ativo
        const c = this.challenge;
        if (c) {
            ctx.fillStyle = 'rgba(80,60,0,0.85)';
            ctx.fillRect(x, y, w, 46);
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 12px Arial';
            ctx.fillText('🎯 DESAFIO DO CHAT', x + 8, y + 15);
            ctx.fillStyle = '#fff';
            ctx.fillText(c.text + (c.goal > 1 && c.id !== 'combo' ? `  ${c.count}/${c.goal}` : ''), x + 8, y + 31);
            ctx.fillStyle = '#333';
            ctx.fillRect(x + 8, y + 37, w - 16, 4);
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(x + 8, y + 37, (w - 16) * c.left / c.time, 4);
            y += 50;
        }

        // Mensagens do chat
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(x, y, w, this.chat.length * 19 + 6);
        this.chat.forEach((m, i) => {
            const my = y + 17 + i * 19;
            ctx.globalAlpha = Math.max(0.35, 1 - m.t / 12);
            ctx.font = 'bold 11px Arial';
            ctx.fillStyle = m.color;
            ctx.fillText(m.user, x + 6, my);
            const uw = ctx.measureText(m.user).width;
            ctx.font = '11px Arial';
            ctx.fillStyle = '#fff';
            ctx.fillText(m.text, x + 10 + uw, my);
        });
        ctx.restore();
    }
}

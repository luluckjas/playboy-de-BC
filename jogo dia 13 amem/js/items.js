// Itens no chão (bonés power-up e queijo coalho) e o vendedor de queijo.
import { SpriteRenderer } from './sprites.js';

export const BONES = {
    sorte:     { name: 'da Sorte',  color: '#32ff7e', msg: 'Boné da Sorte! Chove drop, minha gente!' },
    blindado:  { name: 'Blindado',  color: '#9aa4b1', msg: 'Boné Blindado! Pode bater que aguenta!' },
    turbinado: { name: 'Turbinado', color: '#ff3366', msg: 'Boné Turbinado! Soco de metralhadora!' },
};
export const BONE_KEYS = Object.keys(BONES);
export const BONE_DURATION = 15;

class Pickup {
    constructor(x, y, kind, life, z = 40) {
        // Itens que caem do céu (chuva de Pix) começam sem velocidade pra cima
        Object.assign(this, { x, y, kind, life, z, vz: z > 100 ? 0 : 180, taken: false });
    }

    update(dt) {
        this.life -= dt;
        this.vz -= 900 * dt;
        this.z = Math.max(0, this.z + this.vz * dt);
    }

    drawShadow(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    draw(ctx, time) {
        // Pisca nos últimos 3 segundos antes de sumir
        if (this.life < 3 && Math.floor(time * 10) % 2 === 0) return;
        const lift = this.z > 0 ? this.z : 6 + Math.sin(time * 5 + this.x) * 3;
        ctx.save();
        ctx.translate(Math.round(this.x), Math.round(this.y - lift));
        // Renderiza com sprites HD, brilho neon e efeitos
        SpriteRenderer.drawPickup(ctx, this, time);
        ctx.restore();
    }
}

class Vendor {
    constructor(x) { Object.assign(this, { x, y: 392, used: false }); }

    drawShadow(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 40, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    draw(ctx, time) {
        ctx.save();
        ctx.translate(this.x, this.y);
        // Carrinho com braseiro
        ctx.fillStyle = '#d35400';
        ctx.fillRect(10, -40, 50, 32);
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(20, -6, 7, 0, Math.PI * 2); ctx.arc(50, -6, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff9f1a';
        ctx.fillRect(14, -46, 42, 6);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Arial';
        ctx.fillText('QUEIJO', 18, -22);
        // Fumacinha
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let i = 0; i < 3; i++) {
            const t = (time + i * 0.4) % 1.2;
            ctx.beginPath(); ctx.arc(35 + Math.sin(t * 6) * 4, -50 - t * 30, 4 + t * 4, 0, Math.PI * 2); ctx.fill();
        }
        // Vendedor
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(-14, -34, 8, 30); ctx.fillRect(-4, -34, 8, 30);
        ctx.fillStyle = '#f1c40f'; ctx.fillRect(-16, -64, 22, 30);
        ctx.fillStyle = '#c68642'; ctx.fillRect(-14, -84, 18, 20);
        ctx.fillStyle = '#fff'; ctx.fillRect(-18, -90, 26, 7);
        if (!this.used) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(-50, -128, 110, 26);
            ctx.fillStyle = '#111';
            ctx.font = 'bold 12px Arial';
            ctx.fillText('Ó o queijo, ó!', -40, -110);
        }
        ctx.restore();
    }
}

export class ItemManager {
    constructor(vendorXs = []) {
        this.list = [];
        this.vendors = vendorXs.map(x => new Vendor(x));
    }

    drop(x, y, kind, life = 10, z = 40) { this.list.push(new Pickup(x, y, kind, life, z)); }

    // Nota de Pix no chão mais perto do inimigo (eles correm pra roubar)
    baitFor(e) {
        let best = null, bd = 260;
        for (const p of this.list) {
            if (p.kind !== 'pix' || p.taken) continue;
            const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
            if (d < bd) { bd = d; best = p; }
        }
        return best;
    }

    update(dt, player, game) {
        // Vendedor joga um espetinho quando o jogador chega perto
        for (const v of this.vendors) {
            if (!v.used && Math.abs(player.x - v.x) < 140) {
                v.used = true;
                this.drop(v.x, 440, 'queijo', 40);
                game.ui.narrate('Olha o queijo coalho quentinho!');
                game.audio.playSfx('vendor');
            }
        }
        for (const p of this.list) {
            p.update(dt);
            if (p.z === 0 && player.state !== 'down' &&
                Math.abs(p.x - player.x) < 30 && Math.abs(p.y - player.y) < 24) {
                p.taken = true;
                game.onPickup(p.kind);
            }
        }
        this.list = this.list.filter(p => !p.taken && p.life > 0);
    }
}

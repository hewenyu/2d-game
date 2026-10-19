import { rand } from '../core/math';

export type PKind = 'dot' | 'streak' | 'smoke' | 'ring' | 'shard' | 'wisp';
export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  kind: PKind; grav: number; drag: number; add: boolean;
  r1: number; rot: number; vr: number;
}
export interface BurstOpts {
  color: string; kind?: PKind; speed?: [number, number]; angle?: number; spread?: number;
  life?: [number, number]; size?: [number, number]; grav?: number; drag?: number; add?: boolean;
}

export class Particles {
  list: Particle[] = [];

  spawn(p: Partial<Particle> & { x: number; y: number }) {
    const life = p.life ?? 0.5;
    this.list.push({
      vx: 0, vy: 0, size: 3, color: '#fff', kind: 'dot', grav: 0, drag: 2, add: false, r1: 40, rot: 0, vr: 0,
      ...p, life, max: p.max ?? life,
    });
  }

  burst(x: number, y: number, n: number, o: BurstOpts) {
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + rand(-(o.spread ?? Math.PI), o.spread ?? Math.PI) : rand(0, Math.PI * 2);
      const sp = rand(...(o.speed ?? [60, 240]));
      const life = rand(...(o.life ?? [0.3, 0.7]));
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, size: rand(...(o.size ?? [1.5, 3.5])),
        color: o.color, kind: o.kind ?? 'dot', grav: o.grav ?? 0, drag: o.drag ?? 3, add: o.add ?? false,
        rot: rand(0, 6.28), vr: rand(-12, 12),
      });
    }
  }

  ring(x: number, y: number, r0: number, r1: number, color: string, life = 0.35, width = 3) {
    this.spawn({ x, y, kind: 'ring', size: width, r1, life, color, add: true, vx: r0 });
  }

  update(dt: number) {
    for (const p of this.list) {
      p.life -= dt;
      if (p.kind === 'ring') continue;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const pass of [false, true]) {
      ctx.globalCompositeOperation = pass ? 'lighter' : 'source-over';
      for (const p of this.list) {
        if (p.add !== pass) continue;
        const k = Math.max(0, p.life / p.max);
        ctx.globalAlpha = p.kind === 'smoke' ? k * 0.35 : Math.min(1, k * 1.6);
        ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
        switch (p.kind) {
          case 'dot':
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            break;
          case 'streak': {
            ctx.lineWidth = p.size; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
            break;
          }
          case 'smoke':
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.8 - k), 0, Math.PI * 2); ctx.fill();
            break;
          case 'wisp':
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
            break;
          case 'ring': {
            const r = p.vx + (p.r1 - p.vx) * (1 - k * k);
            ctx.lineWidth = p.size * k + 0.5;
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, r), 0, Math.PI * 2); ctx.stroke();
            break;
          }
          case 'shard': {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.beginPath(); ctx.moveTo(-p.size, -p.size * 0.5); ctx.lineTo(p.size, 0); ctx.lineTo(-p.size * 0.6, p.size * 0.6); ctx.closePath(); ctx.fill();
            ctx.restore();
            break;
          }
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'butt';
  }
}

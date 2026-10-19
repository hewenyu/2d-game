import { VIEW_H, VIEW_W } from '../config';

export type Action =
  | 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'dash' | 'throw' | 'heal'
  | 'pause' | 'confirm' | 'back' | 'interact';

const KEYMAP: Record<string, Action[]> = {
  KeyA: ['left'], ArrowLeft: ['left'],
  KeyD: ['right'], ArrowRight: ['right'],
  KeyW: ['up', 'interact'], ArrowUp: ['up', 'interact'],
  KeyS: ['down'], ArrowDown: ['down'],
  Space: ['jump', 'confirm'], KeyZ: ['jump'],
  KeyJ: ['attack'], KeyX: ['attack'],
  KeyK: ['dash'], ShiftLeft: ['dash'], ShiftRight: ['dash'], KeyC: ['dash'],
  KeyL: ['throw'], KeyV: ['throw'],
  KeyE: ['heal'], KeyQ: ['heal'],
  Escape: ['pause', 'back'], KeyP: ['pause'],
  Enter: ['confirm'],
};
const MOUSE_MAP: Record<number, Action> = { 0: 'attack', 2: 'throw' };

const now = () => performance.now() / 1000;

class Input {
  private codes = new Set<string>();
  private buttons = new Set<number>();
  private pressedAt = new Map<Action, number>();
  /** 逻辑坐标下的鼠标位置 */
  mouseX = VIEW_W / 2;
  mouseY = VIEW_H / 2;
  /** 最近一次投掷瞄准是否来自鼠标 */
  aimMouse = false;
  /** 鼠标是否在画布上动过（键盘玩家不显示准星） */
  mouseSeen = false;
  onAnyKey: ((code: string) => void) | null = null;

  attach(canvas: HTMLCanvasElement) {
    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      // 先跑首次按键的回调（创建 AudioContext 可能卡住主线程上百毫秒），再记录按下时刻，免得按键缓冲在这期间过期
      this.onAnyKey?.(e.code);
      this.codes.add(e.code);
      const acts = KEYMAP[e.code];
      if (acts) for (const a of acts) this.pressedAt.set(a, now());
      if (e.code === 'KeyL' || e.code === 'KeyV') this.aimMouse = false;
    });
    addEventListener('keyup', (e) => this.codes.delete(e.code));
    const toLogical = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * VIEW_W;
      this.mouseY = ((e.clientY - r.top) / r.height) * VIEW_H;
      this.mouseSeen = true;
    };
    canvas.addEventListener('mousemove', toLogical);
    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      canvas.focus();
      this.onAnyKey?.('Mouse' + e.button);
      toLogical(e);
      this.buttons.add(e.button);
      const a = MOUSE_MAP[e.button];
      if (a) this.pressedAt.set(a, now());
      if (e.button === 2) this.aimMouse = true;
      this.pressedAt.set('confirm', now());
    });
    addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('blur', () => { this.codes.clear(); this.buttons.clear(); });
  }

  held(a: Action): boolean {
    for (const c of this.codes) if (KEYMAP[c]?.includes(a)) return true;
    for (const b of this.buttons) if (MOUSE_MAP[b] === a) return true;
    return false;
  }

  /** 读取并消费一次输入缓冲 */
  consume(a: Action, window = 0.15): boolean {
    const t = this.pressedAt.get(a);
    if (t !== undefined && now() - t <= window) { this.pressedAt.delete(a); return true; }
    return false;
  }

  clear() { this.pressedAt.clear(); }
}

export const input = new Input();

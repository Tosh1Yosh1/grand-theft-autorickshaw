import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import { pickLine, resolveLine } from '../../content/lines';
import { BOLX_JUNK, BOLX_LISTINGS, CALL_LINES, CHATS, CONTACTS, type ChatMessage } from '../../content/phone';
import type { GameContext, GameSystem } from '../../core/System';
import { VEHICLES } from '../../vehicles/configs';
import { HALF } from '../../world/city/layout';
import { mapToCanvas, renderCityMap } from '../cityMap';
import { formatRupees } from '../format';
import { showSubtitle } from '../subtitles';

type App = 'home' | 'whatsupp' | 'chat' | 'map' | 'contacts' | 'bolx';

/**
 * Pappu's phone (P or Tab): WhatsUpp (family group, Chacha's forwards, Bunty's insurance),
 * Map (click to set a waypoint), Contacts (Mummy, mechanic delivers your vehicles...), BOLX
 * (sell stolen junk for ₹20). Messages trickle in with notifications.
 */
export class Phone implements GameSystem {
  readonly name = 'phone';
  open = false;
  waypoint: THREE.Vector3 | null = null;
  /** Junk picked up while knocking people over, sellable on BOLX. */
  readonly junk: string[] = [];
  private ctx!: GameContext;
  private el!: HTMLDivElement;
  private toast!: HTMLDivElement;
  private app: App = 'home';
  private chatId = '';
  private messages = new Map<string, ChatMessage[]>();
  private unread = new Map<string, number>();
  private dripTimer = 25;
  private mapCanvas: HTMLCanvasElement | null = null;
  private beam!: THREE.Mesh;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.phone = this;
    for (const c of CHATS) {
      this.messages.set(c.id, [...c.history]);
      this.unread.set(c.id, c.history.length);
    }
    this.el = document.createElement('div');
    this.el.className = 'phone interactive';
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.toast = document.createElement('div');
    this.toast.className = 'phone-toast';
    document.getElementById('overlay')!.append(this.el, this.toast);
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 80, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ff4d6d', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    this.beam.visible = false;
    ctx.scene.add(this.beam);
    // Knocked-over people sometimes drop junk. BOLX will take it. For ₹20.
    ctx.events.on('crime:assault', () => {
      if (Math.random() < 0.35) {
        const item = BOLX_JUNK[Math.floor(Math.random() * BOLX_JUNK.length)]!;
        this.junk.push(item);
        this.notify('BOLX', `Utha liya: ${item}. Becho ₹20 mein!`);
      }
    });
    ctx.events.on('phone:call', ({ from }) => this.notify('Call', `${from} calling...`));
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.el.classList.toggle('show', this.open);
    if (this.open) {
      document.exitPointerLock?.();
      this.app = 'home';
      this.render();
      audio.beep(1500, 0.03, 0.06);
    }
  }

  notify(app: string, text: string): void {
    this.toast.innerHTML = `<b>${app}</b> ${text}`;
    this.toast.classList.add('show');
    audio.beep(1760, 0.05, 0.08);
    setTimeout(() => audio.beep(2093, 0.06, 0.08), 90);
    clearTimeout((this.toast as unknown as { t?: number }).t);
    (this.toast as unknown as { t?: number }).t = window.setTimeout(() => this.toast.classList.remove('show'), 4000);
  }

  update(dt: number): void {
    if (this.ctx.input.wasPressed('phone') && this.ctx.clock.scale !== 0) this.toggle();
    // New messages trickle in.
    this.dripTimer -= dt;
    if (this.dripTimer <= 0) {
      this.dripTimer = 45 + Math.random() * 60;
      const thread = CHATS[Math.random() < 0.6 ? 0 : 1 + Math.floor(Math.random() * (CHATS.length - 1))]!;
      const list = this.messages.get(thread.id)!;
      const pending = thread.drip.filter((m) => !list.includes(m));
      const msg = pending[Math.floor(Math.random() * pending.length)];
      if (msg) {
        list.push(msg);
        this.unread.set(thread.id, (this.unread.get(thread.id) ?? 0) + 1);
        this.notify('WhatsUpp', `${msg.from}: ${resolveLine(msg.text, this.profanity).slice(0, 60)}…`);
        if (this.open && this.app === 'chat' && this.chatId === thread.id) this.render();
      }
    }
    // Waypoint beam; clear when reached.
    this.beam.visible = !!this.waypoint;
    if (this.waypoint) {
      this.beam.position.set(this.waypoint.x, 40, this.waypoint.z);
      const p = this.ctx.services.vehicles?.current?.position ?? this.ctx.services.player?.position;
      if (p && Math.hypot(p.x - this.waypoint.x, p.z - this.waypoint.z) < 10) this.waypoint = null;
    }
  }

  private get profanity(): boolean {
    return this.ctx.store.getState().settings.profanity;
  }

  private render(): void {
    const totalUnread = [...this.unread.values()].reduce((a, b) => a + b, 0);
    const st = this.ctx.store.getState();
    let body = '';
    switch (this.app) {
      case 'home':
        body = `<div class="ph-time">${this.ctx.services.dayNight?.clockText ?? ''}</div>
          <div class="ph-wall">Bhaukaal OS · ${formatRupees(st.player.money)}</div>
          <div class="ph-apps">
            <button data-app="whatsupp"><span>💬</span>WhatsUpp${totalUnread ? `<i>${totalUnread}</i>` : ''}</button>
            <button data-app="map"><span>🗺️</span>Map</button>
            <button data-app="contacts"><span>📞</span>Contacts</button>
            <button data-app="bolx"><span>🏷️</span>BOLX${this.junk.length ? `<i>${this.junk.length}</i>` : ''}</button>
          </div><div class="ph-hint">P / Tab: band karo</div>`;
        break;
      case 'whatsupp':
        body = `<div class="ph-head"><button data-back>‹</button>WhatsUpp</div>` + CHATS.map((c) => {
          const list = this.messages.get(c.id)!;
          const last = list[list.length - 1];
          const n = this.unread.get(c.id) ?? 0;
          return `<button class="ph-row" data-chat="${c.id}"><span class="av">${c.avatar}</span><span class="rt"><b>${c.name}</b><small>${last ? esc(resolveLine(last.text, this.profanity)).slice(0, 40) : ''}</small></span>${n ? `<i>${n}</i>` : ''}</button>`;
        }).join('');
        break;
      case 'chat': {
        const c = CHATS.find((x) => x.id === this.chatId)!;
        this.unread.set(c.id, 0);
        body = `<div class="ph-head"><button data-app="whatsupp">‹</button>${c.name}</div><div class="ph-chat">` +
          this.messages.get(c.id)!.map((m) => `<div class="bubble ${m.from === 'Pappu' ? 'me' : ''}"><b>${m.from}</b>${esc(resolveLine(m.text, this.profanity))}</div>`).join('') +
          `</div><div class="ph-reply"><button data-reply="${c.id}">👍 Reply: "Haan"</button></div>`;
        break;
      }
      case 'map':
        body = `<div class="ph-head"><button data-back>‹</button>Map · tap = waypoint</div><div class="ph-map"></div>
          <div class="ph-legend">H Pandey Niwas · P Denting-Painting · N Netaji · ! Mission · C Gaay</div>`;
        break;
      case 'contacts':
        body = `<div class="ph-head"><button data-back>‹</button>Contacts</div>` + CONTACTS.map((c) => `<button class="ph-row" data-call="${c.kind}"><span class="av">${c.emoji}</span><span class="rt"><b>${c.name}</b></span></button>`).join('');
        if (this.mechanicOpen) {
          body += `<div class="ph-sub">Raju: kaunsi gaadi? (₹500)</div>` + st.progress.unlockedVehicles.map((id) => `<button class="ph-row" data-deliver="${id}"><span class="av">🚗</span><span class="rt"><b>${VEHICLES[id]?.name ?? id}</b></span></button>`).join('');
        }
        break;
      case 'bolx':
        body = `<div class="ph-head"><button data-back>‹</button>BOLX · sab ₹20</div>` +
          (this.junk.length ? this.junk.map((j, i) => `<div class="ph-row"><span class="rt"><b>${esc(j)}</b><small>Condition: "chalta hai"</small></span><button data-sell="${i}">Becho ₹20</button></div>`).join('') : '<div class="ph-sub">Bechne ko kuch nahi. Log maaro, maal uthao. (Mazak hai. Thoda.)</div>') +
          '<div class="ph-sub">Featured listings</div>' + BOLX_LISTINGS.map(([t, p]) => `<div class="ph-row"><span class="rt"><b>${t}</b><small>${p}</small></span></div>`).join('');
        break;
    }
    this.el.innerHTML = `<div class="ph-screen">${body}</div>`;
    if (this.app === 'map') this.mountMap();
  }

  private mechanicOpen = false;

  private mountMap(): void {
    const holder = this.el.querySelector('.ph-map') as HTMLDivElement;
    const scale = 0.4;
    this.mapCanvas ??= renderCityMap(scale);
    const c = document.createElement('canvas');
    c.width = this.mapCanvas.width;
    c.height = this.mapCanvas.height;
    const g = c.getContext('2d')!;
    g.drawImage(this.mapCanvas, 0, 0);
    const s = this.ctx.services;
    const mark = (p: THREE.Vector3, color: string, label: string) => {
      const x = mapToCanvas(p.x, scale);
      const y = mapToCanvas(p.z, scale);
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#000';
      g.font = 'bold 9px Arial';
      g.textAlign = 'center';
      g.fillText(label, x, y + 3);
    };
    const lm = s.city?.landmarks;
    if (lm) {
      mark(lm.safehouse, '#ffd6a5', 'H');
      mark(lm.dentingPainting, '#90e0ef', 'P');
      mark(lm.netaOffice, '#ffffff', 'N');
      for (const d of s.missions?.available() ?? []) mark(d.start({ landmarks: lm }), '#ff9f1c', '!');
    }
    for (const cow of s.animals?.cows ?? []) mark(cow.pos, '#f1ede4', 'C');
    const me = s.vehicles?.current?.position ?? s.player?.position;
    if (me) mark(me, '#ffd60a', 'P');
    if (this.waypoint) mark(this.waypoint, '#ff4d6d', 'W');
    holder.append(c);
    c.addEventListener('click', (e) => {
      const r = c.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * c.width / scale - HALF - 100;
      const z = ((e.clientY - r.top) / r.height) * c.height / scale - HALF - 100;
      this.waypoint = new THREE.Vector3(x, 0, z);
      audio.beep(990, 0.05);
      this.render();
    });
  }

  private onClick(e: MouseEvent): void {
    const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t) return;
    const d = t.dataset;
    const st = this.ctx.store.getState();
    if (d.app) this.app = d.app as App;
    if (d.back !== undefined) this.app = 'home';
    if (d.chat) {
      this.app = 'chat';
      this.chatId = d.chat;
    }
    if (d.reply) this.messages.get(d.reply)!.push({ from: 'Pappu', text: d.reply === 'family' ? 'Haan mummy, kha liya. 🙏' : 'Haan.' });
    if (d.call) {
      audio.ring();
      const kind = d.call as keyof typeof CALL_LINES;
      this.mechanicOpen = kind === 'mechanic';
      const who = CONTACTS.find((c) => c.kind === kind)!.name;
      setTimeout(() => showSubtitle(pickLine(CALL_LINES[kind], this.profanity), who, 4.5), 900);
    }
    if (d.deliver) this.deliver(d.deliver);
    if (d.sell !== undefined) {
      this.junk.splice(Number(d.sell), 1);
      st.setPlayer({ money: st.player.money + 20 });
      audio.beep(1320, 0.08);
    }
    this.render();
  }

  /** Raju Mechanic drops one of your unlocked vehicles on the nearest road. */
  private deliver(id: string): void {
    const st = this.ctx.store.getState();
    const s = this.ctx.services;
    if (st.player.money < 500) return showSubtitle('Pehle ₹500 lao, phir gaadi.', 'Raju Mechanic');
    const p = s.player?.position;
    if (!p || !s.vehicles) return;
    st.setPlayer({ money: st.player.money - 500 });
    const spot = p.clone().add(new THREE.Vector3(3, 1.2, 3));
    s.vehicles.spawn(id, spot, s.player!.heading);
    showSubtitle(`${VEHICLES[id]?.name ?? id} aa gayi. Chaabi ke saath. Mostly.`, 'Raju Mechanic');
    this.mechanicOpen = false;
  }
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

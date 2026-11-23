/** Speedo, vehicle health and fare meter, bottom-right while driving. */
export interface VehicleHudData {
  name: string;
  kmh: number;
  health: number; // 0..1
  meter?: { running: boolean; tampered: boolean; fare: number };
}

let root: HTMLDivElement | null = null;

export function updateVehicleHud(data: VehicleHudData | null): void {
  if (!root) {
    root = document.createElement('div');
    root.className = 'vehicle-hud';
    document.getElementById('overlay')!.append(root);
  }
  if (!data) {
    root.style.display = 'none';
    return;
  }
  root.style.display = 'block';
  const hp = Math.round(data.health * 100);
  const color = hp > 60 ? '#4caf50' : hp > 25 ? '#ffb300' : '#e53935';
  const meter = data.meter
    ? `<div class="vh-meter ${data.meter.tampered ? 'tampered' : ''}">METER ${data.meter.running ? 'DOWN' : 'UP'} · ₹${data.meter.fare}${
        data.meter.tampered ? ' · ⚡FAST' : ''
      }</div>`
    : '';
  root.innerHTML = `<div class="vh-name">${data.name}</div>
    <div class="vh-speed">${Math.round(data.kmh)}<span> km/h</span></div>
    <div class="vh-bar"><div style="width:${hp}%;background:${color}"></div></div>${meter}`;
}

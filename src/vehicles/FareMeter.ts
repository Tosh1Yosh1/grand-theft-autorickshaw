/** The auto's fare meter. ₹26 flag-down + per-km. Tampering triples the rate (and the risk). */
export class FareMeter {
  running = false;
  tampered = false;
  distance = 0; // metres since flag-down
  static readonly BASE = 26;
  static readonly PER_KM = 17;

  get fare(): number {
    if (!this.running) return 0;
    const km = this.distance / 1000;
    return Math.round(FareMeter.BASE + km * FareMeter.PER_KM * (this.tampered ? 3 : 1));
  }

  flagDown(): void {
    this.running = true;
    this.distance = 0;
  }

  stop(): number {
    const f = this.fare;
    this.running = false;
    this.distance = 0;
    return f;
  }

  tick(metres: number): void {
    if (this.running) this.distance += metres;
  }
}

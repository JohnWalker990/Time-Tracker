export function generateNewId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function extractTrackerId(text: string): string | null {
  const regex = /<!--\s*tracker-id:\s*(\S+)\s*-->/;
  const match = regex.exec(text);
  return match ? match[1] : null;
}

export function parseTimeToMinutes(timestr: string): number {
  if (!timestr || !timestr.includes(':')) return 0;
  const [h, m] = timestr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

export function formatMinutesAsHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m < 10 ? '0' + m : m}`;
}

export function calculateDiffInMinutes(start: string, end: string, round?: boolean): number {
  let startM = parseTimeToMinutes(start);
  let endM = parseTimeToMinutes(end);
  if (endM < startM) {
    endM += 24 * 60;
  }
  let diff = endM - startM;
  if (diff < 0) diff = 0;
  if (round) {
    const quarter = 15;
    diff = Math.round(diff / quarter) * quarter;
  }
  return diff;
}

export function isDateInRange(date: string, start: string, end: string): boolean {
  if (!date) return false;
  const d = new Date(date);
  const s = new Date(start);
  const e = new Date(end);
  return d >= s && d <= e;
}

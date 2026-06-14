export function formatTime(time: number): string {
  if (!Number.isFinite(time)) {
    return '0:00.000';
  }

  const minutes = Math.floor(time / 60);
  const seconds = time - minutes * 60;

  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}

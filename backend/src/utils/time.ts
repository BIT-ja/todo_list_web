const EAST_8_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function nowInEast8() {
  const date = new Date(Date.now() + EAST_8_OFFSET_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

// Leaflet tooltips and icons take HTML strings. Anything that comes from the plan (names, modes, durations) can be written by
// other devices, an AI agent or an invited friend, so it is escaped before it goes into such a string.
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

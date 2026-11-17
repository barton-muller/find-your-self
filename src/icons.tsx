export type IconName =
  | 'plane' | 'train' | 'bus' | 'boat' | 'car' | 'bike' | 'walk' | 'arrow' | 'moon'
  | 'list' | 'map' | 'timeline' | 'settings' | 'check' | 'sync' | 'alert' | 'fork' | 'plus' | 'x' | 'cloud' | 'minus' | 'up' | 'down' | 'reorder' | 'undo' | 'redo' | 'locate' | 'todo' | 'bed' | 'download' | 'bolt' | 'fit' | 'sun' | 'rain' | 'flag' | 'pin' | 'branch' | 'help' | 'book' | 'calendar' | 'upload' | 'copy' | 'trash' | 'lock' | 'repo' | 'archive';

const P: Record<IconName, string> = {
  plane: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  train: 'M7 3h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2zM5 11h14M8 21l2-3M16 21l-2-3M8.5 14.5h.01M15.5 14.5h.01',
  bus: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h11.7a2 2 0 0 1 1.7.9l2.9 4.4a2 2 0 0 1 .3 1V15a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 15zM3 10.5h18.2M8.5 5v5.5M14 5v5.5M5.5 17.5a2 2 0 1 0 4 0 2 2 0 0 0-4 0M14.5 17.5a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  boat: 'M2 17l2 3h16l2-3zM12 3v11M12 4l6 9h-6M12 8l-5 5h5',
  car: 'M4 17v-5l2-5h12l2 5v5zM4 12h16M7 17v2M17 17v2M7.5 14.5h.01M16.5 14.5h.01',
  bike: 'M3 17a3 3 0 1 0 6 0 3 3 0 1 0-6 0M15 17a3 3 0 1 0 6 0 3 3 0 1 0-6 0M6 17l4-7h5l3 7M10 10 8 7H6',
  walk: 'M12 5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M13 8l-2 5 3 3v5M11 13l-3 1M13 8l3 3 3 1M14 16l-2 5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  timeline: 'M6.3 4a1.7 1.7 0 1 0 3.4 0 1.7 1.7 0 1 0-3.4 0M6.3 12a1.7 1.7 0 1 0 3.4 0 1.7 1.7 0 1 0-3.4 0M14.3 16a1.7 1.7 0 1 0 3.4 0 1.7 1.7 0 1 0-3.4 0M6.3 20a1.7 1.7 0 1 0 3.4 0 1.7 1.7 0 1 0-3.4 0M8 5.7V10.3M8 13.7V18.3M9.7 12.3C13.5 12.3 16 12.5 16 14.3M16 17.7C16 19.8 12.5 20 9.7 20',
  settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13',
  locate: 'M12 2v3M12 19v3M2 12h3M19 12h3M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0',
  todo: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  bed: 'M3 19V6M3 13h18v6M21 13v-2a3 3 0 0 0-3-3h-7v5M7 10.5h.01',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  reorder: 'M8 9l4-4 4 4M8 15l4 4 4-4',
  check: 'M5 12l5 5L20 7',
  sync: 'M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2M18 2v4h-4M6 22v-4h4',
  alert: 'M12 4 22 21H2zM12 10v5M12 18h.01',
  fork: 'M12 21v-7M12 14 6 6M12 14l6-8M4 4h4M16 4h4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z',
  flag: 'M5 21V4M5 4h11l-2.5 4 2.5 4H5',
  pin: 'M12 21s-6.5-5.5-6.5-11a6.5 6.5 0 1 1 13 0c0 5.5-6.5 11-6.5 11zM9.5 10a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0',
  branch: 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9',
  help: 'M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0M9.6 9.3a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h13',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  copy: 'M8 8h11v12H8zM5 16V4h11',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  archive: 'M3 5h18v4H3zM5 9v10h14V9M10 13h4',
  repo: 'M4 6a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  sun: 'M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  rain: 'M7 14a4 4 0 0 1-.5-8A6 6 0 0 1 18 5a4.5 4.5 0 0 1-.5 9z',
};

export const rainDrops: Record<1 | 2 | 3, string> = {
  1: 'M12 17.5l-1.2 3.5',
  2: 'M9.5 17.5l-1.2 3.5M14.5 17.5l-1.2 3.5',
  3: 'M7.5 17.5l-1.2 3.5M12 17.5l-1.2 3.5M16.5 17.5l-1.2 3.5',
};

export const iconPath = (n: IconName) => P[n];

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`ic ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}

export const iconSvgString = (n: IconName, size = 14) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="${P[n]}"/></svg>`;

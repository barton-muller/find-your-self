export interface TransportOption {
  id: string;
  mode: string;
  duration: string;
  cost: string;
  notes: string;
  overnight: boolean;
  extraDays: number;
  booked?: boolean;
}

export interface Stop {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  nights: number;
  notes: string;
  days: string[];
  activeOut: string | null;
  accom?: string;
  accomBooked?: boolean;
  updatedAt: number;
  deleted?: boolean;
}

export interface Leg {
  id: string;
  from: string;
  to: string;
  options: TransportOption[];
  chosen: string | null;
  updatedAt: number;
  deleted?: boolean;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  due: string | null;
  updatedAt: number;
  deleted?: boolean;
}

export interface Plan {
  v: 1;
  start: string;
  end: string;
  metaUpdatedAt: number;
  startId: string;
  stops: Record<string, Stop>;
  legs: Record<string, Leg>;
  todos?: Record<string, Todo>;
}

export interface SyncConfig {
  token: string;
  repo: string;
  path: string;
  branch: string;
}

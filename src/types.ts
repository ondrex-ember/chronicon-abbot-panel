export interface Book {
  id: string;
  title: string;
  category: "history" | "innovation" | "conflict" | "local" | "special";
  unlockDay: number;
  icon: string;
  author: string;
  year: string;
  content: string;
  
  // English Translation fields
  titleEn: string;
  authorEn: string;
  contentEn: string;
}

export type CategoryType = "history" | "innovation" | "conflict" | "local" | "special";

export interface CategoryInfo {
  key: CategoryType;
  labelCs: string;
  labelEn: string;
  colorClass: string;
  bgClass: string;
}

export const CATEGORIES: Record<CategoryType, CategoryInfo> = {
  history: {
    key: "history",
    labelCs: "Historie",
    labelEn: "History",
    colorClass: "text-blue-400 border-blue-400/30",
    bgClass: "bg-blue-950/20"
  },
  innovation: {
    key: "innovation",
    labelCs: "Inovace",
    labelEn: "Innovation",
    colorClass: "text-emerald-400 border-monk-green/30",
    bgClass: "bg-emerald-950/20"
  },
  conflict: {
    key: "conflict",
    labelCs: "Konflikty",
    labelEn: "Conflicts",
    colorClass: "text-rose-400 border-red-500/30",
    bgClass: "bg-rose-950/20"
  },
  local: {
    key: "local",
    labelCs: "Praha & Čechy",
    labelEn: "Prague & Bohemia",
    colorClass: "text-amber-400 border-gold/30",
    bgClass: "bg-amber-950/20"
  },
  special: {
    key: "special",
    labelCs: "Speciální",
    labelEn: "Special",
    colorClass: "text-purple-400 border-purple-500/30",
    bgClass: "bg-purple-950/20"
  }
};

// --- CHRONICON Types ---

export interface ChroniconAbbot {
  name: string;
  mood: string;
  virtue: number;
  portrait: string | null;
  scrinium_open: boolean;
  message: string | null;
}

export interface ChroniconWeather {
  key: string;
  name: string;
  icon: string;
  desc: string;
  season: number;
  modifier_grain: number;
  modifier_wood: number;
}

export interface ChroniconTime {
  year: number;
  season: number;
  season_name: string;
  season_icon: string;
  day: number;
  total_tick: number;
  date_string: string;
}

export interface ChroniconActors {
  monastery: { mood: number; wealth: number; piety: number };
  vesnicane: { mood: number; stores: number };
  valach: { mood: number; herd: number };
  inkvizitor: { active: boolean; tension: number };
}

export interface ChroniconResources {
  grain: number;
  wood: number;
  grose: number;
  piety: number;
}

export interface ChronicleLog {
  id?: string;
  tick: number;
  day: number;
  season?: string;
  text: string;
  source: string; // 'local_events' | 'distant_events' | 'monastery_internal' | 'gm'
  source_label: string;
}

export interface ChroniconSnapshot {
  version: number;
  generated: string;
  valid_until: string;
  abbot: ChroniconAbbot;
  unlockFlag: string | null;
  weather: ChroniconWeather;
  time: ChroniconTime;
  actors: ChroniconActors;
  resources: ChroniconResources;
  chronicle: ChronicleLog[];
  chronicle_local: ChronicleLog[];
  chronicle_distant: ChronicleLog[];
  church_calendar: {
    day_of_year: number;
    season: string;
    season_icon: string;
    year: number;
    note: string | null;
  };
}

export interface GmInput {
  abbot_name: string;
  abbot_mood: string;
  abbot_virtue: number;
  abbot_portrait: string | null;
  scrinium_open: boolean;
  abbot_message: string | null;
  tension_modifier: number;
  event_inject: string | null;
  unlock_flag?: string | null;
}

export interface ChroniconEvent {
  id: string;
  text: string;
  source: string;
  source_label: string;
  conditions?: Record<string, any>;
  weight?: number;
}


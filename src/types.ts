/**
 * Schema evento canonico. OGNI fonte (Ticketmaster, RSS, custom, future) deve
 * produrre eventi in questa forma. Le differenze tra fonti si gestiscono
 * dentro l'adapter, mai a valle nella pipeline.
 */
export interface RawEvent {
  title: string;
  description: string;
  location: string;
  eventDate: string; // formato YYYY-MM-DD
  /** Categoria provvisoria assegnata dall'adapter; la pipeline la ricalcola con classify() */
  categoriaHint?: string;
  source: string;
  sourceType: SourceType;
  qualityScore: number; // 1-10, usato per ordinamento/fiducia
  price: string;
  eventUrl: string;
  provincia: string;
  mapsQuery: string;
  availabilityStatus: 'available' | 'soldout' | string;
  /** Segnale ad alta confidenza per la classificazione (es. Ticketmaster segment "Music") */
  isMusicSignal?: boolean;
}

/** Evento dopo classificazione: garantito avere una delle 3 categorie */
export interface ClassifiedEvent extends RawEvent {
  categoria: EventCategory;
}

export type SourceType =
  | 'ticketmaster'
  | 'vivaticket'
  | 'rss'
  | 'sagre'
  | 'nightlife'
  | 'custom'
  | 'html';

/** Tassonomia fissa a 3 categorie. Decisa una volta, usata ovunque. */
export const EVENT_CATEGORIES = ['concerti', 'eventi_serali', 'eventi_generali'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** Le 5 province della Campania — unico posto dove questa lista è definita */
export const CAMPANIA_PROVINCES = ['Napoli', 'Salerno', 'Caserta', 'Avellino', 'Benevento'] as const;
export type CampaniaProvince = (typeof CAMPANIA_PROVINCES)[number];

/**
 * Interfaccia che ogni fonte dati deve implementare. Aggiungere una nuova
 * fonte significa scrivere una funzione che rispetta questa firma — nessuna
 * altra parte della pipeline va toccata.
 */
export interface SourceAdapter {
  /** Nome leggibile, usato nei log e nel cron_log */
  readonly name: string;
  /** Esegue il fetch e restituisce eventi grezzi. Non deve mai lanciare eccezioni non gestite. */
  fetchEvents(env: Env, config: RuntimeConfig): Promise<RawEvent[]>;
}

/** Config runtime, unione di secrets Cloudflare + chiavi opzionali da Supabase app_config */
export interface RuntimeConfig {
  ticketmasterKey: string;
  vivaticketToken: string;
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  WORKER_SECRET: string;
  VAPID_PRIVATE_KEY_JWK: string;
  FIREBASE_SERVICE_ACCOUNT_JSON: string;
  TICKETMASTER_KEY?: string;
  VIVATICKET_TOKEN?: string;
}

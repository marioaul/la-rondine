# Rondine Worker v2

Riscrittura TypeScript del worker di ingestione eventi de La Rondine, con
architettura ad **adapter** per le fonti dati e una tassonomia a 3 categorie
(`concerti`, `eventi_serali`, `eventi_generali`) fissata fin dall'inizio.

## Perché questa riscrittura

La v1 (JavaScript puro, incollato a mano nel dashboard Cloudflare) ha
funzionato ma ha accumulato debito tecnico: tassonomia delle categorie
rifatta a metà lavoro, chiavi API salvate lato client, nessun test, nessun
versionamento. Questa v2 corregge tutto questo mantenendo Supabase e
Cloudflare Workers, che restano scelte valide.

## Architettura

```
src/
  types.ts          — schema evento canonico + interfaccia SourceAdapter
  classify.ts        — classificazione in una delle 3 categorie (testato)
  filter.ts           — filtro contenuti + vincolo geografico Campania (testato)
  pipeline.ts         — orchestrazione: adapter → classifica → dedup → filtro → upsert
  supabase.ts         — client REST minimale
  upsert.ts           — scrittura eventi su Supabase
  adapters/
    ticketmaster.ts   — fonte Ticketmaster Discovery API
    rss.ts             — fonti RSS (comuni, sagre, vita notturna)
  handlers/
    index.ts           — endpoint HTTP (/trigger, /status, /search, /cleanup)
  index.ts             — entry point: routing + cron
```

### Aggiungere una nuova fonte dati

1. Crea `src/adapters/nome-fonte.ts` che implementa `SourceAdapter`
   (vedi `ticketmaster.ts` come esempio più semplice, `rss.ts` per fonti
   multiple configurabili).
2. Aggiungila all'array `ADAPTERS` in `src/index.ts`.
3. Scrivi almeno un test se la fonte ha logica di parsing non banale.

Nessun'altra parte del codice va toccata: è il punto centrale di questa
architettura rispetto alla v1.

## Setup locale

```bash
npm install
cp .dev.vars.example .dev.vars   # poi compila con le tue chiavi
npm run dev                       # avvia il worker in locale con wrangler
```

## Test

```bash
npm test          # esegue tutti i test una volta
npm run test:watch # modalità watch durante lo sviluppo
npm run typecheck  # controllo tipi senza compilare
```

## Deploy

Manuale:
```bash
npx wrangler login       # una tantum
npm run deploy            # produzione
npm run deploy:staging    # ambiente di staging
```

Automatico: il workflow `.github/workflows/ci.yml` esegue test + typecheck
su ogni push/PR, e fa deploy automatico su `main` se i test passano. Serve
impostare il secret `CLOUDFLARE_API_TOKEN` nelle impostazioni del repository
GitHub (Settings → Secrets and variables → Actions).

## Secrets su Cloudflare

Le chiavi sensibili **non vanno mai** in `wrangler.toml` né in codice.
Si impostano con:

```bash
npx wrangler secret put SUPABASE_KEY
npx wrangler secret put WORKER_SECRET
npx wrangler secret put TICKETMASTER_KEY
npx wrangler secret put VIVATICKET_TOKEN
```

## Differenze rispetto alla v1

- Tassonomia a 3 categorie fissa dal primo commit, non un ripensamento a metà
- Chiavi solo lato server (Cloudflare secrets), mai in un pannello admin
  modificabile dal browser
- Ogni fonte dati è un modulo isolato dietro un'interfaccia comune
- Test unitari sulla logica critica (classificazione, filtro, normalizzazione
  provincia) — 23 test, tutti verificati prima della consegna
- CI/CD reale: niente più copia-incolla nel dashboard Cloudflare

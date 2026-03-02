# Mondzorg Planning MVP

Meertalig (Nederlands, English, Українська) planningssysteem voor preventieve mondzorg op locatie.

## Wat dit MVP doet
- Ouders melden kinderen online aan via `/`.
- Beheerder stelt beschikbare dagen en capaciteit in via `/admin`.
- Elke dag start planning altijd om `15:00`.
- Elke afspraak duurt altijd `30 minuten`.
- Boekingen worden automatisch in het eerstvolgende vrije slot gezet (aaneengesloten plannen).
- Voorkomt overlap en dubbele boeking van hetzelfde kind op dezelfde dag + locatie.
- Optionele bevestigingsmail via Resend API.

## Stack
- Node.js 24+
- Native `node:sqlite` (geen externe DB dependency)
- Vanille HTML/CSS/JS frontend

## Starten
1. Optioneel: zet variabelen uit `.env.example` in je shell.
2. Start server:

```bash
npm.cmd start
```

3. Open:
- Ouderportaal: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin`

## Belangrijke variabelen
- `ADMIN_KEY`: verplicht voor admin API (`x-admin-key` header).
- `RESEND_API_KEY` + `RESEND_FROM`: als deze gezet zijn, wordt echte mail verstuurd.
- Zonder mail-config logt het systeem alleen dat e-mail niet geconfigureerd is.

## API-overzicht
- `GET /api/public/days?location=Locatie%201`
- `POST /api/public/book`
- `GET /api/public/booking/:bookingRef`
- `GET /api/admin/days?location=Locatie%201` (admin key nodig)
- `POST /api/admin/days` (admin key nodig)
- `GET /api/admin/appointments?serviceDate=YYYY-MM-DD&location=...` (admin key nodig)

## Database schema
- `available_days`: beheert dag, locatie, capaciteit, actief/inactief.
- `appointments`: boekingen inclusief slot-index en tijdvenster.
- `schema_migrations`: houdt toegepaste migraties bij.

Migratiebestanden staan in `migrations/`. Databasebestand wordt automatisch aangemaakt in `data/planning.db`.

## Tests
```bash
npm.cmd test
```

Tests valideren de kern van de planning (slotselectie en vaste tijden).

## Productie (kort)
- Zet `ADMIN_KEY` op een sterke waarde.
- Draai achter een reverse proxy (Nginx/Caddy/Cloudflare Tunnel).
- Maak dagelijkse back-up van `data/planning.db`.

## Deploy naar Render (aanbevolen nu)
Dit project bevat al een `render.yaml` Blueprint.
Deze deploy gebruikt Docker (`Dockerfile`) met Node 24.

Belangrijk:
- De Render service mount een persistente disk op `/var/data`.
- De app leest daardoor productie-data uit `/var/data/planning.db` via `DATA_DIR=/var/data`.

Stappen:
1. Zet deze map in een Git-repo en push naar GitHub/GitLab/Bitbucket.
2. In Render Dashboard: `New` -> `Blueprint` -> selecteer je repo.
3. Laat Render `render.yaml` inlezen en maak de service aan.
4. Vul secrets in:
   - `ADMIN_KEY` (verplicht)
   - `RESEND_API_KEY` (optioneel)
   - `RESEND_FROM` (optioneel)
5. Deploy en open de Render URL.

Let op: voor persistent SQLite-opslag via disk is een betaald Render-plan nodig (`starter` of hoger).

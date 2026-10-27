# Technical
## Home Massage — Uma Devi (`home-massage-uma-devi`)

**Project:** home-massage-uma-devi  
**Version:** 0.1 (Living document)  
**Last updated:** 27 October 2026  

How the booking site is built. What it does is in [`Requirements.md`](Requirements.md). How the screens are drawn is in [`UI.md`](UI.md).

No application code exists yet. This document is the contract for the pages and the API.

---

## Table of contents

- [Modules](#modules)
- [Chosen stack](#chosen-stack)
- [Deployment](#deployment)
- [Time and the single calendar](#time-and-the-single-calendar)
- [Tables](#tables)
- [Seed](#seed)
- [REST API](#rest-api)
- [Pages](#pages)
- [Project layout](#project-layout)
- [Decisions still open](#decisions-still-open)

---

## Modules

One Node process. Three areas, one SQLite file, one therapist.

| # | Module | Code home | Who calls it |
| --- | --- | --- | --- |
| 1 | **Home** | Public read of practice, packages, techniques, benefits | Anyone |
| 2 | **Booking** | Availability and create-booking | Anyone |
| 3 | **Uma’s day** | Session, bookings, hours, blocks, package edits | Signed-in therapist |

There is no customer account, no payment service, no WebSocket, and no WhatsApp Business API. After a booking is stored, the browser opens a `wa.me` link. The server does not send that message.

---

## Chosen stack

The screens stay on UIkit. The server is one small process and one database file. A JVM, MongoDB, and a replica set are more than a single calendar needs.

| Layer | Choice |
| --- | --- |
| Pages | HTML files. No React, no Vite, no build step |
| UI | UIkit 3, files kept in `site/vendor/uikit/` |
| Page logic | One small script per page. `fetch` with `credentials: 'include'` |
| Server | Node.js 22 or newer, built-in `node:http` |
| Database | SQLite, built-in `node:sqlite`. File `data/uma_devi.sqlite` |
| Passwords | `scrypt` from `node:crypto`. No password package |
| Uma’s sign-in | HMAC-signed cookie. No session table and no Redis |
| Checks | Plain functions in the server. Indexes created when the file is opened |
| Deploy | That one process on the smallest VPS that stays on. Caddy, or the host’s proxy, for TLS |

Code layout:

```text
server/index.js     HTTP, static files, /api/v1
server/db.js        open SQLite, create tables, seed
server/slots.js     which starts are legal
server/auth.js      scrypt and the signed cookie
site/               HTML, app.css, page scripts, vendor/uikit
data/               the sqlite file, created on first run, not committed
```

Local dev is `node server/index.js`, then open `http://localhost:8090`. The same process serves the pages and the API. Port 8080 is left for other projects. `npm install` is only for the hosted database client.

---

## Deployment

The Git remote is `https://github.com/anemdhana/home-massage-uma-devi.git`. Vercel Hobby serves the pages from `public/` (built by `npm run build` from `site/`) and the API from `api/v1/[...path].js`. The region is Mumbai (`bom1`).

Vercel has no disk that keeps a SQLite file. Hosted bookings use Turso (libSQL, the same SQL). Local dev still uses `data/uma_devi.sqlite` and does not call Turso.

| Name | Where |
| --- | --- |
| `TURSO_DATABASE_URL` | Vercel, required |
| `TURSO_AUTH_TOKEN` | Vercel, required |
| `COOKIE_SECRET` | Vercel, required. A long random string |
| `ADMIN_PASSWORD` | Vercel, required before the first request. This is Uma’s sign-in password |

Local sign-in stays mobile `9959923543` and password `UmaD1027` until `ADMIN_PASSWORD` is set. On Vercel the seed uses `ADMIN_PASSWORD` and will not accept the local password.

The cookie is named `uma_session`. It is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. The value is a payload `{ "mobile", "exp" }` plus an HMAC from `COOKIE_SECRET`. `exp` is 14 days. Logout clears the cookie. The server accepts the cookie only when the signature matches and `exp` is still ahead. The site is same-origin, so the browser sends the cookie with no CORS setup.

Clock for “3 hours from now” and “today” is `Asia/Kolkata` on the server. The browser sends a date and a start time. It does not send a timezone. The server interprets both in `Asia/Kolkata`.

---

## Time and the single calendar

All public times are local clock times in `Asia/Kolkata`.

| Stored field | Meaning |
| --- | --- |
| `date` | `YYYY-MM-DD` |
| `start` | `HH:mm` when Uma arrives |
| `end` | `HH:mm` when the massage ends (start + package duration) |
| `startAt` | Instant of `date` + `start` |
| `occupiedUntilAt` | Instant of `end` plus the travel gap |

The customer sees `start` and `end`. The gap is not shown as part of the massage. It is why the next offered start is later.

A start is legal when all of these hold. The numbers are the working defaults from Requirements (lead 180 minutes, horizon 21 days, grid 30 minutes, gap 45 minutes, hours 09:00–19:00):

1. `start` is on the 30-minute grid (`09:00`, `09:30`, …).
2. That weekday is open, and `start` is at or after the day’s start, and `end` is at or before the day’s end.
3. `startAt` is at least 180 minutes after the server’s current instant.
4. `date` is today or later, and not after today + 21 days, in `Asia/Kolkata`.
5. The half-open range `[startAt, occupiedUntilAt)` does not intersect a block on that date, or a booking whose status is `HELD`, `CONFIRMED`, or `COMPLETED`.

Intersection of `[a, b)` and `[c, d)` is `a < d` and `c < b`. A visit that occupies until 18:45 may be followed by a start at 18:45.

Example from Requirements. Hours 09:00–19:00, duration 90, gap 45.

| Start | End | Occupied until | Offered |
| --- | --- | --- | --- |
| 16:30 | 18:00 | 18:45 | Yes, if the range is free |
| 17:00 | 18:30 | 19:15 | No, occupied until is after 19:00 |

`CANCELLED` bookings do not occupy time.

### Write path

`POST /bookings` runs in one SQLite write transaction (`BEGIN IMMEDIATE`, then `COMMIT`, or `ROLLBACK` on failure):

1. Load the package. It must exist and be `bookable`.
2. Copy `name`, `priceInr`, `durationMinutes`, and `audience` onto the booking. Later edits to the package do not rewrite this visit.
3. Load the current gap, lead, horizon, grid, and that weekday’s hours. Recompute `end`, `startAt`, and `occupiedUntilAt`. Reject with `400` if the start is illegal for hours, lead, horizon, or grid.
4. Query occupied bookings and blocks that intersect `[startAt, occupiedUntilAt)`. Reject with `409` `SLOT_TAKEN` if any row matches.
5. Insert the booking as `HELD` with a new `reference`.
6. Commit.

The confirm button is disabled while the request runs, so a double click does not open two transactions for the same tap. `BEGIN IMMEDIATE` takes the write lock, so two customers who pass step 4 at the same moment are ordered. The second waits, then sees the first row and gets `409`.

### What a later edit does to old rows

| Uma changes | Effect on an existing booking | Effect on new availability |
| --- | --- | --- |
| Price or duration of a package | Unchanged. The row keeps its snapshot | New visits use the new duration and price |
| Travel gap | Unchanged. `occupiedUntilAt` stays | New visits use the new gap against stored occupied ranges |
| Weekly hours | The visit stays on the list even if it now falls outside hours | New starts follow the new hours. The old visit still blocks its range |
| A block on top of a visit | The visit is not cancelled | She is shown the references that sit inside the new block, and she cancels them herself if she wants the hour free |

---

## Tables

SQLite file `data/uma_devi.sqlite`. List fields (`highlights`, `techniques`, `benefits`, `includes`) are JSON text in the column. The API still returns them as arrays. Instants are ISO-8601 text.

### `practice` (one row, id `practice`)

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Home Massage Service |
| `line` | string | Relaxation delivered to your doorstep |
| `therapist` | string | Uma Devi |
| `city` | string | Hyderabad |
| `experienceLine` | string | Poster line about 2 years |
| `phoneDisplay` | string | `+91 9959923543` |
| `phoneTel` | string | `+919959923543` |
| `whatsappE164` | string | `919959923543` (no plus; used in `wa.me`) |
| `instagram` | string | `uma_devi1601` |
| `highlights` | array | Four `{ "icon", "label" }` rows |
| `techniques` | string[] | Poster list, not bookable |
| `benefits` | string[] | Poster list |
| `enquireNote` | string | Other couple combinations |
| `timezone` | string | `Asia/Kolkata` |
| `leadMinutes` | int | 180 |
| `horizonDays` | int | 21 |
| `slotMinutes` | int | 30 |
| `travelGapMinutes` | int | 45 |
| `currency` | string | `INR` |

Public `GET /practice` returns the display fields and the four rule numbers the calendar needs (`leadMinutes`, `horizonDays`, `slotMinutes`, `timezone`). It does not return a password or a session.

### `week_hours` (seven rows)

The API still returns one object with a `days` array. The table stores one row per weekday, Monday first.

```json
{
  "id": "week",
  "days": [
    { "day": "MON", "open": true, "start": "09:00", "end": "19:00" }
  ]
}
```

`day` is `MON` `TUE` `WED` `THU` `FRI` `SAT` `SUN`. When `open` is false, `start` and `end` are null. `end` is exclusive as a clock limit: a visit may end at `19:00` and may not end at `19:01`.

### `blocks`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `date` | string | `YYYY-MM-DD` |
| `start` | string | `HH:mm` |
| `end` | string | `HH:mm`, after `start`, same date |
| `note` | string | Optional. Leave, or already promised |

A block occupies `[date+start, date+end)`. It does not add a travel gap of its own.

### `packages`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable. Seed ids `P1` `P2` `P3` `P4` `C1` `C2` |
| `name` | string | |
| `includes` | string[] | Empty for C1 and C2 until Uma types them |
| `priceInr` | int | Whole rupees |
| `durationMinutes` | int | 90 or 105 in the seed |
| `audience` | string | `individual` or `couple` |
| `bookable` | bool | False hides it from booking and shows no Book button |
| `sort` | int | Home and step 1 order |

### `bookings`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `reference` | string | Unique. `UD` plus 4 Crockford base32 characters (`0-9`, `A-H`, `J-K`, `M-N`, `P-T`, `V-Z`). Example `UD7K2P` |
| `packageId` | string | |
| `packageName` | string | Snapshot |
| `priceInr` | int | Snapshot |
| `durationMinutes` | int | Snapshot |
| `audience` | string | Snapshot |
| `date` | string | |
| `start` | string | |
| `end` | string | |
| `startAt` | instant | |
| `occupiedUntilAt` | instant | |
| `customerName` | string | |
| `mobile` | string | 10 digits, first digit 6–9 |
| `whatsappSame` | bool | |
| `whatsappMobile` | string | Same as `mobile` when `whatsappSame` is true, otherwise the other 10-digit number |
| `locality` | string | |
| `address` | string | |
| `landmark` | string | Optional |
| `note` | string | Optional |
| `secondName` | string | Required when `audience` is `couple`, otherwise null |
| `status` | string | `HELD` `CONFIRMED` `COMPLETED` `CANCELLED` |
| `createdAt` | instant | |
| `updatedAt` | instant | |

Indexes:

| Keys | Purpose |
| --- | --- |
| `reference` unique | Lookup and the success panel |
| `status`, `startAt` | Uma’s lists |
| `startAt`, `occupiedUntilAt` | Overlap query |
| `date` | Today filter |

### `users`

One therapist row in the first version.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `uma` |
| `mobile` | string | `9959923543` |
| `name` | string | Uma Devi |
| `passwordHash` | string | scrypt from `node:crypto` |
| `role` | string | `therapist` |

There is no public registration. The seed script inserts this row.

### Status

| From | To | Who | Slot |
| --- | --- | --- | --- |
| — | `HELD` | Customer submit | Occupies |
| `HELD` | `CONFIRMED` | Uma | Occupies |
| `HELD` | `COMPLETED` | Uma | Occupies |
| `HELD` | `CANCELLED` | Uma | Free |
| `CONFIRMED` | `COMPLETED` | Uma | Occupies |
| `CONFIRMED` | `CANCELLED` | Uma | Free |
| `COMPLETED` | — | | Stays |
| `CANCELLED` | — | | Stays |

Any other transition is `409` `STATUS`.

### Field checks on create

| Field | Rule |
| --- | --- |
| `customerName` | Trimmed, 2–80 characters |
| `mobile` | `^[6-9][0-9]{9}$` |
| `whatsappMobile` | Same pattern, required when `whatsappSame` is false |
| `locality` | Trimmed, 2–80 |
| `address` | Trimmed, 8–300 |
| `landmark` | 0–120 |
| `note` | 0–400 |
| `secondName` | Required, 2–80, only for `couple` |
| `packageId` | Known and `bookable` |
| `date`, `start` | Legal start, as above |

Messages name the field. The UI prints one line under that field.

---

## Seed

`server/db.js` inserts practice, week hours, packages, and the user when those tables are empty. First run of `node server/index.js` does this. There is no separate seed command.

Packages, prices in rupees, durations in minutes:

| Id | Name | Includes | Price | Minutes | Audience |
| --- | --- | --- | --- | --- | --- |
| P1 | Package I – Swedish | Head, face, and foot massage | 1500 | 90 | individual |
| P2 | Package II | Face, foot, deep tissue, and head, neck and shoulder | 1500 | 90 | individual |
| P3 | Package III – Swedish Special | Swedish, face, body polishing, and foot massage | 2000 | 105 | individual |
| P4 | Package IV – Deep Tissue Special | Deep tissue, face, body polishing, and foot massage | 2200 | 105 | individual |
| C1 | Package I (Couple) | *(empty until Uma writes them)* | 2500 | 90 | couple |
| C2 | Package II (Couple) | *(empty until Uma writes them)* | 2500 | 90 | couple |

Local sign-in, replaced before any public deploy: mobile `9959923543`, password `UmaD1027`.

Highlights, techniques, benefits, phone, and Instagram are the poster values in [`Requirements.md`](Requirements.md).

---

## REST API

Base path: `/api/v1`  
Body: JSON  
Auth: the signed `uma_session` cookie on the Uma routes. Public routes need no cookie.

### Conventions

| Item | Rule |
| --- | --- |
| Success | `{ "data": ... }` |
| List | `{ "data": [ ... ], "page": 1, "pageSize": 20, "total": 0 }` |
| Error | `{ "error": { "code": "SLOT_TAKEN", "message": "That time was just taken.", "field": null } }` |
| Dates | `YYYY-MM-DD` |
| Clock times | `HH:mm`, 24-hour, `Asia/Kolkata` |
| Money | Integer rupees |
| Mobile | 10 digits in JSON |

| HTTP | When |
| --- | --- |
| 400 | Validation, closed package, start outside the rules |
| 401 | Uma route without a session |
| 404 | Unknown id |
| 409 | Slot taken, or a status move that is not allowed |

| `error.code` | HTTP | When |
| --- | --- | --- |
| `VALIDATION` | 400 | A field failed. `field` is the property name |
| `PACKAGE_CLOSED` | 400 | Missing or not bookable |
| `OUTSIDE_HOURS` | 400 | Off the grid, closed day, or visit runs past the day’s end |
| `TOO_SOON` | 400 | Inside the lead time |
| `TOO_FAR` | 400 | Past the horizon |
| `SLOT_TAKEN` | 409 | Overlap with a booking or a block |
| `STATUS` | 409 | Status transition is not in the table |
| `UNAUTHORIZED` | 401 | No session |

### Shared shapes

**Package (public)**

```json
{
  "id": "P1",
  "name": "Package I – Swedish",
  "includes": ["Head, face, and foot massage"],
  "priceInr": 1500,
  "durationMinutes": 90,
  "audience": "individual",
  "bookable": true
}
```

**Practice (public)**

```json
{
  "name": "Home Massage Service",
  "line": "Relaxation delivered to your doorstep",
  "therapist": "Uma Devi",
  "city": "Hyderabad",
  "experienceLine": "2 years experience with excellent customer feedback",
  "phoneDisplay": "+91 9959923543",
  "phoneTel": "+919959923543",
  "whatsappE164": "919959923543",
  "instagram": "uma_devi1601",
  "highlights": [
    { "icon": "heart", "label": "Relax your body" },
    { "icon": "happy", "label": "Relieve stress" },
    { "icon": "future", "label": "Improve sleep" },
    { "icon": "star", "label": "Feel rejuvenated" }
  ],
  "techniques": ["Swedish massage"],
  "benefits": ["Deep relaxation"],
  "enquireNote": "Other couple package combinations are also available.",
  "timezone": "Asia/Kolkata",
  "leadMinutes": 180,
  "horizonDays": 21,
  "slotMinutes": 30
}
```

**Day of starts**

```json
{ "date": "2026-10-28", "bookable": true, "starts": ["09:00", "09:30", "16:30"] }
```

`bookable` is false when `starts` is empty. The payload has no other customer’s name, area, or address.

**Booking (Uma)** includes every stored field except nothing secret: there is no password on a booking. **Booking (customer create response)** returns `reference`, package snapshot, `date`, `start`, `end`, `locality`, `priceInr`, `status`, and the WhatsApp URL. It does not echo the full address back beyond what the customer just typed; the success panel already holds that in memory. The URL is still built on the client from the reference so the server stays a calendar, not a chat gateway.

WhatsApp text, built in the browser:

```text
Booking UD7K2P
Package I – Swedish
Tue 28 Oct 2026, 4:30 pm – 6:00 pm
Madhapur
```

Link: `https://wa.me/919959923543?text=` plus that text, URL-encoded. Clock display in the message is 12-hour with am/pm. The API values stay `HH:mm`.

### Public

#### `GET /practice`

`200` and the practice shape.

#### `GET /packages`

`200` and every package, bookable or not, ordered by `sort`. The home page hides Book when `bookable` is false. The booking step lists only `bookable: true`.

#### `GET /availability?packageId=P1&from=2026-10-27&to=2026-11-16`

`from` and `to` are inclusive. The server clamps the range to today through today + `horizonDays`. A range longer than that is trimmed, not rejected.

`200`

```json
{
  "data": {
    "packageId": "P1",
    "durationMinutes": 90,
    "days": [
      { "date": "2026-10-27", "bookable": true, "starts": ["16:30"] },
      { "date": "2026-10-28", "bookable": false, "starts": [] }
    ]
  }
}
```

`400` `PACKAGE_CLOSED` when the id is unknown or not bookable.

#### `POST /bookings`

```json
{
  "packageId": "P1",
  "date": "2026-10-28",
  "start": "16:30",
  "customerName": "Meera Rao",
  "mobile": "9848098765",
  "whatsappSame": true,
  "locality": "Madhapur",
  "address": "Flat 12, Lake View, Madhapur, Hyderabad",
  "landmark": "Opposite the park",
  "note": "Shoulder pain on the left"
}
```

Couple packages also send `secondName`. When `whatsappSame` is false, send `whatsappMobile`.

`201`

```json
{
  "data": {
    "reference": "UD7K2P",
    "status": "HELD",
    "packageName": "Package I – Swedish",
    "priceInr": 1500,
    "durationMinutes": 90,
    "date": "2026-10-28",
    "start": "16:30",
    "end": "18:00",
    "locality": "Madhapur"
  }
}
```

### Uma

#### `POST /auth/login`

```json
{ "mobile": "9959923543", "password": "UmaD1027" }
```

`200` sets `uma_session`.

```json
{ "data": { "mobile": "9959923543", "name": "Uma Devi", "role": "therapist", "home": "/uma" } }
```

Wrong password is `401` `UNAUTHORIZED` with message `That mobile or password does not match.` The body does not say which of the two failed.

#### `POST /auth/logout`

`200` `{ "data": { "ok": true } }`. Clears the cookie.

#### `GET /auth/me`

`200` with `mobile`, `name`, `role`. `401` when signed out.

#### `GET /admin/bookings?view=today&page=1&pageSize=20`

`view` is `today`, `upcoming`, or `past`.

| View | Rows | Order |
| --- | --- | --- |
| `today` | `date` is today in `Asia/Kolkata`, every status | `start` ascending |
| `upcoming` | `date` after today, status `HELD` or `CONFIRMED` | `startAt` ascending |
| `past` | `date` before today, every status | `startAt` descending |

List item: `id`, `reference`, `date`, `start`, `end`, `packageName`, `customerName`, `locality`, `status`, `priceInr`. Address and note stay off the list. They load with the single booking.

#### `GET /admin/bookings/{id}`

The full booking row, as JSON.

#### `POST /admin/bookings/{id}/status`

```json
{ "status": "CONFIRMED" }
```

`200` returns the booking. `409` `STATUS` when the move is not allowed. `CANCELLED` makes the range available on the next availability read.

#### `GET /admin/hours`

The seven `week_hours` rows, as the `days` array.

#### `PUT /admin/hours`

Replaces the seven days. Each open day needs `start` and `end`, `end` after `start`, both on the 30-minute grid. `200` returns the saved week.

#### `GET /admin/blocks?from=2026-10-27&to=2026-11-16`

Blocks in that inclusive date range, ordered by date then start.

#### `POST /admin/blocks`

```json
{ "date": "2026-11-02", "start": "14:00", "end": "19:00", "note": "Family visit" }
```

`201` returns the block plus `overlaps`: references of `HELD`, `CONFIRMED`, or `COMPLETED` bookings that intersect the block. Those bookings stay. The UI lists the references so Uma can cancel them.

#### `DELETE /admin/blocks/{id}`

`200` `{ "data": { "ok": true } }`.

#### `PUT /admin/packages/{id}`

```json
{
  "name": "Package I (Couple)",
  "includes": ["Swedish for two"],
  "priceInr": 2500,
  "durationMinutes": 90,
  "bookable": true
}
```

`audience` and `id` stay as seeded. `200` returns the package. Existing bookings keep their snapshots.

### Endpoint index

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/practice` | Public |
| GET | `/packages` | Public |
| GET | `/availability` | Public |
| POST | `/bookings` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/logout` | Session |
| GET | `/auth/me` | Session |
| GET | `/admin/bookings` | Therapist |
| GET | `/admin/bookings/{id}` | Therapist |
| POST | `/admin/bookings/{id}/status` | Therapist |
| GET | `/admin/hours` | Therapist |
| PUT | `/admin/hours` | Therapist |
| GET | `/admin/blocks` | Therapist |
| POST | `/admin/blocks` | Therapist |
| DELETE | `/admin/blocks/{id}` | Therapist |
| PUT | `/admin/packages/{id}` | Therapist |

---

## Pages

The Node process serves these files from `site/`. A path with no file extension maps to the HTML file.

| Path | File | Cookie |
| --- | --- | --- |
| `/` | `site/index.html` | No |
| `/book` | `site/book.html` | No. `?package=P1` pre-selects step 1 |
| `/book/done` | `site/done.html` | No. The create response is in `sessionStorage` under `uma_devi_done`. A refresh with that key missing returns to `/book` |
| `/uma/login` | `site/login.html` | No |
| `/uma` | `site/uma.html` | Therapist |
| `/uma/hours` | `site/hours.html` | Therapist |
| `/uma/packages` | `site/packages.html` | Therapist |

A therapist page calls `GET /auth/me` first. On `401` it goes to `/uma/login`. Customers never see a link to `/uma` in the public header. Uma’s bookmark is the way in.

Each HTML file links `vendor/uikit/css/uikit.min.css`, `vendor/uikit/js/uikit.min.js`, `vendor/uikit/js/uikit-icons.min.js`, and `app.css`.

Availability for the open horizon is fetched when the customer enters the date step, and again when they enter the time step, so a slot taken while they were typing is already gone. Create still rechecks. On `409` `SLOT_TAKEN` the wizard returns to the time step, reloads starts, and shows `uk-alert-danger`: “That time was just taken.”

There is no mock mode and no second frontend. Local dev is the same server and the same SQLite file.

---

## Project layout

```text
docs/Requirements.md
docs/Technical.md             this document
docs/UI.md
docs/assets/home_massage_uma_devi.jpeg
site/                         HTML, app.css, page scripts, vendor/uikit
server/                       Node API
data/uma_devi.sqlite          created on first run
```

---

## Decisions still open

These match the open questions in Requirements. The defaults in this document are what the first build uses until they change.

| Topic | Default in this document |
| --- | --- |
| Hours | 09:00–19:00, all seven days |
| Travel gap | 45 minutes |
| Lead and horizon | 180 minutes, 21 days |
| On submit | `HELD`, Uma confirms |
| Payment | None in the API |
| Couple inclusions | Empty `includes` until she edits C1 and C2 |
| Area | Free text locality and address. No locality table, no fee |
| Customer cancel | Not an endpoint. Uma sets `CANCELLED` |

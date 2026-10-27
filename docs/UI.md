# UI
## Home Massage — Uma Devi (`home-massage-uma-devi`)

**Project:** home-massage-uma-devi  
**Version:** 0.1 (Living document)  
**Last updated:** 27 October 2026  

How each screen is drawn with UIkit 3. What the product does is in [`Requirements.md`](Requirements.md). Data, slots, and routes are in [`Technical.md`](Technical.md).

The poster at `docs/assets/home_massage_uma_devi.jpeg` is the source of the words, prices, and phone number. It is not the layout. The site is a quiet appointment app: paper background, ink, one burgundy accent, and UIkit components.

The layout pages are in `site/`. They follow this file. Nothing is saved yet: there is no server and no database.

---

## Table of contents

- [Screen log](#screen-log)
- [Colour, type, and motion](#colour-type-and-motion)
- [How every page is built](#how-every-page-is-built)
- [Screen 1 — Home](#screen-1--home)
- [Screen 2 — Book](#screen-2--book)
- [Screen 3 — Sign in](#screen-3--sign-in)
- [Screen 4 — Bookings](#screen-4--bookings)
- [Screen 5 — Hours](#screen-5--hours)
- [Screen 6 — Packages](#screen-6--packages)
- [What to reach for](#what-to-reach-for)
- [Leave these alone](#leave-these-alone)
- [Choices that keep coming up](#choices-that-keep-coming-up)
- [Details that are easy to get wrong](#details-that-are-easy-to-get-wrong)
- [File map](#file-map)

---

## Screen log

| # | Screen | Path | Who | UIkit pieces |
| --- | --- | --- | --- | --- |
| 1 | Home | `/` | Customer | navbar, offcanvas, section, grid, card, icon, list, button, scrollspy |
| 2 | Book | `/book` | Customer | switcher, progress, subnav, button, grid, form, description list, modal, alert, notification, sticky |
| 3 | Received | `/book/done` | Customer | section, card, button, notification |
| 4 | Sign in | `/uma/login` | Uma | form, alert |
| 5 | Bookings | `/uma` | Uma | subnav, table, label, modal, placeholder, offcanvas |
| 6 | Hours | `/uma/hours` | Uma | form, subnav, table, modal |
| 7 | Packages | `/uma/packages` | Uma | table, modal, form, subnav |

Public header links are Home, Services, Book. Services scrolls to `#services` on the home page. Book goes to `/book`. The public header has no sign-in link.

Uma’s header is a separate bar: wordmark as text, then Bookings, Hours, Packages, and Sign out. Under 960 pixels those four items move into offcanvas. Customers do not see this bar.

---

## Colour, type, and motion

Tokens live in `app.css`. UIkit’s stylesheet loads first. `app.css` only replaces the primary button, the page background, and a few measures. It does not restyle `button` or `input` without a `uk-` class.

| Token | Value | Where |
| --- | --- | --- |
| `--paper` | `#faf7f5` | Page background |
| `--ink` | `#2b2424` | Text |
| `--muted` | `#8a7e7a` | Hints, meta |
| `--line` | `#efe6e2` | Card and header hairline |
| `--card` | `#ffffff` | Cards |
| `--accent` | `#8d3a4a` | Primary button, selected package, selected day, selected slot |
| `--on-accent` | `#ffffff` | Label on the accent |

`uk-button-primary` uses `--accent` and `--on-accent`. `uk-button-default` stays white with `--line` as the border. Selected and primary are the same filled button, so a chosen slot looks like the action the customer is about to take.

Type is UIkit’s default. The words “Uma Devi” on the home page use a system serif (`Iowan Old Style`, `Palatino`, `Palatino Linotype`, `Georgia`). No webfont. Every other string stays in the UI font.

| Measure | Value |
| --- | --- |
| Header height | 64 pixels, white, 1 pixel `--line` along the bottom |
| Phone column | 440 pixels, class `app-column`, centred |
| Booking column | 560 pixels from 960 pixels up, class `app-narrow` |
| Home width | UIkit container |
| Tap target | At least 44 pixels |
| Breakpoint | 960 pixels, the `m` breakpoint in the markup below |

Icons are UIkit icons at `ratio: 0.9` beside a label. A field does not get an icon to look finished.

Motion, each one once:

| Moment | Class or attribute |
| --- | --- |
| Home title | `uk-animation-fade` |
| Package cards | `uk-scrollspy="cls: uk-animation-slide-bottom-small; delay: 60; repeat: false"` |
| Wizard step change | Switcher content fades |
| Progress | `<progress class="uk-progress">` value follows the step |
| Selected card, day, or slot | Background transitions to `--accent` in about 160ms |
| Booking received | `uk-animation-scale-up` on the check icon, then `UIkit.notification` “Booking received.” |

```css
@media (prefers-reduced-motion: reduce) {
  .uk-animation-fade,
  .uk-animation-slide-bottom-small,
  .uk-animation-scale-up {
    animation: none !important;
  }
}
```

When that media query matches, do not set `uk-scrollspy`. Parallax, slideshow, slider, and marquee are not used.

---

## How every page is built

Load UIkit CSS, UIkit JS, then the icon script, then `app.css`, from `site/vendor/uikit/` and `site/app.css`. The same four links go on every page. There is no bundler.

Every screen:

- One job. The title, the fields for that step, and one primary button.
- Labels above fields (`uk-form-stacked`). A real `<label>` for every input.
- `type="button"` on buttons that must not submit.
- Under 960 pixels the primary button is `uk-button uk-button-primary uk-width-1-1`.
- Help is one short line in `uk-text-meta`, or it is left out.
- Status is a word inside `uk-label`, not colour alone.
- Custom classes (`app-header`, `app-column`, `app-narrow`, `is-selected`) sit beside `uk-` classes. They do not replace them.

The booking primary button has one home. Under 960 pixels it lives in a [Sticky](https://getuikit.com/docs/sticky) bar at the bottom (`uk-hidden@m` on the bar, the in-card button hidden with `uk-visible@m`). From 960 pixels up, the button sits in the card and the bar is absent. Back is never in that bar. Back is a `uk-button-text` with `chevron-left`, in the step line, on the left. On step 1 the back control is `uk-invisible` so the step title stays centred.

Empty lists use [Placeholder](https://getuikit.com/docs/placeholder). A save uses [Spinner](https://getuikit.com/docs/spinner) inside the primary button and disables it. A field error is one line under the field. [Alert](https://getuikit.com/docs/alert) `uk-alert-danger` is for a failure of the whole step, such as `SLOT_TAKEN`.

---

## Screen 1 — Home

**Path:** `/`  
**File:** `site/index.html`

**What the page shows**

1. Header.
2. Name, line, city, experience, one Book button.
3. Four highlights.
4. `#services`: individual packages, then couple packages, then the enquire line.
5. Techniques and benefits.
6. Contact.

**Header**

[Navbar](https://getuikit.com/docs/navbar) inside `.app-header`, `uk-navbar="mode: click"`. Left: “Uma Devi” as a link to `/`. Right, from 960 pixels: Home (`/`), Services (`/#services`), Book (`/book`) as `uk-button uk-button-primary uk-button-small`. Under 960 pixels: one `menu` icon button, `uk-navbar-toggle-icon`, opening [Off-canvas](https://getuikit.com/docs/offcanvas) `flip: true` with [Nav](https://getuikit.com/docs/nav) items Home, Services, Book. Overlay mode. Escape and a tap on the overlay close it.

**Opening block** (`uk-section uk-section-small`)

| Piece | Draw as |
| --- | --- |
| Practice name | `uk-h1`, system serif, class `app-wordmark` |
| Line | `uk-text-lead`, one sentence |
| City and experience | `uk-text-meta`, one line: Hyderabad · 2 years experience with excellent customer feedback |
| Book | `uk-button uk-button-primary`, links to `/book` |

The portrait is optional. If it is used, it is one square crop, about 96 pixels, to the left of the name on screens from 960 pixels up, and omitted under 960 pixels. No candle still, no floral frame.

**Highlights**

`uk-grid uk-child-width-1-2 uk-child-width-1-4@m uk-grid-small`, icons from `practice.highlights`:

| Icon | Label |
| --- | --- |
| `heart` | Relax your body |
| `happy` | Relieve stress |
| `future` | Improve sleep |
| `star` | Feel rejuvenated |

Icon above the label, both centred, `uk-text-small`. No circles behind the icons.

**Packages**

Section title `uk-h2` “Services”. A `uk-text-meta` line “Individual” then a grid `uk-child-width-1-1 uk-child-width-1-2@m`. Each package is `uk-card uk-card-default uk-card-body`:

| In the card | Element |
| --- | --- |
| Name | `uk-h3` |
| Includes | `uk-text-small`, one line. Omit the line when `includes` is empty (couple packages until Uma writes them) |
| Duration and price | `uk-text-meta` for duration (`90 min` or `1 hr 45 min`), price as `uk-h3` `₹1500` |
| Book | `uk-button uk-button-default` linking to `/book?package=P1` |

Then `uk-text-meta` “Couple”, the same card grid for C1 and C2. Under the grid, the enquire note in `uk-text-small` and a `uk-button uk-button-text` “Enquire on WhatsApp” to `https://wa.me/919959923543`. That button does not go to `/book`.

Cards do not use `uk-card-hover`. Selection happens on the booking step, not by lifting the card.

**Techniques and benefits**

Two `uk-list uk-list-divider` columns inside `uk-grid uk-child-width-1-1 uk-child-width-1-2@m`. Titles `uk-h3` “Techniques” and “Benefits”. Text only. These lists are not buttons.

**Contact**

One row, `uk-flex uk-flex-wrap uk-flex-middle`. Three text buttons with icons: `receiver` Phone, `whatsapp` WhatsApp, `instagram` Instagram. Phone is `tel:+919959923543`. WhatsApp is `https://wa.me/919959923543`. Instagram is `https://instagram.com/uma_devi1601`. Under them, `uk-text-meta`: Book your doorstep massage today!

---

## Screen 2 — Book

**Path:** `/book`  
**Column:** `app-column`, and `app-narrow` from 960 pixels up.

The five steps are a [Switcher](https://getuikit.com/docs/switcher) with `swiping: false`. The tab list is `uk-hidden`. The first panel and the first nav item have `uk-active` so step 1 is visible before the script runs.

Above the card:

| Piece | Draw as |
| --- | --- |
| Back | `uk-button-text` + `chevron-left`. `uk-invisible` on step 1 |
| Step line | `uk-text-small` “Step 2 of 5 · Date” |
| Progress | `<progress class="uk-progress" value="2" max="5">` with an accessible name “Step 2 of 5” |

One white card, `uk-card uk-card-default uk-card-body`. Do not nest a card inside it.

`?package=P1` opens step 1 with that package already selected when it is bookable. An unknown or closed id ignores the query.

### Step 1 — Package

| Control | UIkit | Notes |
| --- | --- | --- |
| Individual / Couple | `uk-subnav uk-subnav-pill` | `uk-active` on Individual at open. Shows every option |
| Package | A button that looks like a card row | Name, duration, price. The chosen row gets `is-selected` (accent fill, white text) |
| Continue | `uk-button-primary` | Disabled until one package is chosen |

Couple rows with empty `includes` show name, duration, and price only.

### Step 2 — Date

Fetched from `GET /availability` for the selected package, from today through the horizon.

**Under 960 pixels — a week**

| Control | UIkit |
| --- | --- |
| Previous week | `uk-icon="chevron-left"` button. Disabled on the week that contains today |
| Week label | `uk-text-small`, for example “27 Oct – 2 Nov” |
| Next week | `chevron-right`. Disabled when the week is past the horizon |
| Seven days | `uk-grid uk-child-width-1-7`. Each is `uk-button uk-button-small`. The label is the weekday initial and the date number |

Monday is the first column. A day with no starts is `uk-disabled`. A day before today is `uk-disabled`. The selected day is `uk-button-primary`. Today, when not selected, uses `uk-text-bold`.

**From 960 pixels — a month**

Same chevrons, label “October 2026”. A grid of day buttons, Monday first. Days from the adjacent months are `uk-disabled` and keep the grid rectangular. Unavailable days inside the month stay visible and `uk-disabled`.

The button’s accessible name is the full date plus “unavailable” when it cannot be chosen. Continue stays disabled until a bookable day is chosen.

### Step 3 — Time

Reload availability when this step opens.

`uk-grid uk-grid-small uk-child-width-1-2 uk-child-width-1-3@s`. Each start is a `uk-button`. The label is 12-hour (`4:30 pm`). The value posted to the API is `HH:mm`. The selected start is `uk-button-primary`.

When `starts` is empty, the grid is replaced by one line: “No time left on this day.” Continue is disabled. There is no free-text time.

### Step 4 — Your visit

`uk-form-stacked`. `uk-margin-small` between fields.

| Field | Required | Control | Notes |
| --- | --- | --- | --- |
| Your name | Yes | `uk-input` | `autocomplete="name"` |
| Mobile | Yes | `uk-input` | `inputmode="numeric"`, `autocomplete="tel"`, placeholder `10-digit mobile` |
| WhatsApp | Yes | `uk-subnav uk-subnav-pill` | “Same number” (default, `uk-active`) and “Different number” |
| WhatsApp number | When different | `uk-input` | Hidden until “Different number”. `inputmode="numeric"` |
| Locality | Yes | `uk-input` | Hint line: “Area in Hyderabad” |
| Address | Yes | `uk-textarea` `rows="3"` | |
| Landmark | No | `uk-input` | |
| Note | No | `uk-textarea` `rows="2"` | Hint: “Pain, pressure, or anything Uma should know” |
| Second name | Couple package | `uk-input` | Label “The other person’s name”. Omitted for individual packages |

Continue checks the fields in this step. The first invalid field is focused. One line under it, for example “Enter a 10-digit mobile number.”

### Step 5 — Review

[Description list](https://getuikit.com/docs/description-list) `uk-description-list uk-description-list-divider`. No inputs.

| Term | Value |
| --- | --- |
| Package | Snapshot name |
| When | `Tue 28 Oct 2026, 4:30 pm – 6:00 pm` |
| Where | Locality, then address, then landmark if present |
| Who | Customer name. Second name on the next line for a couple |
| Mobile | 10 digits, spaced `98480 98765` |
| Price | `₹1500`, or `₹2500` for a couple package |
| Pay | “At the visit” |

Primary button label is “Confirm booking”. It opens a [Modal](https://getuikit.com/docs/modal) dialog, not a second page.

Dialog title: “Hold this time?” Body: one sentence with package, date, and start. Buttons: `uk-button-default` “Back” and `uk-button-primary` “Hold this time”. Holding runs `POST /bookings` with a spinner in the button. Success closes the dialog, notifies, and navigates to `/book/done` with the response. `SLOT_TAKEN` closes the dialog, returns to step 3, reloads starts, and shows the alert “That time was just taken.”

### Received

**Path:** `/book/done`

`uk-card` in `app-column`. Check icon with `uk-animation-scale-up`. `uk-h2` “Booking received”. Reference in `uk-h1` (`UD7K2P`). The when-line and locality in `uk-text-meta`. Status word in `uk-label`: Held.

Two buttons, stacked on a phone:

- `uk-button-primary` “Send on WhatsApp” — the `wa.me` link from Technical.
- `uk-button-default` “Back to home” — `/`.

The create response is stored in `sessionStorage` under `uma_devi_done`. A refresh with that key missing redirects to `/book`. The reference is not looked up by a public URL in the first version.

---

## Screen 3 — Sign in

**Path:** `/uma/login`  
**Column:** `app-column`

`uk-h2` “Uma’s day”. One stacked form: Mobile, Password, `uk-button-primary uk-width-1-1` “Sign in”. Password `type="password"`. Mobile `inputmode="numeric"`.

Failure: `uk-alert-danger` “That mobile or password does not match.” The alert replaces itself on the next try. No link to create an account. No link from the public header.

Success navigates to `/uma`.

---

## Screen 4 — Bookings

**Path:** `/uma`

**Uma header** as in the screen log. This page’s job is the list.

[Subnav](https://getuikit.com/docs/subnav) `uk-subnav-pill`: Today, Upcoming, Past. Today is `uk-active` on open.

[Table](https://getuikit.com/docs/table) `uk-table uk-table-small uk-table-divider uk-table-responsive`.

| Column | Content |
| --- | --- |
| When | `28 Oct, 4:30 pm` |
| Package | Snapshot name |
| Name | Customer name |
| Area | Locality |
| Status | `uk-label` |

Label text is the status word: Held, Confirmed, Completed, Cancelled. Colour supports the word. Held and Confirmed use the default label. Completed uses `uk-label-success`. Cancelled uses the muted label. The word stays readable if colour is removed.

A row is a button. It opens a modal with the full booking:

- Reference, status label
- When, package, price
- Both names when couple
- Mobile, as a `tel:` link
- Locality, address, landmark, note
- Actions that the status table allows

| Status now | Buttons in the modal |
| --- | --- |
| Held | Confirm, Mark completed, Cancel booking |
| Confirmed | Mark completed, Cancel booking |
| Completed | None |
| Cancelled | None |

Confirm and Mark completed are `uk-button-primary` (only one of them is primary: Confirm when the status is Held, otherwise Mark completed). Cancel booking is `uk-button-default`. Cancel asks a second dialog: “Cancel this visit? The time becomes free.” Ok label “Cancel visit”, dismiss “Keep”.

Empty filter: placeholder “Nothing on this list.”  
Loading: spinner under the subnav. The table appears when the list returns.

---

## Screen 5 — Hours

**Path:** `/uma/hours`

**Week**

Seven rows, Monday through Sunday. Each row is `uk-grid uk-flex-middle`:

| Piece | Control |
| --- | --- |
| Day name | Text, about 6rem wide |
| Open or closed | `uk-subnav uk-subnav-pill`: Open, Closed |
| Start and end | Two `uk-select` controls on the 30-minute grid from `06:00` to `21:00`, visible when Open |

Closed hides the selects. Save is one primary button under the list, “Save hours”. Success is a notification “Hours saved.” A validation failure names the day under the row.

**Blocks**

`uk-h3` “Blocked time”. A table: date, from, to, note, and a text button Remove. Remove asks a confirm dialog.

Add opens a modal:

| Field | Control |
| --- | --- |
| Date | `uk-input` `type="date"` |
| From, To | `uk-select` on the same 30-minute grid |
| Note | `uk-input`, optional |

`type="date"` is used here because Uma is picking a calendar date with a year, not a customer slot. Customers never see `type="date"`.

Primary button “Block this time”. If the response includes `overlaps`, the modal stays open and lists those references: “These visits still sit in this block. Cancel them on Bookings if the hour should be free.”

Empty blocks: placeholder “No blocked time in the next 21 days.”

---

## Screen 6 — Packages

**Path:** `/uma/packages`

Table: name, audience (Individual or Couple), duration, price, bookable as a label (Shown / Hidden). A row opens an edit modal.

| Field | Control |
| --- | --- |
| Name | `uk-input` |
| Includes | `uk-textarea`, one line per array item on save (split on newlines, drop blanks) |
| Price | `uk-input` `inputmode="numeric"`, rupees |
| Duration | `uk-select` of 60, 75, 90, 105, 120 minutes. Seed values 90 and 105 are in the list |
| Bookable | pills Shown / Hidden |

Audience is read-only text. The id is not edited.

Save notifies “Package saved.” The home page and `/book` read the updated list on the next load.

---

## What to reach for

| Need | Reach for |
| --- | --- |
| Page background and width | `uk-section uk-section-small`, `uk-container`, `app-column`, `app-narrow` |
| One task on a white sheet | `uk-card uk-card-default uk-card-body` |
| The forward action | `uk-button uk-button-primary` |
| A choice of two | `uk-subnav uk-subnav-pill` |
| One booking step at a time | Hidden `uk-switcher`, `swiping: false` |
| How far through the five steps | `uk-progress` plus the step line |
| A customer date or start time | `uk-button` in a `uk-grid` |
| Uma picking a block date | `uk-input` `type="date"` |
| A short list of facts | `uk-description-list uk-description-list-divider` |
| Uma’s bookings | `uk-table uk-table-small uk-table-divider uk-table-responsive` |
| Status | `uk-label` with the word |
| Hold, cancel, remove | `uk-modal` dialog |
| Saved | `uk-notification`, one line, then it goes |
| Empty | `uk-placeholder` |
| Phone menu | `uk-offcanvas` and `uk-nav` |
| Phone booking action | `uk-sticky` bar, one primary button |
| A small cue | `uk-icon` |

---

## Leave these alone

| Component | Why it stays unused |
| --- | --- |
| Accordion | A step is short enough to show its fields |
| Tab | The switcher already shows one step. Tabs would put two steps on the page |
| Slideshow, slider, parallax, lightbox, cover, video | Poster layout. This is an appointment app |
| Countdown, totop, marker, leader, comment | Not part of booking or Uma’s day |
| Sortable | She does not drag visits into a day |
| Upload | Nothing is attached to a booking |
| Tooltip | Phones have no hover. The hint is under the field or absent |
| Dotnav, thumbnav, iconnav | No gallery |
| A second UI kit, a date-picker package, a calendar package | Days and starts are buttons |

---

## Choices that keep coming up

**Two options** (Individual / Couple, same WhatsApp number / different, Open / Closed, Shown / Hidden). Subnav pills. Every option is visible. Not a select.

**A customer day or start time.** Buttons. Not `type="date"` and not a text field. Disabled buttons stay in the month grid so the shape does not jump. Unavailable starts are omitted on the time step so the grid is only times she can keep.

**Uma’s block date.** `type="date"`, because she needs a year and she is not picking a free slot.

**A time she types as hours.** Selects on the 30-minute grid. Not a free-text `HH:mm` field.

**Yes that reveals one field** (different WhatsApp number, second name). Keep the pills or the package audience. Show the extra input only when it applies. Do not open a modal for that one field.

**A list.** Few columns. The row opens a modal for the rest. On a phone, `uk-table-responsive` scrolls sideways.

**Empty, waiting, failed.** Placeholder, spinner inside the button, one line under the field, or one alert when the step cannot continue.

---

## Details that are easy to get wrong

- Load UIkit before any call to `UIkit.switcher`, `UIkit.modal`, `UIkit.notification`, or `UIkit.offcanvas`. Load icons after UIkit when the page uses `uk-icon`.
- The switcher hides every panel that is not `uk-active`. Put `uk-active` on the first nav item and the first panel.
- `swiping: false` on the booking switcher so a sideways touch does not skip a step while someone is typing.
- `uk-grid` needs the class and the `uk-grid` attribute. Markup added later for a new week still carries the attribute. If a new grid does not gap, call `UIkit.update` on it.
- One form per step. The confirm modal is outside the step form. Do not nest a form inside a form.
- One primary button on a step. The sticky bar and the in-card button are the same action, and only one of them is visible.
- Selected day, selected slot, and primary button share `--accent`. Do not introduce a second highlight colour.
- Status labels always include the word.
- Customer-facing times display as `4:30 pm`. Values sent to the API stay `HH:mm`.
- The public header does not link to `/uma/login`.
- Icons are optional. Package cards do not each get a different massage pictogram.
- The page script holds the step, the selected package, the day, and the start. UIkit draws the controls. Do not rebuild pills, modals, or the grid in custom CSS when a `uk-` component already fits.
- `app.css` owns `--paper`, `--ink`, `--muted`, `--line`, `--accent`, the 64-pixel header, and the columns. New screens link that file. They do not copy the header rules into the page.

---

## File map

| File | Role |
| --- | --- |
| `docs/Requirements.md` | Product behaviour |
| `docs/Technical.md` | Collections, slot rules, REST, routes |
| `docs/UI.md` | This document |
| `docs/assets/home_massage_uma_devi.jpeg` | Poster. Content source, not a page layout |
| `site/app.css` | Tokens, header, columns |
| `site/index.html` | Home |
| `site/book.html` | Wizard |
| `site/done.html` | Received |
| `site/login.html` | Sign in |
| `site/uma.html` | Bookings |
| `site/hours.html` | Hours and blocks |
| `site/packages.html` | Packages |
| `site/vendor/uikit/` | UIkit 3 CSS, JS, and icons |
| `server/` | Node process that serves `site/` and `/api` |

When a page is added, copy the header from this document, link `app.css` and the UIkit files under `site/vendor/uikit/`, and pick components from [What to reach for](#what-to-reach-for).

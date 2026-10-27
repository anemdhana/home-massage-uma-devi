# Requirements
## Home Massage — Uma Devi (`home-massage-uma-devi`)

**Project:** home-massage-uma-devi  
**Version:** 0.1 (requirements only)  
**Last updated:** 27 October 2026  

A doorstep massage booking site for Uma Devi in Hyderabad. Customers choose a package, a date, and a free time slot. Uma sees those bookings and her day.

This file is what the product does. How it is built is in [`Technical.md`](Technical.md). How each screen is drawn is in [`UI.md`](UI.md). The pages and the API are not started.

**Source:** the starting poster, kept with this document at `docs/assets/home_massage_uma_devi.jpeg` (copied from `C:\Users\dhana\Downloads\home_massage_uma_devi.jpeg`).

The poster supplies the name, the line “Relaxation delivered to your doorstep”, the packages, the prices, the city, and the contact details. The site does not recreate the poster. The page is quiet: warm paper, ink, one burgundy accent, and UIkit components.

---

## Table of contents

- [Shape of the project](#shape-of-the-project)
- [People](#people)
- [Look and motion](#look-and-motion)
- [Catalogue](#catalogue)
- [Modules](#modules)
- [Functional requirements](#functional-requirements)
- [Booking rules](#booking-rules)
- [Screens and UIkit](#screens-and-uikit)
- [User stories](#user-stories)
- [Non-functional requirements](#non-functional-requirements)
- [First build, and what waits](#first-build-and-what-waits)
- [Open questions](#open-questions)

---

## Shape of the project

The docs follow the same three-file shape as `pssm-buddha-sangha`. The stack is smaller, because this product is one calendar and a handful of pages. Only the docs and the source image exist today.

```text
docs/Requirements.md          what the product does
docs/Technical.md             data, slot rules, REST
docs/UI.md                    screens and UIkit
docs/assets/                  source poster
site/                         later: HTML, app.css, page scripts, UIkit
server/                       later: one Node process
data/                         later: one SQLite file, created on first run
```

| Layer | Technology |
| --- | --- |
| Pages | HTML + a small script per page. No React and no build step |
| UI | UIkit 3, stored under `site/vendor/uikit/` |
| Server | Node.js 22, built-in HTTP. One process serves the pages and `/api` |
| Sign-in | Signed cookie for Uma only |
| Data | SQLite, one file |

UIkit is the component set for layout, forms, steps, lists, dialogs, and motion. The calendar and the time slots are built from UIkit buttons, grid, and icons. A second widget library is not part of this product.

Colour and spacing live in `site/app.css`, beside the UIkit files. Screens use `uk-` classes. Custom classes stay on the header, the phone column, and the colour tokens.

---

## People

| Who | What they do | Sign-in |
| --- | --- | --- |
| **Customer** | Reads the services and books a home visit | None in the first version. Name, mobile, and address are enough |
| **Uma** | Confirms, completes, or cancels bookings. Sets working hours and blocked time | Mobile + password, signed cookie |

One therapist. A couple package is one visit: two people, one address, one slot, one duration. The first version has no second therapist and no customer account.

---

## Look and motion

Minimal, and still pleasant on a phone.

- Background is a warm off-white. Cards are white with a hairline border.
- Text is a dark ink. Hints are a muted brown-grey.
- One accent, the burgundy of the poster title, used for the primary button, the selected package, the selected day, and the selected slot.
- Type is UIkit’s default. The name “Uma Devi” may use one light serif. Everything else stays in the UI font.
- Icons are UIkit icons, small, and only where they name a section. No medallions, floral frames, gold rules, or candle still-life.
- The portrait from the poster may appear once, as a simple crop, on the home page. It is optional for the first screens.
- One job on a screen. One primary button on a step.
- Space comes from `uk-section`, `uk-container`, and `uk-margin-medium`. The page should feel like a short appointment app.

Motion uses UIkit’s own animation classes, once, and stays short.

| Moment | UIkit |
| --- | --- |
| First heading | `uk-animation-fade` |
| Package cards as they enter | `uk-scrollspy` with `uk-animation-slide-bottom-small` and a short stagger |
| Step change in the booking | Switcher fade |
| How far through the steps | `uk-progress` value updates with the step |
| Selected package, day, or slot | Background eases to the accent. No bounce |
| Booking received | One `uk-animation-scale-up` on the check icon, then a `uk-notification` |

When the device asks for reduced motion, those classes stay off. Parallax, slideshows, marquees, and scroll-jacking are not part of the design.

---

## Catalogue

Facts taken from the poster. Prices are in Indian rupees. Durations are the time at the home.

**Practice**

| | |
| --- | --- |
| Name | Home Massage Service |
| Line | Relaxation delivered to your doorstep |
| Therapist | Uma Devi |
| City | Hyderabad |
| Experience line | 2 years experience with excellent customer feedback |
| Phone / WhatsApp | +91 9959923543 |
| Instagram | [uma_devi1601](https://instagram.com/uma_devi1601) |
| Closing line | Book your doorstep massage today! |

**Four quiet lines for the home page** (from the icon row on the poster): Relax your body. Relieve stress. Improve sleep. Feel rejuvenated.

**Individual packages** (price is per person)

| Id | Name | Includes | Price | Duration |
| --- | --- | --- | --- | --- |
| P1 | Package I – Swedish | Head, face, and foot massage | ₹1500 | 90 min |
| P2 | Package II | Face, foot, deep tissue, and head, neck and shoulder | ₹1500 | 90 min |
| P3 | Package III – Swedish Special | Swedish, face, body polishing, and foot massage | ₹2000 | 1 hr 45 min |
| P4 | Package IV – Deep Tissue Special | Deep tissue, face, body polishing, and foot massage | ₹2200 | 1 hr 45 min |

**Couple packages** (one visit, two people)

| Id | Name | Price | Duration | What the poster says about the work |
| --- | --- | --- | --- | --- |
| C1 | Package I (Couple) | ₹2500 (₹1250 per person) | 90 min | Special offer. Inclusions are not printed |
| C2 | Package II (Couple) | ₹2500 (₹1250 per person) | 90 min | Special offer. Inclusions are not printed |

The poster also says other couple combinations exist and to enquire. Those are a WhatsApp link, not a slot, until they have a name, a price, and a duration.

**Techniques named on the poster** (shown as a short list, not as separate bookable items): Swedish massage, deep tissue massage, head neck and shoulder, foot reflexology, body polishing, face massage, couple massage for men and women.

**Benefits named on the poster** (one plain list): deep relaxation, stress relief, pain relief, improves sleep, body detox, improves blood circulation, better mood and energy, quality time for couples.

---

## Modules

| # | Module | What it covers |
| --- | --- | --- |
| 1 | **Home** | Name, line, four benefits, packages, techniques, benefits, contact |
| 2 | **Booking** | Package, date, time slot, visit details, review, hold the slot |
| 3 | **Uma’s day** | Sign in, list, confirm or cancel, working hours, blocked time |

---

## Functional requirements

### Home

**FR-01: One scrolling home page**  
The public site is one page: name and line, four short benefits, individual packages, couple packages, techniques, benefits, and contact. Book is in the header and on each bookable package.

**FR-02: Contact is the real number**  
Phone and WhatsApp open `tel:+919959923543` and `https://wa.me/919959923543`. Instagram opens `https://instagram.com/uma_devi1601`.

**FR-03: Enquire stays on WhatsApp**  
“Other couple combinations” is a short line and a WhatsApp link. It does not open the date step.

### Booking

**FR-04: Five steps, one at a time**  
The steps are Package, Date, Time, Your visit, Review. A step shows its fields and one primary button. Back sits with the step line, above the card.

**FR-05: Package choice sets the length and the price**  
The customer picks one bookable package. Individual and couple are two groups. The chosen package’s duration decides which start times fit in the day.

**FR-06: Date shows bookable days**  
The customer moves by week on a phone and by month on a wider screen. A day in the past is unavailable. A day with no legal start time is unavailable. Today can still offer later slots.

**FR-07: Time offers real start times**  
Slots are starts, not a free-text time. A start appears when the visit plus the travel gap fits before the end of working hours and does not overlap a booking or a blocked range. Taken and past starts are absent.

**FR-08: The visit needs a doorstep**  
Required: customer name, 10-digit Indian mobile, locality in Hyderabad, full address. Optional: landmark, a short note (pain, pressure, anything Uma should know). A couple package also requires the second person’s name. WhatsApp “same as this mobile” is a two-way pill, defaulting to yes.

**FR-09: Review then hold**  
Review shows package, price, date, start, end, names, mobile, and address, with no new typing. Confirm opens a UIkit dialog. On success the slot is held and the customer sees a booking reference.

**FR-10: The server keeps a single calendar**  
Two customers cannot hold overlapping time, including the travel gap. The API rejects the second request. The page asks them to pick another slot.

**FR-11: Confirmation also offers WhatsApp**  
The success panel includes a WhatsApp link whose text already contains the reference, package, date, time, and area, so Uma receives the same facts in chat.

### Uma’s day

**FR-12: Only Uma signs in**  
Sign-in is mobile plus password. The server sets a signed cookie. A wrong password shows one alert on the form. Customers never see this screen.

**FR-13: A list of bookings**  
Columns: when, package, name, area, status. Filters are Today, Upcoming, and Past. Opening a row shows the address, mobile, note, and actions. On a phone the table scrolls sideways rather than squeezing the columns.

**FR-14: Status moves in one direction that frees or keeps the slot**  
Statuses are Held, Confirmed, Completed, and Cancelled. Held becomes Confirmed, Completed, or Cancelled. Confirmed becomes Completed or Cancelled. Completed and Cancelled stay as history. Cancelled time is free again.

**FR-15: Hours and blocked time**  
Uma sets the weekly start and end for each day, and can block a range (leave, already promised). Customers only see starts inside those hours and outside those blocks.

**FR-16: Packages can be corrected**  
Uma can change a package’s name, included lines, price, duration, and whether it is bookable. The home page and the booking step read that list. Seed data is the poster catalogue above.

---

## Booking rules

These are the working rules for the first build. Each one that the poster does not state is also listed under [Open questions](#open-questions).

| Rule | Value used until changed |
| --- | --- |
| Whose time is booked | Uma alone |
| Couple visit | One slot, two names, the couple price |
| Working days | All seven days |
| Working hours | 09:00–19:00 |
| Slot grid | A start every 30 minutes (09:00, 09:30, …) |
| Visit length | 90 minutes for P1, P2, C1, C2. 105 minutes for P3 and P4 |
| Travel gap | 45 minutes after the visit before the next start |
| Earliest start | 3 hours from now |
| How far ahead | 21 days |
| Hold | Submitting Review locks the slot as Held |
| Payment | Shown on the page. Collected at the visit. No payment gateway |
| Service area | Hyderabad. Locality and full address required. No travel fee in the price |
| Language | English |

A start is legal when all of these are true:

1. It sits on the 30-minute grid inside that day’s working hours.
2. Visit end is at or before the day’s end.
3. The range from this start through visit end plus the travel gap does not cross another Held, Confirmed, or Completed booking, or a block.
4. The start is at least 3 hours away and inside the 21-day window.

Example. Hours 09:00–19:00, 90-minute visit, 45-minute gap. A visit that starts at 17:00 ends at 18:30 and the gap runs to 19:15, which is after 19:00, so 17:00 is not offered. A visit that starts at 16:30 ends at 18:00 and the gap ends at 18:45, so 16:30 is offered if nothing else occupies 16:30–18:45.

---

## Screens and UIkit

UIkit 3, same usage rules as the sangha UI notes: labels above fields (`uk-form-stacked`), one primary button, `type="button"` unless the control submits, phone column about 440 pixels wide, primary button full width under 960 pixels.

Shared pieces on every public screen:

- Slim header, 64 pixels, white. Inside it, a small [Navbar](https://getuikit.com/docs/navbar): Home, Services, Book.
- Under 960 pixels the links move into [Off-canvas](https://getuikit.com/docs/offcanvas) with [Nav](https://getuikit.com/docs/nav). One menu icon in the header.
- A [Sticky](https://getuikit.com/docs/sticky) bar on the phone during booking: the step name and the full-width primary button.

### Screen 1 — Home

**UIkit:** [Section](https://getuikit.com/docs/section), [Container](https://getuikit.com/docs/container), [Grid](https://getuikit.com/docs/grid), [Card](https://getuikit.com/docs/card), [Button](https://getuikit.com/docs/button), [Icon](https://getuikit.com/docs/icon), [List](https://getuikit.com/docs/list), scrollspy.

- The title is the practice name. The line under it is the doorstep line. One text button: Book.
- Four short lines in `uk-child-width-1-2 uk-child-width-1-4@m`, each with one small icon (heart, happy, future, star — or the nearest UIkit icon).
- Package cards: `uk-card uk-card-default uk-card-body`. Name, included lines, duration, price, and Book. Individual cards use `uk-child-width-1-1 uk-child-width-1-2@m`. Couple cards sit in a second group with the enquire line under them.
- Techniques and benefits are `uk-list uk-list-divider`, two columns from the `m` breakpoint.
- Contact is a single row: phone, WhatsApp, Instagram.

### Screen 2 — Book (wizard)

**UIkit:** hidden [Switcher](https://getuikit.com/docs/switcher) (`swiping: false`), [Progress](https://getuikit.com/docs/progress), [Subnav](https://getuikit.com/docs/subnav) pills, [Button](https://getuikit.com/docs/button), [Grid](https://getuikit.com/docs/grid), [Form](https://getuikit.com/docs/form), [Description list](https://getuikit.com/docs/description-list), [Modal](https://getuikit.com/docs/modal), [Alert](https://getuikit.com/docs/alert), [Notification](https://getuikit.com/docs/notification).

The switcher tab list stays `uk-hidden`. The visible line reads “Step 2 of 5 · Date”. The progress bar sits above the card.

| Step | Customer sees | Controls |
| --- | --- | --- |
| 1 Package | Individual and Couple as pills, then the cards for that group | `uk-subnav uk-subnav-pill`. The chosen card uses the accent. Continue stays quiet until a package is chosen |
| 2 Date | Week title, previous and next chevrons, seven day buttons. From 960 pixels, a month grid of day buttons | `uk-icon` chevron-left and chevron-right. Selected day is `uk-button-primary`. Unavailable days are `uk-disabled` |
| 3 Time | Start times that pass the booking rules | `uk-grid uk-grid-small` of `uk-button`. Selected is primary. Empty day: one line, “No time left on this day.” |
| 4 Your visit | Name, mobile, WhatsApp pill, locality, address, landmark, note. Second name when the package is a couple package | `uk-form-stacked`, `uk-input`, `uk-textarea`. Mobile uses `inputmode="numeric"` |
| 5 Review | Read-only receipt and the price | `uk-description-list uk-description-list-divider`. Confirm opens `uk-modal` |

A field error is one line under that field. `uk-alert-danger` appears only when the whole step cannot continue (the slot was just taken).

Success replaces the wizard with a short panel: reference, when, where to be ready, and the WhatsApp link. A notification confirms “Booking received.”

### Screen 3 — Uma sign-in

**UIkit:** stacked form, `uk-input`, `uk-button-primary`, `uk-alert-danger` on failure. Narrow column.

### Screen 4 — Bookings

**UIkit:** [Subnav](https://getuikit.com/docs/subnav) pills for Today, Upcoming, Past. [Table](https://getuikit.com/docs/table) `uk-table uk-table-small uk-table-divider uk-table-responsive`. [Label](https://getuikit.com/docs/label) for status. [Modal](https://getuikit.com/docs/modal) for the booking and for blocking time. [Placeholder](https://getuikit.com/docs/placeholder) when a filter is empty. Off-canvas nav: Bookings, Hours, Packages, Sign out.

### Screen 5 — Hours and packages

Hours: seven rows, each with a closed pill or a start and end. Blocks: a list, plus Add in a modal (date, from, to, note).

Packages: the same table pattern. Edit in a modal with name, includes, price, duration in minutes, bookable pill.

---

## User stories

### Customer

**US-01: See what is offered**  
As a customer, I can read Uma’s packages, prices, and durations on my phone so I know what a visit costs before I book.

**US-02: Book a package**  
As a customer, I can choose one package so the site knows how long the visit is and what to charge.

**US-03: Pick a free day and start time**  
As a customer, I can choose a date and a start time that Uma can actually keep, so I am not offered a slot she already has.

**US-04: Give the doorstep**  
As a customer, I can enter my name, mobile, and Hyderabad address so Uma can come to the home.

**US-05: Book as a couple**  
As a customer, I can book a couple package with both names on one slot so we share one visit.

**US-06: Leave with a reference**  
As a customer, I can see a booking reference and send the same details on WhatsApp so the request is clear in chat as well as in the app.

**US-07: Ask about an unlisted combination**  
As a customer, I can open WhatsApp for a couple combination that has no fixed price, without being shown a fake slot.

### Uma

**US-08: Sign in**  
As Uma, I can sign in and see upcoming bookings so I know where to go.

**US-09: Confirm or release a visit**  
As Uma, I can mark a booking confirmed, completed, or cancelled so a cancelled hour becomes free for someone else.

**US-10: Close time I cannot work**  
As Uma, I can set weekly hours and block a range so customers stop seeing those starts.

**US-11: Correct a price**  
As Uma, I can change a package’s price or duration so the home page matches what I currently offer.

---

## Non-functional requirements

**NFR-01: Phone first**  
Every flow is usable at 360 pixels wide. Tap targets are at least 44 pixels. Nothing important depends on hover.

**NFR-02: UIkit carries the interface**  
Visible controls are UIkit components. The date and time choosers are buttons in a grid, not a third-party calendar.

**NFR-03: Motion stays small**  
Animations are the set in [Look and motion](#look-and-motion). They run once and they respect reduced motion.

**NFR-04: The calendar is enforced on the server**  
The browser may hide illegal slots. The API still rejects an overlap, a start outside working hours, a start inside the lead time, or a start beyond 21 days.

**NFR-05: Prices and durations come from data**  
The poster values are the seed. Pages read the package records Uma can edit.

**NFR-06: Contact details are public on purpose**  
The phone number and Instagram handle are the ones printed on the poster. They are the business contact, shown on the home page and used in the WhatsApp link.

---

## First build, and what waits

Suggested order when implementation starts. Not part of this step.

1. HTML pages in `site/` with the UIkit markup from [`UI.md`](UI.md).
2. The Node server: packages, hours, blocks, create booking, overlap check, Uma’s list and status changes.
3. First start seeds the catalogue from this document and one Uma login.

Waiting until a later version:

- Online payment
- A second therapist
- Customer accounts, passwords, and “my bookings”
- SMS or a WhatsApp Business API (the first version uses a `wa.me` link)
- Distance or a travel fee by locality
- A reviews module
- Languages other than English
- A page that reproduces the poster

---

## Open questions

Answers here replace the matching row under [Booking rules](#booking-rules) before the build.

1. **Hours.** Are 09:00–19:00, all seven days, right?
2. **Travel gap.** Is 45 minutes between homes enough?
3. **Lead time and window.** Is 3 hours’ notice and 21 days ahead right? Are same-day visits welcome?
4. **Hold or instant confirm.** Should submit lock the slot as Held until Uma confirms, or should it be Confirmed immediately?
5. **Payment.** Is payment at the visit enough for the first version?
6. **Couple packages.** What work is included in couple Package I and Package II? The poster prints the price and the 90 minutes only.
7. **Area.** All of Hyderabad, or a list of localities? Is any locality an extra charge?
8. **Cancel.** May a customer cancel from the success reference later, or only by WhatsApp while Uma cancels in the desk?

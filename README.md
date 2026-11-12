# AUREST prototype

Open `index.html` in a browser or serve this directory with any static web server. No build step or dependencies are required. Demo accounts are listed in `js/data.js`.

## Payments and reservations

- Each room type has a number of rooms (`units` in `js/data.js`, or "Number of rooms" when an admin adds a room). Guests choose any number of adults, children and rooms. A search only lists types with enough rooms free on every night of the stay whose combined capacity fits the group, and each room needs at least one adult. One booking holds several rooms of one type; the booking and review pages check free rooms and capacity again before saving.
- Guests choose a 30% deposit or full payment on the review page. This is a manual transfer workflow: submit the amount and method in My bookings, with a transfer reference, a receipt image, or both. Cash at the front desk needs neither. Staff open uploaded receipts and verify them in Admin → Payments. Submissions alone never count as money received.
- The booking email always comes from the signed-in account. The contact number is optional; when given it must be an 11-digit number starting with 09, shown as `0912 345 6789`.
- Signing in to a different account in another tab signs this tab's account out, with a notice. Private/incognito windows have separate storage and cannot be linked without a server.
- Forms ask before a reload or tab close when something has been typed. Browsers control the wording and only show it after the person has interacted with the page.
- Booking confirmation requires the selected payment threshold and a recorded original-ID check. Users bring their original government photo ID; staff manually match the name. This is not automated identity authentication.
- Draft cancellation policy: refundable at least 48 hours before 2 PM Asia/Manila check-in. Otherwise retain the lesser of 30% of the adjusted room total and verified money still held. Any remaining refund goes into the admin queue. Staff send money outside the app and record the refund reference afterward.
- Rescheduling is available before arrival, subject to room availability, and carries verified payments forward at the saved nightly rate. Additional nights create a balance; excess money creates a refund request. Pending transfers/refunds must be reviewed first. Staff must review discount eligibility again.
- Senior/PWD guests are listed by name in booking details. Inspect their original eligibility IDs on arrival. Staff record the approved discount, eligible guests and calculation notes; the app does not assume the entire room qualifies. Applicable VAT treatment and mixed-occupancy allocations require the hotel's reviewed calculation. A person should not receive stacked senior/PWD discounts.
- Analytics show all-time verified receipts, net collections, outstanding balances and pending refunds, plus monthly net collections. Existing sample bookings contain no payment assumptions.
- Profiles include a resized photo, phone, city, emergency contact and stay/accessibility preferences. ID images and ID numbers are not collected.

## Limits before production

This is a local browser prototype. Accounts, roles, transactions and verification decisions are editable browser storage and are not secure server authorization. They do not sync across devices. Payment/refund controls record manual external actions; there is no payment gateway or automatic ID verification. A production release needs backend authentication/authorization, transactional storage, payment integration, private document handling if remote ID review is added, and an approved cancellation/tax/discount policy. The draft 30% / 48-hour policy is a product default, not a legal requirement.

## Validation

Run `node tests/finance.test.cjs` from the project root. It checks JavaScript syntax, submitted versus verified payments, deposit balances, cancellation windows and fees, refund requests, duplicate refunds, refund completion, free rooms per room type, and multi-room totals.

Browser checks also covered booking → review → confirmation, guest payment submission → admin verification, rescheduling with payment carry-forward, cancellation refunds, profile saves, check-in range shading and locked check-in dates during check-out selection.

## Folder guide

The current structure fits a small static website. Pages stay at the root so existing navigation links work without a routing system.

```text
AUREST/
├── *.html                  Page layouts and form fields
├── css/
│   └── style.css           Shared theme, layouts, responsive rules and animations
├── images/                 Room, hero and background images
├── js/
│   ├── data.js             Default rooms, hotel details and demo accounts
│   ├── app.js              Shared storage helpers, navigation, dialogs and date picker
│   ├── finance.js          Shared ledger, balances, cancellation and rescheduling rules
│   ├── home.js             Search, room filters, contact form and slideshow
│   ├── room-details.js     Room gallery and initial booking draft
│   ├── booking.js          Guest details, validation and saved booking draft
│   ├── review.js           Payment-plan selection and reservation creation
│   ├── confirmation.js     Reservation receipt and current payment summary
│   ├── my-bookings.js      Guest booking cards and payment/change actions
│   ├── admin.js            Room management and reservation/guest tables
│   ├── admin-finance.js    Payment analytics, receipt/refund and ID/discount review
│   ├── charts.js           Booking-status and occupancy charts
│   ├── profile.js          Profile details, portrait preview and image resizing
│   ├── login.js            Demo sign-in and local redirect handling
│   └── register.js         Demo account creation
├── tests/
│   └── finance.test.cjs    Syntax and ledger checks
├── .editorconfig           Editor indentation and line-ending settings
├── .prettierrc.json         Shared code-formatting settings
└── README.md               Setup, workflows, limits and this guide
```

Each HTML page loads `data.js`, then `app.js`, then `finance.js`, followed by its own scripts. These are classic browser scripts that share helpers, so preserve their order. The admin page also loads `charts.js` before `admin.js`, then `admin-finance.js`.

## Code style

Use two spaces for indentation, double quotes in JavaScript, semicolons, and LF line endings. Keep functions and control flow on separate lines so validation and payment rules are easy to follow. Prettier is configured for a preferred width of 100 characters; HTML templates and long strings may exceed that width.

Comments explain business rules, script dependencies, storage limits, accessibility behavior and image handling. When changing a policy or timing value, update its nearby comments and this guide as needed. Avoid comments that simply repeat a clear statement such as assigning a field value.

With Node.js installed, an optional formatting check is:

```sh
npx prettier@3.6.2 --check "*.html" "js/*.js" "css/*.css" "tests/*.cjs" .prettierrc.json
```

Use `--write` instead of `--check` to apply the configured style. This is a development tool and is not needed to run the site.

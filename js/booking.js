// ===== Step 1 of 3: guest and stay details =====
// Reads the draft saved by room-details.js, validates the form, then saves the full draft for review.js.
const me = getUser();
const draft = store.get("aurest-draft");
const bookRoom = selectionRoom(draft);

// ----- Philippine mobile numbers: 11 digits starting with 09, shown as 0912 345 6789 -----
const PHONE_DIGITS = 11;
const phoneDigits = (v) => String(v || "").replace(/\D/g, "");
const formatPhone = (digits) =>
  digits.length === PHONE_DIGITS
    ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
    : digits;
// Profile numbers may be saved as +63 9xx…; use them only if they become a valid 09 number.
function phoneFromProfile(v) {
  let d = phoneDigits(v);
  if (/^639\d{9}$/.test(d)) d = "0" + d.slice(2);
  return /^09\d{9}$/.test(d) ? formatPhone(d) : "";
}
// Keep digits only, stop at 11, and space the number out once it is complete.
function limitPhoneInput(input) {
  const caret = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = phoneDigits(input.value.slice(0, caret)).length;
  const digits = phoneDigits(input.value).slice(0, PHONE_DIGITS);
  input.value = formatPhone(digits);
  // Put the caret back after the same digit, so editing in the middle does not jump to the end.
  let pos = 0,
    seen = 0;
  const target = Math.min(digitsBeforeCaret, digits.length);
  while (pos < input.value.length && seen < target) {
    if (/\d/.test(input.value[pos])) seen++;
    pos++;
  }
  if (document.activeElement === input) input.setSelectionRange(pos, pos);
}

// The account's first and last name. Accounts made on the sign-up form store them separately;
// older accounts, and names edited on the profile page, are split at the first space.
function accountNameParts(user) {
  const account = allUsers().find((u) => u.email === user.email) || {};
  const full = (profileFor(user.email).name || user.name || account.name || "").trim();
  if (account.firstName && `${account.firstName} ${account.lastName || ""}`.trim() === full)
    return [account.firstName, account.lastName || ""];
  const [first = "", ...rest] = full.split(/\s+/);
  return [first, rest.join(" ")];
}

function initBooking(user, d, room) {
  const el = (id) => document.getElementById(id);
  const today = addDays(0);
  const isWhole = (v, min) => v !== "" && Number.isInteger(+v) && +v >= min;

  // Pre-fill: what was typed before (when coming back from the review page), otherwise the signed-in guest.
  el("phone").value = d.phone != null ? d.phone : phoneFromProfile(profileFor(user.email).phone);
  el("discount-guests").value = d.discountGuests || "";
  el("requests").value = d.requests ?? "";
  el("checkin").value = d.checkin || getSearch().checkin;
  el("checkout").value = d.checkout || getSearch().checkout;
  el("adults").value = Math.max(1, Math.floor(+d.adults) || 1);
  el("children").value = Math.max(0, Math.floor(+d.children) || 0);
  el("rooms").value = Math.max(1, Math.floor(+d.rooms) || 1);
  // Scoped to this room and stay, so a new room or date choice is not overwritten by an old draft.
  const formDraft = keepFormOnRefresh(
    el("booking-form"),
    [room.id, d.checkin, d.checkout, d.adults, d.children, d.rooms].join(),
  );
  el("adults").value = d.adults;
  el("children").value = d.children;
  el("rooms").value = d.rooms;
  limitPhoneInput(el("phone")); // a restored draft gets the same digits-only format
  // The email and booking name always come from the account. Set after the draft restore so nothing can replace them.
  el("email").value = user.email;
  const [accountFirst, accountLast] = accountNameParts(user);
  if (accountFirst) {
    el("first").value = accountFirst;
    el("last").value = accountLast;
    [el("first"), el("last")].forEach((input) => {
      input.readOnly = true;
      input.classList.add("locked");
      input.setAttribute("aria-describedby", "name-hint");
    });
    el("name-hint").hidden = false;
  }
  el("checkin").min = today;
  el("checkout").min = el("checkin").value || today;

  el("back").href = "index.html#rooms";
  el("party-readonly").textContent =
    `${plural(d.adults, "adult")}, ${plural(d.children, "child", "children")} · ${plural(d.rooms, "room")}. Change your party or selection on the rooms page.`; // back to this room, not the whole list

  // Summary panel
  el("sum-img").src = room.photo;
  el("sum-img").alt = room.name;
  el("sum-name").textContent = d.roomItems ? plural(d.rooms, "selected room") : room.name;
  el("sum-meta").textContent = d.roomItems
    ? "Your rooms and nightly rates are listed below."
    : `${room.bed} · ${room.size} m² · ${room.guests} guests per room`;
  function drawSummary() {
    const a = el("checkin").value,
      b = el("checkout").value,
      n = a && b ? nightsBetween(a, b) : 0,
      qty = isWhole(el("rooms").value, 1) ? +el("rooms").value : 0;
    el("room-breakdown").innerHTML = roomBreakdown({ ...d, checkin: a, checkout: b });
    el("sum-in").textContent = a ? fmtDate(a) : "—";
    el("sum-out").textContent = b ? fmtDate(b) : "—";
    el("sum-rooms").textContent = qty ? plural(qty, "room") : "—";
    if (n > 0 && qty) {
      el("sum-calc").textContent = "Room subtotal";
      el("sum-sub").textContent = el("sum-total").textContent = peso(
        roomChargeLines({ ...d, checkin: a, checkout: b }).reduce((sum, i) => sum + i.subtotal, 0),
      );
    } else {
      el("sum-calc").textContent = n > 0 ? "Choose how many rooms" : "Choose your dates";
      el("sum-sub").textContent = el("sum-total").textContent = "—";
    }
  }
  el("checkin").addEventListener("change", () => {
    // keep check-out after check-in, like the home page search
    const a = el("checkin").value;
    if (a && (!el("checkout").value || el("checkout").value <= a)) {
      const x = new Date(a + "T00:00");
      x.setDate(x.getDate() + 1);
      el("checkout").value = iso(x);
    }
    el("checkout").min = a || today;
    drawSummary();
  });
  el("checkout").addEventListener("change", drawSummary);
  el("rooms").addEventListener("input", drawSummary);
  el("phone").addEventListener("input", () => limitPhoneInput(el("phone")));
  drawSummary();

  // Validation
  const datesOk = () => el("checkin").value >= today && el("checkout").value > el("checkin").value;
  const freeRooms = () =>
    selectionFree(d, el("checkin").value, el("checkout").value) ? +d.rooms : 0;
  const rules = {
    first: () => (el("first").value.trim() ? "" : "Please enter your first name."),
    // A locked one-word account name has no last name, and the guest could not type one anyway.
    last: () =>
      el("last").value.trim() || el("last").readOnly ? "" : "Please enter your last name.",
    // Optional, but when given it must be a complete 09 mobile number.
    phone: () => {
      const digits = phoneDigits(el("phone").value);
      if (!digits) return "";
      if (digits[0] !== "0" || (digits.length > 1 && digits[1] !== "9"))
        return "Contact number must start with 09.";
      return digits.length === PHONE_DIGITS ? "" : "Contact number must be exactly 11 digits.";
    },
    checkin: () =>
      !el("checkin").value
        ? "Choose a check-in date."
        : el("checkin").value < today
          ? "Check-in can't be in the past."
          : "",
    checkout: () =>
      !el("checkout").value
        ? "Choose a check-out date."
        : el("checkout").value <= el("checkin").value
          ? "Check-out must be after check-in."
          : !freeRooms()
            ? "A selected room is unavailable on those dates. Choose other dates or change your room selection."
            : "",
    adults: () => (isWhole(el("adults").value, 1) ? "" : "Enter at least 1 adult."),
    children: () => (isWhole(el("children").value, 0) ? "" : "Enter 0 or more children."),
    // Checked against the rooms actually free for these dates and how many guests they hold.
    rooms: () => {
      const qty = el("rooms").value;
      if (!isWhole(qty, 1)) return "Enter at least 1 room.";
      const adults = +el("adults").value,
        guestsTotal = adults + +el("children").value;
      if (isWhole(el("adults").value, 1) && +qty > adults)
        return "Each room needs at least one adult.";
      if (datesOk()) {
        const free = freeRooms();
        if (free && +qty > free)
          return `Only ${plural(free, "room")} selected ${free === 1 ? "is" : "are"} free on those dates.`;
      }
      if (
        isWhole(el("adults").value, 1) &&
        isWhole(el("children").value, 0) &&
        guestsTotal > room.guests * qty
      )
        return `${plural(+qty, "room")} selected ${+qty === 1 ? "fits" : "fit"} up to ${plural(room.guests * qty, "guest")}. Add rooms or choose fewer guests.`;
      return "";
    },
  };
  const run = (k) => setError(el(k), rules[k]());
  Object.keys(rules).forEach((k) =>
    el(k).addEventListener("blur", () => {
      if (el(k).value) run(k);
    }),
  );
  // The room check depends on the guest counts and dates, so recheck it when any of them change.
  ["adults", "children", "rooms"].forEach((k) =>
    el(k).addEventListener("change", () => {
      run(k);
      if (el("rooms").value) run("rooms");
    }),
  );
  ["checkin", "checkout"].forEach((k) =>
    el(k).addEventListener("change", () => {
      if (el("checkin").value && el("checkout").value) {
        run("checkout"); // report a clash as soon as dates change
        run("rooms");
      }
    }),
  );
  if (formDraft.restored)
    Object.keys(rules).forEach((k) => {
      if (el(k).value) run(k); // restored values get the same checks, such as a date now in the past
    });

  el("booking-form").addEventListener("submit", (e) => {
    e.preventDefault();
    el("form-error").textContent = "";
    const ok = Object.keys(rules).map(run).every(Boolean);
    if (!ok) {
      el("form-error").textContent = rules.rooms() || "Please fix the highlighted fields.";
      const bad = $(".invalid", el("booking-form"));
      if (bad) bad.focus();
      return;
    }
    store.set("aurest-draft", {
      roomId: room.id,
      roomItems: d.roomItems,
      first: el("first").value.trim(),
      last: el("last").value.trim(),
      email: user.email,
      phone: formatPhone(phoneDigits(el("phone").value)),
      checkin: el("checkin").value,
      checkout: el("checkout").value,
      adults: +el("adults").value,
      children: +el("children").value,
      rooms: +el("rooms").value,
      discountGuests: el("discount-guests").value.trim(),
      requests: el("requests").value.trim(),
      paymentPlan: d.paymentPlan,
    });
    formDraft.clear();
    location.href = "review.html";
  });
}

// Start last, once the helpers above exist.
if (!me) location.replace("login.html?next=booking.html");
else if (!bookRoom)
  location.replace("index.html#rooms"); // nothing to book, so start over
else initBooking(me, draft, bookRoom);

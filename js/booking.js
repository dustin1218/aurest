// ===== Step 1 of 3: guest and stay details =====
// Reads the draft saved by room-details.js, validates the form, then saves the full draft for review.js.
const me = getUser();
const draft = store.get("aurest-draft");
const bookRoom = draft && getRooms().find((r) => r.id === draft.roomId);

if (!me) location.replace("login.html?next=booking.html");
else if (!bookRoom)
  location.replace("index.html#rooms"); // nothing to book, so start over
else initBooking(me, draft, bookRoom);

function initBooking(user, d, room) {
  const el = (id) => document.getElementById(id);
  const today = addDays(0);
  const MAX_ADULTS = 8,
    MAX_CHILDREN = 6; // same limits as the guests picker on the home page

  // Drop-downs go up to the same limits as the home page picker, so a saved search always fits.
  const fillSelect = (sel, from, to) => {
    sel.innerHTML = Array.from(
      { length: to - from + 1 },
      (_, i) => `<option>${from + i}</option>`,
    ).join("");
  };
  fillSelect(el("adults"), 1, MAX_ADULTS);
  fillSelect(el("children"), 0, MAX_CHILDREN);

  // Pre-fill: what was typed before (when coming back from the review page), otherwise the signed-in guest.
  const [firstGuess, ...rest] = (user.name || "").trim().split(/\s+/);
  el("first").value = d.first ?? firstGuess ?? "";
  el("last").value = d.last ?? rest.join(" ");
  el("email").value = d.email ?? user.email ?? "";
  el("phone").value = d.phone ?? profileFor(user.email).phone ?? "";
  el("discount-guests").value = d.discountGuests || "";
  el("requests").value = d.requests ?? "";
  el("checkin").value = d.checkin || getSearch().checkin;
  el("checkout").value = d.checkout || getSearch().checkout;
  el("adults").value = Math.min(MAX_ADULTS, Math.max(1, +d.adults || 1));
  el("children").value = Math.min(MAX_CHILDREN, Math.max(0, +d.children || 0));
  // Scoped to this room and stay, so a new room or date choice is not overwritten by an old draft.
  const formDraft = keepFormOnRefresh(
    el("booking-form"),
    [room.id, d.checkin, d.checkout, d.adults, d.children].join(),
  );
  el("checkin").min = today;
  el("checkout").min = el("checkin").value || today;

  el("back").href = "room-details.html?id=" + encodeURIComponent(room.id); // back to this room, not the whole list

  // Summary panel
  el("sum-img").src = room.photo;
  el("sum-img").alt = room.name;
  el("sum-name").textContent = room.name;
  el("sum-meta").textContent = `${room.bed} · ${room.size} m² · ${room.guests} guests`;
  function drawSummary() {
    const a = el("checkin").value,
      b = el("checkout").value,
      n = a && b ? nightsBetween(a, b) : 0;
    el("sum-in").textContent = a ? fmtDate(a) : "—";
    el("sum-out").textContent = b ? fmtDate(b) : "—";
    if (n > 0) {
      el("sum-calc").textContent = `${peso(room.price)} × ${plural(n, "night")}`;
      el("sum-sub").textContent = el("sum-total").textContent = peso(room.price * n);
    } else {
      el("sum-calc").textContent = "Choose your dates";
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
  drawSummary();

  // Validation
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const rules = {
    first: () => (el("first").value.trim() ? "" : "Please enter your first name."),
    last: () => (el("last").value.trim() ? "" : "Please enter your last name."),
    email: () =>
      !el("email").value.trim()
        ? "Please enter your email."
        : EMAIL.test(el("email").value.trim())
          ? ""
          : "Please enter a valid email address.",
    phone: () => {
      const v = el("phone").value.trim(),
        digits = v.replace(/\D/g, "").length;
      return !v
        ? "Please enter a contact number."
        : /[^\d\s+()-]/.test(v) || digits < 7 || digits > 15
          ? "Please enter a valid contact number."
          : "";
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
          : !available(room.id, el("checkin").value, el("checkout").value)
            ? "This room is already reserved on those dates. Please choose other dates."
            : "",
    adults: () =>
      +el("adults").value + +el("children").value > room.guests
        ? `${room.name} fits up to ${plural(room.guests, "guest")}. Choose fewer guests or another room.`
        : "",
  };
  const run = (k) => setError(el(k), rules[k]());
  Object.keys(rules).forEach((k) =>
    el(k).addEventListener("blur", () => {
      if (el(k).value) run(k);
    }),
  );
  el("children").addEventListener("change", () => run("adults")); // the guest limit depends on both drop-downs
  el("adults").addEventListener("change", () => run("adults"));
  ["checkin", "checkout"].forEach((k) =>
    el(k).addEventListener("change", () => {
      if (el("checkin").value && el("checkout").value) run("checkout"); // report a clash as soon as dates change
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
      el("form-error").textContent = "Please fix the highlighted fields.";
      const bad = $(".invalid", el("booking-form"));
      if (bad) bad.focus();
      return;
    }
    store.set("aurest-draft", {
      roomId: room.id,
      first: el("first").value.trim(),
      last: el("last").value.trim(),
      email: el("email").value.trim(),
      phone: el("phone").value.trim(),
      checkin: el("checkin").value,
      checkout: el("checkout").value,
      adults: +el("adults").value,
      children: +el("children").value,
      discountGuests: el("discount-guests").value.trim(),
      requests: el("requests").value.trim(),
    });
    formDraft.clear();
    location.href = "review.html";
  });
}

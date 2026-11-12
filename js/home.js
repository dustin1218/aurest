// ----- Guests and rooms picker -----
const s0 = getSearch();
const party = {
  adults: Math.max(1, +s0.adults || 1),
  children: Math.max(0, +s0.children || 0),
  rooms: Math.max(1, +s0.rooms || 1),
  pets: !!s0.pets,
};
const toggle = $("#picker-toggle"),
  panel = $("#picker-panel");
// There is no fixed maximum. Availability and room capacity are checked when the search runs.
const countFor = (s, v) => Math.max(+s.dataset.min, Math.floor(+v) || 0);
function updateGuests() {
  ["adults", "children", "rooms"].forEach((k) => {
    const input = $("#val-" + k);
    if (document.activeElement !== input || +input.value !== party[k]) input.value = party[k];
  });
  $$(".stepper").forEach((s) => {
    s.querySelector('[data-step="-1"]').disabled = party[s.dataset.key] <= +s.dataset.min;
  });
  $("#picker-summary").textContent =
    `${plural(party.adults, "adult")} · ${plural(party.children, "child", "children")} · ${plural(party.rooms, "room")}` +
    (party.pets ? " · Pets" : "");
}
const setPanel = (open) => {
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", open);
};
toggle.addEventListener("click", () => setPanel(panel.hidden));
$("#picker-done").addEventListener("click", () => {
  setPanel(false);
  toggle.focus();
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".picker")) setPanel(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panel.hidden) {
    setPanel(false);
    toggle.focus();
  }
});
$$(".stepper").forEach((s) => {
  const k = s.dataset.key,
    input = $("input", s);
  s.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    party[k] = countFor(s, party[k] + +b.dataset.step);
    updateGuests();
  });
  // Typing a number works too; an empty or invalid entry falls back to the lowest allowed value.
  input.addEventListener("input", () => {
    if (input.value === "") return;
    party[k] = countFor(s, input.value);
    updateGuests();
  });
  input.addEventListener("change", () => {
    party[k] = countFor(s, input.value);
    input.value = party[k];
    updateGuests();
  });
});
$("#pets").checked = party.pets;
$("#pets").addEventListener("change", (e) => {
  party.pets = e.target.checked;
  updateGuests();
});
updateGuests();

// ----- Search form (validation) -----
const form = $("#search"),
  cin = $("#checkin"),
  cout = $("#checkout");
cin.min = cout.min = addDays(0);
cin.value = s0.checkin;
cout.value = s0.checkout;
cin.addEventListener("change", () => {
  // helpful default: keep check-out after check-in
  if (cin.value && (!cout.value || cout.value <= cin.value)) {
    const d = new Date(cin.value + "T00:00");
    d.setDate(d.getDate() + 1);
    cout.value = iso(d);
  }
  cout.min = cin.value || addDays(0);
});
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const today = addDays(0);
  const a = setError(
    cin,
    !cin.value
      ? "Choose a check-in date."
      : cin.value < today
        ? "Check-in can't be in the past."
        : "",
  );
  const b = setError(
    cout,
    !cout.value
      ? "Choose a check-out date."
      : cout.value <= cin.value
        ? "Check-out must be after check-in."
        : "",
  );
  const okRooms = party.rooms <= party.adults;
  $("#picker-error").textContent = okRooms ? "" : "Each room needs at least one adult.";
  if (a && b && okRooms) {
    const found = { checkin: cin.value, checkout: cout.value, ...party };
    store.set("aurest-search", found);
    applied = found;
    expanded = true;
    // Each room must hold its share of the group, so filter on guests per room.
    cap.value = Math.min(4, Math.ceil((party.adults + party.children) / party.rooms));
    drawRooms();
    $("#rooms").scrollIntoView({ behavior: "smooth" });
  }
});

// ===== Rooms section: 3 featured, "See more" shows everything =====
const FEATURED = 3;
const gallery = $("#room-gallery"),
  cap = $("#capacity"),
  sort = $("#sort"),
  more = $("#more");
let expanded = false,
  applied = null;

function drawRooms() {
  // After a date search, only offer room types with enough free rooms for the whole stay,
  // whose combined capacity fits the group.
  const free = {};
  let list = getRooms().filter((r) => {
    if (r.guests < +cap.value) return false;
    if (!applied) return true;
    free[r.id] = roomsFree(r.id, applied.checkin, applied.checkout);
    return (
      free[r.id] >= applied.rooms && r.guests * applied.rooms >= applied.adults + applied.children
    );
  });
  if (sort.value === "low") list.sort((a, b) => a.price - b.price);
  if (sort.value === "high") list.sort((a, b) => b.price - a.price);
  const shown = expanded ? list : list.slice(0, FEATURED);
  gallery.innerHTML = shown.length
    ? shown.map((r) => roomCard(r, applied ? `${free[r.id]} left` : "")).join("")
    : `<div class="empty"><h3>${applied ? "No rooms are free for that stay" : `No rooms fit ${cap.value} guests`}</h3><p>${applied ? "Try different dates, fewer guests or more rooms." : "Try fewer guests or clear your filters."}</p><button class="btn" type="button" id="reset">Show all rooms</button></div>`;
  $("#count").textContent = shown.length
    ? `Showing ${shown.length} of ${plural(list.length, "room")}`
    : "";
  $("#filters").hidden = !expanded;
  $("#chip-box").innerHTML = applied
    ? `<span class="chip">${fmtDate(applied.checkin)} – ${fmtDate(applied.checkout)} · ${plural(applied.adults + applied.children, "guest")} · ${plural(applied.rooms, "room")}<button type="button" id="clear" aria-label="Clear search">✕</button></span>`
    : "";
  more.hidden = !expanded && list.length <= FEATURED;
  more.textContent = expanded
    ? "Show fewer rooms"
    : `See more rooms (${list.length - FEATURED} more)`;
  more.setAttribute("aria-expanded", expanded);
  const rb = $("#reset");
  if (rb)
    rb.addEventListener("click", () => {
      cap.value = 1;
      sort.value = "recommended";
      applied = null;
      drawRooms();
    });
  const cl = $("#clear");
  if (cl)
    cl.addEventListener("click", () => {
      applied = null;
      cap.value = 1;
      drawRooms();
    });
}
more.addEventListener("click", () => {
  expanded = !expanded;
  drawRooms();
  if (!expanded) $("#rooms").scrollIntoView({ behavior: "smooth" });
});
cap.addEventListener("change", drawRooms);
sort.addEventListener("change", drawRooms);
drawRooms();

// ===== Contact section =====
$("#contact-info").innerHTML = [
  ["Address", esc(hotelInfo.address)],
  ["Phone", `<a href="tel:${hotelInfo.phone.replace(/[^+\d]/g, "")}">${esc(hotelInfo.phone)}</a>`],
  ["Email", `<a href="mailto:${esc(hotelInfo.email)}">${esc(hotelInfo.email)}</a>`],
  ["Front desk", esc(hotelInfo.hours)],
]
  .map(([k, v]) => `<div class="info"><b>${k}</b><span>${v}</span></div>`)
  .join("");

const cf = { name: $("#c-name"), email: $("#c-email"), message: $("#c-message") };
const contactRules = {
  name: () => (cf.name.value.trim().length >= 2 ? "" : "Please enter your name."),
  email: () =>
    !cf.email.value.trim()
      ? "Please enter your email."
      : EMAIL_RE.test(cf.email.value.trim())
        ? ""
        : "Please enter a valid email address.",
  message: () =>
    cf.message.value.trim().length >= 10 ? "" : "Please write at least 10 characters.",
};
const checkContact = () =>
  Object.keys(contactRules)
    .map((k) => setError(cf[k], contactRules[k]()))
    .every(Boolean);
// Check each field as the person leaves it, without flagging fields they have not reached.
Object.keys(contactRules).forEach((k) =>
  cf[k].addEventListener("blur", () => {
    if (cf[k].value) setError(cf[k], contactRules[k]());
  }),
);
const contactDraft = keepFormOnRefresh($("#contact-form"));
$("#contact-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const n = $("#contact-notice");
  n.textContent = "";
  if (!checkContact()) return $(".invalid", e.target).focus();
  const msgs = store.get("aurest-messages", []);
  msgs.push({
    name: cf.name.value.trim(),
    email: cf.email.value.trim(),
    subject: $("#c-subject").value,
    message: cf.message.value.trim(),
    sent: new Date().toISOString(),
  });
  store.set("aurest-messages", msgs);
  e.target.reset();
  contactDraft.clear();
  n.textContent = "Thank you! Your message was sent. We'll reply by email soon.";
});

// ===== Hero picture slideshow: a new picture every 10 seconds, looping =====
(function heroSlideshow() {
  const slides = $$(".hero-slides .slide"),
    dots = $("#hero-dots"),
    pauseBtn = $("#hero-pause");
  if (slides.length < 2) return;
  const SECONDS = 10;
  let cur = 0,
    timer = null,
    paused = window.matchMedia("(prefers-reduced-motion: reduce)").matches; // respect "reduce motion" settings
  const playIcon =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>';
  const pauseIcon =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
  dots.innerHTML = slides
    .map(
      (_, i) =>
        `<button type="button" class="dot" data-i="${i}" aria-label="Show picture ${i + 1} of ${slides.length}"></button>`,
    )
    .join("");
  function show(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle("on", k === cur));
    $$(".dot", dots).forEach((d, k) => {
      d.classList.toggle("on", k === cur);
      d.toggleAttribute("aria-current", k === cur);
    });
  }
  const stop = () => {
    clearInterval(timer);
    timer = null;
  };
  const start = () => {
    stop();
    if (!paused && !document.hidden) timer = setInterval(() => show(cur + 1), SECONDS * 1000);
  };
  function drawPause() {
    pauseBtn.innerHTML = paused ? playIcon : pauseIcon;
    pauseBtn.setAttribute(
      "aria-label",
      paused ? "Play the picture slideshow" : "Pause the picture slideshow",
    );
  }
  dots.addEventListener("click", (e) => {
    const d = e.target.closest(".dot");
    if (d) {
      show(+d.dataset.i);
      start();
    }
  });
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    drawPause();
    start();
  });
  document.addEventListener("visibilitychange", start); // no catching up while the tab is hidden
  show(0);
  drawPause();
  start();
})();

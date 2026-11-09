// ----- Guests and rooms picker -----
const s0 = getSearch();
const party = { adults: s0.adults, children: s0.children, rooms: s0.rooms, pets: s0.pets };
const toggle = $("#picker-toggle"),
  panel = $("#picker-panel");
function updateGuests() {
  ["adults", "children", "rooms"].forEach((k) => ($("#val-" + k).textContent = party[k]));
  $$(".stepper").forEach((s) => {
    const v = party[s.dataset.key];
    s.querySelector('[data-step="-1"]').disabled = v <= +s.dataset.min;
    s.querySelector('[data-step="1"]').disabled = v >= +s.dataset.max;
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
$$(".stepper").forEach((s) =>
  s.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const k = s.dataset.key;
    party[k] = Math.min(+s.dataset.max, Math.max(+s.dataset.min, party[k] + +b.dataset.step));
    updateGuests();
  }),
);
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
    cap.value = Math.min(4, Math.max(1, party.adults + party.children));
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
  let list = getRooms().filter((r) => r.guests >= +cap.value);
  if (sort.value === "low") list.sort((a, b) => a.price - b.price);
  if (sort.value === "high") list.sort((a, b) => b.price - a.price);
  const shown = expanded ? list : list.slice(0, FEATURED);
  gallery.innerHTML = shown.length
    ? shown.map(roomCard).join("")
    : `<div class="empty"><h3>No rooms fit ${cap.value} guests</h3><p>Try fewer guests or clear your filters.</p><button class="btn" type="button" id="reset">Show all rooms</button></div>`;
  $("#count").textContent = shown.length
    ? `Showing ${shown.length} of ${plural(list.length, "room")}`
    : "";
  $("#filters").hidden = !expanded;
  $("#chip-box").innerHTML = applied
    ? `<span class="chip">${fmtDate(applied.checkin)} – ${fmtDate(applied.checkout)} · ${plural(applied.adults + applied.children, "guest")}<button type="button" id="clear" aria-label="Clear search">✕</button></span>`
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
const checkContact = () =>
  [
    setError(cf.name, cf.name.value.trim().length >= 2 ? "" : "Please enter your name."),
    setError(
      cf.email,
      !cf.email.value.trim()
        ? "Please enter your email."
        : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cf.email.value.trim())
          ? ""
          : "Please enter a valid email address.",
    ),
    setError(
      cf.message,
      cf.message.value.trim().length >= 10 ? "" : "Please write at least 10 characters.",
    ),
  ].every(Boolean);
Object.values(cf).forEach((i) =>
  i.addEventListener("blur", () => {
    if (i.value) checkContact();
  }),
);
$("#contact-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const n = $("#contact-notice");
  n.textContent = "";
  if (!checkContact()) return;
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

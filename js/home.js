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
let roomSelectionReady = false;
function updateGuests() {
  ["adults", "children", "rooms"].forEach((k) => {
    const input = $("#val-" + k);
    if (document.activeElement !== input || +input.value !== party[k]) input.value = party[k];
  });
  $$(".stepper").forEach((s) => {
    s.querySelector('[data-step="-1"]').disabled = party[s.dataset.key] <= +s.dataset.min;
  });
  $("#picker-summary").textContent =
    `${plural(party.adults, "adult")} \u00b7 ${plural(party.children, "child", "children")} \u00b7 ${plural(party.rooms, "room")}` +
    (party.pets ? " \u00b7 Pets" : "");
  if (roomSelectionReady) {
    store.set("aurest-search", { ...getSearch(), ...party });
    if (applied) applied = { ...applied, ...party };
    drawRooms();
  }
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
    cap.value = 1;
    // Keep the selection when guests or dates change; validate availability at checkout.
    drawRooms();
    $("#rooms").scrollIntoView({ behavior: "smooth" });
  }
});

// ===== Rooms section: 3 featured, "See more" shows everything =====
const selected = new Set(store.get("aurest-room-selection", []));
const FEATURED = 3;
const gallery = $("#room-gallery"),
  cap = $("#capacity"),
  sort = $("#sort"),
  more = $("#more");
let expanded = false,
  applied = null;

function drawRooms() {
  for (const id of selected) if (!getRooms().some((r) => r.id === id)) selected.delete(id);
  if (selected.size > party.rooms) {
    const keep = [...selected].slice(0, party.rooms);
    selected.clear();
    keep.forEach((id) => selected.add(id));
    toast("Room count reduced. The most recently selected extra rooms were removed.");
  }
  if (party.rooms <= 1) selected.clear();
  // After a date search, only offer room types with enough free rooms for the whole stay,
  // whose combined capacity fits the group.
  const free = {};
  let list = getRooms().filter((r) => {
    if (r.guests < +cap.value) return false;
    const min = +$("#price-min").value || 0,
      max = $("#price-max").value === "" ? Infinity : +$("#price-max").value;
    $("#filter-error").textContent =
      max < min ? "Maximum price must be at least the minimum price." : "";
    if (r.price < min || r.price > max) return false;
    if (!r.bed.toLowerCase().includes($("#bed-filter").value)) return false;
    if ($("#amenity-filter").value && !r.amenities.includes($("#amenity-filter").value))
      return false;
    if (!applied) return true;
    free[r.id] = roomsFree(r.id, applied.checkin, applied.checkout);
    return free[r.id] >= 1;
  });
  if (sort.value === "low") list.sort((a, b) => a.price - b.price);
  if (sort.value === "high") list.sort((a, b) => b.price - a.price);
  const shown = expanded ? list : list.slice(0, FEATURED);
  gallery.innerHTML = shown.length
    ? shown.map((r) => selectableCard(r, applied ? `${free[r.id]} left` : "")).join("")
    : `<div class="empty"><h3>No rooms match your filters</h3><p>Try different dates or reset the room filters.</p><button class="btn" type="button" id="reset">Show all rooms</button></div>`;
  $("#count").textContent = shown.length
    ? `Showing ${shown.length} of ${plural(list.length, "room")}`
    : "";
  $("#filters").hidden = false;
  $("#chip-box").innerHTML = applied
    ? `<span class="chip">${fmtDate(applied.checkin)} \u2013 ${fmtDate(applied.checkout)} \u00b7 ${plural(applied.adults + applied.children, "guest")} \u00b7 ${plural(applied.rooms, "room")}<button type="button" id="clear" aria-label="Clear search">\u2715</button></span>`
    : "";
  more.hidden = !expanded && list.length <= FEATURED;
  more.textContent = expanded
    ? "Show fewer rooms"
    : `See more rooms (${list.length - FEATURED} more)`;
  more.setAttribute("aria-expanded", expanded);
  drawSelection();
  const rb = $("#reset");
  if (rb)
    rb.addEventListener("click", () => {
      resetRoomFilters();
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
roomSelectionReady = true;
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

function selectableCard(r, note) {
  if (party.rooms <= 1) return roomCard(r, note);
  const checked = selected.has(r.id);
  return roomCard(r, note).replace(
    '<article class="card">',
    '<article class="card selectable' +
      (checked ? " selected" : "") +
      '" data-room="' +
      r.id +
      '"><label class="room-select"><input type="checkbox" data-select="' +
      r.id +
      '" ' +
      (checked ? "checked" : "") +
      "><span>Select " +
      esc(r.name) +
      "</span></label>",
  );
}
function drawSelection() {
  $(".selection-bar").hidden = party.rooms <= 1;
  $("#selection-help").hidden = party.rooms <= 1;
  for (const id of selected) if (!getRooms().some((r) => r.id === id)) selected.delete(id);
  store.set("aurest-room-selection", [...selected]);
  const list = getRooms().filter((r) => selected.has(r.id));
  const s = { checkin: cin.value, checkout: cout.value, ...party };
  const total = list.reduce((sum, r) => sum + r.price, 0) * nightsBetween(s.checkin, s.checkout);
  $("#selection-summary").textContent =
    `${list.length} of ${party.rooms} rooms selected` +
    (list.length
      ? ` - ${list.map((r) => r.name).join(", ")} - ${peso(total)} total for ${plural(nightsBetween(s.checkin, s.checkout), "night")}`
      : "");
  $("#book-selected").textContent = list.length
    ? "Book " + plural(list.length, "selected room")
    : "Book selected rooms";
  $("#book-selected").disabled = list.length !== party.rooms;
  $("#clear-selection").disabled = !list.length;
  $("#selection-details").hidden = !list.length;
  $("#selection-prices").innerHTML = roomBreakdown({
    ...s,
    roomItems: list.map((r) => ({ roomId: r.id, quantity: 1 })),
  });
  const atLimit = selected.size >= party.rooms;
  $$("[data-select]", gallery).forEach((input) => {
    input.disabled = atLimit && !selected.has(input.dataset.select);
    input.closest(".card").classList.toggle("selection-disabled", input.disabled);
  });
}
gallery.addEventListener("click", (e) => {
  if (e.target.closest("a, label, input")) return;
  const card = e.target.closest("[data-room]");
  if (card) {
    const input = card.querySelector("input");
    input.click();
  }
});
gallery.addEventListener("change", (e) => {
  const id = e.target.dataset.select;
  if (!id) return;
  if (e.target.checked && selected.size >= party.rooms) {
    e.target.checked = false;
    toast(
      `You selected ${party.rooms} rooms. Change the room count in Guests and rooms to select more.`,
    );
    return;
  }
  if (e.target.checked) selected.add(id);
  else selected.delete(id);
  e.target.closest(".card").classList.toggle("selected", e.target.checked);
  drawSelection();
});
$("#change-room-count").addEventListener("click", (e) => {
  e.stopPropagation();
  $("#search").scrollIntoView({ behavior: "smooth", block: "center" });
  setPanel(true);
  $("#val-rooms").focus();
});
$("#clear-selection").addEventListener("click", () => {
  selected.clear();
  drawRooms();
});
$("#book-selected").addEventListener("click", () => {
  if (party.rooms <= 1) return;
  const s = { checkin: cin.value, checkout: cout.value, ...party };
  const list = getRooms().filter((r) => selected.has(r.id));
  if (list.length !== party.rooms) {
    toast(`Select exactly ${plural(party.rooms, "room")} to continue.`);
    return;
  }
  if (!s.checkin || !s.checkout || s.checkin < addDays(0) || s.checkout <= s.checkin) {
    toast("Please search for valid future dates first.");
    return;
  }
  if (list.length > s.adults) {
    toast("Each selected room needs at least one adult. Update your guests in Search.");
    return;
  }
  if (list.reduce((sum, r) => sum + r.guests, 0) < s.adults + s.children) {
    toast("Select more rooms or larger rooms to fit your group.");
    return;
  }
  const d = {
    ...s,
    roomId: list[0].id,
    rooms: party.rooms,
    roomItems: list.map((r) => ({ roomId: r.id, quantity: 1 })),
  };
  if (!selectionFree(d, s.checkin, s.checkout)) {
    toast("A selected room is unavailable for these dates. Change your selection or search again.");
    return;
  }
  store.set("aurest-search", s);
  store.set("aurest-draft", d);
  location.href = getUser() ? "booking.html" : "login.html?next=booking.html";
});

function resetRoomFilters() {
  ["price-min", "price-max", "bed-filter", "amenity-filter"].forEach(
    (id) => ($("#" + id).value = ""),
  );
  cap.value = "1";
  sort.value = "recommended";
  $("#filter-error").textContent = "";
}
$("#amenity-filter").innerHTML += [...new Set(getRooms().flatMap((r) => r.amenities))]
  .sort()
  .map((a) => '<option value="' + esc(a) + '">' + esc(a) + "</option>")
  .join("");
["price-min", "price-max", "bed-filter", "amenity-filter"].forEach((id) =>
  $("#" + id).addEventListener("input", () => {
    expanded = true;
    drawRooms();
  }),
);
$("#reset-filters").addEventListener("click", () => {
  resetRoomFilters();
  drawRooms();
});
// Keep detail-page room count and dates consistent with the current picker.
gallery.addEventListener(
  "click",
  (e) => {
    if (e.target.closest("a"))
      store.set("aurest-search", { checkin: cin.value, checkout: cout.value, ...party });
  },
  true,
);

[cin, cout].forEach((input) => input.addEventListener("change", drawSelection));

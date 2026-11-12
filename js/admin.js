// Front-end demo access check. Production must enforce admin permissions on the server.
if (!isAdmin()) location.replace("login.html?next=admin.html");

// Photos are shrunk by readImage() in app.js. There is no set number of extra photos;
// browser storage (about 5 MB) is the only limit, and saving reports when it is full.
const ROOM_PHOTOS_KEY = FORM_DRAFT_PREFIX + "room-photos";
let thumb = null,
  extra = [];
const f = (id) => document.getElementById(id);
// "1 king bed, 2 single beds" → ["1 king bed", "2 single beds"], the same way as amenities.
const commaList = (v) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const prev =(src, label, i, main) =>
  `<div class="preview${main ? " main" : ""}"><img src="${src}" alt="${label}"><button type="button" data-rm="${i}" aria-label="Remove ${label}">✕</button></div>`;
function drawPreviews() {
  f("thumb-prev").innerHTML = thumb ? prev(thumb, "thumbnail", 0, true) : "";
  f("more-prev").innerHTML = extra.map((s, i) => prev(s, "photo " + (i + 1), i)).join("");
  try {
    sessionStorage.setItem(ROOM_PHOTOS_KEY, JSON.stringify({ thumb, extra }));
  } catch {
    sessionStorage.removeItem(ROOM_PHOTOS_KEY); // too large to keep, so photos won't survive a refresh
  }
}
f("thumb-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    thumb = await readImage(file);
    setError(f("thumb-file"), "");
  } catch (err) {
    setError(f("thumb-file"), err.message);
  }
  e.target.value = "";
  drawPreviews();
});
f("more-files").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  setError(f("more-files"), "");
  for (const file of files) {
    try {
      extra.push(await readImage(file));
    } catch (err) {
      setError(f("more-files"), err.message);
    }
  }
  e.target.value = "";
  drawPreviews();
});
f("thumb-prev").addEventListener("click", (e) => {
  if (e.target.dataset.rm !== undefined) {
    thumb = null;
    drawPreviews();
  }
});
f("more-prev").addEventListener("click", (e) => {
  if (e.target.dataset.rm !== undefined) {
    extra.splice(+e.target.dataset.rm, 1);
    drawPreviews();
  }
});

// ----- Validation + save -----
const rules = {
  "r-name": (v) => (v.trim().length >= 2 ? "" : "Please enter a room name."),
  "r-price": (v) => (+v > 0 ? "" : "Enter a price greater than 0."),
  "r-guests": (v) =>
    Number.isInteger(+v) && +v >= 1 && +v <= 10 ? "" : "Enter a whole number from 1 to 10.",
  "r-units": (v) =>
    v !== "" && Number.isInteger(+v) && +v >= 1 ? "" : "Enter how many of these rooms you have.",
  "r-bed": (v) => (commaList(v).length ? "" : "Please enter at least one bed type."),
  "r-size": (v) => (+v > 0 ? "" : "Enter the room size in m²."),
  "r-desc": (v) => (v.trim().length >= 10 ? "" : "Write at least 10 characters."),
};
const run = (k) => setError(f(k), rules[k](f(k).value));
Object.keys(rules).forEach((k) =>
  f(k).addEventListener("blur", () => {
    if (f(k).value) run(k);
  }),
);

// Bring back an unfinished room after a refresh, including its photos and any field errors.
const roomDraft = keepFormOnRefresh(f("room-form"));
try {
  const photos = JSON.parse(sessionStorage.getItem(ROOM_PHOTOS_KEY));
  if (photos) ({ thumb, extra } = photos);
} catch {}
drawPreviews();
if (roomDraft.restored || thumb || extra.length) {
  setAddRoomOpen(true);
  Object.keys(rules).forEach((k) => {
    if (f(k).value) run(k);
  });
}

function clearForm() {
  roomDraft.clear();
  f("room-form").reset();
  thumb = null;
  extra = [];
  drawPreviews();
  $$(".invalid", f("room-form")).forEach((i) => setError(i, ""));
  setError(f("thumb-file"), "");
}
f("reset-form").addEventListener("click", async () => {
  const hasData =
    thumb ||
    extra.length ||
    $$("input, textarea", f("room-form")).some((i) => i.type !== "file" && i.value.trim());
  if (!hasData) return;
  if (
    await confirmDialog({
      title: "Clear the form?",
      message: "Everything you've entered, including photos, will be removed.",
      confirmText: "Yes, clear it",
      cancelText: "Keep editing",
      danger: true,
    })
  )
    clearForm();
});

f("room-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  f("add-error").textContent = "";
  const ok = Object.keys(rules).map(run).every(Boolean);
  const okThumb = setError(f("thumb-file"), thumb ? "" : "Please add a thumbnail image.");
  if (!ok || !okThumb) {
    f("add-error").textContent = "Please fix the highlighted fields.";
    const bad = $(".invalid");
    if (bad) bad.focus();
    return;
  }

  const ok2 = await confirmDialog({
    title: "Add this room?",
    message: `"${f("r-name").value.trim()}" at ${peso(+f("r-price").value)} per night will appear on the home page right away.`,
    confirmText: "Yes, add room",
    cancelText: "Review again",
  });
  if (!ok2) return;
  const mine = store.get("aurest-rooms", []);
  const nextNum = Math.max(3, ...getAllRooms().map((r) => parseInt(r.id.slice(1), 10) || 0)) + 1; // counts deleted defaults too, so ids never repeat
  const room = {
    id: "R" + String(nextNum).padStart(3, "0"),
    name: f("r-name").value.trim(),
    price: +f("r-price").value,
    guests: +f("r-guests").value,
    units: +f("r-units").value,
    bed: commaList(f("r-bed").value).join(", "), // room-details.js shows each bed type as its own tag
    size: +f("r-size").value,
    desc: f("r-desc").value.trim(),
    amenities: commaList(f("r-amen").value),
    photo: thumb,
    gallery: [thumb, ...extra],
    added: true,
  };
  try {
    localStorage.setItem("aurest-rooms", JSON.stringify([...mine, room]));
  } catch {
    f("add-error").textContent =
      "Browser storage is full. Remove an added room or use smaller photos.";
    return;
  }
  clearForm();
  setAddRoomOpen(false);
  render();
  toast(`${room.name} was added. It's now on the home page.`);
});

// "Restore default rooms" button (sits next to the Rooms description)
f("rooms-body")
  .closest(".card-box")
  .querySelector(".sub")
  .insertAdjacentHTML(
    "beforeend",
    ' <button type="button" class="btn-outline" id="restore-rooms" hidden style="min-height:36px;padding:0 14px;font-size:14px;margin-left:8px"></button>',
  );
f("restore-rooms").addEventListener("click", async () => {
  const n = hiddenRoomIds().length;
  if (
    !(await confirmDialog({
      title: "Restore default rooms?",
      message: `${plural(n, "default room")} will show on the website again.`,
      confirmText: "Yes, restore",
      cancelText: "Cancel",
    }))
  )
    return;
  store.del("aurest-hidden-rooms");
  render();
  toast("Default rooms restored.");
});

// ----- Tables -----
const guestName = (b) => b.guestName || (guests.find((g) => g.id === b.guestId) || {}).name || "—";
const roomName = (b) =>
  ((getAllRooms().find((r) => r.id === b.roomId) || {}).name || b.roomName || b.roomId) +
  (roomQty(b) > 1 ? " × " + roomQty(b) : "");

function render() {
  const bk = allBookings(),
    today = addDays(0);
  const upcoming = bk
    .filter((b) => b.status !== "Cancelled" && b.checkin >= today)
    .sort((a, b) => a.checkin.localeCompare(b.checkin));
  f("stats").innerHTML = [
    ["Rooms listed", getRooms().length],
    ["Pending bookings", bk.filter((b) => b.status === "Pending").length],
    ["Confirmed bookings", bk.filter((b) => b.status === "Confirmed").length],
    ["Upcoming arrivals", upcoming.length],
  ]
    .map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`)
    .join("");
  drawCharts(bk); // js/charts.js: status bars + occupancy meter
  f("arrivals").innerHTML =
    upcoming
      .slice(0, 5)
      .map(
        (b) =>
          `<tr><td>${esc(guestName(b))}</td><td>${esc(roomName(b))}</td><td>${fmtDate(b.checkin)} – ${fmtDate(b.checkout)}</td><td>${statusChip(b.status)}</td></tr>`,
      )
      .join("") || `<tr><td colspan="4">No upcoming arrivals.</td></tr>`;
  f("today-arrivals").innerHTML =
    upcoming
      .filter((b) => b.checkin === today)
      .map(
        (b) =>
          `<tr><td>${esc(guestName(b))}</td><td>${esc(roomName(b))}</td><td>${fmtDate(b.checkin)} – ${fmtDate(b.checkout)}</td><td>${statusChip(b.status)}</td></tr>`,
      )
      .join("") || `<tr><td colspan="4">No arrivals today.</td></tr>`;
  f("rooms-body").innerHTML = getRooms()
    .map(
      (
        r,
      ) => `<tr><td>${r.id}</td><td><img class="mini-thumb" src="${r.photo}" alt="">${esc(r.name)}</td><td>${r.guests}</td><td>${roomUnits(r)}</td><td>${peso(r.price)}</td>
    <td><span class="tag">${r.added ? "Added by admin" : "Default"}</span></td>
    <td><button class="btn-danger" type="button" data-del="${r.id}">Delete</button></td></tr>`,
    )
    .join("");
  const gone = hiddenRoomIds().length,
    rb = f("restore-rooms");
  rb.hidden = !gone;
  rb.textContent = `Restore ${plural(gone, "default room")}`;
  f("bookings-body").innerHTML = bk
    .map(
      (
        b,
      ) => `<tr><td>${b.id}</td><td>${esc(guestName(b))}</td><td>${esc(roomName(b))}</td><td>${b.checkin}</td><td>${b.checkout}</td><td>${b.guests}</td>
    <td><select data-bk="${b.id}" aria-label="Status for booking ${b.id}"${b.status === "Cancelled" ? " disabled" : ""}>${["Pending", "Confirmed", "Cancelled"].map((s) => `<option${s === b.status ? " selected" : ""}>${s}</option>`).join("")}</select></td><td>${b.status !== "Cancelled" ? `<button class="btn-outline" data-admin-reschedule="${b.id}">Reschedule</button>` : "—"}</td></tr>`,
    )
    .join("");
  f("guests-body").innerHTML = [
    ...guests,
    ...allUsers()
      .filter((u) => u.role !== "admin" && !guests.some((g) => g.email === u.email))
      .map((u) => ({ ...u, id: "Account", phone: profileFor(u.email).phone || "—" })),
  ]
    .map(
      (g) =>
        `<tr><td>${g.id}</td><td>${esc(g.name)}</td><td>${esc(g.email)}</td><td>${g.phone}</td></tr>`,
    )
    .join("");
  updateAdminHub();
}
f("rooms-body").addEventListener("click", async (e) => {
  const id = e.target.dataset.del;
  if (!id) return;
  const r = getRooms().find((x) => x.id === id);
  const ok = await confirmDialog({
    title: `Delete "${r.name}"?`,
    message: r.added
      ? "Guests will no longer see this room. This can't be undone."
      : 'Guests will no longer see this room. You can bring it back later with "Restore default rooms".',
    confirmText: "Yes, delete room",
    cancelText: "Keep room",
    danger: true,
  });
  if (!ok) return;
  if (r.added)
    store.set(
      "aurest-rooms",
      store.get("aurest-rooms", []).filter((x) => x.id !== id),
    );
  else store.set("aurest-hidden-rooms", [...hiddenRoomIds(), id]); // default rooms are hidden, not erased
  render();
  toast("Room deleted.");
});
render();

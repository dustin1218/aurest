const room = getRooms().find((r) => r.id === new URLSearchParams(location.search).get("id"));
const wrap = $("#detail-wrap");
if (!room) {
  wrap.innerHTML = `<div class="soon"><h1>Room not found</h1><p>We couldn't find that room. It may have been removed.</p><a class="btn" href="index.html#rooms">Browse all rooms</a></div>`;
} else {
  document.title = `${room.name} | AUREST`;
  $("#crumb-room").textContent = room.name;
  const s = getSearch(),
    n = nightsBetween(s.checkin, s.checkout),
    qty = Math.max(1, +s.rooms || 1),
    left = roomsFree(room.id, s.checkin, s.checkout),
    free = left >= 1;
  const bookLabel = free
    ? qty > 1
      ? "Choose rooms separately"
      : "Reserve this room"
    : left
      ? `Only ${left} left on these dates`
      : "Not available on these dates";
  // Each bed type is its own feature tag, the same as amenities.
  const beds = room.bed
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  wrap.innerHTML = `
    <div class="detail">
      <div>
        <img class="main-photo" id="main-photo" src="${room.gallery[0]}" alt="${esc(room.name)} photo 1">
        <div class="thumbs" role="group" aria-label="Room photos">${room.gallery
          .map(
            (g, i) =>
              `<button class="thumb" type="button" data-i="${i}" aria-pressed="${i === 0}" aria-label="Show photo ${i + 1}"><img src="${g}" alt=""></button>`,
          )
          .join("")}</div>
      </div>
      <aside class="panel">
        <h1>${esc(room.name)}</h1>
        <div class="meta">${room.guests} guests · ${esc(room.bed)} · ${room.size} m²</div>
        <p class="lead">${esc(room.desc)}</p>
        <span class="price">${peso(room.price)} <small>/ night</small></span>
        <div class="stay-line">Your stay: <b>${fmtDate(s.checkin)} – ${fmtDate(s.checkout)}</b> (${plural(n, "night")}) · This room total <b>${peso(room.price * n)}</b><br>${plural(left, "room")} available for these dates · <a href="index.html#home">Change dates or rooms</a></div>
        <button class="btn-outline block" id="add-selection" type="button"${qty > 1 ? "" : " hidden"}${left ? "" : " disabled"}>Select this room</button>
        <p${qty > 1 ? "" : " hidden"}>Select this room, then return to the room list to add other rooms and book them together.</p>
        <button class="btn block" id="reserve" type="button"${qty > 1 ? " hidden" : ""}${free ? "" : " disabled"}>${bookLabel}</button>
      </aside>
    </div>
    <ul class="amenities" aria-label="Room features">${beds.map((b) => `<li>${esc(b)}</li>`).join("")}<li>${room.size} m²</li>${room.amenities.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`;
  $$(".thumb").forEach((t) =>
    t.addEventListener("click", () => {
      $("#main-photo").src = room.gallery[t.dataset.i];
      $("#main-photo").alt = `${room.name} photo ${+t.dataset.i + 1}`;
      $$(".thumb").forEach((x) => x.setAttribute("aria-pressed", x === t));
    }),
  );
  $("#add-selection").addEventListener("click", () => {
    if (qty <= 1) return;
    const selection = new Set(store.get("aurest-room-selection", []));
    const maxRooms = Math.max(1, +getSearch().rooms || 1);
    if (!selection.has(room.id) && selection.size >= maxRooms) {
      toast(
        `You selected ${maxRooms} rooms already. Change the room count in Guests and rooms to add more.`,
      );
      return;
    }
    selection.add(room.id);
    store.set("aurest-room-selection", [...selection]);
    location.href = "index.html#rooms";
  });
  $("#reserve").addEventListener("click", () => {
    if (qty > 1 || !free) return;
    store.set("aurest-draft", {
      roomId: room.id,
      checkin: s.checkin,
      checkout: s.checkout,
      adults: s.adults,
      children: s.children,
      rooms: 1,
    });
    location.href = getUser() ? "booking.html" : "login.html?next=booking.html";
  });
}

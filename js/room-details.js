const room = getRooms().find((r) => r.id === new URLSearchParams(location.search).get("id"));
const wrap = $("#detail-wrap");
if (!room) {
  wrap.innerHTML = `<div class="soon"><h1>Room not found</h1><p>We couldn't find that room. It may have been removed.</p><a class="btn" href="index.html#rooms">Browse all rooms</a></div>`;
} else {
  document.title = `${room.name} | AUREST`;
  $("#crumb-room").textContent = room.name;
  const s = getSearch(),
    n = nightsBetween(s.checkin, s.checkout);
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
        <div class="stay-line">Your stay: <b>${fmtDate(s.checkin)} – ${fmtDate(s.checkout)}</b> (${plural(n, "night")}) · Total <b>${peso(room.price * n)}</b><br><a href="index.html#home">Change dates</a></div>
        <button class="btn block" id="reserve" type="button">Reserve this room</button>
      </aside>
    </div>
    <ul class="amenities" aria-label="Room features"><li>${esc(room.bed)}</li><li>${room.size} m²</li>${room.amenities.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`;
  $$(".thumb").forEach((t) =>
    t.addEventListener("click", () => {
      $("#main-photo").src = room.gallery[t.dataset.i];
      $$(".thumb").forEach((x) => x.setAttribute("aria-pressed", x === t));
    }),
  );
  $("#reserve").addEventListener("click", () => {
    store.set("aurest-draft", {
      roomId: room.id,
      checkin: s.checkin,
      checkout: s.checkout,
      adults: s.adults,
      children: s.children,
    });
    location.href = getUser() ? "booking.html" : "login.html?next=booking.html";
  });
}

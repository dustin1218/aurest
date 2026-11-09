// ===== Admin charts (plain HTML + CSS, no library) =====
// 1) "Bookings by status": one bar per status, with a table view.
// 2) "Occupancy": a meter showing how many rooms have a stay on the chosen night.
// admin.js calls drawCharts(bookings) every time the data changes.

// Status colors are the fixed status scale (good / warning / critical). Each bar also has a name and an outline icon,
// so the meaning never depends on color alone. Order puts green and red apart, which keeps them readable for color-blind viewers.
const STATUS_BARS = [
  {
    status: "Confirmed",
    color: "#0ca30c",
    icon: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 9.5"/>',
  },
  {
    status: "Pending",
    color: "#fab219",
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  },
  {
    status: "Cancelled",
    color: "#d03b3b",
    icon: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  },
];
const vizIcon = (paths) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

let chartBookings = [];
let showTable = false;

function drawCharts(bookings) {
  chartBookings = bookings;
  drawStatusChart();
  drawOccupancy();
}

// ----- Bookings by status -----
function drawStatusChart() {
  const box = document.getElementById("status-chart");
  const rows = STATUS_BARS.map((s) => ({
    ...s,
    n: chartBookings.filter((b) => b.status === s.status).length,
  }));
  const total = rows.reduce((t, r) => t + r.n, 0),
    max = Math.max(1, ...rows.map((r) => r.n));
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  document.getElementById("sc-toggle").setAttribute("aria-pressed", showTable);
  if (!total) {
    box.innerHTML = `<p class="viz-empty">No bookings yet. Reservations will appear here as guests make them.</p>`;
    return;
  }

  box.innerHTML = showTable
    ? `<div class="table-wrap"><table><thead><tr><th>Status</th><th>Bookings</th><th>Share</th></tr></thead><tbody>${rows
        .map((r) => `<tr><td>${r.status}</td><td>${r.n}</td><td>${pct(r.n)}%</td></tr>`)
        .join(
          "",
        )}<tr><td><b>Total</b></td><td><b>${total}</b></td><td>100%</td></tr></tbody></table></div>`
    : `<div class="bars">${rows
        .map(
          (r) => `
        <div class="bar-row" tabindex="0" role="group" aria-label="${r.status}: ${plural(r.n, "booking")}, ${pct(r.n)}% of ${total}"
             data-status="${r.status}" data-n="${r.n}" data-pct="${pct(r.n)}" data-total="${total}">
          <span class="bar-name">${vizIcon(r.icon)}${r.status}</span>
          <span class="bar-plot"><span class="bar-fill" style="--w:${(r.n / max) * 100}%;--c:${r.color}"></span>
            <span class="bar-val" style="--w:${(r.n / max) * 100}%"><b>${r.n}</b><small>${pct(r.n)}%</small></span></span>
        </div>`,
        )
        .join("")}</div>`;
}

// One tooltip for the bars. It shows on hover and on keyboard focus. Text is set with textContent, never innerHTML.
const tip = document.createElement("div");
tip.className = "viz-tip";
tip.setAttribute("role", "tooltip");
tip.hidden = true;
tip.innerHTML = `<b></b><span></span>`;
function showTip(row, x, y) {
  const box = document.getElementById("status-chart").getBoundingClientRect();
  tip.firstChild.textContent = row.dataset.n;
  tip.lastChild.textContent = `${row.dataset.status} · ${row.dataset.pct}% of ${plural(+row.dataset.total, "booking")}`;
  tip.hidden = false;
  tip.style.left = Math.min(Math.max(8, x - box.left + 14), box.width - tip.offsetWidth - 8) + "px";
  tip.style.top = y - box.top - tip.offsetHeight - 10 + "px";
}
const statusBox = document.getElementById("status-chart");
statusBox.appendChild(tip); // drawStatusChart() replaces innerHTML, so re-attach the tooltip after each draw
new MutationObserver(() => {
  if (!statusBox.contains(tip)) statusBox.appendChild(tip);
}).observe(statusBox, { childList: true });
statusBox.addEventListener("pointermove", (e) => {
  const r = e.target.closest(".bar-row");
  r ? showTip(r, e.clientX, e.clientY) : (tip.hidden = true);
});
statusBox.addEventListener("pointerleave", () => {
  tip.hidden = true;
});
statusBox.addEventListener("focusin", (e) => {
  const r = e.target.closest(".bar-row");
  if (!r) return;
  const b = r.getBoundingClientRect();
  showTip(r, b.left + b.width / 2, b.top + 6);
});
statusBox.addEventListener("focusout", () => {
  tip.hidden = true;
});
document.getElementById("sc-toggle").addEventListener("click", () => {
  showTable = !showTable;
  drawStatusChart();
});

// ----- Occupancy on a chosen night -----
const occDate = document.getElementById("occ-date");
occDate.value = addDays(0);
occDate.addEventListener("change", drawOccupancy);

function drawOccupancy() {
  const box = document.getElementById("occupancy");
  const day = occDate.value || addDays(0);
  const all = getRooms();
  // A room is occupied on a night when it has a Pending or Confirmed stay that starts on or before it and ends after it (check-out day is free).
  const busy = new Set(
    chartBookings
      .filter((b) => b.status !== "Cancelled" && b.checkin <= day && day < b.checkout)
      .map((b) => b.roomId),
  );
  const used = all.filter((r) => busy.has(r.id));
  const pct = all.length ? Math.round((used.length / all.length) * 100) : 0;
  const label = new Date(day + "T00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  box.innerHTML = all.length
    ? `<p class="occ-figure"><b>${used.length}</b> of ${plural(all.length, "room")} occupied</p>
       <div class="meter" role="meter" aria-label="Occupied rooms" aria-valuemin="0" aria-valuemax="${all.length}" aria-valuenow="${used.length}"
            aria-valuetext="${used.length} of ${all.length} rooms occupied, ${pct}%"><span style="width:${pct}%"></span></div>
       <p class="occ-note">${pct}% occupied on ${esc(label)}. Pending and Confirmed bookings count; a guest checking out that day does not.</p>
       ${used.length ? `<div class="occ-rooms" aria-label="Occupied rooms">${used.map((r) => `<span class="tag">${esc(r.name)}</span>`).join("")}</div>` : ""}`
    : `<p class="viz-empty">No rooms are listed yet.</p>`;
}

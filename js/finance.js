// Prototype ledger: submitted references are never treated as received money.
const profileFor = (email) => store.get("aurest-profiles", {})[email] || {};
const transactions = () => store.get("aurest-transactions", []);
// Let storage errors reach the form so a failed write is not reported as a successful save.
function persist(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
// Keep edits separate from seeded/sample bookings; allBookings() merges these patches when reading.
function patchBooking(id, patch) {
  const u = store.get("aurest-booking-updates", {});
  u[id] = { ...u[id], ...patch };
  persist("aurest-booking-updates", u);
}
// How many rooms of a type the hotel has (older saved rooms have no count, so they count as one),
// and how many rooms a booking holds (older bookings hold one).
const roomUnits = (r) => Math.max(1, Math.floor(+(r && r.units)) || 1);
const roomQty = (b) => Math.max(1, Math.floor(+b.rooms) || 1);
// Use the saved booking price, then subtract the staff-approved discount once.
function bookingTotal(b) {
  return Math.max(
    0,
    (b.total ??
      (getAllRooms().find((r) => r.id === b.roomId)?.price || 0) *
        nightsBetween(b.checkin, b.checkout) *
        roomQty(b)) - (b.discountAmount || 0),
  );
}
// Only verified receipts and completed refunds affect money held. Pending refunds remain obligations.
function moneyFor(b) {
  const ts = transactions().filter((t) => t.bookingId === b.id);
  const paid = ts
    .filter((t) => t.kind === "Payment" && t.status === "Verified")
    .reduce((n, t) => n + t.amount, 0);
  const refunded = ts
    .filter((t) => t.kind === "Refund" && t.status === "Completed")
    .reduce((n, t) => n + t.amount, 0);
  const pending = ts
    .filter((t) => t.kind === "Refund" && t.status === "Pending")
    .reduce((n, t) => n + t.amount, 0);
  const net = paid - refunded,
    total = bookingTotal(b);
  return {
    paid,
    refunded,
    pending,
    net,
    total,
    balance: b.status === "Cancelled" ? 0 : Math.max(0, total - net),
    credit: Math.max(0, net - (b.status === "Cancelled" ? b.cancellationFee || 0 : total)),
  };
}
function addTransaction(t) {
  const ts = transactions();
  ts.push({ id: crypto.randomUUID(), created: new Date().toISOString(), ...t });
  persist("aurest-transactions", ts);
}
// Draft policy: measure the 48-hour window from 2 PM Philippine time; subtract queued refunds to avoid duplicates.
function cancellationQuote(b) {
  const m = moneyFor(b);
  const early = new Date(b.checkin + "T14:00:00+08:00") - Date.now() >= 48 * 3600000;
  const fee = early ? 0 : Math.min(m.net, Math.round(m.total * 0.3 * 100) / 100);
  return { fee, refund: Math.max(0, m.net - fee - m.pending) };
}
// Cancel the stay and queue any refund; this never sends money through a payment provider.
function cancelReservation(b) {
  const q = cancellationQuote(b);
  patchBooking(b.id, { cancellationFee: q.fee, cancelledAt: new Date().toISOString() });
  const statuses = store.get("aurest-status", {});
  statuses[b.id] = "Cancelled";
  persist("aurest-status", statuses);
  // Callers must resolve submitted transfers first. A queued refund is not a completed refund.
  if (q.refund)
    addTransaction({
      bookingId: b.id,
      kind: "Refund",
      amount: q.refund,
      status: "Pending",
      reference: "Cancellation",
    });
}
// Rooms of this type still free for every night from a to z. Stays overlap when each begins before
// the other ends; check-out day can be another guest’s check-in. The busiest night decides the count.
function roomsFree(roomId, a, z, exclude) {
  const room = getAllRooms().find((r) => r.id === roomId);
  if (!room || !a || !z || z <= a) return 0;
  const stays = allBookings().filter(
    (b) =>
      b.id !== exclude &&
      bookingItems(b).some(i => i.roomId === roomId) &&
      b.status !== "Cancelled" &&
      a < b.checkout &&
      z > b.checkin,
  );
  let busiest = 0;
  for (let night = a; night < z; night = nextDayIso(night)) {
    const held = stays
      .filter((b) => b.checkin <= night && night < b.checkout)
      .reduce((n, b) => n + bookingItems(b).filter(i => i.roomId === roomId).reduce((sum,i) => sum + i.quantity, 0), 0);
    busiest = Math.max(busiest, held);
  }
  return Math.max(0, roomUnits(room) - busiest);
}
function nextDayIso(s) {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function available(roomId, a, z, exclude, need = 1) {
  return roomsFree(roomId, a, z, exclude) >= need;
}
// How a payment was evidenced: typed reference, uploaded receipt image, or cash at the desk.
function txRef(t) {
  const parts = [];
  if (t.reference) parts.push(t.reference);
  if (t.receiptImage) parts.push("Receipt image");
  if (!parts.length && t.method === "Cash at front desk") parts.push("Pay at front desk");
  return parts.join(" · ") || "—";
}
function paymentSummary(b) {
  const m = moneyFor(b);
  return `Room total ${peso(m.total)} · Received ${peso(m.paid)} · Balance ${peso(m.balance)} · Refunded ${peso(m.refunded)}${m.pending ? " · Refund pending " + peso(m.pending) : ""}`;
}
// Reusable finance form: keep keyboard focus inside, restore it on close, and show save errors in the dialog.
function financeDialog(title, html, onSave) {
  const ov = document.createElement("div");
  ov.className = "modal-overlay";
  ov.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${html}<p class="error" role="alert"></p><div class="actions"><button class="btn" type="submit">Save</button><button class="btn-outline" type="button" data-close>Close</button></div></form>`;
  document.body.append(ov);
  const prior = document.activeElement;
  const close = () => {
    ov.remove();
    document.removeEventListener("keydown", keys);
    prior?.focus();
  };
  const keys = (e) => {
    if (e.key === "Escape") close();
    if (e.key === "Tab") {
      const els = $$("input, select, button, textarea", ov).filter((x) => !x.disabled);
      let i = els.indexOf(document.activeElement);
      e.preventDefault();
      els[(i + (e.shiftKey ? -1 : 1) + els.length) % els.length].focus();
    }
  };
  document.addEventListener("keydown", keys);
  $("[data-close]", ov).onclick = close;
  $("form", ov).onsubmit = async (e) => {
    e.preventDefault();
    try {
      await onSave(new FormData(e.target));
      close();
    } catch (err) {
      $(".error", ov).textContent = err.message;
    }
  };
  $("input,button", ov)?.focus();
  return $("form", ov);
}

// Carry receipts forward at the saved nightly rate; reset discount review and queue excess money for refund.
function rescheduleReservation(b, onSaved) {
  const id = b.id;
  // Say so before the person picks dates, not after.
  if (transactions().some((t) => t.bookingId === id && ["Pending", "Submitted"].includes(t.status))) {
    toast("Submitted payments and pending refunds must be reviewed before changing dates.");
    return;
  }
  financeDialog(
    "Reschedule your stay",
    `<p>Verified payments carry forward. The saved nightly rate applies. A shorter stay creates a refund request; extra nights increase your balance. ID and discount reviews restart.</p><label>Check-in<input type="date" name="start" min="${addDays(0)}" value="${b.checkin}" required></label><label>Check-out<input type="date" name="end" value="${b.checkout}" required></label>`,
    (d) => {
      const a = d.get("start"),
        z = d.get("end");
      if (a < addDays(0) || z <= a)
        throw Error("Choose future dates with check-out after check-in.");
      const qty = roomQty(b);
      if (!bookingItems(b).every(i => available(i.roomId, a, z, id, i.quantity)))
        throw Error(
          qty > 1
            ? `There aren't ${qty} of these rooms free on those dates.`
            : "This room is unavailable on those dates.",
        );
      // The saved rate is per room, per night. Sample bookings have none, so use the room's price.
      const rate =
        b.nightlyRate ||
        getAllRooms().find((r) => r.id === b.roomId)?.price ||
        b.total / nightsBetween(b.checkin, b.checkout) / qty;
      const total = rate * nightsBetween(a, z) * qty;
      const before = moneyFor(b);
      patchBooking(id, {
        checkin: a,
        checkout: z,
        total,
        nightlyRate: rate,
        discountAmount: 0,
        discountStatus: b.discountGuests ? "Review required" : "None",
        previousCheckin: b.checkin,
        previousCheckout: b.checkout,
        rescheduledAt: new Date().toISOString(),
      });
      const over = store.get("aurest-status", {});
      over[id] = "Pending";
      persist("aurest-status", over);
      if (before.net > total)
        addTransaction({
          bookingId: id,
          kind: "Refund",
          amount: before.net - total,
          status: "Pending",
          reference: "Shorter rescheduled stay",
        });
      onSaved();
      toast(`${id} moved to ${fmtDate(a)} – ${fmtDate(z)}. It is Pending until the hotel confirms it.`);
    },
  );
  // Check-out can never be before check-in, and moves along when check-in changes.
  const start = $('.modal-overlay [name="start"]'),
    end = $('.modal-overlay [name="end"]');
  const nextDay = (s) => {
    const x = new Date(s + "T00:00");
    x.setDate(x.getDate() + 1);
    return iso(x);
  };
  end.min = nextDay(start.value);
  start.addEventListener("change", () => {
    if (!start.value) return;
    end.min = nextDay(start.value);
    if (end.value < end.min) end.value = end.min;
  });
}

// Legacy single-type reservations and mixed selections share the same inventory checks.
function bookingItems(b) {
  return b.roomItems || [{roomId:b.roomId, quantity:roomQty(b)}];
}
function selectionRoom(d) {
  if (!d) return null;
  if (!d.roomItems) return getRooms().find(r=>r.id===d.roomId);
  const items=d.roomItems.map(i=>({...i,room:getRooms().find(r=>r.id===i.roomId)}));
  if (!items.length || items.some(i=>!i.room || !Number.isInteger(i.quantity) || i.quantity<1)) return null;
  const qty=items.reduce((s,i)=>s+i.quantity,0);
  return {...items[0].room, name:items.map(i=>i.room.name+' × '+i.quantity).join(', '),
    price:items.reduce((s,i)=>s+i.room.price*i.quantity,0)/qty,
    guests:items.reduce((s,i)=>s+i.room.guests*i.quantity,0)/qty,
    bed:'Selected rooms', size:items.reduce((s,i)=>s+i.room.size*i.quantity,0)};
}
function selectionFree(d,a,z) {
  return bookingItems(d).every(i=>getRooms().some(r=>r.id===i.roomId) && roomsFree(i.roomId,a,z)>=i.quantity);
}

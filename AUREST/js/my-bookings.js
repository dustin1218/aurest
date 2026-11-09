// Guest reservations page: display only the signed-in account’s bookings and their transaction history.
if (!getUser()) location.replace("login.html?next=my-bookings.html");
// Hide the payment form when paid in full, and distinguish unverified submissions from received money.
function paymentAction(b) {
  const m = moneyFor(b);
  if (m.balance <= 0)
    return '<span class="payment-note paid" role="status">Fully paid — you have no remaining balance.</span>';
  const pending = transactions()
    .filter((t) => t.bookingId === b.id && t.kind === "Payment" && t.status === "Submitted")
    .reduce((sum, t) => sum + t.amount, 0);
  if (pending >= m.balance)
    return '<span class="payment-note" role="status">Payment submitted — awaiting staff verification.</span>';
  return `<button class="btn-outline" data-pay="${b.id}">Submit payment reference</button>`;
}
function draw() {
  const list = myBookings().sort((a, b) => b.id.localeCompare(a.id));
  $("#cart-list").innerHTML =
    list
      .map((b) => {
        const r = getAllRooms().find((r) => r.id === b.roomId);
        return `<article class="cart-item"><img src="${r?.photo || "images/room-classic.jpg"}" alt=""><div><h3>${esc(b.roomName || r?.name || b.roomId)}</h3><p>${fmtDate(b.checkin)} – ${fmtDate(b.checkout)} · ${b.guests} guests · ${b.id}</p><p>${esc(paymentSummary(b))}</p><p>ID: ${esc(b.identityStatus || "Bring original ID for verification")} · Discount: ${esc(b.discountStatus || (b.discountGuests ? "Awaiting original IDs / staff review" : "None requested"))}</p><div class="actions">${b.status !== "Cancelled" && b.checkin >= addDays(0) ? `${paymentAction(b)}<button class="btn-outline" data-reschedule="${b.id}">Reschedule</button><button class="btn-danger" data-cancel="${b.id}">Cancel booking</button>` : ""}</div><details><summary>Transactions</summary>${
          transactions()
            .filter((t) => t.bookingId === b.id)
            .map(
              (t) =>
                `<p>${esc(t.kind)} · ${peso(t.amount)} · ${esc(t.status)} · ${esc(t.reference)}</p>`,
            )
            .join("") || "<p>No transactions yet.</p>"
        }</details></div><div>${statusChip(b.status)}</div></article>`;
      })
      .join("") ||
    '<div class="empty-cart"><h2>No bookings yet</h2><a class="btn" href="index.html#rooms">Browse rooms</a></div>';
}
// Delegate actions from rendered cards so buttons keep working after the list is redrawn.
$("#cart-list").onclick = async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.cancel || btn.dataset.reschedule || btn.dataset.pay;
  const b = myBookings().find((b) => b.id === id);
  if (!b || b.status === "Cancelled") return;
  if (btn.dataset.cancel) {
    if (
      transactions().some(
        (t) => t.bookingId === id && t.kind === "Payment" && t.status === "Submitted",
      )
    ) {
      toast("Please ask staff to verify or reject your submitted payment before cancelling.");
      return;
    }
    const q = cancellationQuote(b);
    if (
      await confirmDialog({
        title: "Cancel reservation?",
        message: `Cancellation charge: ${peso(q.fee)}. Refund to be processed by staff: ${peso(q.refund)}. This cancels your stay permanently.`,
        confirmText: "Cancel reservation",
        danger: true,
      })
    ) {
      cancelReservation(b);
      draw();
    }
    return;
  }
  if (btn.dataset.pay) {
    const m = moneyFor(b);
    const pending = transactions()
      .filter((t) => t.bookingId === id && t.kind === "Payment" && t.status === "Submitted")
      .reduce((s, t) => s + t.amount, 0); // Reserve submitted amounts while they await review so the guest cannot submit the same balance twice.
    const remaining = Math.max(0, m.balance - pending);
    if (m.balance <= 0) {
      toast("You have already paid in full. No remaining balance.");
      draw();
      return;
    }
    if (remaining <= 0) {
      toast("Your payment has already been submitted and is awaiting staff verification.");
      draw();
      return;
    }
    const due = Math.min(
      remaining,
      Math.max(0, (b.paymentPlan === "full" ? m.total : m.total * 0.3) - m.net - pending) ||
        remaining,
    );
    financeDialog(
      "Submit payment reference",
      `<p>Amount remaining to submit: ${peso(remaining)}. Staff will verify the transfer; this form does not charge you.</p><label>Amount (₱)<input name="amount" type="number" min="0.01" max="${remaining}" step="0.01" value="${due.toFixed(2)}" required></label><label>Method<select name="method"><option>Bank transfer</option><option>GCash</option><option>Cash at front desk</option></select></label><label>Transfer / receipt reference<input name="reference" maxlength="100" required></label>`,
      (d) => {
        const amount = Number(d.get("amount")),
          reference = d.get("reference").trim();
        if (!(amount > 0 && amount <= remaining) || !reference)
          throw Error("Enter a valid amount and reference.");
        if (transactions().some((t) => t.reference === reference && t.status !== "Rejected"))
          throw Error("This reference has already been submitted.");
        addTransaction({
          bookingId: id,
          kind: "Payment",
          amount,
          method: d.get("method"),
          reference,
          status: "Submitted",
        });
        draw();
      },
    );
    return;
  }
  rescheduleReservation(b, draw);
};
draw();

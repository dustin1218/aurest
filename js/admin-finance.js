// Render analytics from the ledger, then apply search and status filters to the transaction table.
function renderFinance() {
  const bs = allBookings(),
    ts = transactions();
  const ms = bs.map(moneyFor);
  const received = ms.reduce((n, m) => n + m.paid, 0),
    refunded = ms.reduce((n, m) => n + m.refunded, 0),
    pending = ms.reduce((n, m) => n + m.pending, 0),
    balance = ms.reduce((n, m) => n + m.balance, 0);
  $("#finance-stats").innerHTML = [
    ["Verified receipts", received],
    ["Net collected", received - refunded],
    ["Outstanding balances", balance],
    ["Refunds pending", pending],
  ]
    .map(([k, v]) => `<div class="stat"><span>${k}</span><b>${peso(v)}</b></div>`)
    .join("");
  const months = {};
  ts.filter((t) => t.status === "Verified" || t.status === "Completed").forEach((t) => {
    const month = t.created.slice(0, 7);
    months[month] = (months[month] || 0) + (t.kind === "Payment" ? t.amount : -t.amount);
  });
  const max = Math.max(1, ...Object.values(months).map(Math.abs));
  $("#finance-chart").innerHTML =
    "<h3>Monthly net collections</h3>" +
    (Object.entries(months)
      .sort()
      .map(
        ([k, v]) =>
          `<div class="collection-row"><span>${esc(k)}</span><meter min="0" max="${max}" value="${Math.abs(v)}">${peso(v)}</meter><b>${peso(v)}</b></div>`,
      )
      .join("") ||
      "<p>No verified receipts yet. Sample reservations have no assumed payments.</p>");
  $("#changes-body").innerHTML =
    bs
      .filter((b) => b.status === "Cancelled" || b.rescheduledAt)
      .map(
        (b) =>
          `<tr><td>${esc(b.id)} · ${esc(guestName(b))}</td><td>${b.status === "Cancelled" ? "Cancelled" : "Rescheduled"}</td><td>${b.previousCheckin ? esc(b.previousCheckin + " – " + b.previousCheckout) + " → " : ""}${esc(b.checkin + " – " + b.checkout)}</td><td>${b.status === "Cancelled" ? "Retained " + peso(b.cancellationFee || 0) + " · " : ""}${esc(paymentSummary(b))}</td></tr>`,
      )
      .join("") || '<tr><td colspan="4">No reservation changes.</td></tr>';
  const query = $("#transaction-search").value.toLowerCase(),
    filter = $("#transaction-filter").value;
  $("#transaction-body").innerHTML =
    ts
      .filter((t) => {
        const b = bs.find((b) => b.id === t.bookingId);
        return (
          (!filter || t.status === filter) &&
          `${t.bookingId} ${t.reference} ${b?.guestName || guestName(b || {})}`
            .toLowerCase()
            .includes(query)
        );
      })
      .sort((a, b) => b.created.localeCompare(a.created))
      .map(
        (t) =>
          `<tr><td>${esc(new Date(t.created).toLocaleString("en-PH"))}<br><small>${esc(t.id.slice(0, 8))}</small></td><td>${esc(t.bookingId)}<br>${esc(guestName(bs.find((b) => b.id === t.bookingId) || {}))}</td><td>${esc(t.kind)}</td><td>${esc(t.method || "Original payment method")}<br>${esc(txRef(t))}${t.receiptImage ? `<br><button class="btn-outline" type="button" data-receipt="${t.id}">View receipt</button>` : ""}</td><td>${peso(t.amount)}</td><td>${esc(t.status)}</td><td>${t.status === "Submitted" ? `<button class="btn-soft" data-tx="${t.id}" data-state="Verified">Verify receipt</button> <button class="btn-danger" data-tx="${t.id}" data-state="Rejected">Reject</button>` : t.status === "Pending" ? `<button class="btn-soft" data-tx="${t.id}" data-state="Completed">Record refund sent</button>` : "—"}</td></tr>`,
      )
      .join("") || '<tr><td colspan="7">No matching transactions.</td></tr>';
  $("#refund-body").innerHTML =
    ts
      .filter((t) => t.status === "Pending")
      .sort((a, b) => a.created.localeCompare(b.created))
      .map(
        (t) =>
          `<tr><td>${esc(new Date(t.created).toLocaleString("en-PH"))}</td><td>${esc(t.bookingId)}<br>${esc(guestName(bs.find((b) => b.id === t.bookingId) || {}))}</td><td>${esc(txRef(t))}</td><td>${peso(t.amount)}</td><td><button class="btn-soft" data-tx="${t.id}" data-state="Completed">Record refund sent</button></td></tr>`,
      )
      .join("") || '<tr><td colspan="5">No refunds waiting.</td></tr>';
  $("#verification-body").innerHTML = bs
    .filter((b) => b.status !== "Cancelled")
    .map(
      (b) =>
        `<tr><td>${esc(b.id)}<br>${esc(guestName(b))}</td><td>${esc(b.identityStatus || "Not checked")}</td><td style="white-space:pre-line">${esc(b.discountGuests || "None requested")}</td><td>${esc(b.discountStatus || "Not reviewed")}<br>${peso(b.discountAmount || 0)}</td><td><button class="btn-outline" data-review="${b.id}">Review guest</button></td></tr>`,
    )
    .join("");
  updateAdminHub();
}
const refreshAdmin = () => {
  render();
  renderFinance();
};
$("#transaction-search").oninput = renderFinance;
$("#transaction-filter").onchange = renderFinance;
// Show a guest's uploaded receipt full size so staff can compare it with bank or GCash records.
function showReceipt(t) {
  const back = document.activeElement;
  const ov = document.createElement("div");
  ov.className = "modal-overlay";
  ov.innerHTML = `<div class="modal receipt-view" role="dialog" aria-modal="true" aria-labelledby="rv-title"><h2 id="rv-title">Receipt for ${esc(t.bookingId)}</h2><p>${peso(t.amount)} · ${esc(t.method || "")}${t.reference ? " · Reference " + esc(t.reference) : ""} · ${esc(t.status)}</p><img alt="Receipt uploaded by the guest for ${esc(t.bookingId)}"><div class="modal-actions"><a class="btn-outline" target="_blank" rel="noopener" download="receipt-${esc(t.bookingId)}.jpg">Download</a><button class="btn" type="button" data-close>Close</button></div></div>`;
  $("img", ov).src = t.receiptImage;
  $("a", ov).href = t.receiptImage;
  document.body.append(ov);
  const close = () => {
    ov.remove();
    document.removeEventListener("keydown", keys);
    back?.focus();
  };
  const keys = (e) => {
    if (e.key === "Escape") close();
    if (e.key === "Tab") {
      const els = $$("a, button", ov);
      const i = els.indexOf(document.activeElement);
      e.preventDefault();
      els[(i + (e.shiftKey ? -1 : 1) + els.length) % els.length].focus();
    }
  };
  document.addEventListener("keydown", keys);
  ov.addEventListener("click", (e) => {
    if (e.target === ov) close();
  });
  $("[data-close]", ov).onclick = close;
  $("[data-close]", ov).focus();
}
// Staff verify external receipts or record refunds already sent; each decision saves reviewer and time.
$("#transaction-body").onclick = $("#refund-body").onclick = async (e) => {
  const receiptBtn = e.target.closest("[data-receipt]");
  if (receiptBtn) {
    const t = transactions().find((t) => t.id === receiptBtn.dataset.receipt);
    if (t && t.receiptImage) showReceipt(t);
    return;
  }
  const btn = e.target.closest("[data-tx]");
  if (!btn || !isAdmin()) return;
  const ts = transactions(),
    t = ts.find((t) => t.id === btn.dataset.tx);
  if (!t) return;
  const target = btn.dataset.state;
  if (
    !(
      (t.status === "Submitted" && ["Verified", "Rejected"].includes(target)) ||
      (t.status === "Pending" && target === "Completed")
    )
  )
    return;
  if (target === "Completed") {
    financeDialog(
      "Record completed refund",
      `<p>Only save after sending ${peso(t.amount)} externally to the guest.</p><label>Refund transaction / receipt reference<input name="reference" required maxlength="100"></label>`,
      (d) => {
        const ref = d.get("reference").trim();
        if (!ref) throw Error("Enter the refund receipt reference.");
        t.status = "Completed";
        t.refundReference = ref;
        t.reviewedAt = new Date().toISOString();
        t.reviewedBy = getUser().email;
        persist("aurest-transactions", ts);
        refreshAdmin();
        toast(`Refund of ${peso(t.amount)} recorded for ${t.bookingId}.`);
      },
    );
    return;
  }
  if (
    await confirmDialog({
      title: target === "Verified" ? "Confirm receipt of funds?" : "Reject payment submission?",
      message: `${t.bookingId}: ${peso(t.amount)}, ${t.method || "payment"} (${txRef(t)}). ${t.receiptImage ? "Check the uploaded receipt and verify" : "Verify"} against your actual records before proceeding.`,
      confirmText: target === "Verified" ? "Funds received" : "Reject submission",
      danger: target === "Rejected",
    })
  ) {
    t.status = target;
    t.reviewedBy = getUser().email;
    t.reviewedAt = new Date().toISOString();
    persist("aurest-transactions", ts);
    refreshAdmin();
    toast(
      `${peso(t.amount)} for ${t.bookingId} ${target === "Verified" ? "verified" : "rejected"}.`,
    );
  }
};
// Record original-ID checks and a reviewed discount amount; no ID scans or automatic group discounts.
$("#verification-body").onclick = (e) => {
  const id = e.target.closest("[data-review]")?.dataset.review;
  if (!id || !isAdmin()) return;
  const b = allBookings().find((b) => b.id === id);
  financeDialog(
    "Review identity & discount",
    `<p>${esc(guestName(b))} · ${esc(id)}. Match the original government ID to the guest. Do not enter ID numbers or upload images here.</p><label>Identity check<select name="identity"><option>Not checked</option><option>Verified original ID</option><option>Needs follow-up</option></select></label><label>Discount review<select name="status"><option>Awaiting original IDs</option><option>Approved</option><option>Not eligible</option><option>None requested</option></select></label><label>Approved room discount (₱)<input type="number" name="discount" min="0" step="0.01" max="${bookingTotal({ ...b, discountAmount: 0 })}" value="${b.discountAmount || 0}" required></label><label>Review notes / eligible guests<textarea name="notes" maxlength="500">${esc(b.reviewNotes || "")}</textarea></label>`,
    (d) => {
      const amount = Number(d.get("discount")),
        status = d.get("status");
      if (
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > bookingTotal({ ...b, discountAmount: 0 })
      )
        throw Error("Enter a discount within the room total.");
      if (amount && status !== "Approved")
        throw Error("Approve eligibility before applying a discount.");
      if (status === "Approved" && (!b.discountGuests || !d.get("notes").trim()))
        throw Error("Identify eligible guests and record your calculation in the notes.");
      if (moneyFor(b).pending)
        throw Error("Finish the pending refund before adjusting this booking.");
      patchBooking(id, {
        identityStatus: d.get("identity"),
        discountStatus: status,
        discountAmount: amount,
        reviewNotes: d.get("notes").trim(),
        reviewedBy: getUser().email,
        reviewedAt: new Date().toISOString(),
      });
      const credit = moneyFor(allBookings().find((b) => b.id === id)).credit;
      if (credit)
        addTransaction({
          bookingId: id,
          kind: "Refund",
          amount: credit,
          status: "Pending",
          reference: "Approved discount adjustment",
        });
      refreshAdmin();
      toast(`Review saved for ${id}.`);
    },
  );
  const form = $(".modal-overlay:last-child form");
  $('[name="identity"]', form).value = b.identityStatus || "Not checked";
  $('[name="status"]', form).value =
    b.discountStatus || (b.discountGuests ? "Awaiting original IDs" : "None requested");
};
// Confirm only after the ID check and selected payment threshold; route cancellations through the shared policy.
$("#bookings-body").addEventListener("change", async (e) => {
  const id = e.target.dataset.bk;
  if (!id || !isAdmin()) return;
  const b = allBookings().find((b) => b.id === id),
    status = e.target.value;
  if (b.status === "Cancelled") {
    toast("Cancelled stays cannot be reopened. Create a new reservation.");
    refreshAdmin();
    return;
  }
  if (
    status === "Confirmed" &&
    (b.identityStatus !== "Verified original ID" ||
      moneyFor(b).net <
        Math.round(moneyFor(b).total * (b.paymentPlan === "full" ? 1 : 0.3) * 100) / 100)
  ) {
    toast("Verify the original ID and the selected deposit/full payment before confirming.");
    refreshAdmin();
    return;
  }
  if (
    status === "Cancelled" &&
    transactions().some((t) => t.bookingId === id && t.status === "Submitted")
  ) {
    toast("Verify or reject submitted payments before cancellation.");
    refreshAdmin();
    return;
  }
  const q = cancellationQuote(b);
  if (
    !(await confirmDialog({
      title: `Mark ${id} as ${status}?`,
      message:
        status === "Cancelled"
          ? `Retain ${peso(q.fee)}; request refund ${peso(q.refund)}. Staff must process the refund.`
          : "The guest will see this status.",
      danger: status === "Cancelled",
    }))
  ) {
    refreshAdmin();
    return;
  }
  if (status === "Cancelled") cancelReservation(b);
  else {
    if (status === "Confirmed") patchBooking(id, { confirmedAt: new Date().toISOString() });
    const o = store.get("aurest-status", {});
    o[id] = status;
    persist("aurest-status", o);
  }
  refreshAdmin();
  toast(`${id} marked ${status}.`);
});
renderFinance();
$("#bookings-body").addEventListener("click", (e) => {
  const id = e.target.closest("[data-admin-reschedule]")?.dataset.adminReschedule;
  if (!id || !isAdmin()) return;
  const b = allBookings().find((b) => b.id === id);
  if (b && b.status !== "Cancelled") rescheduleReservation(b, refreshAdmin);
});

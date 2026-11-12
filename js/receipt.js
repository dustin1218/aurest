// Browser prototype: only the booking owner or signed-in admin may view confirmed records.
const receiptMoney = (n) =>
  "PHP " +
  Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function renderReceipt() {
  const user = getUser(),
    id = new URLSearchParams(location.search).get("id");
  const b = user && (isAdmin() ? allBookings() : myBookings()).find((b) => b.id === id);
  const root = document.getElementById("receipt"),
    print = document.getElementById("print-receipt");
  print.hidden = true;
  if (!user) {
    location.replace("login.html?next=" + encodeURIComponent("receipt.html?id=" + (id || "")));
    return;
  }
  if (!b || b.status !== "Confirmed") {
    root.innerHTML =
      "<h1>Receipt unavailable</h1><p>A receipt is available after the hotel confirms your booking.</p>";
    return;
  }
  const money = moneyFor(b),
    lines = roomChargeLines(b),
    gross = lines.reduce((sum, i) => sum + i.subtotal, 0);
  const payments = transactions().filter(
    (t) =>
      t.bookingId === b.id &&
      ((t.kind === "Payment" && t.status === "Verified") ||
        (t.kind === "Refund" && t.status === "Completed")),
  );
  document.title = "Receipt " + b.id + " | AUREST";
  root.innerHTML = `<header class="receipt-heading"><h1>AUREST</h1><p>${esc(hotelInfo.address)}<br>${esc(hotelInfo.phone)}<br>${esc(hotelInfo.email)}</p><h2>BOOKING RECEIPT</h2><p>Receipt # AR-${esc(b.id)}<br>Status: Confirmed<br>${b.confirmedAt ? "Issued: " + esc(new Date(b.confirmedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })) : "Booking date: " + esc(b.created || b.checkin)}</p></header>
  <div class="receipt-meta"><p><b>Guest</b><br>${esc(b.guestName || b.email || "Guest")}<br>${esc(b.email || b.userEmail || "")}</p><p><b>Stay</b><br>${fmtDate(b.checkin)} to ${fmtDate(b.checkout)}<br>${plural(nightsBetween(b.checkin, b.checkout), "night")} / ${plural(roomQty(b), "room")}</p></div>
  <table><thead><tr><th>Room / description</th><th>Amount</th></tr></thead><tbody>${lines.map((i) => `<tr><td>${esc(i.name)}<small>${receiptMoney(i.nightlyRate)} x ${plural(i.nights, "night")}${i.quantity > 1 ? " x " + plural(i.quantity, "room") : ""}</small></td><td>${receiptMoney(i.subtotal)}</td></tr>`).join("")}</tbody></table>
  <div class="receipt-totals"><p><span>Room charges</span><b>${receiptMoney(gross)}</b></p><p><span>Approved discount</span><b>${receiptMoney(b.discountAmount || 0)}</b></p><p class="receipt-total"><span>Total</span><b>${receiptMoney(money.total)}</b></p><p><span>Verified payments</span><b>${receiptMoney(money.paid)}</b></p><p><span>Completed refunds</span><b>${receiptMoney(money.refunded)}</b></p><p class="receipt-total"><span>Balance due</span><b>${receiptMoney(money.balance)}</b></p></div>
  ${payments.length ? "<h3>Payment history</h3>" + payments.map((t) => '<p class="receipt-payment">' + esc(t.kind) + " - " + receiptMoney(t.amount) + "<br><small>" + esc(t.reference || t.method || "Verified by staff") + "</small></p>").join("") : "<p>No verified payments recorded.</p>"}
  <footer class="receipt-foot"><p>Thank you for choosing AUREST.</p><small>Booking confirmation does not mean payment has been received.<br>Demo booking receipt - not a tax invoice.</small></footer>`;
  print.hidden = false;
}
document.getElementById("print-receipt").addEventListener("click", () => {
  renderReceipt();
  if (!document.getElementById("print-receipt").hidden) window.print();
});
window.addEventListener("storage", renderReceipt);
renderReceipt();

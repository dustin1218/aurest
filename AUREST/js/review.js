// Booking step 2: review the saved draft, choose the payment plan, then create a pending reservation.
const user = getUser();
if (!user) location.replace("login.html?next=booking.html");
const d = store.get("aurest-draft");
const room = d && d.first && getRooms().find((r) => r.id === d.roomId);
if (!room) location.replace("index.html#rooms"); // sends people back to start if nothing to review

const n = nightsBetween(d.checkin, d.checkout),
  total = room.price * n;
$("#review-list").innerHTML = [
  ["Name", `${d.first} ${d.last}`],
  ["Email", d.email],
  ["Contact number", d.phone],
  ["Guests", `${plural(d.adults, "adult")}, ${plural(d.children, "child", "children")}`],
  ["Check-in", fmtDate(d.checkin)],
  ["Check-out", fmtDate(d.checkout)],
  ["Senior / PWD guests", d.discountGuests || "None"],
  ["Special requests", d.requests || "None"],
]
  .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
  .join("");
$("#sum-img").src = room.photo;
$("#sum-img").alt = room.name;
$("#sum-name").textContent = room.name;
$("#sum-meta").textContent = `${room.bed} · ${room.size} m² · ${room.guests} guests`;
$("#sum-calc").textContent = `${peso(room.price)} × ${plural(n, "night")}`;
$("#sum-sub").textContent = $("#sum-total").textContent = peso(total);

$("#confirm").addEventListener("click", async () => {
  const ok = await confirmDialog({
    title: "Confirm your reservation?",
    message: `${room.name}, ${fmtDate(d.checkin)} to ${fmtDate(d.checkout)} (${plural(n, "night")}), total ${peso(total)}. It stays Pending until the hotel confirms it.`,
    confirmText: "Yes, reserve",
    cancelText: "Go back",
  });
  if (!ok) return;
  // Recheck room availability immediately before saving, since it may have changed during review.
  if (!available(room.id, d.checkin, d.checkout)) {
    toast("This room is already reserved on those dates. Please choose another stay.");
    return;
  }
  const list = store.get("aurest-bookings", []);
  const id = "B" + String(seedBookings.length + list.length + 1).padStart(3, "0");
  list.push({
    id,
    userEmail: user.email,
    guestName: `${d.first} ${d.last}`,
    email: d.email,
    phone: d.phone,
    roomId: room.id,
    roomName: room.name,
    checkin: d.checkin,
    checkout: d.checkout,
    guests: d.adults + d.children,
    adults: d.adults,
    children: d.children,
    discountGuests: d.discountGuests || "",
    paymentPlan: $('[name="payment-plan"]:checked').value,
    nightlyRate: room.price,
    policyVersion: 1,
    requests: d.requests || "",
    total,
    status: "Pending",
    created: addDays(0),
  });
  store.set("aurest-bookings", list);
  store.del("aurest-draft");
  location.href = "confirmation.html?id=" + id;
});
// Preview the selected amount due; choosing a payment plan does not charge the guest.
function paymentPreview() {
  $("#payment-due").textContent =
    "Amount to transfer: " +
    peso(total * ($('[name="payment-plan"]:checked').value === "full" ? 1 : 0.3));
}
$$('[name="payment-plan"]').forEach((e) => e.addEventListener("change", paymentPreview));
paymentPreview();

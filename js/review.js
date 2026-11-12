// Booking step 2: review the saved draft, choose the payment plan, then create a pending reservation.
const user = getUser();
if (!user) location.replace("login.html?next=booking.html");
const d = store.get("aurest-draft");
const room = d && d.first && getRooms().find((r) => r.id === d.roomId);
if (!room) location.replace("index.html#rooms"); // sends people back to start if nothing to review

const qty = Math.max(1, +d.rooms || 1),
  n = nightsBetween(d.checkin, d.checkout),
  total = room.price * n * qty;
$("#review-list").innerHTML = [
  ["Name", `${d.first} ${d.last}`],
  ["Email", d.email],
  ["Contact number", d.phone || "Not provided"],
  ["Guests", `${plural(d.adults, "adult")}, ${plural(d.children, "child", "children")}`],
  ["Rooms", plural(qty, "room")],
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
$("#sum-meta").textContent = `${room.bed} · ${room.size} m² · ${room.guests} guests per room`;
$("#sum-calc").textContent =
  `${peso(room.price)} × ${plural(n, "night")}` + (qty > 1 ? ` × ${plural(qty, "room")}` : "");
$("#sum-sub").textContent = $("#sum-total").textContent = peso(total);

$("#confirm").addEventListener("click", async () => {
  const ok = await confirmDialog({
    title: "Confirm your reservation?",
    message: `${qty > 1 ? qty + " × " : ""}${room.name}, ${fmtDate(d.checkin)} to ${fmtDate(d.checkout)} (${plural(n, "night")}), total ${peso(total)}. It stays Pending until the hotel confirms it.`,
    confirmText: "Yes, reserve",
    cancelText: "Go back",
  });
  if (!ok) return;
  // Recheck free rooms and capacity immediately before saving, since bookings may have changed during review.
  const free = roomsFree(room.id, d.checkin, d.checkout);
  if (free < qty) {
    toast(
      free
        ? `Only ${plural(free, "room")} of this type ${free === 1 ? "is" : "are"} still free on those dates. Please edit your details.`
        : "This room type is now fully booked on those dates. Please choose another stay.",
    );
    return;
  }
  if (d.adults + d.children > room.guests * qty || d.adults < qty) {
    toast("Your guests no longer fit these rooms. Please edit your details.");
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
    rooms: qty,
    discountGuests: d.discountGuests || "",
    paymentPlan: $('[name="payment-plan"]:checked').value,
    nightlyRate: room.price, // per room
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
    peso(total * ($('[name="payment-plan"]:checked').value === "full" ? 1 : 0.3)) +
    ". Send to: " +
    hotelInfo.payTo +
    ".";
}
// Remember the choice so a refresh does not silently switch it back to the deposit.
if (d?.paymentPlan === "full") $('[name="payment-plan"][value="full"]').checked = true;
$$('[name="payment-plan"]').forEach((e) =>
  e.addEventListener("change", () => {
    store.set("aurest-draft", { ...d, paymentPlan: e.value });
    paymentPreview();
  }),
);
paymentPreview();

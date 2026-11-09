// ===== Step 3 of 3: confirmation. Shows one of the signed-in guest's own bookings, read from ?id= =====
const cUser = getUser();
const cId = new URLSearchParams(location.search).get("id");
const cBooking = cUser && cId ? myBookings().find((b) => b.id === cId) : null;

if (!cUser)
  location.replace("login.html?next=" + encodeURIComponent("confirmation.html?id=" + (cId || "")));
else if (!cBooking)
  location.replace("my-bookings.html"); // no such booking for this guest
else showConfirmation(cBooking);

function showConfirmation(b) {
  const r = getRooms().find((x) => x.id === b.roomId); // the room may have been deleted since, so fall back to what the booking saved
  const n = nightsBetween(b.checkin, b.checkout);
  const total = bookingTotal(b);
  const rate = r ? r.price : Math.round(total / n);

  document.title = `Confirmation ${b.id} | AUREST`;
  $("#c-ref").textContent = b.id;
  $("#c-status").innerHTML = statusChip(b.status);
  $("#c-img").src = r ? r.photo : "images/room-classic.jpg";
  $("#c-img").alt = b.roomName;
  $("#c-room").textContent = b.roomName;
  $("#c-meta").textContent = r ? `${r.bed} · ${r.size} m² · ${r.guests} guests` : "";
  $("#c-in").textContent = fmtDate(b.checkin);
  $("#c-out").textContent = fmtDate(b.checkout);
  $("#c-guests").textContent = b.children
    ? `${plural(b.adults, "adult")}, ${plural(b.children, "child", "children")}`
    : plural(b.guests, "guest");
  $("#c-calc").textContent = `${peso(rate)} × ${plural(n, "night")}`;
  $("#c-sub").textContent = $("#c-total").textContent = peso(total);

  // The headline matches the booking's real status, so the page never promises more than the hotel has agreed to.
  const note =
    {
      Pending:
        "The hotel will confirm your reservation shortly. Until then it stays Pending, and you can follow it in My bookings.",
      Confirmed: "The hotel has confirmed this reservation.",
      Cancelled: "",
    }[b.status] || "";
  if (b.status === "Cancelled") {
    $("#c-eyebrow").textContent = "Reservation cancelled";
    $("#c-title").textContent = "This stay was cancelled.";
    $("#c-lead").textContent = "You're always welcome to book again.";
  }
  $("#c-note").textContent = note + " " + paymentSummary(b);
  if (b.status === "Pending") $("#c-title").textContent = "Reservation received.";
  $("#confirm").hidden = false;
}

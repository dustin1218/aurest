// Admin dashboard navigation: each box opens one panel, and the URL hash remembers which.
// Load before admin.js, because its render functions call updateAdminHub().

const adminHub = document.getElementById("admin-hub");
const adminPageTitle = document.querySelector(".page-title");
let currentAdminView = null;

// Keep the slim box bar directly below the sticky site header.
function syncHubOffset() {
  const header = document.querySelector(".site-header");
  document.documentElement.style.setProperty(
    "--admin-header-h",
    (header ? header.offsetHeight : 0) + "px",
  );
}

function showAdminView(view, moveFocus) {
  if (view === currentAdminView) return;
  currentAdminView = view;
  const isOverview = view === "overview";
  $$(".admin-panel").forEach((p) => (p.hidden = p.id !== "panel-" + view));
  adminPageTitle.hidden = !isOverview;
  document.title = isOverview
    ? "Admin | AUREST"
    : `${$(`[data-view="${view}"] .hub-name`, adminHub).textContent} | AUREST Admin`;
  adminHub.classList.toggle("compact", !isOverview);
  $$("[data-view]", adminHub).forEach((a) =>
    a.dataset.view === view ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"),
  );
  if (moveFocus) {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("panel-" + view).focus({ preventScroll: true });
  }
}

function routeAdminView(moveFocus) {
  const wanted = location.hash.slice(1);
  const known = !!document.getElementById("panel-" + wanted) && wanted !== "";
  // Other in-page links, such as "Skip to main content", must not change the open section.
  if (!known && wanted && currentAdminView) return;
  showAdminView(known ? wanted : "overview", moveFocus);
}

// A booking needs review until its original ID is checked or a requested discount is decided.
function needsVerification(b, today) {
  if (b.status === "Cancelled" || b.checkout < today) return false;
  const discountOpen =
    b.discountGuests && (!b.discountStatus || b.discountStatus === "Awaiting original IDs");
  return b.identityStatus !== "Verified original ID" || !!discountOpen;
}

function setHubBox(view, detail, urgent) {
  const box = $(`[data-view="${view}"]`, adminHub);
  const badge = $(".hub-badge", box);
  $(".hub-detail", box).textContent = detail;
  badge.textContent = urgent;
  badge.hidden = !urgent;
  box.setAttribute("aria-label", `${$(".hub-name", box).textContent}: ${detail}`);
}

// Called after every data change so the boxes always match the tables.
function updateAdminHub() {
  const bookings = allBookings(),
    ts = transactions(),
    today = addDays(0);
  const toVerify = ts.filter((t) => t.status === "Submitted").length;
  const toRefund = ts.filter((t) => t.status === "Pending").length;
  const pending = bookings.filter((b) => b.status === "Pending").length;
  const upcoming = bookings.filter((b) => b.status !== "Cancelled" && b.checkin >= today).length;
  const toCheck = bookings.filter((b) => needsVerification(b, today)).length;
  const net = bookings.map(moneyFor).reduce((n, m) => n + m.paid - m.refunded, 0);

  setHubBox("payments", toVerify ? `${toVerify} to verify` : "Nothing to verify", toVerify);
  setHubBox("reservations", `${pending} pending · ${upcoming} upcoming`, pending);
  setHubBox("verification", toCheck ? `${toCheck} to check` : "All checked", toCheck);
  setHubBox("refunds", toRefund ? `${toRefund} to send` : "No refunds waiting", toRefund);
  setHubBox("analytics", `${peso(net)} collected`, 0);
  setHubBox("rooms", `${plural(getRooms().length, "room")} listed`, 0);
  setHubBox("guests", plural(document.getElementById("guests-body").rows.length, "guest"), 0);
}

// The add-room form stays out of the way until staff ask for it.
function setAddRoomOpen(open) {
  const toggle = document.getElementById("toggle-add-room");
  document.getElementById("add-room").hidden = !open;
  toggle.setAttribute("aria-expanded", open);
  toggle.textContent = open ? "Close form" : "Add a room";
  if (open) document.getElementById("r-name").focus();
}
document
  .getElementById("toggle-add-room")
  .addEventListener("click", () => setAddRoomOpen(document.getElementById("add-room").hidden));

window.addEventListener("hashchange", () => routeAdminView(true));
window.addEventListener("resize", syncHubOffset);
syncHubOffset();
routeAdminView(false);

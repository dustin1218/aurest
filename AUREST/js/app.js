// ===== Shared helpers + navbar/footer used on every page =====
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const peso = (n) => "₱" + Number(n).toLocaleString("en-PH");
// Escape text before inserting guest-provided values into HTML templates.
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const store = {
  get(k, d = null) {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};
const getUser = () => store.get("aurest-user");
const allUsers = () => [...users, ...store.get("aurest-users", [])];

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const fmtDate = (s) =>
  new Date(s + "T00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const getSearch = () =>
  store.get("aurest-search") || {
    checkin: addDays(14),
    checkout: addDays(16),
    adults: 2,
    children: 0,
    rooms: 1,
    pets: false,
  };
const plural = (n, w, pl = w + "s") => `${n} ${n === 1 ? w : pl}`;
// Allow only local page redirects after sign-in rather than arbitrary external URLs.
const safeNext = (n) => (/^[a-z-]+\.html(\?[\w=&.-]*)?$/i.test(n || "") ? n : "index.html");

function setError(input, msg) {
  const e = document.getElementById(input.id + "-error");
  if (e) e.textContent = msg;
  input.classList.toggle("invalid", !!msg);
  input.setAttribute("aria-invalid", !!msg);
  return !msg;
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function roomCard(r) {
  return `<article class="card">
    <img src="${r.photo}" alt="${esc(r.name)}: ${esc(r.bed)}" loading="lazy">
    <div class="card-body">
      <h3>${esc(r.name)}</h3><p>${esc(r.desc)}</p>
      <div class="meta">${r.guests} guests · ${esc(r.bed)} · ${r.size} m²</div>
      <div class="card-foot"><span class="price">${peso(r.price)} <small>/ night</small></span>
      <a class="btn" href="room-details.html?id=${r.id}" aria-label="View ${esc(r.name)}">View room</a></div>
    </div></article>`;
}

// ----- On-theme confirmation dialog (returns true if the person confirms) -----
function confirmDialog({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Go back",
  danger = false,
}) {
  return new Promise((resolve) => {
    const back = document.activeElement;
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="m-title" aria-describedby="m-msg">
      <h2 id="m-title">${esc(title)}</h2><p id="m-msg">${esc(message)}</p>
      <div class="modal-actions"><button type="button" class="btn-outline" data-no>${esc(cancelText)}</button>
      <button type="button" class="btn${danger ? " danger" : ""}" data-yes>${esc(confirmText)}</button></div></div>`;
    document.body.appendChild(ov);
    const done = (v) => {
      document.removeEventListener("keydown", onKey);
      ov.remove();
      if (back && back.focus) back.focus();
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === "Escape") return done(false);
      if (e.key === "Tab") {
        // keep keyboard focus inside the dialog
        const b = $$("button", ov),
          i = b.indexOf(document.activeElement);
        e.preventDefault();
        b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    ov.addEventListener("click", (e) => {
      if (e.target === ov) done(false);
    });
    $("[data-no]", ov).onclick = () => done(false);
    $("[data-yes]", ov).onclick = () => done(true);
    $(danger ? "[data-no]" : "[data-yes]", ov).focus(); // risky actions focus the safe button first
  });
}

// ----- Rooms, bookings, roles (saved in the browser until the backend takes over) -----
const hiddenRoomIds = () => store.get("aurest-hidden-rooms", []); // default rooms the admin has deleted
const getAllRooms = () => [...rooms, ...store.get("aurest-rooms", [])]; // everything, including deleted defaults
const getRooms = () => getAllRooms().filter((r) => !hiddenRoomIds().includes(r.id));
const isAdmin = () => (getUser() || {}).role === "admin";
const allBookings = () => {
  const over = store.get("aurest-status", {});
  return [...seedBookings, ...store.get("aurest-bookings", [])].map((b) => ({
    ...b,
    ...store.get("aurest-booking-updates", {})[b.id],
    status: over[b.id] || b.status,
  }));
};
const myBookings = () => {
  const u = getUser();
  return u ? allBookings().filter((b) => b.userEmail === u.email) : [];
};
const statusChip = (s) => `<span class="status ${s.toLowerCase()}">${s}</span>`;
const bagIcon =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>'; // bed icon

// Shared profile link: use the saved portrait, falling back to the first letter if missing or unreadable.
function updateNavAvatar() {
  const link = $("#nav-profile");
  const user = getUser();
  if (!link || !user) return;
  const profile = store.get("aurest-profiles", {})[user.email] || {};
  const initial =
    Array.from((profile.name || user.name || "Guest").trim())[0]?.toLocaleUpperCase() || "G";
  link.textContent = initial;
  if (profile.picture) {
    const img = document.createElement("img");
    img.alt = "";
    img.src = profile.picture;
    img.addEventListener(
      "error",
      () => {
        link.textContent = initial;
      },
      { once: true },
    );
    link.replaceChildren(img);
  }
}

// ----- Navbar + footer (change here once, every page updates) -----
(function chrome() {
  const hdr = $("#site-header"),
    ftr = $("#site-footer");
  const nav = document.body.dataset.nav,
    onHome = document.body.dataset.page === "home",
    user = getUser(),
    admin = isAdmin();
  const base = onHome ? "" : "index.html";
  const links = [
    ["home", "Home"],
    ["rooms", "Rooms"],
    ["about", "About"],
    ["contact", "Contact"],
  ];
  if (hdr) {
    const n = myBookings().filter((b) => b.status !== "Cancelled").length;
    const cart = admin
      ? ""
      : `<span class="vr" aria-hidden="true"></span>
      <a class="cart-btn" href="my-bookings.html"${nav === "bookings" ? ' aria-current="page"' : ""} aria-label="My bookings${n ? ", " + n + " reservation" + (n > 1 ? "s" : "") : ""}">${bagIcon}<span>My bookings</span>${n ? `<span class="badge">${n}</span>` : ""}</a>`;
    hdr.className = "site-header";
    hdr.innerHTML = `<a class="skip" href="#main">Skip to main content</a>
      <div class="bar"><a class="logo" href="${base || "index.html"}#home" aria-label="AUREST home">AUREST</a>
        <button class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="menu" aria-label="Open menu">☰</button>
        <div class="menu" id="menu">
          <nav class="main-nav" aria-label="Main">${links.map((l) => `<a href="${base}#${l[0]}" data-sec="${l[0]}"${!onHome && l[0] === nav ? ' aria-current="page"' : ""}>${l[1]}</a>`).join("")}${admin ? `<a href="admin.html"${nav === "admin" ? ' aria-current="page"' : ""}>Admin</a>` : ""}</nav>
          ${cart}
          <div class="account">${
            user
              ? `<a class="nav-avatar" id="nav-profile" href="profile.html" aria-label="Profile settings" title="Profile settings"></a><button class="btn-soft" id="signout" type="button">Sign out</button>`
              : `<a class="btn-soft" href="login.html">Sign in</a><a class="btn" href="register.html">Create Account</a>`
          }</div>
        </div></div>`;
    updateNavAvatar();
    const btn = $("#menu-btn");
    const closeMenu = () => {
      hdr.classList.remove("open");
      btn.setAttribute("aria-expanded", false);
      btn.setAttribute("aria-label", "Open menu");
    };
    btn.addEventListener("click", () => {
      const open = hdr.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    $$(".main-nav a, .cart-btn, .logo", hdr).forEach((a) => a.addEventListener("click", closeMenu));
    const so = $("#signout");
    if (so)
      so.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: "Sign out?",
          message: "You'll need to sign in again to manage your bookings.",
          confirmText: "Sign out",
          cancelText: "Stay signed in",
        });
        if (ok) {
          store.del("aurest-user");
          location.href = "index.html";
        }
      });

    // On the home page, highlight the section you are looking at (scroll-spy)
    if (onHome && "IntersectionObserver" in window) {
      const setCur = (id) =>
        $$(".main-nav a[data-sec]", hdr).forEach((a) =>
          a.dataset.sec === id
            ? a.setAttribute("aria-current", "page")
            : a.removeAttribute("aria-current"),
        );
      const seen = new Map();
      const io = new IntersectionObserver(
        (es) => {
          es.forEach((e) => seen.set(e.target.id, e.isIntersecting));
          const cur = links.map((l) => l[0]).find((id) => seen.get(id));
          if (cur) setCur(cur);
        },
        { rootMargin: "-40% 0px -55% 0px" },
      );
      links.forEach((l) => {
        const s = document.getElementById(l[0]);
        if (s) io.observe(s);
      });
      setCur("home");
    }
  }
  if (ftr) {
    ftr.className = "site-footer";
    ftr.innerHTML = `AUREST · Where Comfort Meets Care.<p>Thoughtful spaces. Warm welcomes. Restful stays.</p>
      <nav aria-label="Footer"><a href="${base}#rooms">Rooms</a><a href="${base}#about">About</a><a href="${base}#contact">Contact</a></nav>`;
  }
})();

// Clear a field's red error as soon as the person starts correcting it (it is re-checked on blur/submit)
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.classList && el.classList.contains("invalid")) setError(el, "");
});

// ===== Themed calendar: opens when you click the Check-in / Check-out field. One month at a time, scroll for the next =====
function initDatePickers() {
  const inEl = document.getElementById("checkin"),
    outEl = document.getElementById("checkout");
  if (!inEl || !outEl) return;
  const MONTHS_SHOWN = 18; // how many months you can scroll through
  const setNative = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  const pretty = (s) =>
    s
      ? new Date(s + "T00:00").toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";
  const short = (s) =>
    new Date(s + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  // The field shows a friendly date, but .value still returns 2026-12-18 style text, so the other scripts keep working.
  [inEl, outEl].forEach((el) => {
    el.type = "text";
    el.readOnly = true;
    el.autocomplete = "off";
    el.placeholder = "Select a date";
    el.classList.add("date-input");
    el.setAttribute("aria-haspopup", "dialog");
    Object.defineProperty(el, "value", {
      configurable: true,
      get() {
        return el.dataset.iso || "";
      },
      set(v) {
        el.dataset.iso = v || "";
        setNative.call(el, pretty(v));
      },
    });
  });
  const icon = (d) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const today = addDays(0);
  let pop = null,
    mode = "in",
    hover = "",
    anchor = null;
  const minIso = () => inEl.getAttribute("min") || today;
  const setVal = (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  function open(el, byKeyboard) {
    anchor = el;
    mode = el === outEl && inEl.value ? "out" : "in";
    hover = "";
    build();
    place(true);
    if (byKeyboard)
      (
        pop.querySelector(".dc.is-start button, .dc.is-end button, .dc button:not(:disabled)") ||
        pop
      ).focus();
  }
  function close(refocus) {
    if (!pop) return;
    pop.remove();
    pop = null;
    if (refocus && anchor) anchor.focus();
  }

  function build() {
    if (!pop) {
      pop = document.createElement("div");
      pop.className = "dp";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-label", "Choose your dates");
      document.body.appendChild(pop);
      pop.addEventListener("click", onClick);
      pop.addEventListener("mouseover", (e) => {
        const c = e.target.closest(".dc");
        const d = c ? c.dataset.iso : "";
        if (d !== hover) {
          hover = d;
          paint();
        }
      });
      pop.addEventListener("mouseleave", () => {
        hover = "";
        paint();
      });
      pop.addEventListener("keydown", onKeys);
    }
    const first = new Date(minIso() + "T00:00");
    first.setDate(1);
    let html = `<div class="dp-top"><button type="button" class="dp-nav" data-dir="-1" aria-label="Previous month">${icon("M6 15l6-6 6 6")}</button>
      <div class="dp-prompt" id="dp-prompt" aria-live="polite"></div>
      <button type="button" class="dp-nav" data-dir="1" aria-label="Next month">${icon("M6 9l6 6 6-6")}</button></div>
      <div class="dp-wd" aria-hidden="true">${["S", "M", "T", "W", "T", "F", "S"].map((x) => `<span>${x}</span>`).join("")}</div>
      <div class="dp-scroll" id="dp-scroll">`;
    for (let k = 0; k < MONTHS_SHOWN; k++) {
      const d = new Date(first.getFullYear(), first.getMonth() + k, 1),
        n = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      html += `<section class="dp-month" data-ym="${iso(d).slice(0, 7)}"><div class="dp-mname">${d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div><div class="dp-days">${"<span></span>".repeat(d.getDay())}`;
      for (let i = 1; i <= n; i++) {
        const id = iso(new Date(d.getFullYear(), d.getMonth(), i));
        html += `<div class="dc" data-iso="${id}"><button type="button" data-iso="${id}" aria-label="${pretty(id)}">${i}</button></div>`;
      }
      html += `</div></section>`;
    }
    pop.innerHTML =
      html +
      `</div><div class="dp-foot"><span id="dp-sum"></span><button type="button" class="dp-clear" data-clear>Clear dates</button></div>`;
    $("#dp-scroll", pop).addEventListener("scroll", navState, { passive: true });
    paint();
    // start on the month you are working with
    const ref = (mode === "out" ? outEl.value || inEl.value : inEl.value) || minIso();
    const m = $(`.dp-month[data-ym="${ref.slice(0, 7)}"]`, pop) || $(".dp-month", pop);
    $("#dp-scroll", pop).scrollTop = m.offsetTop;
    navState();
  }
  // which month is at the top of the scroll area right now
  function topMonth() {
    const sc = $("#dp-scroll", pop),
      ms = $$(".dp-month", pop);
    let idx = 0;
    ms.forEach((m, i) => {
      if (m.offsetTop <= sc.scrollTop + 8) idx = i;
    });
    return idx;
  }
  function navState() {
    if (!pop) return;
    const i = topMonth();
    $('[data-dir="-1"]', pop).disabled = i === 0;
    $('[data-dir="1"]', pop).disabled = i === MONTHS_SHOWN - 1;
  }

  function paint() {
    if (!pop) return;
    const s = inEl.value,
      e = outEl.value > s ? outEl.value : "",
      min = minIso();
    const end = mode === "out" ? (s && hover > s ? hover : e) : ""; // hovering shows the range you would get
    $$(".dc", pop).forEach((c) => {
      const d = c.dataset.iso,
        b = c.firstElementChild;
      b.disabled = d < min || (mode === "out" && s && d <= s);
      b.setAttribute("aria-pressed", d === s || d === e);
      c.className =
        "dc" +
        (d === today ? " today" : "") +
        (s && end && d >= s && d <= end ? " inr" : "") +
        (d === s ? " is-start" : "") +
        (end && d === end ? " is-end" : "") +
        (end && d === end && end !== e ? " hov" : "");
    });
    $("#dp-prompt", pop).textContent =
      mode === "out" && s ? "Choose your check-out" : "Choose your check-in";
    $("#dp-sum", pop).textContent =
      s && e
        ? `${short(s)} → ${short(e)} · ${plural(nightsBetween(s, e), "night")}`
        : s
          ? `Check-in ${short(s)}. Now pick a check-out.`
          : "Pick your check-in date.";
  }
  function place(scrollIn) {
    if (!pop) return;
    const r = anchor.getBoundingClientRect(),
      w = pop.offsetWidth,
      h = pop.offsetHeight,
      top = r.bottom + 10;
    pop.style.left =
      Math.max(
        window.scrollX + 12,
        Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - w - 12),
      ) + "px";
    pop.style.top = top + window.scrollY + "px"; // always sits right under the field
    const overflow = top + h + 16 - window.innerHeight; // if it runs off the screen, scroll the page up a little
    if (scrollIn && overflow > 0)
      window.scrollBy({ top: Math.min(overflow, Math.max(0, r.top - 100)), behavior: "smooth" });
  }
  function pick(d) {
    if (mode === "out" && inEl.value && d <= inEl.value) return;
    if (mode === "in" || !inEl.value) {
      // choosing (or re-choosing) the check-in day
      setVal(inEl, d);
      if (outEl.value && outEl.value <= d) setVal(outEl, "");
      hover = "";
      close(true);
    } else {
      // choosing the check-out day
      setVal(outEl, d);
      close(true);
    }
  }
  function onClick(e) {
    const nav = e.target.closest(".dp-nav");
    if (nav) {
      const ms = $$(".dp-month", pop),
        t = ms[Math.min(ms.length - 1, Math.max(0, topMonth() + +nav.dataset.dir))];
      $("#dp-scroll", pop).scrollTo({ top: t.offsetTop, behavior: "smooth" });
      return;
    }
    if (e.target.closest("[data-clear]")) {
      if (mode === "out") setVal(outEl, "");
      else {
        setVal(inEl, "");
        setVal(outEl, "");
      }
      paint();
      return;
    }
    const b = e.target.closest(".dc button");
    if (b && !b.disabled) pick(b.dataset.iso);
  }
  function onKeys(e) {
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (move === undefined || !e.target.closest(".dc")) return;
    e.preventDefault();
    const days = $$(".dc button:not(:disabled)", pop),
      i = days.indexOf(e.target),
      t = days[i + move];
    if (t) t.focus();
  }
  [inEl, outEl].forEach((el) => {
    el.addEventListener("click", () => open(el, false));
    el.addEventListener("keydown", (e) => {
      if (["Enter", " ", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        open(el, true);
      }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pop) {
      e.preventDefault();
      close(true);
    }
  }); // Esc works from the field too
  document.addEventListener("mousedown", (e) => {
    if (pop && !pop.contains(e.target) && e.target !== inEl && e.target !== outEl) close(false);
  });
  window.addEventListener("resize", () => place());
}
initDatePickers();

const hasNext = new URLSearchParams(location.search).has("next");
const next = safeNext(new URLSearchParams(location.search).get("next"));
if (new URLSearchParams(location.search).has("next"))
  $("#notice").textContent = "Please sign in to continue.";
if (new URLSearchParams(location.search).get("registered"))
  $("#notice").textContent = "Account created. Please sign in.";

$$(".pw-toggle").forEach((b) =>
  b.addEventListener("click", () => {
    const i = $("#" + b.dataset.for),
      show = i.type === "password";
    i.type = show ? "text" : "password";
    b.textContent = show ? "Hide" : "Show";
    b.setAttribute("aria-pressed", show);
  }),
);

const id = $("#identifier"),
  pw = $("#password"),
  formError = $("#form-error");
const loginDraft = keepFormOnRefresh($("#login-form"));
const check = () =>
  [
    setError(id, id.value.trim() ? "" : "Please enter your username or email."),
    setError(pw, pw.value ? "" : "Please enter your password."),
  ].every(Boolean);
// New guests keep their place: a booking started before sign-in continues after registering.
if (location.search) $('a[href="register.html"]').href = "register.html" + location.search;

$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  formError.textContent = "";
  if (!check()) return $(".invalid", e.target).focus();
  const q = id.value.trim().toLowerCase();
  const u = allUsers().find(
    (x) =>
      (x.email.toLowerCase() === q || (x.username || "").toLowerCase() === q) &&
      x.password === pw.value,
  );
  if (!u) {
    formError.textContent = "Incorrect username/email or password. Please try again.";
    pw.focus();
    return;
  }
  loginDraft.clear();
  store.set("aurest-user", {
    name: profileFor(u.email).name || u.name,
    email: u.email,
    role: u.role || "guest",
  });
  location.href = hasNext ? next : u.role === "admin" ? "admin.html" : "index.html";
});

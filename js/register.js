$$(".pw-toggle").forEach((b) =>
  b.addEventListener("click", () => {
    const i = $("#" + b.dataset.for),
      show = i.type === "password";
    i.type = show ? "text" : "password";
    b.textContent = show ? "Hide" : "Show";
  }),
);
const name = $("#fullname"),
  email = $("#email"),
  pw = $("#password"),
  formError = $("#form-error");
const registerDraft = keepFormOnRefresh($("#register-form"));
if (location.search) $('a[href="login.html"]').href = "login.html" + location.search;
const emailMessage = () => {
  const em = email.value.trim().toLowerCase();
  if (!em) return "Please enter your email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return "Please enter a valid email address.";
  return allUsers().some((u) => u.email.toLowerCase() === em)
    ? "This email already has an account. Try signing in."
    : "";
};
const validators = [
  [name, () => (name.value.trim().length >= 2 ? "" : "Please enter your full name.")],
  [email, emailMessage],
  [
    pw,
    () =>
      !pw.value
        ? "Please create a password."
        : pw.value.length < 8
          ? "Password must be at least 8 characters."
          : "",
  ],
];
const check = () => validators.map(([el, message]) => setError(el, message())).every(Boolean);
// Check each field as the person leaves it, without flagging fields they have not reached.
validators.forEach(([el, message]) =>
  el.addEventListener("blur", () => {
    if (el.value) setError(el, message());
  }),
);
$("#register-form").addEventListener("submit", (e) => {
  e.preventDefault();
  formError.textContent = "";
  if (!check()) return $(".invalid", e.target).focus();
  const em = email.value.trim().toLowerCase();
  const mine = store.get("aurest-users", []);
  mine.push({ name: name.value.trim(), email: em, password: pw.value });
  store.set("aurest-users", mine);
  store.set("aurest-user", { name: name.value.trim(), email: em });
  registerDraft.clear();
  const n = new URLSearchParams(location.search).get("next");
  location.href = safeNext(n);
});

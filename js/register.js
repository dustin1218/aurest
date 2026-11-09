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
const check = () =>
  [
    setError(name, name.value.trim().length >= 2 ? "" : "Please enter your full name."),
    setError(
      email,
      !email.value.trim()
        ? "Please enter your email."
        : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())
          ? ""
          : "Please enter a valid email address.",
    ),
    setError(
      pw,
      !pw.value
        ? "Please create a password."
        : pw.value.length < 8
          ? "Password must be at least 8 characters."
          : "",
    ),
  ].every(Boolean);
$("#register-form").addEventListener("submit", (e) => {
  e.preventDefault();
  formError.textContent = "";
  if (!check()) return;
  const em = email.value.trim().toLowerCase();
  if (allUsers().some((u) => u.email.toLowerCase() === em)) {
    setError(email, "This email already has an account. Try signing in.");
    return;
  }
  const mine = store.get("aurest-users", []);
  mine.push({ name: name.value.trim(), email: em, password: pw.value });
  store.set("aurest-users", mine);
  store.set("aurest-user", { name: name.value.trim(), email: em });
  const n = new URLSearchParams(location.search).get("next");
  location.href = safeNext(n);
});

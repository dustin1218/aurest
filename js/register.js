$$(".pw-toggle").forEach((b) =>
  b.addEventListener("click", () => {
    const i = $("#" + b.dataset.for),
      show = i.type === "password";
    i.type = show ? "text" : "password";
    b.textContent = show ? "Hide" : "Show";
  }),
);
const first = $("#firstname"),
  last = $("#lastname"),
  email = $("#email"),
  pw = $("#password"),
  pw2 = $("#password2"),
  formError = $("#form-error");
const registerDraft = keepFormOnRefresh($("#register-form"));
if (location.search) $('a[href="login.html"]').href = "login.html" + location.search;

// Names take letters only (including letters such as ñ and é). A single space between words is
// kept so two-word names like "Dela Cruz" or "Mary Ann" still work.
const NAME_RE = /^\p{L}+( \p{L}+)*$/u;
function lettersOnly(input) {
  const before = input.value,
    caret = input.selectionStart ?? before.length;
  const clean = (s) => s.replace(/[^\p{L} ]/gu, "").replace(/ {2,}/g, " ").replace(/^ /, "");
  const after = clean(before);
  if (after === before) return;
  input.value = after;
  const pos = clean(before.slice(0, caret)).length;
  input.setSelectionRange(pos, pos);
  // Say why the character did not appear. Set after app.js clears errors on input.
  setTimeout(() => setError(input, "Use letters only."));
}
[first, last].forEach((input) => input.addEventListener("input", () => lettersOnly(input)));
const nameMessage = (input, label) => {
  const v = input.value.trim();
  if (!v) return `Please enter your ${label}.`;
  return NAME_RE.test(v) ? "" : "Use letters only.";
};

const emailMessage = () => {
  const em = email.value.trim().toLowerCase();
  if (!em) return "Please enter your email.";
  if (!EMAIL_RE.test(em)) return "Enter a valid email, such as name@example.com.";
  return allUsers().some((u) => u.email.toLowerCase() === em)
    ? "This email already has an account. Try signing in."
    : "";
};
const validators = [
  [first, () => nameMessage(first, "first name")],
  [last, () => nameMessage(last, "last name")],
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
  [
    pw2,
    () =>
      !pw2.value
        ? "Please re-enter your password."
        : pw2.value !== pw.value
          ? "Passwords do not match."
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
// Changing the first password re-checks the second one if it has been typed.
pw.addEventListener("input", () => {
  if (pw2.value) setTimeout(() => setError(pw2, validators[4][1]()));
});
$("#register-form").addEventListener("submit", (e) => {
  e.preventDefault();
  formError.textContent = "";
  if (!check()) return $(".invalid", e.target).focus();
  const em = email.value.trim().toLowerCase(),
    firstName = first.value.trim(),
    lastName = last.value.trim(),
    name = `${firstName} ${lastName}`;
  const mine = store.get("aurest-users", []);
  mine.push({ name, firstName, lastName, email: em, password: pw.value });
  store.set("aurest-users", mine);
  store.set("aurest-user", { name, email: em });
  registerDraft.clear();
  const n = new URLSearchParams(location.search).get("next");
  location.href = safeNext(n);
});

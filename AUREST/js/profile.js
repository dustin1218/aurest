// Account settings use browser storage; the photo is a portrait, never an identity document.
if (!getUser()) location.replace("login.html?next=profile.html");
const profileUser = getUser();
let picture = profileFor(profileUser?.email).picture || "";
// Show the chosen portrait or first-letter fallback. Changes are previews until the profile is saved.
function drawAvatar() {
  $("#avatar").hidden = !picture;
  $("#avatar-initials").hidden = !!picture;
  if (picture) $("#avatar").src = picture;
  $("#avatar-initials").textContent =
    Array.from(
      ($("#profile-fullname").value || profileUser?.name || "Guest").trim(),
    )[0]?.toLocaleUpperCase() || "G";
}
if (profileUser) {
  const p = profileFor(profileUser.email);
  $("#profile-name").textContent = p.name || profileUser.name;
  $("#profile-email").textContent = profileUser.email;
  ["name", "phone", "city", "emergency", "preferences"].forEach(
    (k) => ($(`[name="${k}"]`).value = p[k] || (k === "name" ? profileUser.name : "")),
  );
  drawAvatar();
}
$("#remove-avatar").onclick = () => {
  picture = "";
  drawAvatar();
};
// Resize portraits to at most 320px before storage; always release the temporary image URL.
$("#avatar-file").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 5 * 1024 * 1024)
      throw Error("Choose a JPG, PNG or WebP up to 5 MB.");
    const url = URL.createObjectURL(f);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas"),
        k = Math.min(1, 320 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      picture = c.toDataURL("image/jpeg", 0.8);
      drawAvatar();
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    $("#profile-notice").textContent = err.message;
  }
  e.target.value = "";
};
// Save details under the account email, keep the session name in sync, and refresh the navbar avatar.
$("#profile-form").onsubmit = (e) => {
  e.preventDefault();
  try {
    const p = Object.fromEntries(new FormData(e.target));
    Object.keys(p).forEach((k) => (p[k] = p[k].trim()));
    if (p.name.length < 2) throw Error("Enter your full name.");
    if (p.phone && !/^[+\d\s()-]{7,30}$/.test(p.phone)) throw Error("Enter a valid phone number.");
    const profiles = store.get("aurest-profiles", {});
    profiles[profileUser.email] = { ...p, picture };
    persist("aurest-profiles", profiles);
    persist("aurest-user", { ...profileUser, name: p.name });
    const registered = store
      .get("aurest-users", [])
      .map((u) => (u.email === profileUser.email ? { ...u, name: p.name } : u));
    persist("aurest-users", registered);
    $("#profile-name").textContent = p.name;
    drawAvatar();
    updateNavAvatar();
    $("#profile-notice").textContent = "Profile saved.";
  } catch (err) {
    $("#profile-notice").textContent = err.message;
  }
};

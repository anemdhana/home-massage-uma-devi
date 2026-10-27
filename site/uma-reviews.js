(function () {
  const U = window.Uma;

  async function signOut(event) {
    event.preventDefault();
    await U.api("/auth/logout", { method: "POST" }).catch(() => {});
    location.href = "/";
  }

  async function load() {
    const rows = (await U.api("/admin/reviews")).data;
    const host = document.getElementById("rows");
    document.getElementById("empty").hidden = rows.length > 0;
    host.innerHTML = rows.map((row) => `<article class="app-booking is-static">
      <span class="app-booking-top"><span class="app-icon-row">${U.stars(row.rating)} ${U.escapeHtml(row.displayName)}</span>${row.visible ? `<span class="uk-label uk-label-success">Shown</span>` : `<span class="uk-label app-label-muted">Hidden</span>`}</span>
      <span>${U.escapeHtml(row.packageName)} · ${U.escapeHtml(row.reference)}</span>
      <span class="uk-text-meta">${U.escapeHtml(row.summary)}</span>
      <button class="uk-button uk-button-default uk-button-small uk-margin-small-top" type="button" data-id="${row.id}" data-visible="${row.visible ? "1" : "0"}">${row.visible ? "Hide from the site" : "Show on the site"}</button>
    </article>`).join("");
    host.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await U.api("/admin/reviews/" + encodeURIComponent(button.getAttribute("data-id")), {
            method: "POST",
            body: { visible: button.getAttribute("data-visible") !== "1" },
          });
          await load();
        } catch (error) {
          U.showMessage(document.getElementById("list-alert"), "danger", error.message);
          button.disabled = false;
        }
      });
    });
    if (window.UIkit) UIkit.update(host);
  }

  document.getElementById("sign-out").addEventListener("click", signOut);
  document.getElementById("sign-out-menu").addEventListener("click", signOut);
  U.api("/auth/me").then(load).catch(() => { location.href = "/uma/login"; });
})();

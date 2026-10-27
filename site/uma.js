(function () {
  const U = window.Uma;
  let view = "today";

  function label(status) {
    if (status === "COMPLETED") return `<span class="uk-label uk-label-success">Completed</span>`;
    if (status === "CANCELLED") return `<span class="uk-label app-label-muted">Cancelled</span>`;
    const word = status === "HELD" ? "Held" : "Confirmed";
    return `<span class="uk-label">${word}</span>`;
  }

  async function signOut(event) {
    event.preventDefault();
    await U.api("/auth/logout", { method: "POST" }).catch(() => {});
    location.href = "/";
  }

  async function load() {
    const list = await U.api(`/admin/bookings?view=${view}`);
    const rows = document.getElementById("rows");
    document.getElementById("empty").hidden = list.data.length > 0;
    rows.innerHTML = list.data.map((row) => `<button class="app-booking" type="button" data-id="${row.id}">
      <span class="app-booking-top"><span>${U.escapeHtml(U.dateLabel(row.date).replace(/ \d{4}$/, ""))}, ${U.clockLabel(row.start)}</span>${label(row.status)}</span>
      <span>${U.escapeHtml(row.customerName)} · ${U.escapeHtml(row.locality)}</span>
      <span class="uk-text-meta">${U.escapeHtml(row.packageName)}</span>
    </button>`).join("");
    rows.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => openVisit(button.getAttribute("data-id"))));
  }

  async function openVisit(id) {
    const row = (await U.api("/admin/bookings/" + id)).data;
    const actions = [];
    if (row.status === "HELD") actions.push(`<button class="uk-button uk-button-primary" type="button" data-status="CONFIRMED">Confirm</button>`);
    if (row.status === "HELD" || row.status === "CONFIRMED") {
      const primary = row.status === "CONFIRMED" ? "uk-button-primary" : "uk-button-default";
      actions.push(`<button class="uk-button ${primary}" type="button" data-status="COMPLETED">Mark completed</button>`);
      actions.push(`<button class="uk-button uk-button-default" type="button" data-status="CANCELLED">Cancel booking</button>`);
    }
    const who = row.secondName ? row.customerName + " and " + row.secondName : row.customerName;
    document.getElementById("visit-body").innerHTML = `
      <div class="uk-flex uk-flex-between uk-flex-middle"><h2 class="uk-h4 uk-margin-remove">${U.escapeHtml(row.reference)}</h2>${label(row.status)}</div>
      <dl class="uk-description-list uk-description-list-divider app-dl uk-margin-small-top">
        <dt>When</dt><dd>${U.escapeHtml(U.dateLabel(row.date) + ", " + U.clockLabel(row.start) + " – " + U.clockLabel(row.end))}</dd>
        <dt>Package</dt><dd>${U.escapeHtml(row.packageName)} · ${U.money(row.priceInr)}</dd>
        <dt>Who</dt><dd>${U.escapeHtml(who)}</dd>
        <dt>Mobile</dt><dd><a href="tel:+91${row.mobile}">${row.mobile.slice(0, 5)} ${row.mobile.slice(5)}</a></dd>
        <dt>Where</dt><dd>${U.escapeHtml(row.locality)}<br>${U.escapeHtml(row.address)}${row.landmark ? "<br>" + U.escapeHtml(row.landmark) : ""}</dd>
        <dt>Note</dt><dd>${U.escapeHtml(row.note || "—")}</dd>
      </dl>
      <div id="visit-alert"></div>
      <div class="uk-margin-small-top">${actions.join(" ")}</div>`;
    document.getElementById("visit-body").querySelectorAll("[data-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (button.getAttribute("data-status") === "CANCELLED") {
          const yes = await new Promise((resolve) => {
            UIkit.modal.confirm("Cancel this visit? The time becomes free.", { labels: { ok: "Cancel visit", cancel: "Keep" } }).then(() => resolve(true), () => resolve(false));
          });
          if (!yes) return;
        }
        button.disabled = true;
        try {
          await U.api(`/admin/bookings/${id}/status`, { method: "POST", body: { status: button.getAttribute("data-status") } });
          UIkit.modal("#visit").hide();
          U.notify("Booking updated.");
          await load();
        } catch (error) {
          button.disabled = false;
          U.showMessage(document.getElementById("visit-alert"), "danger", error.message);
        }
      });
    });
    if (window.UIkit) UIkit.update(document.getElementById("visit-body"));
    UIkit.modal("#visit").show();
  }

  document.getElementById("views").addEventListener("click", (event) => {
    const link = event.target.closest("[data-view]");
    if (!link) return;
    event.preventDefault();
    view = link.getAttribute("data-view");
    link.closest(".uk-subnav").querySelectorAll("li").forEach((item) => item.classList.remove("uk-active"));
    link.parentElement.classList.add("uk-active");
    load().catch((error) => U.showMessage(document.getElementById("list-alert"), "danger", error.message));
  });
  document.getElementById("sign-out").addEventListener("click", signOut);
  document.getElementById("sign-out-menu").addEventListener("click", signOut);

  U.api("/auth/me").then(load).catch(() => { location.href = "/uma/login"; });
})();

(function () {
  const U = window.Uma;
  let current = null;

  function render(rows) {
    document.getElementById("rows").innerHTML = rows.map((row) => `<button class="app-booking" type="button" data-id="${row.id}">
      <span class="app-booking-top"><span>${U.escapeHtml(row.name)}</span>${row.bookable ? `<span class="uk-label">Shown</span>` : `<span class="uk-label app-label-muted">Hidden</span>`}</span>
      <span class="uk-text-meta">${row.audience === "couple" ? "Couple" : "Individual"} · ${U.durationLabel(row.durationMinutes)} · ${U.money(row.priceInr)}</span>
    </button>`).join("");
    document.getElementById("rows").querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => open(rows.find((row) => row.id === button.getAttribute("data-id"))));
    });
  }

  function open(row) {
    current = row;
    document.getElementById("edit-audience").textContent = row.audience === "couple" ? "Couple" : "Individual";
    document.getElementById("pkg-name").value = row.name;
    document.getElementById("pkg-includes").value = row.includes.join("\n");
    document.getElementById("pkg-price").value = row.priceInr;
    document.getElementById("pkg-duration").value = String(row.durationMinutes);
    document.querySelectorAll("[data-bookable]").forEach((link) => {
      link.parentElement.classList.toggle("uk-active", link.getAttribute("data-bookable") === (row.bookable ? "1" : "0"));
    });
    U.clearMessage(document.getElementById("edit-alert"));
    UIkit.modal("#edit-package").show();
  }

  async function load() {
    render((await U.api("/packages")).data);
  }

  document.querySelectorAll("[data-bookable]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      link.closest(".uk-subnav").querySelectorAll("li").forEach((item) => item.classList.remove("uk-active"));
      link.parentElement.classList.add("uk-active");
    });
  });
  document.getElementById("edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    U.clearMessage(document.getElementById("edit-alert"));
    try {
      await U.api("/admin/packages/" + current.id, {
        method: "PUT",
        body: {
          name: document.getElementById("pkg-name").value,
          includes: document.getElementById("pkg-includes").value.split("\n"),
          priceInr: Number(document.getElementById("pkg-price").value),
          durationMinutes: Number(document.getElementById("pkg-duration").value),
          bookable: document.querySelector("[data-bookable='1']").parentElement.classList.contains("uk-active"),
        },
      });
      UIkit.modal("#edit-package").hide();
      U.notify("Package saved.");
      await load();
    } catch (error) {
      U.showMessage(document.getElementById("edit-alert"), "danger", error.message);
    }
  });

  async function signOut(event) {
    event.preventDefault();
    await U.api("/auth/logout", { method: "POST" }).catch(() => {});
    location.href = "/";
  }
  document.getElementById("sign-out").addEventListener("click", signOut);
  document.getElementById("sign-out-menu").addEventListener("click", signOut);
  U.api("/auth/me").then(load).catch(() => { location.href = "/uma/login"; });
})();

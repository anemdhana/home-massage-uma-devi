(function () {
  const U = window.Uma;
  const names = { MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday", SUN: "Sunday" };

  function options(selected) {
    let html = "";
    for (let minutes = 6 * 60; minutes <= 21 * 60; minutes += 30) {
      const value = String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
      html += `<option ${value === selected ? "selected" : ""}>${value}</option>`;
    }
    return html;
  }

  function renderWeek(days) {
    document.getElementById("week").innerHTML = days.map((day) => `<div class="app-hour-row" data-day="${day.day}">
      <span class="app-dayname">${names[day.day].slice(0, 3)}</span>
      <ul class="uk-subnav uk-subnav-pill uk-margin-remove">
        <li class="${day.open ? "uk-active" : ""}"><a href="#" data-open="1">Open</a></li>
        <li class="${day.open ? "" : "uk-active"}"><a href="#" data-open="0">Closed</a></li>
      </ul>
      <select class="uk-select" data-which="start" aria-label="${names[day.day]} start" ${day.open ? "" : "hidden"}>${options(day.start || "09:00")}</select>
      <select class="uk-select" data-which="end" aria-label="${names[day.day]} end" ${day.open ? "" : "hidden"}>${options(day.end || "19:00")}</select>
    </div>`).join("");
    document.getElementById("week").querySelectorAll("a[data-open]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const row = link.closest(".app-hour-row");
        row.querySelectorAll("li").forEach((item) => item.classList.remove("uk-active"));
        link.parentElement.classList.add("uk-active");
        const open = link.getAttribute("data-open") === "1";
        row.querySelectorAll("select").forEach((select) => { select.hidden = !open; });
      });
    });
  }

  async function renderBlocks() {
    const from = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const rows = (await U.api(`/admin/blocks?from=${from}&to=${U.addDays(from, 21)}`)).data;
    document.getElementById("no-blocks").hidden = rows.length > 0;
    document.getElementById("blocks").innerHTML = rows.map((row) => `<tr>
      <td>${U.escapeHtml(U.dateLabel(row.date))}</td>
      <td>${U.clockLabel(row.start)}</td>
      <td>${U.clockLabel(row.end)}</td>
      <td>${U.escapeHtml(row.note || "")}</td>
      <td><button class="uk-button uk-button-text" type="button" data-id="${row.id}">Remove</button></td>
    </tr>`).join("");
    document.getElementById("blocks").querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", async () => {
        const yes = await new Promise((resolve) => {
          UIkit.modal.confirm("Remove this block?", { labels: { ok: "Remove", cancel: "Keep" } }).then(() => resolve(true), () => resolve(false));
        });
        if (!yes) return;
        await U.api("/admin/blocks/" + button.getAttribute("data-id"), { method: "DELETE" });
        U.notify("Block removed.");
        renderBlocks();
      });
    });
  }

  document.getElementById("save-hours").addEventListener("click", async () => {
    const days = [...document.querySelectorAll(".app-hour-row")].map((row) => {
      const open = row.querySelector("a[data-open='1']").parentElement.classList.contains("uk-active");
      return {
        day: row.getAttribute("data-day"),
        open,
        start: open ? row.querySelector("[data-which='start']").value : null,
        end: open ? row.querySelector("[data-which='end']").value : null,
      };
    });
    try {
      await U.api("/admin/hours", { method: "PUT", body: { days } });
      U.clearMessage(document.getElementById("hours-alert"));
      U.notify("Hours saved.");
    } catch (error) {
      U.showMessage(document.getElementById("hours-alert"), "danger", error.message);
    }
  });

  document.getElementById("block-from").innerHTML = options("14:00");
  document.getElementById("block-to").innerHTML = options("19:00");
  document.getElementById("block-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    U.clearMessage(document.getElementById("add-alert"));
    try {
      const saved = (await U.api("/admin/blocks", {
        method: "POST",
        body: {
          date: document.getElementById("block-date").value,
          start: document.getElementById("block-from").value,
          end: document.getElementById("block-to").value,
          note: document.getElementById("block-note").value,
        },
      })).data;
      await renderBlocks();
      if (saved.overlaps && saved.overlaps.length) {
        U.showMessage(document.getElementById("add-alert"), "warning", "These visits still sit in this block: " + saved.overlaps.join(", ") + ". Cancel them on Bookings if the hour should be free.");
        return;
      }
      UIkit.modal("#add-block").hide();
      U.notify("Time blocked.");
    } catch (error) {
      U.showMessage(document.getElementById("add-alert"), "danger", error.message);
    }
  });

  async function signOut(event) {
    event.preventDefault();
    await U.api("/auth/logout", { method: "POST" }).catch(() => {});
    location.href = "/";
  }
  document.getElementById("sign-out").addEventListener("click", signOut);
  document.getElementById("sign-out-menu").addEventListener("click", signOut);

  U.api("/auth/me").then(() => Promise.all([U.api("/admin/hours"), renderBlocks()])).then(([hours]) => {
    renderWeek(hours.data.days);
  }).catch(() => { location.href = "/uma/login"; });
})();

(function () {
  const U = window.Uma;
  const names = ["Package", "Date", "Time", "Your visit", "Review"];
  const state = {
    step: 0,
    packages: [],
    packageId: new URLSearchParams(location.search).get("package"),
    audience: "individual",
    days: [],
    date: null,
    start: null,
    cursor: null,
    wide: window.matchMedia("(min-width: 960px)").matches,
  };

  const alertHost = document.getElementById("step-alert");
  const summary = document.getElementById("summary");

  function selected() {
    return state.packages.find((pack) => pack.id === state.packageId) || null;
  }

  function dayInfo(ymd) {
    return state.days.find((day) => day.date === ymd) || null;
  }

  function show(step) {
    state.step = step;
    document.querySelectorAll("#book-steps > li").forEach((item, index) => item.classList.toggle("uk-active", index === step));
    document.getElementById("step-line").textContent = "Step " + (step + 1) + " of 5 · " + names[step];
    const bar = document.getElementById("step-progress");
    bar.value = step + 1;
    bar.setAttribute("aria-label", "Step " + (step + 1) + " of 5");
    document.getElementById("step-back").classList.toggle("uk-invisible", step === 0);
    const label = step === 4 ? "Confirm booking" : "Continue";
    document.getElementById("sticky-next").textContent = label;
    document.getElementById("card-next").textContent = label;
    U.clearMessage(alertHost);
    if (step === 1) renderDays();
    if (step === 2) renderSlots();
    if (step === 4) fillReview();
    paintSummary();
  }

  function paintSummary() {
    const pack = selected();
    if (!pack) {
      summary.hidden = true;
      return;
    }
    const bits = [pack.name, U.durationLabel(pack.durationMinutes), U.money(pack.priceInr)];
    if (state.date) bits.push(U.dateLabel(state.date));
    if (state.start) {
      const end = endClock(state.start, pack.durationMinutes);
      bits.push(U.clockLabel(state.start) + " – " + U.clockLabel(end));
    }
    summary.hidden = false;
    summary.innerHTML = `<p class="app-alert-line"><span uk-icon="icon: info; ratio: 0.8"></span><span>${U.escapeHtml(bits.join(" · "))}</span></p>`;
    if (window.UIkit) UIkit.update(summary);
  }

  function endClock(start, minutes) {
    const [hour, minute] = start.split(":").map(Number);
    const total = hour * 60 + minute + minutes;
    return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
  }

  function renderChoices() {
    for (const audience of ["individual", "couple"]) {
      const host = document.getElementById("choice-" + audience);
      host.innerHTML = state.packages.filter((pack) => pack.audience === audience && pack.bookable).map((pack) => {
        const includes = pack.includes[0] ? `<span class="uk-text-small uk-display-block">${U.escapeHtml(pack.includes[0])}</span>` : "";
        return `<button class="app-choice ${pack.id === state.packageId ? "is-selected" : ""}" type="button" data-id="${pack.id}">
          <span class="app-icon-row"><span uk-icon="icon: ${U.packageIcon(pack.id)}; ratio: 0.85"></span><span class="uk-text-bold">${U.escapeHtml(pack.name)}</span></span>
          ${includes}
          <span class="uk-flex uk-flex-between uk-margin-small-top"><span class="uk-text-meta">${U.durationLabel(pack.durationMinutes)}</span><span class="uk-text-bold">${U.money(pack.priceInr)}</span></span>
        </button>`;
      }).join("");
      host.querySelectorAll(".app-choice").forEach((button) => {
        button.addEventListener("click", () => {
          state.packageId = button.getAttribute("data-id");
          state.date = null;
          state.start = null;
          state.days = [];
          renderChoices();
          paintSummary();
          document.getElementById("second-wrap").hidden = selected().audience !== "couple";
        });
      });
    }
    document.getElementById("choice-individual").hidden = state.audience !== "individual";
    document.getElementById("choice-couple").hidden = state.audience !== "couple";
    if (window.UIkit) UIkit.update(document.getElementById("book-steps"));
  }

  async function ensureDays() {
    if (state.days.length || !state.packageId) return;
    const today = new Date();
    const from = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
    const to = U.addDays(from, 21);
    const data = (await U.api(`/availability?packageId=${state.packageId}&from=${from}&to=${to}`)).data;
    state.days = data.days;
    const first = state.days.find((day) => day.bookable);
    state.cursor = first ? first.date : (state.days[0] && state.days[0].date);
    if (!state.date && first) state.date = first.date;
  }

  function renderDays() {
    const host = document.getElementById("day-grid");
    if (!state.cursor) {
      host.innerHTML = "";
      U.showMessage(alertHost, "warning", "No open day in the next 21 days.");
      return;
    }
    const cells = [];
    if (state.wide) {
      const [year, month] = state.cursor.split("-").map(Number);
      const first = `${state.cursor.slice(0, 7)}-01`;
      const start = U.mondayOf(first);
      document.getElementById("range-label").textContent = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
      for (let i = 0; i < 42; i += 1) cells.push(U.addDays(start, i));
      const last = cells[cells.length - 1];
      document.getElementById("prev-range").disabled = first <= (state.days[0] && state.days[0].date);
      document.getElementById("next-range").disabled = last >= state.days[state.days.length - 1].date;
    } else {
      const start = U.mondayOf(state.cursor);
      const short = (ymd) => U.dateLabel(ymd).replace(/^\w+ /, "");
      document.getElementById("range-label").textContent = short(start).replace(/ \d{4}$/, "") + " – " + short(U.addDays(start, 6));
      for (let i = 0; i < 7; i += 1) cells.push(U.addDays(start, i));
      document.getElementById("prev-range").disabled = start <= U.mondayOf(state.days[0].date);
      document.getElementById("next-range").disabled = U.addDays(start, 6) >= state.days[state.days.length - 1].date;
    }
    const letters = ["S", "M", "T", "W", "T", "F", "S"];
    host.innerHTML = cells.map((ymd) => {
      const inMonth = !state.wide || ymd.slice(0, 7) === state.cursor.slice(0, 7);
      const info = dayInfo(ymd);
      const disabled = !inMonth || !info || !info.bookable;
      const dayNum = Number(ymd.slice(8));
      const [year, month, day] = ymd.split("-").map(Number);
      const letter = letters[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
      const selectedClass = ymd === state.date ? "uk-button-primary" : "uk-button-default";
      const today = info && state.days[0] && ymd === state.days.find((item) => item.date >= state.days[0].date && item.starts) ? "" : "";
      return `<button class="uk-button ${selectedClass} app-day" type="button" ${disabled ? "disabled" : ""} data-date="${ymd}" aria-label="${U.dateLabel(ymd)}${disabled ? ", unavailable" : ""}"><span class="app-day-name">${state.wide ? "" : letter}</span><span>${dayNum}</span></button>`;
    }).join("");
    host.querySelectorAll("button:not(:disabled)").forEach((button) => {
      button.addEventListener("click", () => {
        state.date = button.getAttribute("data-date");
        state.start = null;
        renderDays();
        paintSummary();
      });
    });
  }

  function renderSlots() {
    const info = dayInfo(state.date);
    const starts = info ? info.starts : [];
    const host = document.getElementById("slot-grid");
    const empty = document.getElementById("slot-empty");
    empty.hidden = starts.length > 0;
    host.innerHTML = starts.map((start) =>
      `<div><button class="uk-button ${start === state.start ? "uk-button-primary" : "uk-button-default"} app-slot" type="button" data-start="${start}">${U.clockLabel(start)}</button></div>`
    ).join("");
    if (window.UIkit) UIkit.update(host);
    host.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        state.start = button.getAttribute("data-start");
        renderSlots();
        paintSummary();
      });
    });
  }

  function setFieldError(id, message) {
    const input = document.getElementById(id);
    if (!input) return;
    input.classList.toggle("is-invalid", !!message);
    let note = input.parentElement.querySelector(".app-error");
    if (!message) {
      if (note) note.remove();
      return;
    }
    if (!note) {
      note = document.createElement("div");
      note.className = "app-error";
      input.insertAdjacentElement("afterend", note);
    }
    note.textContent = message;
  }

  function clearErrors() {
    document.querySelectorAll(".is-invalid").forEach((input) => input.classList.remove("is-invalid"));
    document.querySelectorAll(".app-error").forEach((note) => note.remove());
  }

  function visitValue() {
    return {
      customerName: document.getElementById("customer-name").value.trim(),
      mobile: document.getElementById("mobile").value.replace(/\D/g, ""),
      whatsappSame: document.querySelector("[data-whatsapp='same']").parentElement.classList.contains("uk-active"),
      whatsappMobile: document.getElementById("whatsapp-mobile").value.replace(/\D/g, ""),
      locality: document.getElementById("locality").value.trim(),
      address: document.getElementById("address").value.trim(),
      landmark: document.getElementById("landmark").value.trim(),
      note: document.getElementById("note").value.trim(),
      secondName: document.getElementById("second-name").value.trim(),
    };
  }

  function validateVisit() {
    clearErrors();
    const pack = selected();
    const value = visitValue();
    const errors = [];
    if (value.customerName.length < 2) errors.push(["customer-name", "Enter your name."]);
    if (!/^[6-9][0-9]{9}$/.test(value.mobile)) errors.push(["mobile", "Enter a 10-digit mobile number."]);
    if (!value.whatsappSame && !/^[6-9][0-9]{9}$/.test(value.whatsappMobile)) errors.push(["whatsapp-mobile", "Enter a 10-digit WhatsApp number."]);
    if (value.locality.length < 2) errors.push(["locality", "Enter the area in Hyderabad."]);
    if (value.address.length < 8) errors.push(["address", "Enter the full address."]);
    if (pack && pack.audience === "couple" && value.secondName.length < 2) errors.push(["second-name", "Enter the other person’s name."]);
    errors.forEach(([id, message]) => setFieldError(id, message));
    if (errors.length) {
      U.showMessage(alertHost, "danger", "Check the fields below.");
      document.getElementById(errors[0][0]).focus();
      return false;
    }
    U.clearMessage(alertHost);
    return true;
  }

  function fillReview() {
    const pack = selected();
    const value = visitValue();
    const end = endClock(state.start, pack.durationMinutes);
    document.getElementById("review-package").textContent = pack.name;
    document.getElementById("review-when").textContent = U.dateLabel(state.date) + ", " + U.clockLabel(state.start) + " – " + U.clockLabel(end);
    document.getElementById("review-where").textContent = [value.locality, value.address, value.landmark].filter(Boolean).join("\n");
    document.getElementById("review-who").textContent = pack.audience === "couple" ? value.customerName + "\n" + value.secondName : value.customerName;
    document.getElementById("review-mobile").textContent = value.mobile.slice(0, 5) + " " + value.mobile.slice(5);
    document.getElementById("review-price").textContent = U.money(pack.priceInr);
    document.getElementById("couple-note").hidden = !(pack.audience === "couple" && pack.includes.length === 0);
    document.getElementById("hold-line").textContent = pack.name + " · " + U.dateLabel(state.date) + " · " + U.clockLabel(state.start) + "–" + U.clockLabel(end);
  }

  async function forward() {
    U.clearMessage(alertHost);
    if (state.step === 0) {
      if (!selected()) return U.showMessage(alertHost, "warning", "Choose a package to continue.");
      try {
        await ensureDays();
      } catch (error) {
        return U.showMessage(alertHost, "danger", error.message);
      }
      if (!state.days.some((day) => day.bookable)) return U.showMessage(alertHost, "warning", "No open day in the next 21 days.");
      return show(1);
    }
    if (state.step === 1) {
      if (!state.date || !dayInfo(state.date)?.bookable) return U.showMessage(alertHost, "warning", "Choose a day with an open time.");
      return show(2);
    }
    if (state.step === 2) {
      if (!state.start) return U.showMessage(alertHost, "warning", "Choose a start time.");
      return show(3);
    }
    if (state.step === 3) {
      if (!validateVisit()) return;
      return show(4);
    }
    U.clearMessage(document.getElementById("hold-alert"));
    UIkit.modal("#hold").show();
  }

  document.getElementById("step-back").addEventListener("click", () => {
    if (state.step > 0) show(state.step - 1);
  });
  document.getElementById("card-next").addEventListener("click", forward);
  document.getElementById("sticky-next").addEventListener("click", forward);
  document.querySelectorAll("[data-audience]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      state.audience = link.getAttribute("data-audience");
      link.closest(".uk-subnav").querySelectorAll("li").forEach((item) => item.classList.remove("uk-active"));
      link.parentElement.classList.add("uk-active");
      renderChoices();
    });
  });
  document.querySelectorAll("[data-whatsapp]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      link.closest(".uk-subnav").querySelectorAll("li").forEach((item) => item.classList.remove("uk-active"));
      link.parentElement.classList.add("uk-active");
      document.getElementById("whatsapp-wrap").hidden = link.getAttribute("data-whatsapp") !== "other";
    });
  });
  document.getElementById("prev-range").addEventListener("click", () => shift(-1));
  document.getElementById("next-range").addEventListener("click", () => shift(1));

  function shift(direction) {
    if (state.wide) {
      const [year, month] = state.cursor.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1 + direction, 1));
      state.cursor = date.toISOString().slice(0, 10);
    } else {
      state.cursor = U.addDays(U.mondayOf(state.cursor), direction * 7);
    }
    renderDays();
  }

  document.getElementById("hold-yes").addEventListener("click", async () => {
    const button = document.getElementById("hold-yes");
    const pack = selected();
    const value = visitValue();
    button.disabled = true;
    button.textContent = "Holding…";
    U.clearMessage(document.getElementById("hold-alert"));
    try {
      const saved = (await U.api("/bookings", {
        method: "POST",
        body: {
          packageId: pack.id,
          date: state.date,
          start: state.start,
          ...value,
          whatsappMobile: value.whatsappSame ? undefined : value.whatsappMobile,
        },
      })).data;
      sessionStorage.setItem("uma_devi_done", JSON.stringify(saved));
      location.href = "/book/done";
    } catch (error) {
      button.disabled = false;
      button.textContent = "Hold this time";
      if (error.code === "SLOT_TAKEN" || error.code === "TOO_SOON" || error.code === "OUTSIDE_HOURS") {
        UIkit.modal("#hold").hide();
        state.days = [];
        state.start = null;
        await ensureDays();
        show(2);
        U.showMessage(alertHost, "danger", error.message);
        return;
      }
      if (error.field) {
        UIkit.modal("#hold").hide();
        show(3);
        const fieldId = {
          customerName: "customer-name",
          mobile: "mobile",
          whatsappMobile: "whatsapp-mobile",
          locality: "locality",
          address: "address",
          secondName: "second-name",
        }[error.field];
        if (fieldId) setFieldError(fieldId, error.message);
        U.showMessage(alertHost, "danger", error.message);
        return;
      }
      U.showMessage(document.getElementById("hold-alert"), "danger", error.message);
    }
  });

  U.api("/packages").then((res) => {
    state.packages = res.data;
    const query = state.packages.find((pack) => pack.id === state.packageId && pack.bookable);
    if (!query) state.packageId = null;
    else state.audience = query.audience;
    document.querySelectorAll("[data-audience]").forEach((link) => {
      link.parentElement.classList.toggle("uk-active", link.getAttribute("data-audience") === state.audience);
    });
    if (query && query.audience === "couple") document.getElementById("second-wrap").hidden = false;
    renderChoices();
    paintSummary();
  }).catch(() => U.showMessage(alertHost, "danger", "Packages could not be loaded. Refresh the page."));

  window.matchMedia("(min-width: 960px)").addEventListener("change", (event) => {
    state.wide = event.matches;
    if (state.step === 1) renderDays();
  });
})();

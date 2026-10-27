(function () {
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  async function api(path, options = {}) {
    const opts = { credentials: "include", ...options };
    if (opts.body !== undefined) {
      opts.headers = { "content-type": "application/json", ...(opts.headers || {}) };
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch("/api/v1" + path, opts);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(json.error?.message || "Something went wrong. Try again.");
      error.status = res.status;
      error.code = json.error?.code || "";
      error.field = json.error?.field || null;
      throw error;
    }
    return json;
  }

  function showMessage(host, kind, text) {
    if (!host) return;
    host.hidden = false;
    const icon = { danger: "warning", warning: "warning", primary: "info", success: "check" }[kind] || "info";
    host.innerHTML =
      `<div class="uk-alert uk-alert-${kind} app-alert" uk-alert>` +
      `<a class="uk-alert-close" uk-close></a>` +
      `<p class="app-alert-line"><span uk-icon="icon: ${icon}; ratio: 0.85"></span><span>${escapeHtml(text)}</span></p></div>`;
    if (window.UIkit) UIkit.update(host);
  }

  function clearMessage(host) {
    if (!host) return;
    host.hidden = true;
    host.innerHTML = "";
  }

  function money(amount) {
    return "₹" + amount;
  }

  function durationLabel(minutes) {
    if (minutes === 60) return "1 hr";
    if (minutes === 105) return "1 hr 45 min";
    if (minutes % 60 === 0) return minutes / 60 + " hr";
    return minutes + " min";
  }

  function clockLabel(hhmm) {
    const [hour, minute] = hhmm.split(":").map(Number);
    const suffix = hour >= 12 ? "pm" : "am";
    return (hour % 12 || 12) + ":" + String(minute).padStart(2, "0") + " " + suffix;
  }

  function dateLabel(ymd) {
    const [year, month, day] = ymd.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return days[date.getUTCDay()] + " " + day + " " + months[month - 1] + " " + year;
  }

  function addDays(ymd, count) {
    const [year, month, day] = ymd.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + count));
    return date.toISOString().slice(0, 10);
  }

  function mondayOf(ymd) {
    const [year, month, day] = ymd.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
  }

  function packageIcon(id) {
    return { P1: "lotus", P2: "user", P3: "star", P4: "lifesaver", C1: "users", C2: "users" }[id] || "heart";
  }

  function notify(message) {
    if (window.UIkit) UIkit.notification({ message, status: "primary", pos: "top-center", timeout: 2200 });
  }

  window.Uma = {
    escapeHtml,
    api,
    showMessage,
    clearMessage,
    money,
    durationLabel,
    clockLabel,
    dateLabel,
    addDays,
    mondayOf,
    packageIcon,
    notify,
  };
})();

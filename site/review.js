(function () {
  const U = window.Uma;
  const alertHost = document.getElementById("page-alert");
  const writeForm = document.getElementById("write-form");
  const params = new URLSearchParams(location.search);
  let rating = 0;

  if (params.get("reference")) document.getElementById("reference").value = params.get("reference");

  const stars = document.getElementById("stars");
  stars.innerHTML = [1, 2, 3, 4, 5].map((n) =>
    `<button type="button" data-rating="${n}" aria-label="${n} out of 5" aria-pressed="false"><span uk-icon="icon: star; ratio: 0.9"></span></button>`
  ).join("");

  function paintStars() {
    stars.querySelectorAll("button").forEach((button) => {
      const on = Number(button.getAttribute("data-rating")) <= rating;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  stars.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    rating = Number(button.getAttribute("data-rating"));
    paintStars();
  });

  function showVisit(visit) {
    document.getElementById("visit-name").textContent = visit.packageName;
    document.getElementById("visit-when").textContent = U.dateLabel(visit.date) + ", " + U.clockLabel(visit.start);
    writeForm.hidden = false;
  }

  document.getElementById("find-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    U.clearMessage(alertHost);
    writeForm.hidden = true;
    const reference = document.getElementById("reference").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    try {
      const visit = (await U.api("/reviews/check?reference=" + encodeURIComponent(reference) + "&mobile=" + encodeURIComponent(mobile))).data;
      if (visit.state === "cancelled") {
        U.showMessage(alertHost, "warning", "That booking was cancelled, so it cannot be rated.");
        return;
      }
      if (visit.state === "early") {
        U.showMessage(alertHost, "warning", "You can rate this visit after it ends.");
        return;
      }
      if (visit.state === "done") {
        U.showMessage(alertHost, "success", "You already shared a review for this visit.");
        showVisit(visit);
        document.getElementById("summary").value = visit.review.summary;
        rating = visit.review.rating;
        paintStars();
        document.getElementById("save").hidden = true;
        document.getElementById("summary").readOnly = true;
        stars.querySelectorAll("button").forEach((button) => { button.disabled = true; });
        return;
      }
      document.getElementById("save").hidden = false;
      document.getElementById("summary").readOnly = false;
      stars.querySelectorAll("button").forEach((button) => { button.disabled = false; });
      showVisit(visit);
    } catch (error) {
      U.showMessage(alertHost, "danger", error.message);
    }
  });

  document.getElementById("write-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    U.clearMessage(alertHost);
    const button = document.getElementById("save");
    button.disabled = true;
    try {
      await U.api("/reviews", {
        method: "POST",
        body: {
          reference: document.getElementById("reference").value.trim(),
          mobile: document.getElementById("mobile").value.trim(),
          rating,
          summary: document.getElementById("summary").value.trim(),
        },
      });
      U.notify("Review shared.");
      location.href = "/#reviews";
    } catch (error) {
      U.showMessage(alertHost, "danger", error.message);
      button.disabled = false;
    }
  });

  if (window.UIkit) UIkit.update(document.body);
})();

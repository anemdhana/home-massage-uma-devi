(function () {
  const U = window.Uma;

  function summary(pack) {
    const line = (pack.includes || []).filter(Boolean).join(", ");
    if (line) return line;
    return pack.audience === "couple" ? "Shared session for two. Uma confirms what is included." : "";
  }

  function reviewBits(reviews) {
    if (!reviews.length) return "";
    return `<div class="app-reviews uk-margin-small-top">${reviews.map(reviewCard).join("")}</div>`;
  }

  function reviewCard(review) {
    return `<article class="app-review">
      <div class="app-booking-top"><span class="app-icon-row">${U.stars(review.rating)} <span class="uk-text-bold">${U.escapeHtml(review.displayName)}</span></span></div>
      <p class="uk-margin-small-top uk-margin-remove-bottom">${U.escapeHtml(review.summary)}</p>
    </article>`;
  }

  function packageCard(pack, score, reviews) {
    const rating = score
      ? U.ratingLine(score.average, score.count)
      : `<span class="uk-text-meta">No rating yet</span>`;
    const per = pack.audience === "couple" ? `<span class="uk-text-meta"> · ₹${Math.round(pack.priceInr / 2)} per person</span>` : "";
    return `<article class="app-service">
      <div class="app-booking-top"><span class="app-icon-row"><span uk-icon="icon: ${U.packageIcon(pack.id)}; ratio: 0.8"></span><h3>${U.escapeHtml(pack.name)}</h3></span><span class="uk-text-bold">${U.money(pack.priceInr)}</span></div>
      <p class="app-service-summary">${U.escapeHtml(summary(pack))}</p>
      <div class="app-service-foot">
        <p class="uk-text-meta uk-margin-remove">${U.durationLabel(pack.durationMinutes)}${per} · ${rating}</p>
        <a class="app-book-link" href="/book?package=${pack.id}">Book</a>
      </div>
      ${reviewBits(reviews)}
    </article>`;
  }

  function fill(host, packs, averages, reviews) {
    host.innerHTML = packs.map((pack) => packageCard(
      pack,
      averages.get(pack.id),
      reviews.filter((review) => review.packageId === pack.id)
    )).join("");
  }

  function closeMenuAndShow(id) {
    const target = document.getElementById(id);
    if (!target) return;
    if (window.UIkit) UIkit.offcanvas("#nav").hide();
    window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
  }

  document.querySelectorAll("#nav a[href^='#']").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      closeMenuAndShow(link.getAttribute("href").slice(1));
    });
  });

  Promise.all([
    U.api("/packages"),
    U.api("/reviews").catch(() => ({ data: { reviews: [], averages: [] } })),
  ]).then(([packsRes, reviewRes]) => {
    const packs = packsRes.data.filter((pack) => pack.bookable);
    const reviews = reviewRes.data.reviews || [];
    const averages = new Map((reviewRes.data.averages || []).map((row) => [row.packageId, row]));
    fill(document.getElementById("individual-cards"), packs.filter((pack) => pack.audience === "individual"), averages, reviews);
    fill(document.getElementById("couple-cards"), packs.filter((pack) => pack.audience === "couple"), averages, reviews);
    const list = document.getElementById("review-list");
    list.innerHTML = reviews.length
      ? reviews.map((review) => `<article class="app-review">
          <div class="app-booking-top"><span class="app-icon-row">${U.stars(review.rating)} <span class="uk-text-bold">${U.escapeHtml(review.displayName)}</span></span><span class="uk-text-meta">${U.escapeHtml(review.packageName)}</span></div>
          <p class="uk-margin-small-top uk-margin-remove-bottom">${U.escapeHtml(review.summary)}</p>
        </article>`).join("")
      : `<p class="uk-text-meta uk-margin-remove">Ratings appear here after a visit.</p>`;
    if (window.UIkit) UIkit.update(document.body);
    const hash = location.hash.replace("#", "");
    if (hash === "services" || hash === "reviews") closeMenuAndShow(hash);
  }).catch(() => {});
})();

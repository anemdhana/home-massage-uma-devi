(function () {
  const U = window.Uma;
  const icons = {
    "Swedish massage": "lotus",
    "Deep tissue massage": "lifesaver",
    "Head, neck and shoulder": "user",
    "Foot reflexology": "foot",
    "Body polishing": "star",
    "Face massage": "happy",
    "Couple massage for men and women": "users",
  };

  function card(pack) {
    const includes = pack.includes[0]
      ? `<p class="uk-text-small uk-margin-remove-top uk-margin-small-bottom">${U.escapeHtml(pack.includes[0])}</p>`
      : "";
    const per = pack.audience === "couple" ? `<p class="uk-text-meta uk-margin-remove">₹${Math.round(pack.priceInr / 2)} per person</p>` : "";
    const book = pack.bookable
      ? `<a class="uk-button uk-button-default uk-button-small uk-margin-small-top" href="/book?package=${pack.id}">Book</a>`
      : `<p class="uk-text-meta uk-margin-small-top">Hidden</p>`;
    return `<article class="uk-card uk-card-default uk-card-body uk-padding-small">
      <div class="app-icon-row"><span uk-icon="icon: ${U.packageIcon(pack.id)}; ratio: 0.9"></span><h3 class="uk-h3 uk-margin-remove">${U.escapeHtml(pack.name)}</h3></div>
      ${includes}${per}
      <div class="uk-flex uk-flex-between uk-flex-middle uk-margin-small-top">
        <span class="uk-text-meta app-icon-row"><span uk-icon="icon: clock; ratio: 0.75"></span> ${U.durationLabel(pack.durationMinutes)}</span>
        <span class="uk-text-bold">${U.money(pack.priceInr)}</span>
      </div>
      ${book}
    </article>`;
  }

  U.api("/practice").then(async (practiceRes) => {
    const practice = practiceRes.data;
    const packs = (await U.api("/packages")).data;
    document.getElementById("practice-name").textContent = practice.name;
    document.getElementById("practice-line").textContent = practice.line;
    document.getElementById("practice-meta").textContent = practice.city + " · " + practice.experienceLine;
    document.getElementById("highlights").innerHTML = practice.highlights.map((item) =>
      `<div><span class="app-mark" uk-icon="icon: ${item.icon}; ratio: 1.1"></span><div class="uk-text-small uk-margin-small-top">${U.escapeHtml(item.label)}</div></div>`
    ).join("");
    const individual = packs.filter((pack) => pack.audience === "individual" && pack.bookable);
    const couple = packs.filter((pack) => pack.audience === "couple" && pack.bookable);
    document.getElementById("individual-cards").innerHTML = individual.map(card).join("");
    document.getElementById("couple-cards").innerHTML = couple.map(card).join("");
    document.getElementById("enquire-note").textContent = practice.enquireNote;
    document.getElementById("enquire-link").href = "https://wa.me/" + practice.whatsappE164;
    document.getElementById("techniques").innerHTML = practice.techniques.map((name) =>
      `<li class="app-icon-row"><span uk-icon="icon: ${icons[name] || "check"}; ratio: 0.85"></span> ${U.escapeHtml(name)}</li>`
    ).join("");
    document.getElementById("benefits").innerHTML = practice.benefits.map((name) =>
      `<li class="app-icon-row"><span uk-icon="icon: check; ratio: 0.85"></span> ${U.escapeHtml(name)}</li>`
    ).join("");
    document.getElementById("phone-link").href = "tel:" + practice.phoneTel;
    document.getElementById("whatsapp-link").href = "https://wa.me/" + practice.whatsappE164;
    document.getElementById("instagram-link").href = "https://instagram.com/" + practice.instagram;
    if (window.UIkit) UIkit.update(document.body);
  }).catch(() => {
    U.showMessage(document.getElementById("page-alert"), "danger", "The services could not be loaded. Refresh the page.");
  });
})();

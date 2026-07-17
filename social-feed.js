async function loadSocialFeed() {
  const gridEl = document.getElementById("social-feed-grid");
  if (!gridEl) return;

  if (typeof SOCIAL_FEED_FUNCTION === "undefined" || !SOCIAL_FEED_FUNCTION) {
    const section = gridEl.closest(".home-section");
    if (section) section.style.display = "none";
    return;
  }

  const { data, error } = await supabaseClient.functions.invoke(SOCIAL_FEED_FUNCTION);

  if (error || !data || data.error) {
    console.error(error || data.error);
    gridEl.innerHTML = `<p class="menu-empty" style="padding:20px 0;">Couldn't load the gallery right now.</p>`;
    return;
  }

  if (!data.items || !data.items.length) {
    gridEl.innerHTML = `<p class="menu-empty" style="padding:20px 0;">No photos yet.</p>`;
    return;
  }

  gridEl.innerHTML = data.items.map(item => `
    <a class="gallery-card" href="${item.permalink}" target="_blank" rel="noopener noreferrer">
      <img src="${item.imageUrl}" alt="${escapeHtmlSocial(item.caption || "Photo")}" loading="lazy">
      ${item.caption ? `<div class="gallery-caption">${escapeHtmlSocial(item.caption)}</div>` : ""}
    </a>
  `).join("");
}

function escapeHtmlSocial(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

loadSocialFeed();

async function loadDeals() {
  const listEl = document.getElementById("deals-list");

  const { data, error } = await supabaseClient
    .from("deals")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    listEl.innerHTML = `<p class="menu-empty">Couldn't load deals right now.</p>`;
    return;
  }

  if (!data.length) {
    listEl.innerHTML = `<p class="menu-empty">No deals running right now — check back soon.</p>`;
    return;
  }

  listEl.innerHTML = `
    <div class="menu-category">
      ${data.map(deal => `
        <div class="menu-item">
          <div>
            <div class="mi-name">${escapeHtmlDeals(deal.title)}</div>
            ${deal.description ? `<div class="mi-desc">${escapeHtmlDeals(deal.description)}</div>` : ""}
          </div>
          <div class="mi-price">$${Number(deal.price).toFixed(2)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function escapeHtmlDeals(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

loadDeals();

supabaseClient
  .channel("deals-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, loadDeals)
  .subscribe();

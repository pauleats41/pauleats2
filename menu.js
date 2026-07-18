async function loadMenu() {
  const listEl = document.getElementById("menu-list");

  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("*")
    .eq("is_available", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    listEl.innerHTML = `<p class="menu-empty">Couldn't load the menu right now — try again in a bit.</p>`;
    return;
  }

  if (!data.length) {
    listEl.innerHTML = `<p class="menu-empty">No menu items yet — check back soon.</p>`;
    return;
  }

  const byCategory = {};
  data.forEach(item => {
    const cat = item.category || "Menu";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });

  listEl.innerHTML = Object.entries(byCategory).map(([category, items]) => `
    <div class="menu-category">
      <h2>${escapeHtmlMenu(category)}</h2>
      ${items.map(item => `
        <div class="menu-item">
          <div>
            <div class="mi-name">${escapeHtmlMenu(item.name)}</div>
            ${item.description ? `<div class="mi-desc">${escapeHtmlMenu(item.description)}</div>` : ""}
          </div>
          ${item.price != null ? `<div class="mi-price">$${Number(item.price).toFixed(2)}</div>` : ""}
        </div>
      `).join("")}
    </div>
  `).join("");
}

function escapeHtmlMenu(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

loadMenu();

// Refresh automatically if the admin changes the menu while someone's viewing it
supabaseClient
  .channel("menu-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, loadMenu)
  .subscribe();

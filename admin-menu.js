let adminMenuItems = [];

async function loadAdminMenu() {
  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    document.getElementById("menu-admin-list").innerHTML = `<p class="menu-empty">Couldn't load the menu.</p>`;
    return;
  }

  adminMenuItems = data;
  renderAdminMenu();
}

function renderAdminMenu() {
  const listEl = document.getElementById("menu-admin-list");
  if (!adminMenuItems.length) {
    listEl.innerHTML = `<p class="menu-empty">No items yet — add your first one above.</p>`;
    return;
  }

  listEl.innerHTML = adminMenuItems.map(item => `
    <div class="menu-admin-row">
      <div class="mi-info">
        <div class="mi-name">${escapeHtmlAdmin(item.name)} ${item.price != null ? `· $${Number(item.price).toFixed(2)}` : ""}</div>
        <div class="mi-meta">${escapeHtmlAdmin(item.category)}${item.is_available ? "" : " · hidden from customers"}</div>
      </div>
      <button class="icon-btn" data-action="toggle" data-id="${item.id}">${item.is_available ? "Hide" : "Show"}</button>
      <button class="icon-btn danger" data-action="delete" data-id="${item.id}">Delete</button>
    </div>
  `).join("");

  listEl.querySelectorAll('[data-action="toggle"]').forEach(btn => {
    btn.addEventListener("click", () => toggleAvailability(Number(btn.dataset.id)));
  });
  listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener("click", () => deleteMenuItem(Number(btn.dataset.id)));
  });
}

function escapeHtmlAdmin(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

document.getElementById("menu-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("mi-name").value.trim();
  const category = document.getElementById("mi-category").value.trim() || "Menu";
  const priceRaw = document.getElementById("mi-price").value.trim();
  const description = document.getElementById("mi-desc").value.trim();
  if (!name) return;

  const price = priceRaw ? Number(priceRaw) : null;

  const { error } = await supabaseClient.from("menu_items").insert({
    name, category, price, description: description || null, is_available: true
  });

  if (error) { console.error(error); alert("Couldn't add that item — check the console for details."); return; }

  e.target.reset();
  loadAdminMenu();
});

async function toggleAvailability(id) {
  const item = adminMenuItems.find(m => m.id === id);
  if (!item) return;
  const { error } = await supabaseClient.from("menu_items").update({ is_available: !item.is_available }).eq("id", id);
  if (error) console.error(error);
  loadAdminMenu();
}

async function deleteMenuItem(id) {
  if (!confirm("Delete this menu item? This can't be undone.")) return;
  const { error } = await supabaseClient.from("menu_items").delete().eq("id", id);
  if (error) console.error(error);
  loadAdminMenu();
}

if (window.fireorderAdminAuthed) {
  loadAdminMenu();
} else {
  window.addEventListener("fireorder-admin-authed", loadAdminMenu);
}

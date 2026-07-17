let adminDeals = [];

async function loadAdminDeals() {
  const { data, error } = await supabaseClient.from("deals").select("*").order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById("deal-admin-list").innerHTML = `<p class="menu-empty">Couldn't load deals.</p>`;
    return;
  }

  adminDeals = data;
  renderAdminDeals();
}

function renderAdminDeals() {
  const listEl = document.getElementById("deal-admin-list");
  if (!adminDeals.length) {
    listEl.innerHTML = `<p class="menu-empty">No deals yet — add your first one above.</p>`;
    return;
  }

  listEl.innerHTML = adminDeals.map(deal => `
    <div class="menu-admin-row">
      <div class="mi-info">
        <div class="mi-name">${escapeHtmlDeal(deal.title)} · $${Number(deal.price).toFixed(2)}</div>
        <div class="mi-meta">${escapeHtmlDeal(deal.description || "")}${deal.is_active ? "" : " · hidden from customers"}</div>
      </div>
      <button class="icon-btn" data-action="toggle" data-id="${deal.id}">${deal.is_active ? "Hide" : "Show"}</button>
      <button class="icon-btn danger" data-action="delete" data-id="${deal.id}">Delete</button>
    </div>
  `).join("");

  listEl.querySelectorAll('[data-action="toggle"]').forEach(btn => {
    btn.addEventListener("click", () => toggleDealActive(Number(btn.dataset.id)));
  });
  listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener("click", () => deleteDeal(Number(btn.dataset.id)));
  });
}

function escapeHtmlDeal(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

document.getElementById("deal-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("deal-title").value.trim();
  const priceRaw = document.getElementById("deal-price").value.trim();
  const description = document.getElementById("deal-desc").value.trim();
  if (!title || !priceRaw) return;

  const { error } = await supabaseClient.from("deals").insert({
    title, price: Number(priceRaw), description: description || null, is_active: true
  });

  if (error) { console.error(error); alert("Couldn't add that deal — check the console."); return; }

  e.target.reset();
  loadAdminDeals();
});

async function toggleDealActive(id) {
  const deal = adminDeals.find(d => d.id === id);
  if (!deal) return;
  const { error } = await supabaseClient.from("deals").update({ is_active: !deal.is_active }).eq("id", id);
  if (error) console.error(error);
  loadAdminDeals();
}

async function deleteDeal(id) {
  if (!confirm("Delete this deal? This can't be undone.")) return;
  const { error } = await supabaseClient.from("deals").delete().eq("id", id);
  if (error) console.error(error);
  loadAdminDeals();
}

if (window.fireorderAdminAuthed) {
  loadAdminDeals();
} else {
  window.addEventListener("fireorder-admin-authed", loadAdminDeals);
}

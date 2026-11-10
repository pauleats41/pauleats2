const PAY_LABELS = { cashapp: "Cash App", applepay: "Apple Pay", paypal: "PayPal", zelle: "Zelle" };
let adminPayments = [];

function escPay(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

async function loadAdminPayments() {
  const { data, error } = await supabaseClient.from("payment_handles").select("*").order("id", { ascending: true });
  const listEl = document.getElementById("payment-admin-list");
  if (error) {
    console.error(error);
    listEl.innerHTML = `<p class="menu-empty">Couldn't load payment handles — did you run payment_handles.sql?</p>`;
    return;
  }
  adminPayments = data;
  renderAdminPayments();
}

function renderAdminPayments() {
  const listEl = document.getElementById("payment-admin-list");
  if (!adminPayments.length) {
    listEl.innerHTML = `<p class="menu-empty">No handles yet — add your first one above.</p>`;
    return;
  }

  listEl.innerHTML = Object.keys(PAY_LABELS).map(method => {
    const rows = adminPayments.filter(p => p.method === method);
    if (!rows.length) return "";
    return `
      <div class="pay-group">
        <h4>${PAY_LABELS[method]}</h4>
        ${rows.map(p => `
          <div class="menu-admin-row" data-id="${p.id}">
            <input type="text" class="pay-edit" value="${escPay(p.handle).replace(/"/g, "&quot;")}">
            <button class="icon-btn" data-action="save">Save</button>
            <button class="icon-btn" data-action="toggle">${p.is_active ? "Hide" : "Show"}</button>
            <button class="icon-btn danger" data-action="delete">Delete</button>
            ${p.is_active ? "" : `<span class="mi-meta">hidden</span>`}
          </div>`).join("")}
      </div>`;
  }).join("");

  listEl.querySelectorAll(".menu-admin-row").forEach(row => {
    const id = Number(row.dataset.id);
    row.querySelector('[data-action="save"]').addEventListener("click", async (e) => {
      const value = row.querySelector(".pay-edit").value.trim();
      if (!value) return;
      const { error } = await supabaseClient.from("payment_handles").update({ handle: value }).eq("id", id);
      e.target.textContent = error ? "Failed" : "Saved ✓";
      if (error) console.error(error);
      setTimeout(loadAdminPayments, 900);
    });
    row.querySelector('[data-action="toggle"]').addEventListener("click", async () => {
      const p = adminPayments.find(x => x.id === id);
      const { error } = await supabaseClient.from("payment_handles").update({ is_active: !p.is_active }).eq("id", id);
      if (error) console.error(error);
      loadAdminPayments();
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm("Delete this payment handle?")) return;
      const { error } = await supabaseClient.from("payment_handles").delete().eq("id", id);
      if (error) console.error(error);
      loadAdminPayments();
    });
  });
}

document.getElementById("payment-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const method = document.getElementById("pay-method").value;
  const handle = document.getElementById("pay-handle").value.trim();
  if (!handle) return;
  const { error } = await supabaseClient.from("payment_handles").insert({ method, handle, is_active: true });
  if (error) { console.error(error); alert("Couldn't add that handle — check the console."); return; }
  document.getElementById("pay-handle").value = "";
  loadAdminPayments();
});

if (window.fireorderAdminAuthed) {
  loadAdminPayments();
} else {
  window.addEventListener("fireorder-admin-authed", loadAdminPayments);
}

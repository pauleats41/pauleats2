const PAYMENT_LABELS = {
  cashapp: "Cash App",
  applepay: "Apple Pay",
  paypal: "PayPal",
  zelle: "Zelle"
};

let currentFilter = "all";
let currentSearch = "";
let allOrders = [];

// ---- Auth guard ----
function timeoutAfter(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out contacting Supabase")), ms));
}

(async function checkAuth() {
  try {
    const { data: { session }, error } = await Promise.race([
      supabaseClient.auth.getSession(),
      timeoutAfter(6000)
    ]);
    if (error) throw error;

    if (!session) {
      window.location.href = "login.html";
      return;
    }

    document.body.classList.remove("auth-pending");
    window.fireorderAdminAuthed = true;
    window.dispatchEvent(new Event("fireorder-admin-authed"));
    loadOrders();
  } catch (err) {
    console.error("Auth check failed:", err);
    document.getElementById("auth-loading").innerHTML =
      `Couldn't verify your login: ${err.message || "unknown error"}<br><br><a href="login.html" style="color:var(--flame)">Go to login</a>`;
  }
})();

supabaseClient.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") window.location.href = "login.html";
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
});

// ---- Data ----
async function loadOrders() {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById("order-rows").innerHTML =
      `<tr class="empty-row"><td colspan="5">Couldn't load orders — check your Supabase config and RLS policies.</td></tr>`;
    return;
  }

  allOrders = data;
  render();
}

// Live refresh whenever an order is inserted/updated/deleted anywhere
supabaseClient
  .channel("orders-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
  .subscribe();

function friendlyId(o) { return `FO-${1041 + o.id}`; }

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function render() {
  renderStats(allOrders);
  renderRows(allOrders);
}

function renderStats(orders) {
  const counts = { new: 0, confirmed: 0, delivered: 0 };
  orders.forEach(o => { if (counts[o.status] !== undefined) counts[o.status]++; });
  const stats = [
    { num: orders.length, lbl: "Total orders" },
    { num: counts.new, lbl: "New" },
    { num: counts.confirmed, lbl: "Confirmed" },
    { num: counts.delivered, lbl: "Delivered" }
  ];
  document.getElementById("stat-row").innerHTML = stats.map(s =>
    `<div class="stat-card"><div class="num">${s.num}</div><div class="lbl">${s.lbl}</div></div>`
  ).join("");
}

function renderRows(orders) {
  const rowsEl = document.getElementById("order-rows");

  const filtered = orders.filter(o => {
    const matchesFilter = currentFilter === "all" || o.status === currentFilter;
    const haystack = `${friendlyId(o)} ${o.name} ${o.phone} ${o.address}`.toLowerCase();
    const matchesSearch = haystack.includes(currentSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (!filtered.length) {
    rowsEl.innerHTML = `<tr class="empty-row"><td colspan="5">No orders match — try a different search or filter.</td></tr>`;
    return;
  }

  rowsEl.innerHTML = filtered.map(o => `
    <tr data-id="${o.id}">
      <td><span style="font-family:var(--font-mono); font-size:12.5px; color:var(--text-muted)">${friendlyId(o)}</span></td>
      <td><strong>${escapeHtml(o.name)}</strong><br><span style="color:var(--text-muted); font-size:12px">${escapeHtml(o.phone)}</span></td>
      <td>${PAYMENT_LABELS[o.payment_method] || o.payment_method}</td>
      <td><span class="badge ${o.status}">${o.status}</span></td>
      <td style="color:var(--text-muted); font-size:12.5px">${fmtTime(o.created_at)}</td>
    </tr>
  `).join("");

  [...rowsEl.querySelectorAll("tr")].forEach(row => {
    row.addEventListener("click", () => openModal(Number(row.dataset.id)));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ---- Search & filter ----
document.getElementById("search").addEventListener("input", e => {
  currentSearch = e.target.value;
  render();
});
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    render();
  });
});

// ---- Modal ----
const backdrop = document.getElementById("modal-backdrop");
const modal = document.getElementById("modal");

function openModal(id) {
  const order = allOrders.find(o => o.id === id);
  if (!order) return;

  modal.innerHTML = `
    <button class="modal-close" id="modal-close">✕</button>
    <h3>${escapeHtml(order.name)}</h3>
    <div class="mono-id">${friendlyId(order)} · ${fmtTime(order.created_at)}</div>
    ${order.screenshot_url ? `<img class="modal-img" src="${order.screenshot_url}" alt="Order screenshot">` : ""}
    <div class="detail-row"><span class="k">Phone</span><span class="v">${escapeHtml(order.phone)}</span></div>
    <div class="detail-row"><span class="k">Address</span><span class="v">${escapeHtml(order.address)}</span></div>
    <div class="detail-row"><span class="k">Payment</span><span class="v">${PAYMENT_LABELS[order.payment_method] || order.payment_method}${order.payment_handle ? ` → ${escapeHtml(order.payment_handle)}` : ""}</span></div>
    <div class="detail-row"><span class="k">Status</span><span class="v"><span class="badge ${order.status}">${order.status}</span></span></div>
    ${order.notes ? `<div class="detail-row"><span class="k">Notes</span><span class="v">${escapeHtml(order.notes)}</span></div>` : ""}
    ${order.payment_screenshot_url ? `<div style="margin-top:10px;"><div class="k" style="font-size:12.5px; color:var(--text-muted); margin-bottom:6px;">Payment screenshot</div><img class="modal-img" src="${order.payment_screenshot_url}" alt="Payment screenshot"></div>` : ""}

    <label class="field" for="modal-tracking-url">Tracking link (shown to customer automatically)</label>
    <input type="text" id="modal-tracking-url" placeholder="https://..." value="${escapeHtml(order.tracking_url || "")}">
    <button type="button" class="icon-btn" id="modal-tracking-save" style="margin-top:8px; width:100%;">Save tracking link</button>

    <div class="action-row">
      ${order.status !== "new" ? `<button data-status="new">Mark New</button>` : ""}
      ${order.status !== "confirmed" ? `<button data-status="confirmed" class="primary">Mark Confirmed</button>` : ""}
      ${order.status !== "delivered" ? `<button data-status="delivered" class="primary">Mark Delivered</button>` : ""}
      <button data-action="delete" class="danger">Delete order</button>
    </div>
  `;

  modal.querySelector("#modal-tracking-save").addEventListener("click", () => saveTrackingUrl(order.id));

  modal.querySelector("#modal-close").addEventListener("click", closeModal);
  modal.querySelectorAll("[data-status]").forEach(btn => {
    btn.addEventListener("click", () => updateStatus(order.id, btn.dataset.status));
  });
  modal.querySelector('[data-action="delete"]').addEventListener("click", () => deleteOrder(order.id));

  backdrop.style.display = "flex";
}

async function saveTrackingUrl(id) {
  const input = document.getElementById("modal-tracking-url");
  const btn = document.getElementById("modal-tracking-save");
  const url = input.value.trim();

  btn.disabled = true;
  btn.textContent = "Saving…";

  const { error } = await supabaseClient.from("orders").update({ tracking_url: url || null }).eq("id", id);

  if (error) {
    console.error(error);
    btn.textContent = "Couldn't save — try again";
    btn.disabled = false;
  } else {
    btn.textContent = "Saved ✓";
    setTimeout(() => { btn.textContent = "Save tracking link"; btn.disabled = false; }, 1500);
  }
}

function closeModal() { backdrop.style.display = "none"; }
backdrop.addEventListener("click", e => { if (e.target === backdrop) closeModal(); });

async function updateStatus(id, status) {
  const { error } = await supabaseClient.from("orders").update({ status }).eq("id", id);
  if (error) console.error(error);
  closeModal();
  // loadOrders() also fires automatically via the realtime subscription
}

async function deleteOrder(id) {
  const { error } = await supabaseClient.from("orders").delete().eq("id", id);
  if (error) console.error(error);
  closeModal();
}

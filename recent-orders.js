async function loadRecentOrders() {
  const gridEl = document.getElementById("recent-orders-grid");
  if (!gridEl) return;

  const { data, error } = await supabaseClient.rpc("public_recent_orders", { limit_count: 8 });

  if (error) {
    console.error(error);
    gridEl.innerHTML = "";
    return;
  }

  if (!data || !data.length) {
    gridEl.innerHTML = `<p class="menu-empty" style="padding:20px 0;">No orders yet today — be the first! 🔥</p>`;
    return;
  }

  gridEl.innerHTML = data.map(o => `
    <div class="recent-order-card">
      <img src="${o.screenshot_url}" alt="Recent order screenshot" loading="lazy">
      <div class="recent-order-meta">
        <span class="badge ${o.status}">${o.status}</span>
        <span class="recent-order-time">${timeAgo(o.created_at)}</span>
      </div>
    </div>
  `).join("");
}

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

loadRecentOrders();

// Refresh the moment a new order comes in — reuses the same public function
supabaseClient
  .channel("recent-orders-public")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, loadRecentOrders)
  .subscribe();

let storeIsOpen = true;

async function loadStoreStatus() {
  const bannerEl = document.getElementById("store-status-banner");
  const sendBtn = document.getElementById("send-btn");

  const { data, error } = await supabaseClient
    .from("store_status")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) { console.error(error); return; }

  storeIsOpen = data.is_open;

  if (storeIsOpen) {
    bannerEl.style.display = "none";
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = "SEND ORDER"; }
  } else {
    bannerEl.innerHTML = `
      <div class="step" style="border-color: var(--flame-dim); background: rgba(255,70,32,0.08); text-align:center;">
        <h2 style="font-family:var(--font-display); font-weight:400; margin:0 0 6px;">We're closed right now</h2>
        <p style="color:var(--text-muted); margin:0;">${escapeHtmlStore(data.reason) || "Back soon — check back shortly."}</p>
      </div>
    `;
    bannerEl.style.display = "block";
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = "CLOSED — CHECK BACK SOON"; }
  }
}

function escapeHtmlStore(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

loadStoreStatus();

supabaseClient
  .channel("store-status-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "store_status" }, loadStoreStatus)
  .subscribe();

async function loadStoreStatusForm() {
  const { data, error } = await supabaseClient.from("store_status").select("*").eq("id", 1).single();
  if (error) { console.error(error); return; }

  document.getElementById("store-open-toggle").checked = data.is_open;
  document.getElementById("store-reason").value = data.reason || "";
}

document.getElementById("store-status-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const isOpen = document.getElementById("store-open-toggle").checked;
  const reason = document.getElementById("store-reason").value.trim();

  const { error } = await supabaseClient
    .from("store_status")
    .update({ is_open: isOpen, reason: reason || null, updated_at: new Date().toISOString() })
    .eq("id", 1);

  btn.disabled = false;
  btn.textContent = error ? "Couldn't save — try again" : "Saved ✓";
  if (!error) setTimeout(() => { btn.textContent = "Save store status"; }, 1800);
  if (error) console.error(error);
});

if (window.fireorderAdminAuthed) {
  loadStoreStatusForm();
} else {
  window.addEventListener("fireorder-admin-authed", loadStoreStatusForm);
}

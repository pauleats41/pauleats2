async function loadRestaurantForm() {
  const { data, error } = await supabaseClient
    .from("featured_restaurants")
    .select("*")
    .order("slot", { ascending: true });

  if (error) { console.error(error); return; }

  data.forEach(r => {
    const input = document.getElementById(`restaurant-${r.slot}`);
    if (input) input.value = r.name || "";
  });
}

document.getElementById("restaurant-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const updates = [1, 2, 3].map(slot => {
    const value = document.getElementById(`restaurant-${slot}`).value.trim();
    return supabaseClient
      .from("featured_restaurants")
      .update({ name: value || null, updated_at: new Date().toISOString() })
      .eq("slot", slot);
  });

  const results = await Promise.all(updates);
  const failed = results.find(r => r.error);

  btn.disabled = false;
  btn.textContent = failed ? "Couldn't save — try again" : "Saved ✓";
  if (!failed) setTimeout(() => { btn.textContent = "Save today's restaurants"; }, 1800);
  if (failed) console.error(failed.error);
});

if (window.fireorderAdminAuthed) {
  loadRestaurantForm();
} else {
  window.addEventListener("fireorder-admin-authed", loadRestaurantForm);
}

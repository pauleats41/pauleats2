// Today's deals picker on the order form. The chosen deal is prepended to the
// order notes ("[DEAL] title — $price") so it shows up in the admin Orders tab.
let selectedDeal = null;

function escDeal(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function getSelectedDealTag() {
  return selectedDeal ? `[DEAL] ${selectedDeal.title} — $${Number(selectedDeal.price).toFixed(2)}` : "";
}

(async function loadOrderDeals() {
  const el = document.getElementById("deal-picker");
  const { data, error } = await supabaseClient
    .from("deals").select("*").eq("is_active", true)
    .order("created_at", { ascending: false });

  const cards = [{ id: null, title: "No deal", description: "Match my order to the best price", price: null }]
    .concat(error || !data ? [] : data);

  el.innerHTML = cards.map((d, i) => `
    <div class="deal-option${i === 0 ? " selected" : ""}" data-idx="${i}">
      <div>
        <div class="mi-name">${escDeal(d.title)}</div>
        ${d.description ? `<div class="mi-desc">${escDeal(d.description)}</div>` : ""}
      </div>
      ${d.price != null ? `<div class="mi-price">$${Number(d.price).toFixed(2)}</div>` : ""}
    </div>`).join("");

  el.addEventListener("click", e => {
    const opt = e.target.closest(".deal-option");
    if (!opt) return;
    el.querySelectorAll(".deal-option").forEach(c => c.classList.remove("selected"));
    opt.classList.add("selected");
    const d = cards[Number(opt.dataset.idx)];
    selectedDeal = d.id == null ? null : d;
  });
})();

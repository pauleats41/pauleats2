const trackForm = document.getElementById("track-form");
const trackSubmit = document.getElementById("track-submit");
const trackError = document.getElementById("track-error");
const trackResult = document.getElementById("track-result");

const STEPS = ["new", "confirmed", "delivered"];
const STEP_LABELS = { new: "Order received", confirmed: "Confirmed", delivered: "Delivered" };

function parseOrderNumber(raw) {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const num = parseInt(digits, 10);
  const id = num - 1041;
  return id > 0 ? id : null;
}

// Pre-fill from a link like track.html?order=FO-1042&phone=5551234567
(function prefillFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const order = params.get("order");
  const phone = params.get("phone");
  if (order) document.getElementById("track-order-number").value = order;
  if (phone) document.getElementById("track-phone").value = phone;
  if (order && phone) trackForm.requestSubmit();
})();

trackForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  trackError.style.display = "none";
  trackResult.style.display = "none";

  const rawNumber = document.getElementById("track-order-number").value.trim();
  const phone = document.getElementById("track-phone").value.trim();
  const orderId = parseOrderNumber(rawNumber);

  if (!orderId || !phone) {
    trackError.textContent = "Enter both your order number and phone number.";
    trackError.style.display = "block";
    return;
  }

  trackSubmit.disabled = true;
  trackSubmit.textContent = "LOOKING UP…";

  const { data, error } = await supabaseClient.rpc("public_track_order", {
    order_number: orderId,
    phone_number: phone
  });

  trackSubmit.disabled = false;
  trackSubmit.textContent = "TRACK ORDER";

  const order = data && data[0];

  if (error || !order) {
    if (error) console.error(error);
    trackError.textContent = "We couldn't find that order — double check your order number and phone number.";
    trackError.style.display = "block";
    return;
  }

  renderResult(order);
});

function renderResult(order) {
  const currentIndex = STEPS.indexOf(order.status);

  const timelineHTML = STEPS.map((step, i) => `
    <div class="track-step ${i <= currentIndex ? "done" : ""}">
      <div class="track-dot"></div>
      <div class="track-label">${STEP_LABELS[step]}</div>
    </div>
  `).join("");

  trackResult.innerHTML = `
    <div class="track-timeline">${timelineHTML}</div>
    ${order.tracking_url
      ? `<a class="send-btn" style="display:block; text-align:center; text-decoration:none; margin-top:20px;" href="${order.tracking_url}" target="_blank" rel="noopener noreferrer">TRACK DELIVERY →</a>`
      : `<p style="color:var(--text-muted); font-size:13px; text-align:center; margin-top:16px;">A tracking link will show up here once your order is out for delivery.</p>`
    }
  `;
  trackResult.style.display = "block";
}

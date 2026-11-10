// Payment handles are managed in Admin → Payments (stored in the payment_handles table).
// orders.json is only a fallback if the table is empty or can't be reached.
// Each method can have several handles — one is picked at random per order and saved with it.
let PAYMENT_HANDLES = {};

function applyPaymentAvailability() {
  if (!Object.keys(PAYMENT_HANDLES).length) return; // nothing loaded — don't hide every option
  document.querySelectorAll("#pay-grid .pay-option").forEach(opt => {
    const has = [].concat(PAYMENT_HANDLES[opt.dataset.method] || []).length > 0;
    opt.style.display = has ? "" : "none";
    if (!has && selectedMethod === opt.dataset.method) {
      selectedMethod = null;
      opt.classList.remove("selected");
    }
  });
}

async function loadPaymentHandles() {
  try {
    const r = await fetch("orders.json");
    const data = await r.json();
    if (data.paymentHandles) PAYMENT_HANDLES = data.paymentHandles;
  } catch (e) { /* fall through to database */ }

  try {
    const { data, error } = await supabaseClient
      .from("payment_handles").select("method, handle")
      .eq("is_active", true).order("id", { ascending: true });
    if (!error && data && data.length) {
      const map = {};
      data.forEach(row => { (map[row.method] = map[row.method] || []).push(row.handle); });
      PAYMENT_HANDLES = map;
    }
  } catch (e) { /* keep fallback */ }

  applyPaymentAvailability();
}

function pickHandle(method) {
  const value = PAYMENT_HANDLES[method];
  if (Array.isArray(value)) return value[Math.floor(Math.random() * value.length)] || "—";
  return value || "—";
}

// ---- Elements ----
const form = document.getElementById("order-form");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("screenshot-input");
const preview = document.getElementById("preview");
const payGrid = document.getElementById("pay-grid");
const sendBtn = document.getElementById("send-btn");
const confirmCard = document.getElementById("confirm-card");
const confirmHandle = document.getElementById("confirm-handle");
const confirmId = document.getElementById("confirm-id");
const confirmTrackLink = document.getElementById("confirm-track-link");

const paymentDropzone = document.getElementById("payment-dropzone");
const paymentInput = document.getElementById("payment-screenshot-input");
const paymentPreview = document.getElementById("payment-preview");
const paymentBtn = document.getElementById("payment-screenshot-btn");
const paymentStatus = document.getElementById("payment-screenshot-status");

let screenshotFile = null;
let selectedMethod = null;
let placedOrderId = null;
let placedOrderPhone = null;
let paymentScreenshotFile = null;

// ---- Order screenshot upload ----
dropzone.addEventListener("click", () => fileInput.click());
["dragover", "dragenter"].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add("drag"); })
);
["dragleave", "drop"].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove("drag"); })
);
dropzone.addEventListener("drop", e => {
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith("image/")) return;
  screenshotFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    preview.src = e.target.result;
    preview.style.display = "block";
    clearError("err-screenshot");
  };
  reader.readAsDataURL(file);
}

// ---- Payment method selection ----
payGrid.addEventListener("click", e => {
  const opt = e.target.closest(".pay-option");
  if (!opt) return;
  [...payGrid.children].forEach(c => c.classList.remove("selected"));
  opt.classList.add("selected");
  selectedMethod = opt.dataset.method;
  clearError("err-payment");
});

// ---- Helpers ----
function showError(id) { document.getElementById(id).style.display = "block"; }
function clearError(id) { document.getElementById(id).style.display = "none"; }

async function uploadToScreenshots(file, prefix) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${prefix}-${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage.from("screenshots").upload(path, file);
  if (uploadError) throw uploadError;

  const { data } = supabaseClient.storage.from("screenshots").getPublicUrl(path);
  return data.publicUrl;
}

// ---- Submit order ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (typeof storeIsOpen !== "undefined" && !storeIsOpen) {
    alert("We're currently closed — check the message above for when we'll be back.");
    return;
  }

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const notes = document.getElementById("notes").value.trim();

  let valid = true;
  if (!screenshotFile) { showError("err-screenshot"); valid = false; } else clearError("err-screenshot");
  if (!name) { showError("err-name"); valid = false; } else clearError("err-name");
  if (!phone) { showError("err-phone"); valid = false; } else clearError("err-phone");
  if (!address) { showError("err-address"); valid = false; } else clearError("err-address");
  if (!selectedMethod) { showError("err-payment"); valid = false; } else clearError("err-payment");

  if (!valid) return;

  sendBtn.disabled = true;
  sendBtn.textContent = "SENDING…";

  try {
    const screenshotUrl = await uploadToScreenshots(screenshotFile, "order");
    const handle = pickHandle(selectedMethod);

    const { data: newId, error } = await supabaseClient.rpc("create_order", {
      p_name: name,
      p_phone: phone,
      p_address: address,
      p_notes: notes || null,
      p_payment_method: selectedMethod,
      p_payment_handle: handle,
      p_screenshot_url: screenshotUrl
    });

    if (error) throw error;

    placedOrderId = newId;
    placedOrderPhone = phone;

    const friendlyOrderId = `FO-${1041 + newId}`;

    form.style.display = "none";
    confirmHandle.textContent = handle;
    confirmId.textContent = friendlyOrderId;
    confirmTrackLink.href = `track.html?order=${encodeURIComponent(friendlyOrderId)}&phone=${encodeURIComponent(phone)}`;
    confirmCard.style.display = "block";
    confirmCard.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    console.error(err);
    sendBtn.disabled = false;
    sendBtn.textContent = "SEND ORDER";
    alert("Something went wrong sending your order — check your connection and try again.");
  }
});

// ---- Payment proof screenshot (after order is placed) ----
paymentDropzone.addEventListener("click", () => paymentInput.click());
paymentInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  paymentScreenshotFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    paymentPreview.src = ev.target.result;
    paymentPreview.style.display = "block";
    paymentBtn.style.display = "block";
  };
  reader.readAsDataURL(file);
});

paymentBtn.addEventListener("click", async () => {
  if (!paymentScreenshotFile || placedOrderId == null) return;

  paymentBtn.disabled = true;
  paymentBtn.textContent = "Attaching…";

  try {
    const url = await uploadToScreenshots(paymentScreenshotFile, "payment");

    const { data: attached, error } = await supabaseClient.rpc("public_attach_payment_screenshot", {
      order_number: placedOrderId,
      phone_number: placedOrderPhone,
      screenshot_url: url
    });

    if (error || !attached) throw error || new Error("Order not found");

    paymentBtn.style.display = "none";
    paymentStatus.textContent = "Payment screenshot attached — we'll confirm shortly ✓";
  } catch (err) {
    console.error(err);
    paymentBtn.disabled = false;
    paymentBtn.textContent = "Attach payment screenshot";
    paymentStatus.textContent = "Couldn't attach that — try again.";
  }
});

loadPaymentHandles();

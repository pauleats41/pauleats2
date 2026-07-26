// Payment handles are just display info, not sensitive — fine to keep in a JSON file.
// Each method can be a single string OR an array of strings (e.g. multiple Cash Apps) —
// if it's an array, one is picked at random per order and saved with the order itself.
let PAYMENT_HANDLES = {
  cashapp: ["$3raqu1a", "$KasimeBernardJr"],
  applepay: "(404) 543-5509",
  paypal: "paypal.me/a5sxe",
  zelle: "(678) 923-4967"
};

const paymentHandlesReady = fetch("orders.json")
  .then(r => r.json())
  .then(data => { if (data.paymentHandles) PAYMENT_HANDLES = data.paymentHandles; })
  .catch((err) => { console.error("Couldn't load orders.json — using fallback payment handles:", err); });

function pickHandle(method) {
  const value = PAYMENT_HANDLES[method];
  if (Array.isArray(value)) return value[Math.floor(Math.random() * value.length)];
  return value || "—";
}

const PENDING_ORDER_KEY = "pauleats_pending_order";

// ---- Elements ----
const form = document.getElementById("order-form");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("screenshot-input");
const preview = document.getElementById("preview");
const payGrid = document.getElementById("pay-grid");
const sendBtn = document.getElementById("send-btn");
const confirmCard = document.getElementById("confirm-card");
const confirmHandle = document.getElementById("confirm-handle");
const confirmAmountRow = document.getElementById("confirm-amount-row");
const confirmAmount = document.getElementById("confirm-amount");
const confirmId = document.getElementById("confirm-id");
const confirmTrackLink = document.getElementById("confirm-track-link");
const startNewOrderLink = document.getElementById("start-new-order-link");

const dealSelect = document.getElementById("deal-select");

const paymentDropzone = document.getElementById("payment-dropzone");
const paymentInput = document.getElementById("payment-screenshot-input");
const paymentPreview = document.getElementById("payment-preview");
const paymentBtn = document.getElementById("payment-screenshot-btn");
const paymentStatus = document.getElementById("payment-screenshot-status");

let screenshotFile = null;
let selectedMethod = null;
let selectedDeal = null; // { id, price } or null
let placedOrderId = null;
let placedOrderPhone = null;
let paymentScreenshotFile = null;

// ---- Load active deals into the picker ----
async function loadDealOptions() {
  if (!dealSelect) return;
  const { data, error } = await supabaseClient
    .from("deals")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !data) { console.error(error); return; }

  dealSelect.innerHTML =
    `<option value="">Not a deal — I'll say my total when I send payment</option>` +
    data.map(d => `<option value="${d.id}" data-price="${d.price}">${escapeHtmlApp(d.title)} — $${Number(d.price).toFixed(2)}</option>`).join("");
}

function escapeHtmlApp(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

if (dealSelect) {
  loadDealOptions();
  dealSelect.addEventListener("change", () => {
    const opt = dealSelect.selectedOptions[0];
    const price = opt && opt.dataset.price;
    selectedDeal = price ? { id: Number(opt.value), price: Number(price) } : null;
  });
}

// ---- Image compression (fixes "file too big" failures on phone photos/HEIC) ----
async function compressImage(file, maxDimension = 1600, quality = 0.8) {
  // Small files don't need it — skip straight through
  if (file.size < 700 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;

    const newName = (file.name || "photo").replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    console.error("Image compression failed — uploading original file instead:", err);
    return file; // never block the upload just because compression failed
  }
}

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

async function handleFile(file) {
  if (!file.type.startsWith("image/")) return;
  preview.alt = "Compressing…";
  const compressed = await compressImage(file);
  screenshotFile = compressed;
  const reader = new FileReader();
  reader.onload = e => {
    preview.src = e.target.result;
    preview.style.display = "block";
    clearError("err-screenshot");
  };
  reader.readAsDataURL(compressed);
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

  await paymentHandlesReady;

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
      p_screenshot_url: screenshotUrl,
      p_deal_id: selectedDeal ? selectedDeal.id : null,
      p_amount: selectedDeal ? selectedDeal.price : null
    });

    if (error) throw error;

    const friendlyOrderId = `FO-${1041 + newId}`;

    // Persist so the "attach payment screenshot" step survives a reload or
    // switching apps to actually send the payment (e.g. opening Cash App) —
    // in-memory variables alone don't survive that on a lot of mobile browsers.
    localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({
      orderId: newId,
      phone,
      friendlyOrderId,
      handle,
      amount: selectedDeal ? selectedDeal.price : null
    }));

    showConfirmation({ orderId: newId, phone, friendlyOrderId, handle, amount: selectedDeal ? selectedDeal.price : null });
  } catch (err) {
    console.error(err);
    sendBtn.disabled = false;
    sendBtn.textContent = "SEND ORDER";
    const msg = (err && err.message) || "";
    alert(/size|large|payload/i.test(msg)
      ? "That screenshot is still too large to upload — try cropping it tighter or taking a lower-res screenshot."
      : "Something went wrong sending your order — check your connection and try again.");
  }
});

function showConfirmation({ orderId, phone, friendlyOrderId, handle, amount }) {
  placedOrderId = orderId;
  placedOrderPhone = phone;

  form.style.display = "none";
  confirmHandle.textContent = handle;
  confirmId.textContent = friendlyOrderId;
  confirmTrackLink.href = `track.html?order=${encodeURIComponent(friendlyOrderId)}&phone=${encodeURIComponent(phone)}`;

  if (amount != null) {
    confirmAmount.textContent = `$${Number(amount).toFixed(2)}`;
    confirmAmountRow.style.display = "block";
  } else {
    confirmAmountRow.style.display = "none";
  }

  confirmCard.style.display = "block";
  confirmCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

const copyOrderNumberBtn = document.getElementById("copy-order-number-btn");
if (copyOrderNumberBtn) {
  copyOrderNumberBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(confirmId.textContent);
      const original = copyOrderNumberBtn.textContent;
      copyOrderNumberBtn.textContent = "Copied ✓";
      setTimeout(() => { copyOrderNumberBtn.textContent = original; }, 1500);
    } catch (err) {
      console.error(err);
      alert("Couldn't copy automatically — just type it in manually: " + confirmId.textContent);
    }
  });
}

// Restore an in-progress order (e.g. customer switched to Cash App to pay,
// then came back) instead of silently failing to attach a payment screenshot.
(function restorePendingOrder() {
  const raw = localStorage.getItem(PENDING_ORDER_KEY);
  if (!raw) return;
  try {
    const pending = JSON.parse(raw);
    showConfirmation(pending);
  } catch { /* ignore corrupt storage */ }
})();

if (startNewOrderLink) {
  startNewOrderLink.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem(PENDING_ORDER_KEY);
    window.location.reload();
  });
}

// ---- Payment proof screenshot (after order is placed) ----
paymentDropzone.addEventListener("click", () => paymentInput.click());
paymentInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  const compressed = await compressImage(file);
  paymentScreenshotFile = compressed;
  const reader = new FileReader();
  reader.onload = ev => {
    paymentPreview.src = ev.target.result;
    paymentPreview.style.display = "block";
    paymentBtn.style.display = "block";
  };
  reader.readAsDataURL(compressed);
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
    localStorage.removeItem(PENDING_ORDER_KEY);
  } catch (err) {
    console.error(err);
    paymentBtn.disabled = false;
    paymentBtn.textContent = "Attach payment screenshot";
    const msg = (err && err.message) || "";
    paymentStatus.textContent = /size|large|payload/i.test(msg)
      ? "That file is still too large — try a screenshot instead of a full-res photo, or crop it tighter."
      : "Couldn't attach that — try again.";
  }
});

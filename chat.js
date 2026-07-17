// ---- Session identity (no accounts — just a random id kept in this browser) ----
const CHAT_SESSION_KEY = "fireorder_chat_session";
function getSessionId() {
  let id = localStorage.getItem(CHAT_SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CHAT_SESSION_KEY, id);
  }
  return id;
}
const sessionId = getSessionId();

let FAQ = { greeting: "Hi! Ask me anything.", fallback: "I'll flag this for a person to answer.", faqs: [] };
fetch("faq.json").then(r => r.json()).then(data => { FAQ = data; }).catch(() => {});

// ---- Build widget markup ----
const widgetHTML = `
  <button class="chat-bubble-btn" id="chat-bubble-btn" aria-label="Open chat">💬</button>
  <div class="chat-widget" id="chat-widget">
    <div class="chat-widget-head">
      <span>FireOrder chat</span>
      <button id="chat-widget-close">✕</button>
    </div>
    <div class="chat-widget-messages" id="chat-widget-messages"></div>
    <form class="chat-widget-form" id="chat-widget-form">
      <input type="text" id="chat-widget-input" placeholder="Type a message…" autocomplete="off">
      <button type="submit">Send</button>
    </form>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", widgetHTML);

const chatBubbleBtn = document.getElementById("chat-bubble-btn");
const chatWidget = document.getElementById("chat-widget");
const chatCloseBtn = document.getElementById("chat-widget-close");
const chatMessagesEl = document.getElementById("chat-widget-messages");
const chatForm = document.getElementById("chat-widget-form");
const chatInput = document.getElementById("chat-widget-input");

let chatOpened = false;

chatBubbleBtn.addEventListener("click", () => {
  chatWidget.classList.toggle("open");
  if (!chatOpened) {
    chatOpened = true;
    loadHistory();
  }
});
chatCloseBtn.addEventListener("click", () => chatWidget.classList.remove("open"));

function renderMessage(sender, text) {
  const div = document.createElement("div");
  div.className = `chat-bubble ${sender}`;
  div.textContent = text;
  chatMessagesEl.appendChild(div);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

async function loadHistory() {
  const { data, error } = await supabaseClient
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) { console.error(error); return; }

  if (!data.length) {
    // First time this customer opens chat — greet them with the bot message (not saved, purely local)
    renderMessage("bot", FAQ.greeting);
  } else {
    data.forEach(m => renderMessage(m.sender, m.message));
  }
}

// Live updates — mainly so an admin's reply appears without the customer refreshing
supabaseClient
  .channel(`chat-${sessionId}`)
  .on("postgres_changes",
    { event: "INSERT", schema: "public", table: "chat_messages", filter: `session_id=eq.${sessionId}` },
    (payload) => {
      // Avoid double-rendering messages we already rendered optimistically
      if (payload.new.sender === "admin") renderMessage("admin", payload.new.message);
    }
  )
  .subscribe();

function matchFaq(text) {
  const lower = text.toLowerCase();
  for (const item of FAQ.faqs) {
    if (item.keywords.some(k => lower.includes(k))) return item.answer;
  }
  return null;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";

  renderMessage("customer", text);
  const { error: customerInsertError } = await supabaseClient
    .from("chat_messages")
    .insert({ session_id: sessionId, sender: "customer", message: text });
  if (customerInsertError) {
    console.error("Chat message failed to save — the admin won't see this:", customerInsertError);
  }

  const answer = matchFaq(text) || FAQ.fallback;
  setTimeout(async () => {
    renderMessage("bot", answer);
    const { error: botInsertError } = await supabaseClient
      .from("chat_messages")
      .insert({ session_id: sessionId, sender: "bot", message: answer });
    if (botInsertError) {
      console.error("Bot reply failed to save — the admin won't see this:", botInsertError);
    }
  }, 500);
});

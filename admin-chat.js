let allChatMessages = [];
let activeSessionId = null;

async function loadAllChats() {
  const { data, error } = await supabaseClient
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) { console.error(error); return; }

  allChatMessages = data;
  renderConvoList();
  if (activeSessionId) renderThread(activeSessionId);
}

function renderConvoList() {
  const listEl = document.getElementById("convo-list");

  const bySession = {};
  allChatMessages.forEach(m => {
    bySession[m.session_id] = bySession[m.session_id] || [];
    bySession[m.session_id].push(m);
  });

  const sessions = Object.entries(bySession).sort((a, b) => {
    const aLast = a[1][a[1].length - 1].created_at;
    const bLast = b[1][b[1].length - 1].created_at;
    return new Date(bLast) - new Date(aLast);
  });

  if (!sessions.length) {
    listEl.innerHTML = `<div class="chat-empty-state">No conversations yet.</div>`;
    return;
  }

  listEl.innerHTML = sessions.map(([sessionId, msgs]) => {
    const last = msgs[msgs.length - 1];
    const label = sessionId.slice(0, 8);
    return `
      <div class="convo-item ${sessionId === activeSessionId ? "active" : ""}" data-session="${sessionId}">
        <strong>Chat ${label}</strong>
        <div class="convo-preview">${escapeHtmlChat(last.sender === "customer" ? "" : last.sender + ": ")}${escapeHtmlChat(last.message)}</div>
      </div>
    `;
  }).join("");

  listEl.querySelectorAll(".convo-item").forEach(el => {
    el.addEventListener("click", () => openConversation(el.dataset.session));
  });
}

function openConversation(sessionId) {
  activeSessionId = sessionId;
  document.getElementById("admin-chat-input").disabled = false;
  document.getElementById("admin-chat-send").disabled = false;
  renderConvoList();
  renderThread(sessionId);
}

function renderThread(sessionId) {
  const threadEl = document.getElementById("admin-chat-messages");
  const msgs = allChatMessages.filter(m => m.session_id === sessionId);

  threadEl.innerHTML = msgs.map(m =>
    `<div class="chat-bubble ${m.sender}">${escapeHtmlChat(m.message)}</div>`
  ).join("");
  threadEl.scrollTop = threadEl.scrollHeight;
}

function escapeHtmlChat(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

async function sendAdminReply() {
  const input = document.getElementById("admin-chat-input");
  const text = input.value.trim();
  if (!text || !activeSessionId) return;
  input.value = "";

  const { error } = await supabaseClient.from("chat_messages").insert({
    session_id: activeSessionId,
    sender: "admin",
    message: text
  });
  if (error) console.error(error);
}

document.getElementById("admin-chat-send").addEventListener("click", sendAdminReply);
document.getElementById("admin-chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendAdminReply();
});

function initChat() {
  loadAllChats();
  // Live updates whenever any customer or bot sends a new message
  supabaseClient
    .channel("admin-chat-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, loadAllChats)
    .subscribe();
}

if (window.fireorderAdminAuthed) {
  initChat();
} else {
  window.addEventListener("fireorder-admin-authed", initChat);
}

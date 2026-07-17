const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errEl = document.getElementById("err-password");

// If already logged in, skip straight to the dashboard
supabaseClient.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = "admin.html";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.style.display = "none";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value
  });

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
    passwordInput.value = "";
    passwordInput.focus();
    return;
  }

  window.location.href = "admin.html";
});

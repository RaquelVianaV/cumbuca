const form = document.querySelector("#login-form");
const errorBox = document.querySelector("#login-error");

form.addEventListener("submit", async event => {
  event.preventDefault();
  errorBox.textContent = "";

  const data = Object.fromEntries(new FormData(form).entries());
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (response.ok) {
    location.href = "/";
    return;
  }

  const result = await response.json().catch(() => ({}));
  errorBox.textContent = result.error || "Não foi possível entrar.";
});

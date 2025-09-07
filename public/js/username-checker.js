// public/js/username-checker.js
document.addEventListener("DOMContentLoaded", () => {
  const usernameInput = document.getElementById("username");
  const statusText = document.getElementById("username-status");
  if (!usernameInput || !statusText) return;

  let timeout = null;

  function setStatus(message, isOk) {
    statusText.textContent = message;
    statusText.style.color = isOk ? "#28a745" : "#dc3545"; // green / red
    usernameInput.style.borderColor = isOk ? "#28a745" : "#dc3545";
  }

  usernameInput.addEventListener("input", () => {
    clearTimeout(timeout);
    const val = usernameInput.value.trim();

    if (val.length < 3) {
      setStatus("Too short", false);
      return;
    }

    // debounce request to avoid spamming the server
    timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/auth/check-username?username=${encodeURIComponent(val)}`);
        const data = await res.json();

        if (data && data.available) {
          setStatus("✔ Available", true);
        } else {
          setStatus("✘ Taken", false);
        }
      } catch (err) {
        setStatus("Error checking username", false);
      }
    }, 500);
  });
});

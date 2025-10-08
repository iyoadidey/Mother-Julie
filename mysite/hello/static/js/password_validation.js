document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("form");
  const password = document.querySelector('input[name="password"]');
  const confirmPassword = document.querySelector('input[name="confirm_password"]');

  form.addEventListener("submit", function (event) {
    password.style.border = "";
    confirmPassword.style.border = "";

    if (password.value !== confirmPassword.value) {
      event.preventDefault();
      alert("Passwords do not match. Please make sure both fields are the same.");
      password.style.border = "2px solid #ff4d6d";
      confirmPassword.style.border = "2px solid #ff4d6d";
    }
  });
});

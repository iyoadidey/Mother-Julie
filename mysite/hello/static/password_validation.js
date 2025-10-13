document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signup-form");
  const password = document.querySelector('input[name="password"]');
  const confirmPassword = document.querySelector('input[name="confirm_password"]');

  if (!form) {
    alert("❌ No form found with id='signup-form'");
    return;
  }

  form.addEventListener("submit", function (event) {
    // Reset border styles
    password.style.border = "";
    confirmPassword.style.border = "";

    // Check if passwords match
    if (password.value !== confirmPassword.value) {
      event.preventDefault();
      alert("⚠️ Passwords do not match! Please make sure both fields are the same.");
      password.style.border = "2px solid #ff4d6d";
      confirmPassword.style.border = "2px solid #ff4d6d";
      return;
    }

    // If everything is correct
    alert("Sign up successful! Redirecting to Sign In...");
    window.location.href = "signin.html"; // Redirect to signin page
  });
});


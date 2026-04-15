document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signup-form");
  const password = document.querySelector('input[name="password1"]');  // Changed from "password"
  const confirmPassword = document.querySelector('input[name="password2"]');  // Changed from "confirm_password"

  if (!form) {
    console.error("No form found with id='signup-form'");
    return;
  }

  // Optional: Remove the alert that's redirecting to signin.html
  // The Django view already handles redirection
  
  form.addEventListener("submit", function (event) {
    // Reset border styles
    if (password) password.style.border = "";
    if (confirmPassword) confirmPassword.style.border = "";

    // Check if passwords match
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      event.preventDefault();
      alert("⚠️ Passwords do not match! Please make sure both fields are the same.");
      if (password) password.style.border = "2px solid #ff4d6d";
      if (confirmPassword) confirmPassword.style.border = "2px solid #ff4d6d";
      return;
    }

    // Let the form submit normally to Django - DON'T redirect here!
    // The Django view will handle the redirect after successful signup
    // Just remove this alert and redirect
    // alert("Sign up successful! Redirecting to Sign In...");
    // window.location.href = "signin.html"; // ← THIS IS CAUSING PROBLEMS!
    
    // Allow the normal form submission to proceed
    return true;
  });
});

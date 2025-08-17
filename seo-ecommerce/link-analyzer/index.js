const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

// Initialize Supabase client
const supabaseUrl = "https://bekbempccbkuyrvjuygr.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJla2JlbXBjY2JrdXlydmp1eWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3Njg5NTQsImV4cCI6MjA3MDM0NDk1NH0.1sKyYrWnpPGo0NOFRO5krPdwh_-N9KM1QifGFCZtatw";
const supabase = createClient(supabaseUrl, supabaseKey);

console.log(
  "Supabase client initialized with provided credentials. Ready to implement features.",
);

// Function to register a new user
async function registerUser(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) {
    console.error("Error registering user:", error.message);
    return;
  }
  console.log("User registered successfully:", data);
}

// Function to log in a user
async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error("Error logging in user:", error.message);
    return;
  }
  console.log("User logged in successfully:", data);
}

// Function to enable 2FA for a user
async function enable2FA() {
  const { data, error } = await supabase.auth.mfa.enroll();
  if (error) {
    console.error("Error enabling 2FA:", error.message);
    return;
  }
  console.log(
    "2FA enabled successfully. Use this QR code to set up:",
    data.qr_code_url,
  );
}

// Function to verify 2FA code during login
async function verify2FACode(code) {
  const { data, error } = await supabase.auth.mfa.verify({
    code,
  });
  if (error) {
    console.error("Error verifying 2FA code:", error.message);
    return;
  }
  console.log("2FA verified successfully:", data);
}

// Function to send password recovery email
async function sendPasswordRecovery(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    console.error("Error sending password recovery email:", error.message);
    return;
  }
  console.log("Password recovery email sent successfully:", data);
}

// Example usage
// registerUser('user@example.com', 'password123');
// loginUser('user@example.com', 'password123');
// enable2FA();
// verify2FACode('123456');
// sendPasswordRecovery('user@example.com');

// Express server setup
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Endpoint to analyze URL
app.post("/analyze", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }

  try {
    // Simulate link analysis (replace with real logic later)
    const analysisResult = {
      url,
      status: "success",
      details: {
        linksFound: 42,
        brokenLinks: 3,
        seoScore: 85,
      },
    };

    res.json(analysisResult);
  } catch (error) {
    console.error("Error analyzing URL:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

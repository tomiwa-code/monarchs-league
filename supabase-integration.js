// ─── SUPABASE CONFIG ──────────────────────────────────────────────────
const SUPABASE_URL = "https://yyejmustajdmwczrkwzf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ojBJ44me-NwI08m_YgVF3w_C5Il4T8z";
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

var pendingAction = null;

// Expose functions globally
window.promptUsernameAndSave = function () {
  pendingAction = "save";
  var modal = document.getElementById("usernameModal");
  if (!modal) {
    showNotification("Modal not found", "error");
    return;
  }
  modal.style.display = "flex";
  document.getElementById("usernameInput").value = "";
  document.getElementById("codeInput").value = "";
  document.getElementById("codeFieldGroup").style.display = "block";
};

window.promptUsernameAndLoad = function () {
  pendingAction = "load";
  var modal = document.getElementById("usernameModal");
  if (!modal) {
    showNotification("Modal not found", "error");
    return;
  }
  modal.style.display = "flex";
  document.getElementById("usernameInput").value = "";
  document.getElementById("codeInput").value = "";
  document.getElementById("codeFieldGroup").style.display = "none";
};

// ─── CONFIRM BUTTON ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  var confirmBtn = document.getElementById("usernameConfirmBtn");
  if (!confirmBtn) return;

  confirmBtn.addEventListener("click", async function () {
    var username = document.getElementById("usernameInput").value.trim();
    if (!username) {
      showNotification("Please enter a username", "error");
      return;
    }

    if (pendingAction === "load") {
      closeModal("usernameModal");
      await loadFromSupabase(username);
      return;
    }

    var isVerified =
      localStorage.getItem("leagueArena_verified_" + username) === "true";
    if (isVerified) {
      closeModal("usernameModal");
      await saveToSupabase(username);
      return;
    }

    var code = document.getElementById("codeInput").value.trim();
    if (!code) {
      showNotification("Access code required for first upload", "error");
      return;
    }

    try {
      var { data, error } = await supabaseClient
        .from("users")
        .select("username")
        .eq("username", username)
        .eq("access_code", code)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        showNotification("Invalid username or access code", "error");
        return;
      }

      localStorage.setItem("leagueArena_verified_" + username, "true");
      closeModal("usernameModal");
      await saveToSupabase(username);
    } catch (err) {
      console.error(err);
      showNotification("Verification failed: " + err.message, "error");
    }
  });

  document
    .getElementById("usernameInput")
    .addEventListener("keydown", function (e) {
      if (e.key === "Enter") confirmBtn.click();
    });
  document
    .getElementById("codeInput")
    .addEventListener("keydown", function (e) {
      if (e.key === "Enter") confirmBtn.click();
    });
});

// ─── SAVE ──────────────────────────────────────────────────
async function saveToSupabase(username) {
  try {
    var { error } = await supabaseClient.from("user_league_data").upsert(
      {
        username: username,
        leagues_data: leagues,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "username" },
    );
    if (error) throw error;
    showNotification('Saved to cloud as "' + username + '"');
  } catch (err) {
    console.error(err);
    showNotification("Save failed: " + err.message, "error");
  }
}

// ─── LOAD ──────────────────────────────────────────────────
async function loadFromSupabase(username) {
  try {
    var { data, error } = await supabaseClient
      .from("user_league_data")
      .select("leagues_data")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      showNotification('No data found for "' + username + '"', "error");
      return;
    }

    leagues = data.leagues_data;
    saveLeagues();
    renderLeagues();
    showNotification('Loaded from cloud as "' + username + '"');
  } catch (err) {
    console.error(err);
    showNotification("Load failed: " + err.message, "error");
  }
}

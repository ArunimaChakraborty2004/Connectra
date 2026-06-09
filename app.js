import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* ======================
   SUPABASE CONFIG
====================== */
const SUPABASE_URL = "https://tqbyyyjakqieyduwsthb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxYnl5eWpha3FpZXlkdXdzdGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMDkwNDcsImV4cCI6MjA4NTY4NTA0N30.206OcIa_ir63U99OTpSICHrVWBk-vnf_Bhy010Gs13s"; // keep yours

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ======================
   DOM ELEMENTS
====================== */
const authScreen = document.getElementById("authScreen");
const dashboardScreen = document.getElementById("dashboardScreen");

const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");
const updateProfileForm = document.getElementById("updateProfileForm");

const createPostBtn = document.getElementById("createPostBtn");
const loadingOverlay = document.getElementById("loadingOverlay");

/* ======================
   UI HELPERS
====================== */
function showLoading() {
  loadingOverlay.style.display = "flex";
}

function hideLoading() {
  loadingOverlay.style.display = "none";
}

function switchScreen(screen) {
  authScreen.style.display = screen === "auth" ? "flex" : "none";
  dashboardScreen.style.display = screen === "dashboard" ? "block" : "none";
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const tabs = document.querySelectorAll(".auth-tab");

  tabs.forEach((t) => t.classList.remove("active"));
  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");

  if (tab === "login") {
    loginForm.classList.add("active");
    signupForm.classList.remove("active");
  } else {
    signupForm.classList.add("active");
    loginForm.classList.remove("active");
  }
}

function showMessage(id, message, type = "error") {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `form-message ${type}`;
}

/* ======================
   AUTH HELPERS
====================== */
async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

async function getProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (error) return null;
  return data;
}

/* ======================
   SIGNUP
====================== */
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("signupUsername").value.trim();
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;

  if (!username) {
    showMessage("signupMessage", "Username required");
    return;
  }

  showLoading();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    hideLoading();
    showMessage("signupMessage", error.message);
    return;
  }

  if (data.user) {
    await supabase
  .from("profiles")
  .upsert({
    id: data.user.id,
    username: username,
  });}

  hideLoading();
  showMessage(
    "signupMessage",
    "Signup successful! Verify email & login.",
    "success"
  );

  signupForm.reset();
});

/* ======================
   LOGIN
====================== */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  showLoading();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    hideLoading();
    showMessage("loginMessage", error.message);
    return;
  }

  const profile = await getProfile();
  hideLoading();

  if (!profile) {
    showMessage("loginMessage", "Profile not found");
    return;
  }

  document.getElementById("profileUsername").textContent = profile.username;
  document.getElementById("currentUsername").textContent = profile.username;
  document.getElementById("avatarInitial").textContent =
    (profile.username || "U")[0].toUpperCase();

  switchScreen("dashboard");
  loadFeed();
  loadConnectionRequests();
});

/* ======================
   UPDATE PROFILE
====================== */
updateProfileForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("updateUsername").value.trim();
  if (!username) return;

  showLoading();

  const user = await getCurrentUser();
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", user.id);

  hideLoading();

  if (error) {
    showMessage("updateMessage", error.message);
    return;
  }

  document.getElementById("profileUsername").textContent = username;
  document.getElementById("currentUsername").textContent = username;
  document.getElementById("avatarInitial").textContent =
    username[0].toUpperCase();

  showMessage("updateMessage", "Profile updated!", "success");
});

/* ======================
   CREATE POST
====================== */
createPostBtn.addEventListener("click", async () => {
  const content = document.getElementById("postContent").value.trim();
  if (!content) return;

  const user = await getCurrentUser();
  if (!user) return;

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    content,
  });

  if (error) {
    alert(error.message);
    return;
  }

  document.getElementById("postContent").value = "";
  loadFeed();
});

/* ======================
   LOAD FEED
====================== */
async function loadFeed() {
  const { data, error } = await supabase
    .from("posts")
    .select(`
  id,
  user_id,
  content,
  created_at,
  profiles(username),
  likes(count),
  comments(
    id,
    content,
    created_at,
    profiles(username)
  )
`)

    .order("created_at", { ascending: false });

  if (error) {
    console.error(error.message);
    return;
  }

  renderPosts(data);
}

/* ======================
   RENDER POSTS
====================== */
/* ======================
   RENDER POSTS
====================== */
async function renderPosts(posts) {
  const feed = document.getElementById("feed");
  feed.innerHTML = "";

  // ✅ Get logged-in user ONCE
  const user = await getCurrentUser();

  posts.forEach((post) => {
    const div = document.createElement("div");
    div.className = "post";
    div.setAttribute("data-post-id", post.id);

    const isOwner = user && user.id === post.user_id;

    div.innerHTML = `
      <strong>${post.profiles.username}</strong>

      <div class="post-content" data-content="${post.content}">
  <p>${post.content}</p>
</div>


      

     <div class="post-actions-row">
  <button class="icon-btn" onclick="toggleLike('${post.id}')">
    ❤️ <span>${post.likes?.[0]?.count || 0}</span>
  </button>

  ${
    isOwner
      ? `
      <button class="icon-btn" onclick="editPost('${post.id}')">✏️</button>
      <button class="icon-btn danger" onclick="deletePost('${post.id}')">🗑️</button>
      `
      : ""
  }
</div>


      <div class="comments">
        ${post.comments
          .map(
            (c) => `
            <div><b>${c.profiles.username}</b>: ${c.content}</div>
          `
          )
          .join("")}
      </div>

      <input
        id="comment-${post.id}"
        placeholder="Add a comment"
        onkeydown="if(event.key==='Enter') addComment('${post.id}')"
      />
      <hr/>
    `;

    feed.appendChild(div);
  });
}


/* ======================
   LIKE
====================== */
async function toggleLike(postId) {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    await supabase.from("likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("likes").insert({
      post_id: postId,
      user_id: user.id,
    });
  }

  loadFeed();
}
let postToDelete = null;

function deletePost(postId) {
  postToDelete = postId;
  document.getElementById("deleteModal").classList.remove("hidden");
}

document.getElementById("cancelDelete").onclick = () => {
  postToDelete = null;
  document.getElementById("deleteModal").classList.add("hidden");
};

document.getElementById("confirmDelete").onclick = async () => {
  if (!postToDelete) return;

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postToDelete);

  document.getElementById("deleteModal").classList.add("hidden");
  postToDelete = null;

  if (error) {
    alert(error.message);
    return;
  }

  loadFeed();
};


async function editPost(postId) {
  const postDiv = document.querySelector(`[data-post-id="${postId}"]`);
  const contentDiv = postDiv.querySelector(".post-content p");

  const oldContent = contentDiv.textContent;

  contentDiv.innerHTML = `
    <textarea class="edit-textarea">${oldContent}</textarea>
    <div class="edit-actions">
      <button onclick="savePost('${postId}')">Save</button>
      <button onclick="cancelEdit('${postId}', \`${oldContent}\`)">Cancel</button>
    </div>
  `;
}
async function savePost(postId) {
  const postDiv = document.querySelector(`[data-post-id="${postId}"]`);
  const textarea = postDiv.querySelector(".edit-textarea");
  const newContent = textarea.value.trim();

  if (!newContent) return;

  const { error } = await supabase
    .from("posts")
    .update({ content: newContent })
    .eq("id", postId);

  if (error) {
    alert(error.message);
    return;
  }

  loadFeed();
}

function cancelEdit(postId, oldContent) {
  const postDiv = document.querySelector(`[data-post-id="${postId}"]`);
  postDiv.querySelector(".post-content").innerHTML = `<p>${oldContent}</p>`;
}





/* ======================
   COMMENT
====================== */
async function addComment(postId) {
  const input = document.getElementById(`comment-${postId}`);
  const content = input.value.trim();
  if (!content) return;

  const user = await getCurrentUser();
  if (!user) return;

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    user_id: user.id,
    content,
  });

  if (error) {
    alert(error.message);
    return;
  }

  input.value = "";
  loadFeed();
  
}

/* ======================
   GLOBAL EXPORTS (IMPORTANT)
====================== */
window.toggleLike = toggleLike;
window.addComment = addComment;
/* ======================
   LOGOUT
====================== */
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    showLoading();

    const { error } = await supabase.auth.signOut();

    hideLoading();

    if (error) {
      alert(error.message);
      return;
    }

    // Clear UI + go back to auth screen
    switchScreen("auth");

    // Optional: clear feed
    const feed = document.getElementById("feed");
    if (feed) feed.innerHTML = "";
  });
}

/* ======================
   INIT
====================== */
document.addEventListener("DOMContentLoaded", () => {
  switchScreen("auth");
  setupRealtime();
  loadConnectionRequests();
  
  // Setup auth tab switching
  const authTabs = document.querySelectorAll(".auth-tab");
  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchAuthTab(tab.dataset.tab);
    });
  });
});
/* ======================
   REALTIME SUBSCRIPTIONS
====================== */
function setupRealtime() {
  supabase
    .channel("realtime-feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "posts" },
      () => loadFeed()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "likes" },
      () => loadFeed()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "comments" },
      () => loadFeed()
    )
    .on(
  "postgres_changes",
  { event: "*", schema: "public", table: "connections" },
  () => {
    loadConnectionRequests();
    loadConnections();
  }
)
    .subscribe();
    
}
async function loadConnectionRequests() {
  const user = await getCurrentUser();
  if (!user) return;

  // 1️⃣ Get pending connections
  const { data: connections, error } = await supabase
    .from("connections")
    .select("id, requester_id")
    .eq("receiver_id", user.id)
    .eq("status", "pending");

  if (error) {
    console.error("Connections error:", error.message);
    return;
  }

  if (!connections || connections.length === 0) {
    renderConnectionRequests([]);
    return;
  }

  // 2️⃣ Get requester user IDs
  const requesterIds = connections.map(c => c.requester_id);

  // 3️⃣ Fetch usernames manually
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", requesterIds);

  if (profileError) {
    console.error("Profiles error:", profileError.message);
    return;
  }

  // 4️⃣ Merge data
  const enriched = connections.map(c => ({
    id: c.id,
    requester: profiles.find(p => p.id === c.requester_id)
  }));

  renderConnectionRequests(enriched);
}
async function loadConnections() {
  const user = await getCurrentUser();
  if (!user) return;

  // 1️⃣ Get accepted connections
  const { data: connections, error } = await supabase
    .from("connections")
    .select("id, requester_id, receiver_id")
    .eq("status", "accepted");

  if (error) {
    console.error("Connections error:", error.message);
    return;
  }

  if (!connections || connections.length === 0) {
    renderConnections([], user.id);
    return;
  }

  // 2️⃣ Collect all user IDs involved
  const userIds = [
    ...new Set(
      connections.flatMap(c => [c.requester_id, c.receiver_id])
    )
  ];

  // 3️⃣ Fetch profiles manually
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds);

  if (profileError) {
    console.error("Profiles error:", profileError.message);
    return;
  }

  // 4️⃣ Merge data manually
  const enriched = connections.map(c => ({
    id: c.id,
    requester_id: c.requester_id,
    receiver_id: c.receiver_id,
    requester: profiles.find(p => p.id === c.requester_id),
    receiver: profiles.find(p => p.id === c.receiver_id)
  }));

  renderConnections(enriched, user.id);
}
function renderConnections(connections, userId) {
  const container = document.getElementById("connectionsList");
  container.innerHTML = "";

  if (!connections || connections.length === 0) {
    container.innerHTML = "<p>No connections yet</p>";
    return;
  }

  connections.forEach((conn) => {
    const otherUser =
      conn.requester_id === userId
        ? conn.receiver
        : conn.requester;

    if (!otherUser) return;

    const div = document.createElement("div");
    div.className = "connection-card";

    div.innerHTML = `
      <b>${otherUser.username}</b>
      <span class="badge">Connected</span>
    `;

    container.appendChild(div);
  });
}
function renderConnectionRequests(requests) {
  const container = document.getElementById("connectionRequests");
  container.innerHTML = "";

  if (!requests || requests.length === 0) {
    container.innerHTML = "<p>No pending requests</p>";
    return;
  }

  requests.forEach(req => {
    const div = document.createElement("div");
    div.className = "connection-card";

    div.innerHTML = `
      <span><b>${req.requester.username}</b> wants to connect</span>
      <div class="connection-actions">
        <button onclick="acceptRequest('${req.id}')">✅ Accept</button>
        <button class="danger" onclick="rejectRequest('${req.id}')">❌ Reject</button>
      </div>
    `;

    container.appendChild(div);
  });
}
async function acceptRequest(connectionId) {
  const { error } = await supabase
    .from("connections")
    .update({ status: "accepted" })
    .eq("id", connectionId);

  if (error) {
    alert(error.message);
    return;
  }
loadConnections();
  loadConnectionRequests();
}

async function rejectRequest(connectionId) {
  const { error } = await supabase
    .from("connections")
    .update({ status: "rejected" })
    .eq("id", connectionId);

  if (error) {
    alert(error.message);
    return;
  }
loadConnections();
  loadConnectionRequests();
}

window.toggleLike = toggleLike;
window.addComment = addComment;
window.deletePost = deletePost;
window.editPost = editPost;
window.savePost = savePost;
window.cancelEdit = cancelEdit;
window.acceptRequest = acceptRequest;
window.rejectRequest = rejectRequest;


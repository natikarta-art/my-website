// Your Google Apps Script Web App URL

function makeClickable(img) {
  img.style.cursor = "pointer";
  img.onclick = function () {
    const fullScreenImg = document.createElement("img");
    fullScreenImg.src = img.src;
    fullScreenImg.style.position = "fixed";
    fullScreenImg.style.top = "50%";
    fullScreenImg.style.left = "50%";
    fullScreenImg.style.transform = "translate(-50%, -50%)";
    fullScreenImg.style.zIndex = "1000";
    fullScreenImg.style.maxWidth = "90%";
    fullScreenImg.style.maxHeight = "90%";

    const downloadBtn = document.createElement("button");
    downloadBtn.textContent = "Download";
    downloadBtn.style.position = "absolute";
    downloadBtn.style.bottom = "20px";
    downloadBtn.style.left = "50%";
    downloadBtn.style.transform = "translateX(-50%)";
    downloadBtn.onclick = function () {
      const link = document.createElement("a");
      link.href = fullScreenImg.src;
      link.download = "downloaded_image.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    overlay.style.zIndex = "999";
    overlay.appendChild(fullScreenImg);
    overlay.appendChild(downloadBtn);
    document.body.appendChild(overlay);

    overlay.onclick = function () {
      document.body.removeChild(overlay);
    };
  };
}

const API_URL =
  "https://script.google.com/macros/s/AKfycbw_vnpvhhe2PDOGoNt_m_v7AsxxtR3L_O8ymBgZHoGFQtPjKglicGdqFX2FImH8YylD1g/exec";
function renderMemories(list) {
  const wrap = document.getElementById("masonry");
  const empty = document.getElementById("emptyState");
  wrap.innerHTML = "";

  if (!list || !list.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const m of list) {
    const card = document.createElement("article");
    card.className = "post";

    if (m.media && String(m.media).startsWith("data:image")) {
      const img = document.createElement("img");
      img.src = m.media;
      img.alt = m.author ? `זיכרון מאת ${m.author}` : "זיכרון";
      card.appendChild(img);
      makeClickable(img);
    }

    const body = document.createElement("div");
    body.className = "post-body";

    const who = document.createElement("div");
    who.className = "post-author";
    who.textContent = m.author || "אנונימי";
    body.appendChild(who);

    const txt = document.createElement("div");
    txt.className = "post-text";
    txt.textContent = m.text || "";
    body.appendChild(txt);

    const meta = document.createElement("div");
    meta.className = "post-meta";
    const d = new Date(Number(m.ts || Date.now()));
    meta.textContent = d.toLocaleDateString("he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (m.link) {
      const a = document.createElement("a");
      a.href = m.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = " · קישור מצורף";
      meta.appendChild(a);
    }
    body.appendChild(meta);

    card.appendChild(body);
    wrap.appendChild(card);
  }
}
async function refreshMemories() {
  try {
    const res = await fetch(API_URL);
    const text = await res.text();
    let list = [];
    try {
      list = JSON.parse(text);
    } catch {}
    renderMemories(list);
  } catch (e) {
    console.error("GET memories failed:", e);
  }
}

// Load on page open
document.addEventListener("DOMContentLoaded", refreshMemories);

// Hook the form to send entries
const form = document.getElementById("memoryForm");
// Hook the form to add entries to localStorage
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("memName").value.trim();
    const link = document.getElementById("memLink").value.trim();
    const text = document.getElementById("memText").value.trim();
    const file = document.getElementById("memFile").files[0];

    // basic validation
    if (!name || !text) return alert("נא למלא שם וטקסט.");

    let mediaDataURL = null;
    try {
      mediaDataURL = await fileToDataURL(file);
    } catch {}

    let mediaBase64 = "";
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        mediaBase64 = reader.result;
        await submitMemory(name, link, text, mediaBase64);
      };
      reader.readAsDataURL(file);
    } else {
      await submitMemory(name, link, text, mediaBase64);
    }

    // reset and show
    form.reset();
    refreshMemories();

    // smooth scroll to the memories section
    document.getElementById("stories").scrollIntoView({ behavior: "smooth" });
  });
}

// Send data to Google Apps Script
async function submitMemory(name, link, text, mediaBase64) {
  const data = { author: name, link, text, media: mediaBase64 };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      // no headers -> stays a "simple request" (no CORS preflight)
      body: JSON.stringify(data),
    });

    const responseText = await res.text();
    console.log("API status:", res.status, responseText);

    let result = {};
    try {
      result = JSON.parse(responseText);
    } catch (_) {}

    if (res.ok && (result.ok === undefined || result.ok === true)) {
      alert("נשמר בהצלחה!");
      document.getElementById("memoryForm").reset();
      // optionally refresh the masonry here if you already render from the API
    } else {
      alert(`שגיאה מהשרת (סטטוס ${res.status}):\n${responseText || "No body"}`);
    }
  } catch (err) {
    console.error(err);
    alert("שגיאת רשת/חיבור לשרת: " + err.message);
  }
}

// Year
document.getElementById("y").textContent = new Date().getFullYear().toString();

// Gallery scroll buttons
function scrollRail(dir) {
  const el = document.getElementById("rail");
  el.scrollBy({ left: dir * 320, behavior: "smooth" });
}

// Swap main video source (when using local MP4s)
function swapVideo(src) {
  const v = document.getElementById("player");
  if (!v) return;
  const t = v.currentTime;
  v.src = src;
  v.load();
  v.currentTime = t;
  v.play().catch(() => {});
}

// ---- simple store using localStorage (works on a static site) ----
const KEY = "memories";

function loadMemories() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function saveMemories(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    if (!file) return res(null);
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

const rail = document.getElementById("rail");
const MACRO_URL =
  "https://script.google.com/macros/s/AKfycbzWl3L8HnKm9soEYlLiBzXLTVHDHVXl5dl4yAR-8jvlefiuhVCkE6QgNo4-rssUyETv4w/exec";

if (rail) {
  fetch(MACRO_URL)
    .then((response) => response.json())
    .then((data) => {
      data.forEach((item) => {
        const div = document.createElement("div");
        div.className = "shot";

        const img = document.createElement("img");

        // 🟢 FIX 1: Use the 'thumbnail' API with a large size (s4000 = max 4000px)
        // This bypasses the Google Drive viewer interface completely
        img.src = `https://drive.google.com/thumbnail?id=${item.fileId}&sz=s4000`;

        // 🟢 FIX 2: Hide the origin so Google doesn't block the embed
        img.referrerPolicy = "no-referrer";

        img.alt = item.filename || "image";

        if (typeof makeClickable === "function") {
          makeClickable(img);
        }

        div.appendChild(img);
        rail.appendChild(div);
      });
    })
    .catch((error) => console.error("Error loading images:", error));
}

// render on load
refreshMemories();

// ===== VIDEOS: clickable grid + modal + next/prev + swipe =====
(function initVideos() {
  const grid = document.getElementById("videoGrid");
  if (!grid) return;

  // Collect cards from the grid (supports dynamic append later)
  function getCards() {
    return Array.from(grid.querySelectorAll(".video-card"));
  }

  // Create modal once
  const overlay = document.createElement("div");
  overlay.id = "videoOverlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.85)";
  overlay.style.zIndex = "2000";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "1rem";

  const panel = document.createElement("div");
  panel.style.position = "relative";
  panel.style.width = "min(1000px, 96vw)";
  panel.style.maxHeight = "90vh";
  panel.style.display = "grid";
  panel.style.gap = "0.75rem";

  const title = document.createElement("div");
  title.id = "videoOverlayTitle";
  title.style.color = "#fff";
  title.style.textAlign = "center";
  title.style.fontSize = "1.2rem";
  title.style.padding = "0.25rem 0.5rem";

  const playerWrap = document.createElement("div");
  playerWrap.style.position = "relative";
  playerWrap.style.borderRadius = "12px";
  playerWrap.style.overflow = "hidden";
  playerWrap.style.background = "#000";

  const player = document.createElement("video");
  player.id = "videoOverlayPlayer";
  player.controls = true;
  player.preload = "metadata";
  player.style.width = "100%";
  player.style.height = "auto";
  player.style.display = "block";
  player.playsInline = true;

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "10px";
  closeBtn.style.right = "10px";
  closeBtn.style.width = "42px";
  closeBtn.style.height = "42px";
  closeBtn.style.borderRadius = "999px";
  closeBtn.style.border = "1px solid rgba(255,255,255,0.25)";
  closeBtn.style.background = "rgba(0,0,0,0.35)";
  closeBtn.style.color = "#fff";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.zIndex = "5";

  // Prev/Next buttons (RTL-friendly: left arrow feels like next)
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.textContent = "›"; // previous in RTL
  prevBtn.setAttribute("aria-label", "הסרטון הקודם");
  prevBtn.style.position = "absolute";
  prevBtn.style.top = "50%";
  prevBtn.style.right = "10px";
  prevBtn.style.transform = "translateY(-50%)";
  prevBtn.style.width = "44px";
  prevBtn.style.height = "44px";
  prevBtn.style.borderRadius = "999px";
  prevBtn.style.border = "1px solid rgba(255,255,255,0.25)";
  prevBtn.style.background = "rgba(0,0,0,0.35)";
  prevBtn.style.color = "#fff";
  prevBtn.style.cursor = "pointer";
  prevBtn.style.zIndex = "5";

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.textContent = "‹"; // next in RTL
  nextBtn.setAttribute("aria-label", "הסרטון הבא");
  nextBtn.style.position = "absolute";
  nextBtn.style.top = "50%";
  nextBtn.style.left = "10px";
  nextBtn.style.transform = "translateY(-50%)";
  nextBtn.style.width = "44px";
  nextBtn.style.height = "44px";
  nextBtn.style.borderRadius = "999px";
  nextBtn.style.border = "1px solid rgba(255,255,255,0.25)";
  nextBtn.style.background = "rgba(0,0,0,0.35)";
  nextBtn.style.color = "#fff";
  nextBtn.style.cursor = "pointer";
  nextBtn.style.zIndex = "5";

  playerWrap.appendChild(player);
  playerWrap.appendChild(closeBtn);
  playerWrap.appendChild(prevBtn);
  playerWrap.appendChild(nextBtn);

  panel.appendChild(title);
  panel.appendChild(playerWrap);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  let currentIndex = -1;

  function openAt(index) {
    const cards = getCards();
    if (!cards.length) return;

    currentIndex = Math.max(0, Math.min(index, cards.length - 1));
    const card = cards[currentIndex];

    const src = card.getAttribute("data-src") || "";
    const t = card.getAttribute("data-title") || "";

    title.textContent = t;

    // Load video
    player.pause();
    player.removeAttribute("src");
    player.load();

    player.src = src;
    player.load();

    overlay.style.display = "flex";

    // Try autoplay (may be blocked)
    player.play().catch(() => {});
  }

  function closeOverlay() {
    overlay.style.display = "none";
    player.pause();
    player.removeAttribute("src");
    player.load();
    currentIndex = -1;
  }

  function nextVideo() {
    const cards = getCards();
    if (!cards.length) return;
    const next = (currentIndex + 1) % cards.length;
    openAt(next);
  }

  function prevVideo() {
    const cards = getCards();
    if (!cards.length) return;
    const prev = (currentIndex - 1 + cards.length) % cards.length;
    openAt(prev);
  }

  // Click card -> open
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".video-card");
    if (!card) return;

    const cards = getCards();
    const idx = cards.indexOf(card);
    if (idx >= 0) openAt(idx);
  });

  // Close when clicking outside panel (on overlay background)
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay();
  });
  closeBtn.addEventListener("click", closeOverlay);

  // Nav buttons
  nextBtn.addEventListener("click", nextVideo);
  prevBtn.addEventListener("click", prevVideo);

  // Keyboard: Esc closes; arrows navigate (RTL-friendly mapping)
  document.addEventListener("keydown", (e) => {
    if (overlay.style.display !== "flex") return;

    if (e.key === "Escape") closeOverlay();
    if (e.key === "ArrowLeft") nextVideo();   // left = next
    if (e.key === "ArrowRight") prevVideo();  // right = prev
  });

  // ===== Swipe support (mobile) =====
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;

  playerWrap.addEventListener("touchstart", (e) => {
    if (overlay.style.display !== "flex") return;
    if (!e.touches || e.touches.length !== 1) return;

    touchActive = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  playerWrap.addEventListener("touchend", (e) => {
    if (!touchActive || overlay.style.display !== "flex") return;
    touchActive = false;

    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    // Ignore mostly-vertical gestures (scroll)
    if (Math.abs(dy) > Math.abs(dx)) return;

    // Threshold to avoid accidental swipes
    const TH = 60;

    if (dx <= -TH) {
      // swipe left -> next (RTL-friendly)
      nextVideo();
    } else if (dx >= TH) {
      // swipe right -> prev
      prevVideo();
    }
  }, { passive: true });
})();


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

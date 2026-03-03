const CONFIG = window.APP_CONFIG || {};
const DEFAULT_WORKER_URL = "https://your-bilipulse-api.example.com";
const WORKER_URL = (CONFIG.API_BASE_URL || DEFAULT_WORKER_URL).replace(/\/$/, "");
const API_TIMEOUT_MS = 90000;
const MAX_HISTORY = 20;

let userId = null;
let entitlements = null;
chrome.storage.local.get("userId", (data) => {
  if (data.userId) {
    userId = data.userId;
  } else {
    userId = crypto.randomUUID();
    chrome.storage.local.set({ userId });
  }
  fetchEntitlements();
});

async function fetchUsage() {
  if (!userId) return;
  try {
    const res = await fetch(WORKER_URL + "/usage", {
      headers: { "X-User-Id": userId },
    });
    if (!res.ok) return;
    const info = await res.json();
    entitlements = {
      plan: info.plan || "free",
      features: {
        analyze: true,
        danmaku: true,
        competitor: info.plan === "pro" || info.plan === "credit" || info.plan === "trial",
        trend: true,
        improvement: true,
      },
      quota: {
        used: Number(info.used || 0),
        limit: Number(info.limit ?? 0),
        remaining: Number(info.remaining ?? 0),
      },
      expiresAt: info.expiresAt || null,
    };
    renderUsage(info);
    checkTrial();
  } catch {}
}

async function fetchEntitlements() {
  if (!userId) return;
  try {
    const res = await fetch(WORKER_URL + "/entitlements", {
      headers: { "X-User-Id": userId },
    });
    if (res.ok) {
      const data = await res.json();
      entitlements = data;
      const quota = data.quota || {};
      const info = {
        plan: data.plan || "free",
        used: Number(quota.used || 0),
        limit: Number(quota.limit ?? 0),
        remaining: Number(quota.remaining ?? 0),
      };
      renderUsage(info);
      checkTrial();
      return;
    }
  } catch {}
  await fetchUsage();
}

function renderUsage(info) {
  usageFill.classList.remove("warn");
  if (info.plan === "pro") {
    usageText.textContent = "Pro - unlimited analyses";
    usageFill.style.width = "100%";
    usageBar.classList.remove("hidden");
    usageLimitMsg.classList.add("hidden");
    return;
  }
  const remaining = info.plan === "credit" || info.plan === "trial" ? info.remaining : info.limit - info.used;
  const limit = info.limit;
  const label = info.plan === "credit" ? "credits" : info.plan === "trial" ? "trial uses" : "free analyses";
  usageText.textContent = `${info.plan === "free" ? "Free" : "Plan"} - ${remaining}/${limit} ${label} remaining`;
  const pct = limit > 0 ? ((limit - remaining) / limit) * 100 : 100;
  usageFill.style.width = pct + "%";
  if (pct >= 100) usageFill.classList.add("warn");
  usageBar.classList.remove("hidden");
  if (remaining <= 0 && info.plan === "free") showUsageLimit();
  else usageLimitMsg.classList.add("hidden");
}

function showUsageLimit() {
  usageLimitMsg.classList.remove("hidden");
  analyzeBtn.disabled = true;
  danmakuBtn.disabled = true;
  competitorBtn.disabled = true;
}

// --- DOM refs ---
const analyzeBtn = document.getElementById("analyzeBtn");
const danmakuBtn = document.getElementById("danmakuBtn");
const competitorBtn = document.getElementById("competitorBtn");
const trendBtn = document.getElementById("trendBtn");
const loading = document.getElementById("loading");
const loadingText = document.getElementById("loadingText");
const progressFill = document.getElementById("progressFill");
const errorDiv = document.getElementById("error");
const results = document.getElementById("results");
const historyLink = document.getElementById("historyLink");
const historyArea = document.getElementById("historyArea");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const usageBar = document.getElementById("usageBar");
const usageText = document.getElementById("usageText");
const usageFill = document.getElementById("usageFill");
const usageLimitMsg = document.getElementById("usageLimitMsg");
const proModal = document.getElementById("proModal");
const proEmail = document.getElementById("proEmail");
const proTrialBtn = document.getElementById("proTrialBtn");
const proMsg = document.getElementById("proMsg");
const proLock = document.getElementById("proLock");
const proClose = document.getElementById("proClose");
const trendArea = document.getElementById("trendArea");
const trendContent = document.getElementById("trendContent");
const improvementBtn = document.getElementById("improvementBtn");
const improvementResult = document.getElementById("improvementResult");
const clearTrendBtn = document.getElementById("clearTrendBtn");

// --- Onboarding ---
chrome.storage.local.get("onboardingDone", (data) => {
  if (!data.onboardingDone) document.getElementById("onboarding").classList.remove("hidden");
});
document.getElementById("dismissOnboarding").addEventListener("click", () => {
  document.getElementById("onboarding").classList.add("hidden");
  chrome.storage.local.set({ onboardingDone: true });
});

const proHint = document.getElementById("proHint");

// --- Pro Trial ---
const TRIAL_DAYS = 7, TRIAL_USES = 5;
let trialActive = false;
function checkTrial(cb) {
  trialActive = !!entitlements?.features?.competitor;
  if (proLock) proLock.classList.toggle("hidden", trialActive);
  if (proHint) proHint.classList.toggle("hidden", trialActive);

  if (trialActive && entitlements?.plan === "trial") {
    const remaining = Number(entitlements.quota?.remaining ?? 0);
    const limit = Number(entitlements.quota?.limit ?? TRIAL_USES);
    competitorBtn.innerHTML = "Competitor Analysis <span class='trial-status'>Trial - " + remaining + "/" + limit + " left</span>";
  } else {
    competitorBtn.innerHTML = "Competitor Analysis <span id='proLock' class='pro-badge" + (trialActive ? " hidden" : "") + "'>PRO</span>";
  }

  if (cb) cb(trialActive);
}
checkTrial();

// --- Restore last results ---
chrome.storage.local.get("lastResultData", (data) => {
  if (data.lastResultData) {
    const { type, data: d } = data.lastResultData;
    if (type === "analyze") renderAnalyzeReport(d);
    else if (type === "danmaku") renderDanmakuReport(d);
    else if (type === "competitor") renderCompetitorReport(d);
  }
});

// --- Helpers ---
function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.classList.remove("hidden");
  errorDiv.onclick = () => errorDiv.classList.add("hidden");
}
function hideError() { errorDiv.classList.add("hidden"); }
function updateProgress(percent, text) {
  progressFill.style.width = percent + "%";
  loadingText.textContent = text;
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// --- Bilibili API helpers (client-side to avoid 412 block) ---
async function biliSearch(keyword) {
  const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(keyword)}&page=1&pagesize=10`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.bilibili.com" }, credentials: "include" });
  const data = await res.json();
  return (data.data?.result || []).map(v => ({
    bvid: v.bvid, title: (v.title || "").replace(/<[^>]+>/g, ""),
    author: v.author || "", play: v.play || 0,
  }));
}

async function biliVideoInfo(bvid) {
  const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { credentials: "include" });
  const data = await res.json();
  const s = data.data?.stat || {};
  return {
    bvid, title: data.data?.title || "", owner: data.data?.owner?.name || "",
    view: s.view || 0, like: s.like || 0, coin: s.coin || 0,
    favorite: s.favorite || 0, danmaku: s.danmaku || 0, reply: s.reply || 0,
  };
}

async function biliFetchComments(bvid, pages = 2) {
  const infoRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { credentials: "include" });
  const infoData = await infoRes.json();
  const oid = infoData.data?.aid;
  if (!oid) return [];
  let all = [];
  for (let i = 1; i <= pages; i++) {
    const res = await fetch(`https://api.bilibili.com/x/v2/reply?type=1&oid=${oid}&pn=${i}&sort=1`, { credentials: "include" });
    const data = await res.json();
    const replies = data.data?.replies || [];
    if (!replies.length) break;
    all = all.concat(replies.map(r => ({ text: r.content?.message || "", likes: r.like || 0 })));
  }
  return all.sort((a, b) => b.likes - a.likes);
}
function bindCopyBtn(copyText) {
  const btn = document.getElementById("copyBtn");
  if (!btn) return;
  btn.onclick = () => {
    navigator.clipboard.writeText(copyText).then(() => {
      btn.textContent = "宸插鍒?";
      btn.classList.add("copied");
      setTimeout(() => { btn.textContent = "澶嶅埗缁撴灉"; btn.classList.remove("copied"); }, 2000);
    });
  };
}

// --- Analyze Comments ---
analyzeBtn.addEventListener("click", async () => {
  hideError();
  results.classList.add("hidden");
  analyzeBtn.disabled = true;
  danmakuBtn.disabled = true;
  analyzeBtn.textContent = "鍒嗘瀽涓?..";
  loading.classList.remove("hidden");
  updateProgress(0, "鍑嗗涓?..");

  try {
    updateProgress(10, "妫€鏌ュ綋鍓嶉〉闈?..");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url?.includes("bilibili.com/video")) {
      throw new Error("璇峰厛鎵撳紑B绔欒棰戦〉闈€?");
    }

    updateProgress(20, "鎻愬彇璇勮...");
    let resp;
    try {
      resp = await chrome.tabs.sendMessage(tab.id, { action: "extractComments" });
    } catch {
      throw new Error("鏃犳硶璇诲彇椤甸潰鍐呭锛岃鍒锋柊椤甸潰鍚庨噸璇曘€?");
    }
    const comments = resp?.comments || [];
    const videoInfo = resp?.videoInfo || {};
    if (comments.length === 0) {
      throw new Error("鏈壘鍒拌瘎璁猴紝璇锋粴鍔ㄩ〉闈㈠姞杞借瘎璁哄悗閲嶈瘯銆?");
    }

    updateProgress(40, "AI 鍒嗘瀽涓?..");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const apiRes = await fetch(WORKER_URL + "/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId || "" },
      body: JSON.stringify({ comments, videoInfo }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!apiRes.ok) {
      const err = await apiRes.json().catch(() => ({}));
      if (apiRes.status === 403 && err.code === "USAGE_LIMIT") {
        fetchEntitlements();
        throw new Error(err.error);
      }
      if (apiRes.status === 403 && err.code === "FEATURE_LOCKED") {
        proModal.classList.remove("hidden");
        fetchEntitlements();
        throw new Error(err.error);
      }
      throw new Error(err.error || "Analysis failed. Please try again later.");
    }

    const data = await apiRes.json();
    if (data.error) throw new Error("鍒嗘瀽澶辫触锛岃绋嶅悗閲嶈瘯銆?");

    updateProgress(100, "瀹屾垚!");
    renderAnalyzeReport(data);
    chrome.storage.local.set({ lastResultData: { type: "analyze", data } });
    saveToHistory(data, "analyze");
    fetchEntitlements();
  } catch (err) {
    showError(err.name === "AbortError" ? "Analysis timed out. Please retry." : err.message);
  } finally {
    analyzeBtn.disabled = false;
    danmakuBtn.disabled = false;
    analyzeBtn.textContent = "鍒嗘瀽璇勮";
    loading.classList.add("hidden");
    progressFill.style.width = "0%";
  }
});

// --- Danmaku Analysis ---
danmakuBtn.addEventListener("click", async () => {
  hideError();
  results.classList.add("hidden");
  analyzeBtn.disabled = true;
  danmakuBtn.disabled = true;
  danmakuBtn.textContent = "鍒嗘瀽涓?..";
  loading.classList.remove("hidden");
  updateProgress(0, "鍑嗗涓?..");

  try {
    updateProgress(10, "妫€鏌ュ綋鍓嶉〉闈?..");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url?.includes("bilibili.com/video")) {
      throw new Error("璇峰厛鎵撳紑B绔欒棰戦〉闈€?");
    }

    updateProgress(20, "鑾峰彇寮瑰箷鏁版嵁...");
    let dmData;
    try {
      dmData = await chrome.tabs.sendMessage(tab.id, { action: "extractDanmaku" });
    } catch {
      throw new Error("鏃犳硶鑾峰彇寮瑰箷锛岃鍒锋柊椤甸潰鍚庨噸璇曘€?");
    }
    if (!dmData?.segments?.length) {
      throw new Error("鏈幏鍙栧埌寮瑰箷鏁版嵁銆?");
    }

    // Also get video info
    let videoInfo = {};
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { action: "extractComments" });
      videoInfo = resp?.videoInfo || {};
    } catch {}

    updateProgress(40, "AI 鍒嗘瀽寮瑰箷...");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const apiRes = await fetch(WORKER_URL + "/danmaku", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId || "" },
      body: JSON.stringify({ segments: dmData.segments, total: dmData.total, videoInfo }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!apiRes.ok) {
      const err = await apiRes.json().catch(() => ({}));
      if (apiRes.status === 403 && err.code === "USAGE_LIMIT") {
        fetchEntitlements();
        throw new Error(err.error);
      }
      if (apiRes.status === 403 && err.code === "FEATURE_LOCKED") {
        proModal.classList.remove("hidden");
        fetchEntitlements();
        throw new Error(err.error);
      }
      throw new Error(err.error || "Danmaku analysis failed. Please try again later.");
    }

    const data = await apiRes.json();
    if (data.error) throw new Error("寮瑰箷鍒嗘瀽澶辫触锛岃绋嶅悗閲嶈瘯銆?");

    updateProgress(100, "瀹屾垚!");
    renderDanmakuReport(data);
    chrome.storage.local.set({ lastResultData: { type: "danmaku", data } });
    saveToHistory(data, "danmaku");
    fetchEntitlements();
  } catch (err) {
    showError(err.name === "AbortError" ? "Analysis timed out. Please retry." : err.message);
  } finally {
    analyzeBtn.disabled = false;
    danmakuBtn.disabled = false;
    danmakuBtn.textContent = "寮瑰箷鍒嗘瀽";
    loading.classList.add("hidden");
    progressFill.style.width = "0%";
  }
});

// --- Competitor Analysis ---
competitorBtn.addEventListener("click", async () => {
  if (!entitlements?.features?.competitor) {
    proModal.classList.remove("hidden");
    return;
  }
  hideError();
  results.classList.add("hidden");
  trendArea.classList.add("hidden");
  analyzeBtn.disabled = true;
  danmakuBtn.disabled = true;
  competitorBtn.disabled = true;
  competitorBtn.textContent = "瀵规瘮涓?..";
  loading.classList.remove("hidden");
  updateProgress(0, "鍑嗗涓?..");

  try {
    updateProgress(10, "妫€鏌ュ綋鍓嶉〉闈?..");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url?.includes("bilibili.com/video")) {
      throw new Error("璇峰厛鎵撳紑B绔欒棰戦〉闈€?");
    }

    updateProgress(20, "鎻愬彇璇勮鍜岃棰戜俊鎭?..");
    let resp;
    try {
      resp = await chrome.tabs.sendMessage(tab.id, { action: "extractComments" });
    } catch {
      throw new Error("鏃犳硶璇诲彇椤甸潰鍐呭锛岃鍒锋柊椤甸潰鍚庨噸璇曘€?");
    }
    const comments = resp?.comments || [];
    const videoInfo = resp?.videoInfo || {};
    if (!videoInfo.bvid) {
      throw new Error("鏃犳硶鑾峰彇瑙嗛BV鍙凤紝璇风‘璁ゅ湪瑙嗛椤甸潰銆?");
    }

    updateProgress(30, "鎼滅储绔炲搧瑙嗛...");
    const searchQuery = (videoInfo.title || "").slice(0, 20);
    const searchResults = await biliSearch(searchQuery);
    const competitors = searchResults.filter(v => v.bvid !== videoInfo.bvid).slice(0, 3);
    if (!competitors.length) throw new Error("鏈壘鍒扮浉鍏崇珵鍝佽棰?");

    updateProgress(50, "鑾峰彇绔炲搧鏁版嵁...");
    const myStats = await biliVideoInfo(videoInfo.bvid);
    const compStats = await Promise.all(competitors.map(c => biliVideoInfo(c.bvid)));

    updateProgress(65, "鑾峰彇绔炲搧璇勮...");
    const compComments = await Promise.all(competitors.map(c => biliFetchComments(c.bvid, 2)));

    updateProgress(80, "AI鍒嗘瀽瀵规瘮涓?..");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const apiRes = await fetch(WORKER_URL + "/competitor", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId || "" },
      body: JSON.stringify({ comments, videoInfo, myStats, compStats, compComments }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!apiRes.ok) {
      const err = await apiRes.json().catch(() => ({}));
      if (apiRes.status === 403 && err.code === "USAGE_LIMIT") {
        fetchEntitlements();
        throw new Error(err.error);
      }
      if (apiRes.status === 403 && err.code === "FEATURE_LOCKED") {
        proModal.classList.remove("hidden");
        fetchEntitlements();
        throw new Error(err.error);
      }
      throw new Error(err.error || "Competitor analysis failed. Please try again later.");
    }

    const data = await apiRes.json();
    if (data.error) throw new Error(data.error);

    updateProgress(100, "瀹屾垚!");
    renderCompetitorReport(data);
    chrome.storage.local.set({ lastResultData: { type: "competitor", data } });
    saveToHistory(data, "competitor");
    fetchEntitlements();
  } catch (err) {
    showError(err.name === "AbortError" ? "Competitor analysis timed out. Please retry." : err.message);
  } finally {
    analyzeBtn.disabled = false;
    danmakuBtn.disabled = false;
    competitorBtn.disabled = false;
    competitorBtn.textContent = "Competitor Analysis";
    checkTrial();
    loading.classList.add("hidden");
    progressFill.style.width = "0%";
  }
});

// --- Render: Analyze Report ---
function renderAnalyzeReport(parsed) {
  let html = "";
  let copyText = "";
  const problems = parsed.problems || [];
  problems.forEach((p, i) => {
    const signalCls = p.signal_strength === "strong" ? "signal-strong" : p.signal_strength === "moderate" ? "signal-moderate" : "signal-weak";
    html += "<div class='problem-card'>";
    html += "<span class='problem-tag'>闂 " + (i + 1) + "</span>";
    html += "<span class='signal-tag " + signalCls + "'>" + (p.signal_strength || "unknown") + "</span>";
    html += "<div class='problem-title'>" + escapeHtml(p.title) + "</div>";
    html += "<div class='problem-detail'>" + escapeHtml(p.detail) + "</div>";
    html += "<span class='suggestion-tag'>寤鸿</span>";
    html += "<div class='suggestion-text'>" + escapeHtml(p.suggestion) + "</div>";
    if (p.evidence?.length) {
      html += "<div class='evidence-block'>";
      p.evidence.forEach(e => { html += "<div class='evidence-item'>" + escapeHtml(e) + "</div>"; });
      html += "</div>";
    }
    html += "</div>";
    copyText += "闂 " + (i + 1) + " [" + (p.signal_strength || "") + "]: " + p.title + "\n" + p.detail + "\n寤鸿: " + p.suggestion + "\n\n";
  });

  const questions = parsed.unanswered_questions || [];
  if (questions.length) {
    html += "<div class='danmaku-section'>";
    html += "<span class='danmaku-section-title highlights'>鏈洖绛旂殑闂</span>";
    questions.forEach(q => {
      html += "<div class='danmaku-item'>" + escapeHtml(q.question_theme) + " (" + (q.count || "?") + " 鏉¤瘎璁?";
      if (q.examples?.length) {
        html += "<div class='evidence-block'>";
        q.examples.forEach(e => { html += "<div class='evidence-item'>" + escapeHtml(e) + "</div>"; });
        html += "</div>";
      }
      html += "</div>";
    });
    html += "</div>";
  }

  html += "<button id='copyBtn' class='copy-btn'>澶嶅埗缁撴灉</button>";
  html += "<div class='comment-count'>" + escapeHtml(parsed._footer || "鍩轰簬椤甸潰璇勮鍒嗘瀽") + "</div>";
  results.innerHTML = html;
  results.classList.remove("hidden");
  bindCopyBtn(copyText);
  document.getElementById("upgradeBanner").classList.remove("hidden");
}

// --- Render: Danmaku Report ---
function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}

function renderDanmakuReport(data) {
  // Reuse analyze card layout and append danmaku count.
  data._footer = "Total danmaku analyzed: " + (data.total || 0);
  renderAnalyzeReport(data);
}

// --- Render: Competitor Report ---
function renderDataComparison(dc) {
  if (!dc) return "";
  const my = dc.my, avg = dc.avg;
  function cmp(myVal, avgVal) {
    if (!avgVal) return "";
    const diff = ((myVal - avgVal) / avgVal * 100).toFixed(0);
    if (diff > 0) return "<span class='dc-up'>+" + diff + "%</span>";
    if (diff < 0) return "<span class='dc-down'>" + diff + "%</span>";
    return "<span>0%</span>";
  }
  let h = "<div class='data-comparison'>";
  h += "<div class='data-comparison-title'>鏁版嵁瀵规瘮</div>";
  h += "<table class='data-comparison-table'>";
  h += "<tr><th></th><th>鎾斁</th><th>鐐硅禐鐜?/th><th>鎶曞竵鐜?/th><th>鏀惰棌鐜?/th></tr>";
  h += "<tr class='my-row'><td>鎴戠殑瑙嗛</td>";
  h += "<td>" + my.view.toLocaleString() + "</td>";
  h += "<td>" + my.like_rate + "%</td>";
  h += "<td>" + my.coin_rate + "%</td>";
  h += "<td>" + my.fav_rate + "%</td></tr>";
  h += "<tr><td>绔炲搧骞冲潎</td>";
  h += "<td>" + avg.view.toLocaleString() + "</td>";
  h += "<td>" + avg.like_rate + "%</td>";
  h += "<td>" + avg.coin_rate + "%</td>";
  h += "<td>" + avg.fav_rate + "%</td></tr>";
  h += "<tr><td>宸紓</td>";
  h += "<td>" + cmp(my.view, avg.view) + "</td>";
  h += "<td>" + cmp(my.like_rate, avg.like_rate) + "</td>";
  h += "<td>" + cmp(my.coin_rate, avg.coin_rate) + "</td>";
  h += "<td>" + cmp(my.fav_rate, avg.fav_rate) + "</td></tr>";
  h += "</table></div>";
  return h;
}

function renderCompetitorReport(data) {
  let html = "";
  html += renderDataComparison(data.data_comparison);

  if (data.competitors?.length) {
    html += "<div class='comp-videos'>";
    data.competitors.forEach(c => {
      html += "<div class='comp-video-card'>";
      html += "<a class='comp-video-link' href='https://www.bilibili.com/video/" + c.bvid + "' target='_blank'>" + escapeHtml(c.title) + "</a>";
      html += "<div class='comp-video-meta'>" + escapeHtml(c.owner) + " 路 " + Number(c.view).toLocaleString() + " 鎾斁 路 " + Number(c.reply || 0).toLocaleString() + " 璇勮</div>";
      html += "</div>";
    });
    html += "</div>";
  }

  const sections = [
    { key: "my_strengths", label: "浣犵殑浼樺娍", cls: "strengths" },
    { key: "my_weaknesses", label: "绔炲搧鍋氬緱鏇村ソ", cls: "weaknesses" },
    { key: "opportunities", label: "Opportunities to Try", cls: "opportunities" },
  ];
  sections.forEach(s => {
    const items = data[s.key] || [];
    if (!items.length) return;
    html += "<div class='comp-section'>";
    html += "<span class='comp-section-title " + s.cls + "'>" + s.label + "</span>";
    items.forEach(item => {
      const text = typeof item === "string" ? item : item.insight;
      html += "<div class='comp-item'>" + escapeHtml(text);
      if (item.evidence?.length) {
        html += "<div class='evidence-block'>";
        item.evidence.forEach(e => { html += "<div class='evidence-item'>" + escapeHtml(e) + "</div>"; });
        html += "</div>";
      }
      html += "</div>";
    });
    html += "</div>";
  });

  const actions = data.action_items || [];
  if (actions.length) {
    html += "<div class='comp-section'>";
    html += "<span class='comp-section-title actions'>涓嬩竴姝ヨ鍔?/span>";
    actions.forEach(a => {
      html += "<div class='comp-item'>" + escapeHtml(a.action);
      if (a.reason) html += "<div class='reason'>" + escapeHtml(a.reason) + "</div>";
      if (a.evidence?.length) {
        html += "<div class='evidence-block'>";
        a.evidence.forEach(e => { html += "<div class='evidence-item'>" + escapeHtml(e) + "</div>"; });
        html += "</div>";
      }
      html += "</div>";
    });
    html += "</div>";
  }

  let copyText = "=== 绔炲搧瀵规瘮 ===\n\n";
  if (data.competitors?.length) {
    copyText += "绔炲搧:\n";
    data.competitors.forEach(c => { copyText += "- " + c.title + " (" + c.owner + ")\n"; });
    copyText += "\n";
  }
  sections.forEach(s => {
    const items = data[s.key] || [];
    if (items.length) { copyText += s.label + ":\n" + items.map(i => "- " + (typeof i === "string" ? i : i.insight)).join("\n") + "\n\n"; }
  });
  if (actions.length) {
    copyText += "涓嬩竴姝ヨ鍔?\n" + actions.map(a => "- " + a.action).join("\n");
  }

  html += "<button id='copyBtn' class='copy-btn'>澶嶅埗缁撴灉</button>";
  html += "<div class='comment-count'>瀵规瘮浜?" + (data.competitors?.length || 0) + " 涓珵鍝佽棰?/div>";
  results.innerHTML = html;
  results.classList.remove("hidden");
  bindCopyBtn(copyText);
  document.getElementById("upgradeBanner").classList.remove("hidden");
}

// --- History ---
function saveToHistory(structuredData, type) {
  chrome.storage.local.get("history", (data) => {
    const history = data.history || [];
    let titles;
    if (type === "analyze") {
      titles = (structuredData.problems || []).map(p => p.title);
    } else if (type === "competitor") {
      titles = (structuredData.action_items || []).map(a => a.action).slice(0, 3);
      if (!titles.length) titles = ["绔炲搧瀵规瘮"];
    } else {
      titles = (structuredData.highlights || []).map(h => h.reason).slice(0, 3);
      if (!titles.length) titles = ["寮瑰箷鍒嗘瀽"];
    }
    history.unshift({
      id: Date.now(),
      date: new Date().toLocaleString(),
      type,
      titles,
      data: structuredData,
    });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    chrome.storage.local.set({ history });
  });
}

function showHistoryView() {
  results.classList.add("hidden");
  trendArea.classList.add("hidden");
  historyArea.classList.remove("hidden");
  loadHistoryList();
}

function loadHistoryList() {
  chrome.storage.local.get("history", (data) => {
    const history = data.history || [];
    if (!history.length) {
      historyList.innerHTML = "<p style='text-align:center;color:#aaa;font-size:13px;padding:20px 0'>鏆傛棤鍘嗗彶璁板綍</p>";
      return;
    }
    let html = "";
    history.forEach((entry) => {
      html += "<div class='history-item' data-id='" + entry.id + "'>";
      html += "<div class='history-item-title'>" + escapeHtml((entry.titles || []).join(" / ")) + "</div>";
      const typeLabel = entry.type === "danmaku" ? "寮瑰箷" : entry.type === "competitor" ? "绔炲搧瀵规瘮" : "璇勮";
      html += "<div class='history-item-meta'>" + escapeHtml(entry.date) + " 路 " + typeLabel + "</div>";
      html += "</div>";
    });
    historyList.innerHTML = html;
    historyList.querySelectorAll(".history-item").forEach((el) => {
      el.addEventListener("click", () => showHistoryDetail(parseInt(el.dataset.id)));
    });
  });
}

function showHistoryDetail(id) {
  chrome.storage.local.get("history", (data) => {
    const entry = (data.history || []).find(h => h.id === id);
    if (!entry) return;
    historyArea.classList.add("hidden");
    if (entry.data) {
      if (entry.type === "danmaku") renderDanmakuReport(entry.data);
      else if (entry.type === "competitor") renderCompetitorReport(entry.data);
      else renderAnalyzeReport(entry.data);
    }
    const backLink = document.createElement("a");
    backLink.className = "history-back";
    backLink.textContent = "鈫?杩斿洖鍘嗗彶璁板綍";
    backLink.addEventListener("click", () => showHistoryView());
    results.prepend(backLink);
  });
}

historyLink.addEventListener("click", () => showHistoryView());
clearHistoryBtn.addEventListener("click", () => {
  chrome.storage.local.set({ history: [] }, () => loadHistoryList());
});

// --- Pro fake door ---
document.getElementById("upgradeBanner").addEventListener("click", () => proModal.classList.remove("hidden"));
document.getElementById("proHintLink").addEventListener("click", () => proModal.classList.remove("hidden"));
document.addEventListener("click", (e) => {
  if (e.target.id === "usageLimitUpgrade") proModal.classList.remove("hidden");
});
proClose.addEventListener("click", () => proModal.classList.add("hidden"));
proTrialBtn.addEventListener("click", async () => {
  const val = proEmail.value.trim();
  if (!val) {
    proMsg.textContent = "Please enter your email";
    proMsg.classList.remove("hidden");
    return;
  }
  proTrialBtn.disabled = true;
  proTrialBtn.textContent = "Activating...";
  try {
    const res = await fetch(WORKER_URL + "/trial/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId || "" },
      body: JSON.stringify({ email: val }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(data.error || "Failed to activate trial");
    }
    if (data.entitlements) entitlements = data.entitlements;
    await fetchEntitlements();
    proMsg.textContent = "Trial activated.";
    proMsg.style.color = "#22c55e";
    proMsg.classList.remove("hidden");
    proTrialBtn.textContent = "Activated";
    setTimeout(() => proModal.classList.add("hidden"), 1200);
  } catch (err) {
    proMsg.textContent = err.message || "Failed to activate trial";
    proMsg.style.color = "#dc2626";
    proMsg.classList.remove("hidden");
    proTrialBtn.disabled = false;
    proTrialBtn.textContent = "Try Free - " + TRIAL_DAYS + " Days / " + TRIAL_USES + " Uses";
  }
});

// --- Pro button removed, competitor btn handles gate ---

// --- Trend ---
function showTrendView() {
  results.classList.add("hidden");
  historyArea.classList.add("hidden");
  trendArea.classList.remove("hidden");
  improvementResult.classList.add("hidden");
  chrome.storage.local.get("trendCache", (data) => {
    if (data.trendCache?.length) {
      renderTrend(data.trendCache);
      updateImprovementBtn(data.trendCache);
    } else {
      trendContent.innerHTML = "<p style='text-align:center;color:#aaa;padding:20px'>鏆傛棤瓒嬪娍鏁版嵁锛屽厛鍒嗘瀽鍑犱釜瑙嗛鍚с€?/p>";
      improvementBtn.classList.add("hidden");
    }
  });
  fetchTrend();
}

trendBtn.addEventListener("click", showTrendView);

clearTrendBtn.addEventListener("click", async () => {
  chrome.storage.local.remove("trendCache");
  trendContent.innerHTML = "<p style='text-align:center;color:#aaa;padding:20px'>鏆傛棤瓒嬪娍鏁版嵁锛屽厛鍒嗘瀽鍑犱釜瑙嗛鍚с€?/p>";
  improvementBtn.classList.add("hidden");
  improvementResult.classList.add("hidden");
  if (userId) fetch(WORKER_URL + "/trend", { method: "DELETE", headers: { "X-User-Id": userId } }).catch(() => {});
});

document.getElementById("trendBackBtn").addEventListener("click", () => {
  trendArea.classList.add("hidden");
});

async function fetchTrend() {
  if (!userId) return;
  try {
    const res = await fetch(WORKER_URL + "/trend", { headers: { "X-User-Id": userId } });
    if (!res.ok) return;
    const snapshots = await res.json();
    chrome.storage.local.set({ trendCache: snapshots });
    if (snapshots.length) {
      renderTrend(snapshots);
      updateImprovementBtn(snapshots);
    }
  } catch {}
}

function dedupeSnapshots(snapshots) {
  const map = {};
  snapshots.forEach(s => {
    const key = s.bvid || s.title || JSON.stringify(s);
    if (!map[key] || (s.analyzedAt || "") > (map[key].analyzedAt || "")) map[key] = s;
  });
  return Object.values(map).sort((a, b) => (b.analyzedAt || "").localeCompare(a.analyzedAt || ""));
}

function renderTrend(snapshots) {
  const unique = dedupeSnapshots(snapshots);
  const maxProblems = Math.max(...unique.map(s => s.problemCount || 0), 1);
  let html = "";

  // 楂橀闂
  const problemFreq = {};
  unique.forEach(s => (s.problems || []).forEach(p => {
    problemFreq[p.title] = (problemFreq[p.title] || 0) + 1;
  }));
  const topProblems = Object.entries(problemFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topProblems.length) {
    html += "<div class='comp-section'><span class='comp-section-title weaknesses'>楂橀闂</span>";
    topProblems.forEach(([title, count]) => {
      html += "<div class='comp-item'>" + escapeHtml(title) + " <b>(" + count + " 涓棰?</b></div>";
    });
    html += "</div>";
  }

  // Group by uploader.
  const groups = {};
  unique.forEach(s => {
    const owner = s.owner || "Unknown uploader";
    (groups[owner] = groups[owner] || []).push(s);
  });

  Object.entries(groups).forEach(([owner, list]) => {
    html += "<div class='comp-section'><span class='comp-section-title actions'>" + escapeHtml(owner) + " (" + list.length + " 涓棰?</span>";
    list.forEach(s => {
      const label = s.title || s.bvid || "?";
      const date = s.analyzedAt ? new Date(s.analyzedAt).toLocaleDateString() : "";
      const pct = Math.round(((s.problemCount || 0) / maxProblems) * 100);
      html += "<div class='trend-bar-row'>";
      html += "<div class='trend-bar-label'>" + escapeHtml(label) + (date ? " <span class='trend-date'>" + date + "</span>" : "") + "</div>";
      html += "<div class='trend-bar-track'><div class='trend-bar-fill' style='width:" + pct + "%'></div><span class='trend-bar-num'>" + (s.problemCount || 0) + "</span></div>";
      html += "</div>";
    });
    html += "</div>";
  });

  // 楂橀鏈洖绛旈棶棰?  const uaFreq = {};
  unique.forEach(s => (s.unanswered || []).forEach(q => {
    uaFreq[q.theme] = (uaFreq[q.theme] || 0) + (q.count || 1);
  }));
  const topUA = Object.entries(uaFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topUA.length) {
    html += "<div class='comp-section'><span class='comp-section-title opportunities'>楂橀鏈洖绛旈棶棰?/span>";
    topUA.forEach(([theme, count]) => {
      html += "<div class='comp-item'>" + escapeHtml(theme) + " <b>(" + count + " 娆?</b></div>";
    });
    html += "</div>";
  }
  trendContent.innerHTML = html;
}

function updateImprovementBtn(snapshots) {
  const owners = {};
  snapshots.forEach(s => { if (s.owner) owners[s.owner] = (owners[s.owner] || 0) + 1; });
  const hasMulti = Object.values(owners).some(c => c >= 2);
  if (hasMulti) {
    improvementBtn.classList.remove("hidden");
    improvementBtn.dataset.snapshots = JSON.stringify(snapshots);
  } else {
    improvementBtn.classList.add("hidden");
    improvementResult.innerHTML = "<p style='text-align:center;color:#aaa;padding:10px;font-size:12px'>鍒嗘瀽鍚屼竴UP涓荤殑2涓互涓婅棰戝悗鍙煡鐪嬫敼杩涙儏鍐?/p>";
    improvementResult.classList.remove("hidden");
  }
}

improvementBtn.addEventListener("click", async () => {
  const snapshots = JSON.parse(improvementBtn.dataset.snapshots || "[]");
  const owners = {};
  snapshots.forEach(s => { if (s.owner) owners[s.owner] = (owners[s.owner] || 0) + 1; });
  const owner = Object.entries(owners).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!owner) return;
  const ownerSnaps = snapshots.filter(s => s.owner === owner).sort((a, b) =>
    (a.analyzedAt || "").localeCompare(b.analyzedAt || "")
  );
  const latest = ownerSnaps[ownerSnaps.length - 1];

  improvementBtn.disabled = true;
  improvementBtn.textContent = "鍒嗘瀽涓?..";
  improvementResult.innerHTML = "";
  improvementResult.classList.add("hidden");

  try {
    const res = await fetch(WORKER_URL + "/improvement", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId },
      body: JSON.stringify({ bvid: latest.bvid, owner }),
    });
    const data = await res.json();
    if (data.status === "no_history") {
      improvementResult.innerHTML = "<p style='text-align:center;color:#aaa;padding:10px;font-size:12px'>璇P涓绘殏鏃犲巻鍙插姣旀暟鎹?/p>";
    } else if (data.error) {
      improvementResult.innerHTML = "<p style='color:#dc2626;padding:10px;font-size:12px'>" + escapeHtml(data.error) + "</p>";
    } else {
      renderImprovement(data);
    }
    improvementResult.classList.remove("hidden");
  } catch {
    improvementResult.innerHTML = "<p style='color:#dc2626;padding:10px;font-size:12px'>璇锋眰澶辫触</p>";
    improvementResult.classList.remove("hidden");
  }
  improvementBtn.disabled = false;
  improvementBtn.textContent = "鏌ョ湅鏀硅繘鎯呭喌";
});

function renderImprovement(data) {
  let html = "<p style='font-size:11px;color:#aaa;margin-bottom:8px'>瀵规瘮: " + escapeHtml(data.prevTitle || "") + " 鈫?" + escapeHtml(data.currTitle || "") + "</p>";
  if (data.improved?.length) {
    html += "<div class='comp-section'><span class='comp-section-title strengths'>宸叉敼杩?/span>";
    data.improved.forEach(i => { html += "<div class='comp-item'><b>" + escapeHtml(i.old) + "</b><div class='reason'>" + escapeHtml(i.verdict) + "</div></div>"; });
    html += "</div>";
  }
  if (data.persisting?.length) {
    html += "<div class='comp-section'><span class='comp-section-title weaknesses'>浠嶅瓨鍦?/span>";
    data.persisting.forEach(i => { html += "<div class='comp-item'><b>" + escapeHtml(i.old) + "</b> 鈫?" + escapeHtml(i.new || "") + "<div class='reason'>" + escapeHtml(i.verdict) + "</div></div>"; });
    html += "</div>";
  }
  if (data.new_problems?.length) {
    html += "<div class='comp-section'><span class='comp-section-title opportunities'>鏂伴棶棰?/span>";
    data.new_problems.forEach(i => { html += "<div class='comp-item'><b>" + escapeHtml(i.new) + "</b><div class='reason'>" + escapeHtml(i.verdict) + "</div></div>"; });
    html += "</div>";
  }
  if (!data.improved?.length && !data.persisting?.length && !data.new_problems?.length) {
    html += "<p style='text-align:center;color:#aaa;padding:10px'>鏆傛棤瀵规瘮鏁版嵁</p>";
  }
  improvementResult.innerHTML = html;
}



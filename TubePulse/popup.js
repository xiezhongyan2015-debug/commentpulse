const CONFIG = window.APP_CONFIG || {};
const DEFAULT_WORKER_URL = "https://your-tubepulse-api.example.com";
const WORKER_URL = (CONFIG.API_BASE_URL || DEFAULT_WORKER_URL).replace(/\/$/, "");
const API_TIMEOUT_MS = 60000;
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
    usageText.textContent = "Pro - Unlimited analyses";
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
  competitorBtn.disabled = true;
}

document.addEventListener("click", (e) => {
  if (e.target.id === "usageLimitUpgrade") {
    proModal.classList.remove("hidden");
  }
});

const analyzeBtn = document.getElementById("analyzeBtn");
const competitorBtn = document.getElementById("competitorBtn");
const loading = document.getElementById("loading");
const loadingText = document.getElementById("loadingText");
const progressFill = document.getElementById("progressFill");
const errorDiv = document.getElementById("error");
const results = document.getElementById("results");
const videoContext = document.getElementById("videoContext");
const historyLink = document.getElementById("historyLink");
const historyArea = document.getElementById("historyArea");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const usageBar = document.getElementById("usageBar");
const usageText = document.getElementById("usageText");
const usageFill = document.getElementById("usageFill");
const usageLimitMsg = document.getElementById("usageLimitMsg");
const proModal = document.getElementById("proModal");
const proTrialBtn = document.getElementById("proTrialBtn");
const proEmail = document.getElementById("proEmail");
const proMsg = document.getElementById("proMsg");
const proClose = document.getElementById("proClose");
const proLock = document.getElementById("proLock");

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
    competitorBtn.innerHTML = "Niche Insights <span class='trial-status'>Trial - " + remaining + "/" + limit + " left</span>";
  } else {
    competitorBtn.innerHTML = "Niche Insights <span id='proLock' class='pro-badge" + (trialActive ? " hidden" : "") + "'>PRO</span>";
  }

  if (cb) cb(trialActive);
}
checkTrial();

// --- Init: restore last results from structured data ---
chrome.storage.local.get("lastResultData", (data) => {
  if (data.lastResultData) {
    const { type, data: d } = data.lastResultData;
    if (type === "analyze") renderAnalyzeReport(d);
    else if (type === "competitor") renderCompetitorReport(d);
  }
});

// --- Analyze ---
analyzeBtn.addEventListener("click", () => runAnalysis({
  btn: analyzeBtn,
  btnLabel: "Analyze Comments",
  contextPrefix: "Analyzing: ",
  buildBody: (videoId, videoInfo) => ({
    endpoint: "/analyze",
    body: {
      videoId,
      title: videoInfo.title || "",
      channel: videoInfo.channel || "",
      views: videoInfo.views || "",
      published: videoInfo.published || "",
      likes: videoInfo.likes || "",
      duration: videoInfo.duration || "",
    },
  }),
  onSuccess: (data, videoInfo) => {
    renderAnalyzeReport(data);
    chrome.storage.local.set({ lastResultData: { type: "analyze", data } });
    saveToHistory(data, "analyze", videoInfo.title);
  },
}));

function renderDataComparison(dc) {
  if (!dc) return "";
  const my = dc.my;
  const avg = dc.avg;
  function cmp(myVal, avgVal) {
    if (!avgVal) return "";
    const diff = ((myVal - avgVal) / avgVal * 100).toFixed(0);
    if (diff > 0) return "<span class='dc-up'>+" + diff + "%</span>";
    if (diff < 0) return "<span class='dc-down'>" + diff + "%</span>";
    return "<span>0%</span>";
  }
  let h = "<div class='data-comparison'>";
  h += "<div class='data-comparison-title'>Data Comparison</div>";
  h += "<table class='data-comparison-table'>";
  h += "<tr><th></th><th>Views</th><th>Like%</th><th>Reply%</th></tr>";
  h += "<tr class='my-row'><td>My Video</td>";
  h += "<td>" + my.view.toLocaleString() + "</td>";
  h += "<td>" + my.like_rate + "%</td>";
  h += "<td>" + my.reply_rate + "%</td></tr>";
  h += "<tr><td>Avg Competitor</td>";
  h += "<td>" + avg.view.toLocaleString() + "</td>";
  h += "<td>" + avg.like_rate + "%</td>";
  h += "<td>" + avg.reply_rate + "%</td></tr>";
  h += "<tr><td>Diff</td>";
  h += "<td>" + cmp(my.view, avg.view) + "</td>";
  h += "<td>" + cmp(my.like_rate, avg.like_rate) + "</td>";
  h += "<td>" + cmp(my.reply_rate, avg.reply_rate) + "</td></tr>";
  h += "</table></div>";
  return h;
}

function renderCompetitorReport(data, videoTitle) {
  let html = "";

  // Data comparison panel
  html += renderDataComparison(data.data_comparison);

  // Competitor video cards
  if (data.competitors?.length) {
    html += "<div class='comp-videos'>";
    data.competitors.forEach(c => {
      html += "<div class='comp-video-card'>";
      html += "<a class='comp-video-link' href='https://www.youtube.com/watch?v=" + c.id + "' target='_blank'>" + escapeHtml(c.title) + "</a>";
      html += "<div class='comp-video-meta'>" + escapeHtml(c.channel) + " 路 " + Number(c.views).toLocaleString() + " views 路 " + Number(c.commentCount || 0).toLocaleString() + " comments</div>";
      html += "</div>";
    });
    html += "</div>";
  }

  // Sections
  const sections = [
    { key: "my_strengths", label: "What Your Audience Loves", cls: "strengths" },
    { key: "my_weaknesses", label: "What Others Do Better", cls: "weaknesses" },
    { key: "opportunities", label: "Ideas to Try", cls: "opportunities" },
  ];
  sections.forEach(s => {
    const items = data[s.key] || [];
    if (items.length === 0) return;
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

  // Action items
  const actions = data.action_items || [];
  if (actions.length) {
    html += "<div class='comp-section'>";
    html += "<span class='comp-section-title actions'>Your Next Steps</span>";
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

  // Copy button + count
  let copyText = "=== Niche Insights ===\n\n";
  if (data.competitors?.length) {
    copyText += "Competitors:\n";
    data.competitors.forEach(c => { copyText += "- " + c.title + " (" + c.channel + ")\n"; });
    copyText += "\n";
  }
  sections.forEach(s => {
    const items = data[s.key] || [];
    if (items.length) { copyText += s.label + ":\n" + items.map(i => "- " + (typeof i === "string" ? i : i.insight)).join("\n") + "\n\n"; }
  });
  if (actions.length) {
    copyText += "Your Next Steps:\n" + actions.map(a => "- " + a.action + (a.reason ? " (" + a.reason + ")" : "")).join("\n");
  }

  html += "<button id='copyBtn' class='copy-btn'>Copy Results</button>";
  html += "<div class='comment-count'>Compared against " + (data.competitors?.length || 0) + " videos</div>";

  results.innerHTML = html;
  results.classList.remove("hidden");

  bindCopyBtn(copyText);

  document.getElementById("upgradeBanner").classList.remove("hidden");

  // Save structured data (not HTML) to prevent XSS
  chrome.storage.local.set({ lastResultData: { type: "competitor", data } });

  saveToHistory(data, "competitor", videoTitle);
}

function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.classList.remove("hidden");
  errorDiv.onclick = () => errorDiv.classList.add("hidden");
}

function hideError() {
  errorDiv.classList.add("hidden");
}

function updateProgress(percent, text) {
  progressFill.style.width = percent + "%";
  loadingText.textContent = text;
}

function bindCopyBtn(copyText) {
  const btn = document.getElementById("copyBtn");
  if (!btn) return;
  btn.onclick = () => {
    navigator.clipboard.writeText(copyText).then(() => {
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => { btn.textContent = "Copy Results"; btn.classList.remove("copied"); }, 2000);
    });
  };
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function runAnalysis({ btn, btnLabel, contextPrefix, buildBody, onSuccess }) {
  hideError();
  results.classList.add("hidden");
  analyzeBtn.disabled = true;
  competitorBtn.disabled = true;
  btn.textContent = "Analyzing...";
  loading.classList.remove("hidden");
  updateProgress(0, "Preparing...");
  let fakeInterval = null;

  try {
    updateProgress(10, "Checking current page...");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isWatch = tab.url?.includes("youtube.com/watch");
    const shortsMatch = tab.url?.match(/youtube\.com\/shorts\/([^/?]+)/);
    if (!isWatch && !shortsMatch) {
      throw new Error("Please open a YouTube video or Shorts page first.");
    }

    const videoId = shortsMatch ? shortsMatch[1] : new URL(tab.url).searchParams.get("v") || "";
    updateProgress(20, "Extracting video info...");
    let videoInfo = {};
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { action: "extractComments" });
      videoInfo = resp?.videoInfo || {};
    } catch (e) {
      console.warn("Content script not available:", e.message);
    }

    if (videoInfo.title) {
      videoContext.textContent = contextPrefix + videoInfo.title;
      videoContext.classList.remove("hidden");
    }

    const { endpoint, body } = buildBody(videoId, videoInfo);
    updateProgress(40, "Calling API...");

    let fakePercent = 40;
    fakeInterval = setInterval(() => {
      fakePercent += Math.random() * 3 + 1;
      if (fakePercent > 90) fakePercent = 90;
      const msgs = ["Analyzing comments...", "Processing data...", "Generating insights...", "Almost there..."];
      updateProgress(fakePercent, msgs[Math.min(Math.floor((fakePercent - 40) / 13), msgs.length - 1)]);
    }, 800);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const apiResponse = await fetch(WORKER_URL + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId || "" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    clearInterval(fakeInterval);

    if (!apiResponse.ok) {
      const errData = await apiResponse.json().catch(() => ({}));
      if (apiResponse.status === 403 && errData.code === "USAGE_LIMIT") {
        fetchEntitlements();
        throw new Error(errData.error);
      }
      if (apiResponse.status === 403 && errData.code === "FEATURE_LOCKED") {
        proModal.classList.remove("hidden");
        fetchEntitlements();
        throw new Error(errData.error || "This feature requires Pro.");
      }
      console.warn("API error", apiResponse.status, errData);
      throw new Error(errData.error || "Analysis failed. Please try again later.");
    }

    const data = await apiResponse.json();
    if (data.error) throw new Error("Analysis failed. Please try again later.");

    updateProgress(100, "Done!");
    onSuccess(data, videoInfo);
    fetchEntitlements();
  } catch (err) {
    showError(err.name === "AbortError" ? "Analysis timed out. Please try again." : err.message);
  } finally {
    clearInterval(fakeInterval);
    analyzeBtn.disabled = false;
    competitorBtn.disabled = false;
    btn.textContent = btnLabel;
    loading.classList.add("hidden");
    progressFill.style.width = "0%";
  }
}

function renderAnalyzeReport(parsed) {
  let html = "";
  const problems = parsed.problems || [];
  let copyText = "";
  problems.forEach((p, i) => {
    const signalCls = p.signal_strength === "strong" ? "signal-strong" : p.signal_strength === "moderate" ? "signal-moderate" : "signal-weak";
    const signalLabel = p.signal_strength || "unknown";
    html += "<div class='problem-card'>";
    html += "<span class='problem-tag'>Problem " + (i + 1) + "</span>";
    html += "<span class='signal-tag " + signalCls + "'>" + signalLabel + "</span>";
    html += "<div class='problem-title'>" + escapeHtml(p.title) + "</div>";
    html += "<div class='problem-detail'>" + escapeHtml(p.detail) + "</div>";
    html += "<span class='suggestion-tag'>Suggestion</span>";
    html += "<div class='suggestion-text'>" + escapeHtml(p.suggestion) + "</div>";
    if (p.evidence?.length) {
      html += "<div class='evidence-block'>";
      p.evidence.forEach(e => { html += "<div class='evidence-item'>" + escapeHtml(e) + "</div>"; });
      html += "</div>";
    }
    html += "</div>";
    copyText += "Problem " + (i + 1) + " [" + signalLabel + "]: " + p.title + "\n";
    copyText += p.detail + "\n";
    copyText += "Suggestion: " + p.suggestion + "\n\n";
  });

  const questions = parsed.unanswered_questions || [];
  if (questions.length) {
    html += "<div class='comp-section'>";
    html += "<span class='comp-section-title opportunities'>Unanswered Questions</span>";
    questions.forEach(q => {
      html += "<div class='comp-item'>" + escapeHtml(q.question_theme) + " (" + (q.count || "?") + " comments)";
      if (q.examples?.length) {
        html += "<div class='evidence-block'>";
        q.examples.forEach(e => { html += "<div class='evidence-item'>" + escapeHtml(e) + "</div>"; });
        html += "</div>";
      }
      html += "</div>";
    });
    html += "</div>";
    copyText += "Unanswered Questions:\n";
    questions.forEach(q => { copyText += "- " + q.question_theme + " (" + (q.count || "?") + " comments)\n"; });
    copyText += "\n";
  }

  copyText += "Analyzed via YouTube API";
  html += "<button id='copyBtn' class='copy-btn'>Copy Results</button>";
  html += "<div class='comment-count'>Analyzed via YouTube API</div>";

  results.innerHTML = html;
  results.classList.remove("hidden");
  bindCopyBtn(copyText);
  document.getElementById("upgradeBanner").classList.remove("hidden");
}

// --- History ---
function saveToHistory(structuredData, type, videoTitle) {
  chrome.storage.local.get("history", (data) => {
    const history = data.history || [];
    let titles;
    if (type === "analyze") {
      titles = (structuredData.problems || []).map(p => p.title);
    } else {
      titles = (structuredData.action_items || []).map(a => a.action).slice(0, 3);
      if (!titles.length) titles = ["Niche Insights"];
    }
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type,
      titles,
      videoTitle: videoTitle || "",
      data: structuredData,
    };
    history.unshift(entry);
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
    if (history.length === 0) {
      historyList.innerHTML = "<p style='text-align:center;color:#aaa;font-size:13px;padding:20px 0'>No history yet.</p>";
      return;
    }
    let html = "";
    history.forEach((entry) => {
      html += "<div class='history-item' data-id='" + entry.id + "'>";
      const displayTitle = entry.videoTitle || (entry.titles || entry.problems || []).join(" / ");
      html += "<div class='history-item-title'>" + escapeHtml(displayTitle) + "</div>";
      html += "<div class='history-item-meta'>" + escapeHtml(entry.date) + " 路 " + (entry.type || "analyze") + "</div>";
      html += "</div>";
    });
    historyList.innerHTML = html;
    // Bind click events
    historyList.querySelectorAll(".history-item").forEach((el) => {
      el.addEventListener("click", () => {
        const id = parseInt(el.dataset.id);
        showHistoryDetail(id);
      });
    });
  });
}

function showHistoryDetail(id) {
  chrome.storage.local.get("history", (data) => {
    const history = data.history || [];
    const entry = history.find(h => h.id === id);
    if (!entry) return;
    historyArea.classList.add("hidden");
    // Re-render from structured data instead of injecting stored HTML
    if (entry.data) {
      const type = entry.type || "analyze";
      if (type === "analyze") renderAnalyzeReport(entry.data);
      else renderCompetitorReport(entry.data);
    } else {
      results.innerHTML = "<p style='text-align:center;color:#aaa;padding:20px'>History data is outdated. Please re-analyze.</p>";
      results.classList.remove("hidden");
    }
    // Prepend back button
    const backLink = document.createElement("a");
    backLink.className = "history-back";
    backLink.textContent = "鈫?Back to History";
    backLink.addEventListener("click", () => showHistoryView());
    results.prepend(backLink);
  });
}

historyLink.addEventListener("click", () => {
  showHistoryView();
});

clearHistoryBtn.addEventListener("click", () => {
  chrome.storage.local.set({ history: [] }, () => {
    loadHistoryList();
  });
});

// --- Competitor Analysis ---
competitorBtn.addEventListener("click", () => {
  if (!entitlements?.features?.competitor) {
    proModal.classList.remove("hidden");
    return;
  }
  runAnalysis({
  btn: competitorBtn,
  btnLabel: "Niche Insights",
  contextPrefix: "Comparing: ",
  buildBody: (videoId, videoInfo) => ({
    endpoint: "/competitor",
    body: { title: videoInfo.title || "", videoId },
  }),
  onSuccess: (data, videoInfo) => {
    renderCompetitorReport(data, videoInfo.title);
  },
});
});

// --- Pro door ---
document.getElementById("upgradeBanner").addEventListener("click", () => {
  proModal.classList.remove("hidden");
});
proClose.addEventListener("click", () => {
  proModal.classList.add("hidden");
});
document.getElementById("proHintLink").addEventListener("click", () => proModal.classList.remove("hidden"));
const trendArea = document.getElementById("trendArea");
const trendContent = document.getElementById("trendContent");
const trendBtn = document.getElementById("trendBtn");
const improvementBtn = document.getElementById("improvementBtn");
const improvementResult = document.getElementById("improvementResult");
const clearTrendBtn = document.getElementById("clearTrendBtn");

// --- Pro trial activation ---
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
      headers: { "Content-Type": "application/json", "X-User-Id": userId },
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
      trendContent.innerHTML = "<p style='text-align:center;color:#aaa;padding:20px'>No trend data yet. Analyze some videos first.</p>";
      improvementBtn.classList.add("hidden");
    }
  });
  fetchTrend();
}

function hideTrendView() {
  trendArea.classList.add("hidden");
}

trendBtn.addEventListener("click", showTrendView);

clearTrendBtn.addEventListener("click", async () => {
  if (!confirm("Clear all trend data?")) return;
  chrome.storage.local.remove("trendCache");
  trendContent.innerHTML = "<p style='text-align:center;color:#aaa;padding:20px'>No trend data yet. Analyze some videos first.</p>";
  improvementBtn.classList.add("hidden");
  improvementResult.classList.add("hidden");
  if (userId) fetch(WORKER_URL + "/trend", { method: "DELETE", headers: { "X-User-Id": userId } }).catch(() => {});
});

document.getElementById("trendBackBtn").addEventListener("click", hideTrendView);

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
    const key = s.videoId || s.title || JSON.stringify(s);
    if (!map[key] || (s.analyzedAt || "") > (map[key].analyzedAt || "")) map[key] = s;
  });
  return Object.values(map).sort((a, b) => (b.analyzedAt || "").localeCompare(a.analyzedAt || ""));
}

function renderTrend(snapshots) {
  const unique = dedupeSnapshots(snapshots);
  const maxProblems = Math.max(...unique.map(s => s.problemCount || 0), 1);
  let html = "";

  const problemFreq = {};
  unique.forEach(s => (s.problems || []).forEach(p => {
    problemFreq[p.title] = (problemFreq[p.title] || 0) + 1;
  }));
  const topProblems = Object.entries(problemFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topProblems.length) {
    html += "<div class='comp-section'><span class='comp-section-title weaknesses'>Recurring Problems</span>";
    topProblems.forEach(([title, count]) => {
      html += "<div class='comp-item'>" + escapeHtml(title) + " <b>(" + count + " videos)</b></div>";
    });
    html += "</div>";
  }

  const groups = {};
  unique.forEach(s => {
    const ch = s.channel || "Unknown Channel";
    (groups[ch] = groups[ch] || []).push(s);
  });

  Object.entries(groups).forEach(([channel, list]) => {
    html += "<div class='comp-section'><span class='comp-section-title actions'>" + escapeHtml(channel) + " (" + list.length + " videos)</span>";
    list.forEach(s => {
      const label = s.title || s.videoId || "?";
      const date = s.analyzedAt ? new Date(s.analyzedAt).toLocaleDateString() : "";
      const pct = Math.round(((s.problemCount || 0) / maxProblems) * 100);
      html += "<div class='trend-bar-row'>";
      html += "<div class='trend-bar-label'>" + escapeHtml(label) + (date ? " <span class='trend-date'>" + date + "</span>" : "") + "</div>";
      html += "<div class='trend-bar-track'><div class='trend-bar-fill' style='width:" + pct + "%'></div><span class='trend-bar-num'>" + (s.problemCount || 0) + "</span></div>";
      html += "</div>";
    });
    html += "</div>";
  });

  const uaFreq = {};
  unique.forEach(s => (s.unanswered || []).forEach(q => {
    uaFreq[q.theme] = (uaFreq[q.theme] || 0) + (q.count || 1);
  }));
  const topUA = Object.entries(uaFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topUA.length) {
    html += "<div class='comp-section'><span class='comp-section-title opportunities'>Recurring Unanswered Questions</span>";
    topUA.forEach(([theme, count]) => {
      html += "<div class='comp-item'>" + escapeHtml(theme) + " <b>(" + count + " total)</b></div>";
    });
    html += "</div>";
  }

  trendContent.innerHTML = html;
}

function updateImprovementBtn(snapshots) {
  const channels = {};
  snapshots.forEach(s => { if (s.channel) channels[s.channel] = (channels[s.channel] || 0) + 1; });
  const hasMulti = Object.values(channels).some(c => c >= 2);
  if (hasMulti) {
    improvementBtn.classList.remove("hidden");
    improvementBtn.dataset.snapshots = JSON.stringify(snapshots);
  } else {
    improvementBtn.classList.add("hidden");
    improvementResult.innerHTML = "<p style='text-align:center;color:#aaa;padding:10px;font-size:12px'>Analyze 2+ videos from the same channel to unlock improvement tracking</p>";
    improvementResult.classList.remove("hidden");
  }
}

improvementBtn.addEventListener("click", async () => {
  const snapshots = JSON.parse(improvementBtn.dataset.snapshots || "[]");
  const channels = {};
  snapshots.forEach(s => { if (s.channel) channels[s.channel] = (channels[s.channel] || 0) + 1; });
  const ch = Object.entries(channels).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!ch) return;
  const chSnaps = snapshots.filter(s => s.channel === ch).sort((a, b) =>
    (a.analyzedAt || "").localeCompare(b.analyzedAt || "")
  );
  const latest = chSnaps[chSnaps.length - 1];

  improvementBtn.disabled = true;
  improvementBtn.textContent = "Checking...";
  improvementResult.innerHTML = "";
  improvementResult.classList.add("hidden");

  try {
    const res = await fetch(WORKER_URL + "/improvement", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId },
      body: JSON.stringify({ videoId: latest.videoId, channel: ch }),
    });
    const data = await res.json();
    if (data.status === "no_history") {
      improvementResult.innerHTML = "<p style='text-align:center;color:#aaa;padding:10px;font-size:12px'>No historical comparison data for this channel</p>";
    } else if (data.error) {
      improvementResult.innerHTML = "<p style='color:#dc2626;padding:10px;font-size:12px'>" + escapeHtml(data.error) + "</p>";
    } else {
      renderImprovement(data);
    }
    improvementResult.classList.remove("hidden");
  } catch {
    improvementResult.innerHTML = "<p style='color:#dc2626;padding:10px;font-size:12px'>Request failed</p>";
    improvementResult.classList.remove("hidden");
  }
  improvementBtn.disabled = false;
  improvementBtn.textContent = "Check Improvement";
});

function renderImprovement(data) {
  let html = "<p style='font-size:11px;color:#aaa;margin-bottom:8px'>Comparing: " + escapeHtml(data.prevTitle || "") + " 鈫?" + escapeHtml(data.currTitle || "") + "</p>";
  if (data.improved?.length) {
    html += "<div class='comp-section'><span class='comp-section-title strengths'>Improved</span>";
    data.improved.forEach(i => { html += "<div class='comp-item'><b>" + escapeHtml(i.old) + "</b><div class='reason'>" + escapeHtml(i.verdict) + "</div></div>"; });
    html += "</div>";
  }
  if (data.persisting?.length) {
    html += "<div class='comp-section'><span class='comp-section-title weaknesses'>Still Exists</span>";
    data.persisting.forEach(i => { html += "<div class='comp-item'><b>" + escapeHtml(i.old) + "</b> 鈫?" + escapeHtml(i.new || "") + "<div class='reason'>" + escapeHtml(i.verdict) + "</div></div>"; });
    html += "</div>";
  }
  if (data.new_problems?.length) {
    html += "<div class='comp-section'><span class='comp-section-title opportunities'>New Problems</span>";
    data.new_problems.forEach(i => { html += "<div class='comp-item'><b>" + escapeHtml(i.new) + "</b><div class='reason'>" + escapeHtml(i.verdict) + "</div></div>"; });
    html += "</div>";
  }
  if (!data.improved?.length && !data.persisting?.length && !data.new_problems?.length) {
    html += "<p style='text-align:center;color:#aaa;padding:10px'>No comparison data available</p>";
  }
  improvementResult.innerHTML = html;
}



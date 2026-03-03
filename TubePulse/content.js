function extractVideoInfo() {
  const info = {};

  // Title
  const titleEl = document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
                   document.querySelector("h1.title yt-formatted-string");
  info.title = titleEl ? titleEl.innerText.trim() : "";

  // Channel name
  const channelEl = document.querySelector("#channel-name yt-formatted-string a") ||
                    document.querySelector("ytd-channel-name yt-formatted-string a");
  info.channel = channelEl ? channelEl.innerText.trim() : "";

  // Views and publish date from info strings
  const infoStrings = document.querySelectorAll("#info-strings yt-formatted-string");
  if (infoStrings.length > 0) {
    info.views = infoStrings[0] ? infoStrings[0].innerText.trim() : "";
    info.published = infoStrings[1] ? infoStrings[1].innerText.trim() : "";
  } else {
    // Fallback: try view count from primary info renderer
    const viewEl = document.querySelector("ytd-video-primary-info-renderer .view-count");
    info.views = viewEl ? viewEl.innerText.trim() : "";
    info.published = "";
  }

  // Likes
  const likeButton = document.querySelector("like-button-view-model button");
  if (likeButton) {
    info.likes = likeButton.getAttribute("aria-label") || likeButton.innerText.trim() || "";
  } else {
    const toggleBtn = document.querySelector("ytd-menu-renderer ytd-toggle-button-renderer yt-formatted-string");
    info.likes = toggleBtn ? toggleBtn.innerText.trim() : "";
  }

  // Video duration
  const video = document.querySelector("video.html5-main-video");
  if (video && video.duration && isFinite(video.duration)) {
    const totalSec = Math.round(video.duration);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      info.duration = hrs + ":" + String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
    } else {
      info.duration = mins + ":" + String(secs).padStart(2, "0");
    }
  } else {
    info.duration = "";
  }

  return info;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractComments") {
    const videoInfo = extractVideoInfo();
    sendResponse({ videoInfo });
  }
  return true;
});

function parseLikeCount(str) {
  if (!str) return 0;
  if (str.includes('万')) return Math.round(parseFloat(str) * 10000);
  return parseInt(str) || 0;
}

function extractComments() {
  const comments = [];
  const seen = new Set();

  // B站使用 Web Components + 多层 Shadow DOM
  // bili-comments -> shadowRoot -> bili-comment-thread-renderer
  const commentsRoot = document.querySelector('bili-comments')?.shadowRoot;
  if (!commentsRoot) return comments;
  const threads = commentsRoot.querySelectorAll('bili-comment-thread-renderer');
  for (const thread of threads) {
    const tsr = thread.shadowRoot;
    if (!tsr) continue;

    // 主评论
    const renderer = tsr.querySelector('bili-comment-renderer');
    if (renderer) {
      const c = readComment(renderer);
      if (c && !seen.has(c.text)) {
        seen.add(c.text);
        comments.push(c);
      }
    }

    // 子回复
    const replies = tsr.querySelectorAll('#replies bili-comment-renderer');
    for (const r of replies) {
      const c = readComment(r);
      if (c && !seen.has(c.text)) {
        seen.add(c.text);
        comments.push(c);
      }
    }

    if (comments.length >= 200) break;
  }

  return comments;
}

function readComment(renderer) {
  const sr = renderer.shadowRoot;
  if (!sr) return null;

  // 文字: #content bili-rich-text -> shadowRoot -> #contents
  const richText = sr.querySelector('bili-rich-text');
  const text = richText?.shadowRoot?.querySelector('#contents')?.textContent?.trim();
  if (!text) return null;

  // 点赞数: 在 #footer 里找数字
  let likes = 0;
  const footer = sr.querySelector('#footer');
  if (footer) {
    // 尝试多种可能的选择器
    const likeBtn = footer.querySelector('bili-comment-action-buttons-renderer');
    const likeSr = likeBtn?.shadowRoot;
    if (likeSr) {
      const span = likeSr.querySelector('#like-button span, .like-count, [id*="like"] span');
      likes = parseLikeCount(span?.textContent?.trim());
    }
    if (!likes) {
      // fallback: 从footer文本中提取第一个数字
      const m = footer.textContent?.match(/(\d[\d.]*万?)/);
      if (m) likes = parseLikeCount(m[1]);
    }
  }

  return { text, likes };
}

function extractVideoInfo() {
  const info = {};
  const bvMatch = location.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  info.bvid = bvMatch ? bvMatch[1] : '';
  info.title = document.querySelector('h1')?.textContent?.trim() || '';
  info.owner = document.querySelector('.up-name, .up-info-container a')?.textContent?.trim() || '';
  info.view = document.querySelector('.view-text, .video-data-list span')?.textContent?.trim() || '';
  info.like = document.querySelector('.video-like-info, .video-toolbar-left .video-like span')?.textContent?.trim() || '';
  info.coin = document.querySelector('.video-coin-info, .video-toolbar-left .video-coin span')?.textContent?.trim() || '';
  info.fav = document.querySelector('.video-fav-info, .video-toolbar-left .video-fav span')?.textContent?.trim() || '';

  const video = document.querySelector('video');
  if (video && video.duration && isFinite(video.duration)) {
    const t = Math.round(video.duration);
    const m = Math.floor(t / 60), s = t % 60;
    info.duration = m + ':' + String(s).padStart(2, '0');
  } else {
    info.duration = '';
  }
  return info;
}

async function getCid() {
  // 方法1: 从URL提取bvid，调B站API获取cid
  const bvMatch = location.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  if (bvMatch) {
    try {
      const res = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvMatch[1]);
      const data = await res.json();
      if (data.data?.cid) return data.data.cid;
    } catch {}
  }
  // 方法2: 从页面脚本中查找
  for (const s of document.querySelectorAll('script')) {
    const m = s.textContent?.match(/"cid"\s*:\s*(\d+)/);
    if (m) return m[1];
  }
  return null;
}

function aggregateByTimeSegment(danmaku, segSec) {
  const map = {};
  for (const d of danmaku) {
    const seg = Math.floor(d.time / segSec) * segSec;
    if (!map[seg]) map[seg] = {};
    const key = d.text.length > 2 ? d.text.slice(0, 3) : d.text;
    if (!map[seg][key]) map[seg][key] = { text: d.text, count: 0 };
    map[seg][key].count++;
  }
  return Object.entries(map).map(([time, groups]) => ({
    time: Number(time),
    density: Object.values(groups).reduce((s, g) => s + g.count, 0),
    top: Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 5),
  })).sort((a, b) => a.time - b.time);
}

async function extractDanmaku() {
  const cid = await getCid();
  if (!cid) return { segments: [], total: 0 };

  const res = await fetch('https://comment.bilibili.com/' + cid + '.xml');
  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');
  const ds = xml.querySelectorAll('d');

  const raw = Array.from(ds).map(d => {
    const attrs = d.getAttribute('p').split(',');
    return { time: parseFloat(attrs[0]), text: d.textContent };
  });

  return { segments: aggregateByTimeSegment(raw, 30), total: raw.length };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractComments') {
    sendResponse({ comments: extractComments(), videoInfo: extractVideoInfo() });
  }
  if (message.action === 'extractDanmaku') {
    extractDanmaku().then(data => sendResponse(data));
    return true;
  }
});

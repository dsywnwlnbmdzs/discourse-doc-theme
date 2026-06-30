import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.34.0", (api) => {
  const excerptCache = new Map();

  function topicLookup() {
    try {
      const holder = document.querySelector("#data-preloaded");
      if (!holder?.dataset?.preloaded) {
        return {};
      }

      const preloaded = JSON.parse(holder.dataset.preloaded);
      const payload = JSON.parse(preloaded.topic_list || "{}");
      const topics = {};

      for (const topic of payload.topic_list?.topics || []) {
        topics[topic.id] = {
          replyCount: topic.reply_count ?? 0,
          views: topic.views ?? 0,
          lastPosterUsername: topic.last_poster_username || "",
          creatorUsername: topic.creator_username || "",
          bumpedAt: topic.bumped_at || topic.last_posted_at || topic.created_at || "",
          createdAt: topic.created_at || "",
        };
      }

      return topics;
    } catch (_e) {
      return {};
    }
  }

  function englishRelativeTime(input) {
    const timestamp = Number(input);
    const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date(input);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
    const units = [
      ["year", 31536000],
      ["month", 2592000],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
      ["second", 1],
    ];

    for (const [unit, value] of units) {
      const amount = Math.floor(seconds / value);
      if (amount >= 1) {
        return `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
      }
    }

    return "1 second ago";
  }

  function applyEnglishRelativeDates(root = document) {
    root.querySelectorAll(".relative-date[data-time]").forEach((node) => {
      const value = englishRelativeTime(node.dataset.time);
      if (value && node.textContent !== value) {
        node.textContent = value;
        node.dataset.gfEnglishTimeApplied = "true";
      }
    });
  }

  function avatarLinks(posters) {
    return Array.from(posters.querySelectorAll("a")).filter((link) =>
      link.querySelector("img.avatar")
    );
  }

  function cloneAvatarLink(sourceLink, className, size) {
    if (!sourceLink) {
      return null;
    }

    const clone = sourceLink.cloneNode(true);
    clone.classList.add(className);
    clone.removeAttribute("tabindex");

    const avatar = clone.querySelector("img.avatar");
    if (avatar) {
      avatar.width = size;
      avatar.height = size;
      avatar.classList.remove("latest");
    }

    return clone;
  }

  function cellNumber(row, selector) {
    return row.querySelector(`${selector} .number`)?.textContent?.trim() || "0";
  }

  function categoryColorFrom(root) {
    const wrapper = root?.querySelector?.(".badge-category__wrapper");
    const badge = wrapper?.querySelector?.(".badge-category");

    return (
      wrapper?.style?.getPropertyValue("--category-badge-color") ||
      badge?.style?.getPropertyValue("--category-badge-color") ||
      badge?.style?.getPropertyValue("--gf-marker-color") ||
      ""
    ).trim();
  }

  function findOriginalPosterLink(links) {
    return (
      links.find((link) =>
        link.querySelector("img.avatar")?.title?.includes("原始发帖人")
      ) || links[0]
    );
  }

  function findLatestPosterLink(links, fallback) {
    return links.find((link) => link.classList.contains("latest")) || fallback;
  }

  function buildStatBox(name, value, label) {
    const item = document.createElement("div");
    item.className = `gf-stat-box gf-stat-${name}`;

    const number = document.createElement("span");
    number.className = "gf-stat-number";
    number.textContent = value;

    const text = document.createElement("span");
    text.className = "gf-stat-label";
    text.textContent = label;

    item.append(number, text);
    return item;
  }

  function buildDesktopStats(row) {
    const stats = document.createElement("div");
    stats.className = "gf-desktop-stats";
    stats.append(
      buildStatBox("posts", cellNumber(row, "td.posts"), "POSTS"),
      buildStatBox("views", cellNumber(row, "td.views"), "VIEWS")
    );
    return stats;
  }

  function plainTextFromCooked(cooked) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = cooked || "";
    return (wrapper.textContent || "").replace(/\s+/g, " ").trim();
  }

  function excerptJsonUrl(link) {
    if (!link) {
      return null;
    }

    const href = link.getAttribute("href") || "";
    if (!href || href === "#") {
      return null;
    }

    return href.endsWith(".json") ? href : `${href}.json`;
  }

  async function loadLastReplyExcerpt(row, excerptNode, activityLink) {
    const url = excerptJsonUrl(activityLink);
    if (!url || excerptNode.dataset.gfExcerptLoading === "true") {
      return;
    }

    if (excerptCache.has(url)) {
      excerptNode.textContent = excerptCache.get(url);
      excerptNode.dataset.gfExcerptLoaded = "true";
      return;
    }

    excerptNode.dataset.gfExcerptLoading = "true";

    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const posts = data?.post_stream?.posts || [];
      const lastPost = posts[posts.length - 1];
      const excerpt = plainTextFromCooked(lastPost?.cooked).slice(0, 80);

      if (excerpt) {
        excerptCache.set(url, excerpt);
        excerptNode.textContent = excerpt;
        excerptNode.dataset.gfExcerptLoaded = "true";
      }
    } catch (_e) {
      // Keep the latest area usable even if the excerpt endpoint is unavailable.
    } finally {
      delete excerptNode.dataset.gfExcerptLoading;
    }
  }

  function buildLatest(row, latestAvatar, hasReplies) {
    const latest = document.createElement("div");
    latest.className = hasReplies
      ? "gf-last-post-summary"
      : "gf-last-post-summary gf-no-reply-summary";

    if (!hasReplies) {
      const noReply = document.createElement("div");
      noReply.className = "gf-no-reply";
      noReply.textContent = "No one has replied";
      latest.append(noReply);
      return latest;
    }

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "gf-last-avatar-inline";
    avatarWrap.append(latestAvatar);

    const head = document.createElement("div");
    head.className = "gf-last-reply-head";
    head.append(avatarWrap);

    const activityLink = row.querySelector("td.activity .post-activity")?.cloneNode(true);
    if (activityLink) {
      activityLink.classList.add("gf-last-date");
      applyEnglishRelativeDates(activityLink);
      head.append(activityLink);
    }

    const excerpt = document.createElement("div");
    excerpt.className = "gf-last-reply-excerpt";

    latest.append(head, excerpt);

    if (activityLink) {
      requestAnimationFrame(() => loadLastReplyExcerpt(row, excerpt, activityLink));
    }

    return latest;
  }

  function buildSharedLeftBlock(mainLink, titleLine, bottomLine, opAvatarLink) {
    const avatar = document.createElement("div");
    avatar.className = "pull-left gf-op-avatar";
    avatar.append(opAvatarLink);

    const metadata = document.createElement("div");
    metadata.className = "topic-item-metadata right gf-topic-copy";

    const title = document.createElement("div");
    title.className = "main-link gf-topic-title";
    title.append(titleLine);
    metadata.append(title);

    if (bottomLine) {
      bottomLine.classList.add("topic-item-stats", "clearfix", "gf-topic-meta");
      metadata.append(bottomLine);
    }

    const left = document.createElement("div");
    left.className = "gf-topic-left";
    left.append(avatar, metadata);

    mainLink.classList.add("gf-topic-cell");
    return left;
  }

  function decorateDesktopRow(row) {
    const mainLink = row.querySelector("td.main-link");
    const posters = row.querySelector("td.posters");
    const titleLine = mainLink?.querySelector(".link-top-line");

    if (!mainLink || !posters || !titleLine || mainLink.querySelector(".gf-topic-row")) {
      return;
    }

    const links = avatarLinks(posters);
    if (!links.length) {
      return;
    }

    const originalPoster = findOriginalPosterLink(links);
    const latestPoster = findLatestPosterLink(links, originalPoster);
    const opAvatarLink = cloneAvatarLink(originalPoster, "gf-op-avatar-link", 40);
    const latestAvatarLink = cloneAvatarLink(latestPoster, "gf-last-avatar-link", 24);

    if (!opAvatarLink || !latestAvatarLink) {
      return;
    }

    const postsCount = Number.parseInt(cellNumber(row, "td.posts"), 10) || 0;
    const bottomLine = mainLink.querySelector(".link-bottom-line");
    const categoryColor = categoryColorFrom(bottomLine || mainLink);

    const rowLayout = document.createElement("div");
    rowLayout.className = "gf-topic-row";
    if (categoryColor) {
      rowLayout.style.setProperty("--gf-topic-category-color", categoryColor);
    }
    rowLayout.append(
      buildSharedLeftBlock(mainLink, titleLine, bottomLine, opAvatarLink),
      buildDesktopStats(row),
      buildLatest(row, latestAvatarLink, postsCount > 0)
    );

    mainLink.colSpan = 5;
    mainLink.append(rowLayout);
    row.classList.add("gf-topic-list-v2-row");
  }

  function decorateDesktopRows() {
    if (document.documentElement.classList.contains("mobile-view")) {
      return;
    }

    document.querySelectorAll("tr.topic-list-item").forEach(decorateDesktopRow);
  }

  function setIfChanged(node, prop, value) {
    if (node[prop] !== value) {
      node[prop] = value;
    }
  }

  function setAttributeIfChanged(node, name, value) {
    if (node.getAttribute(name) !== value) {
      node.setAttribute(name, value);
    }
  }

  function ensureMobileRepliesBadge(pullRight) {
    let repliesBadge = pullRight.querySelector(".gf-mobile-replies-badge");
    if (!repliesBadge) {
      repliesBadge = document.createElement("span");
      repliesBadge.className = "gf-mobile-replies-badge";
      pullRight.prepend(repliesBadge);
    }
    return repliesBadge;
  }

  function ensureMobileViewsBadge(pullRight) {
    let viewsBadge = pullRight.querySelector(".gf-mobile-views-badge");
    if (!viewsBadge) {
      viewsBadge = document.createElement("span");
      viewsBadge.className = "gf-mobile-views-badge";
      pullRight.append(viewsBadge);
    }
    return viewsBadge;
  }

  function updateBadge(badge, value, title) {
    const text = String(value ?? "");

    if (badge.dataset.gfBadgeValue === text) {
      return;
    }

    badge.dataset.gfBadgeValue = text;
    setIfChanged(badge, "textContent", text);
    setIfChanged(badge, "title", title);
    setAttributeIfChanged(badge, "aria-label", title);
  }

  function hasUserReply(topic) {
    if (!topic) {
      return false;
    }

    const creator = (topic.creatorUsername || "").toLowerCase();
    const latest = (topic.lastPosterUsername || "").toLowerCase();

    if (latest && creator && latest !== creator) {
      return true;
    }

    return Number(topic.replyCount || 0) > 0;
  }

  function mobileMetaIconHtml(hasReply) {
    const icon = hasReply ? "reply" : "far-pen-to-square";
    return `<svg class="fa d-icon d-icon-${icon} svg-icon svg-string" width="1em" height="1em" aria-hidden="true"><use href="#${icon}"></use></svg>`;
  }

  function ensureMobileMetaStatus(stats, activity) {
    let status = stats.querySelector(":scope > .gf-mobile-meta-status");

    if (!status) {
      status = document.createElement("span");
      status.className = "gf-mobile-meta-status";
      status.innerHTML = `
        <span class="gf-mobile-action-icon" aria-hidden="true"></span>
        <span class="gf-mobile-meta-author"></span>
        <span class="gf-mobile-meta-state"></span>
      `;
      stats.insertBefore(status, activity || null);
    } else if (activity && status.nextElementSibling !== activity) {
      stats.insertBefore(status, activity);
    }

    return status;
  }

  function decorateMobileMetadata(row, topic) {
    const stats = row.querySelector(".topic-item-metadata.right > .topic-item-stats");
    if (!stats || !topic) {
      return;
    }

    const category = stats.querySelector(":scope > .topic-item-stats__category-tags");
    let activity = stats.querySelector(":scope > .activity");

    if (!activity) {
      activity = document.createElement("span");
      activity.className = "activity gf-mobile-meta-time";
      stats.append(activity);
    }

    activity.classList.add("gf-mobile-meta-time");

    if (category && stats.firstElementChild !== category) {
      stats.insertBefore(category, stats.firstElementChild);
    }

    const hasReply = hasUserReply(topic);
    const username = hasReply
      ? topic.lastPosterUsername || topic.creatorUsername || ""
      : topic.creatorUsername || topic.lastPosterUsername || "";
    const stateText = hasReply ? "Replied" : "Started";
    const timeSource = hasReply ? topic.bumpedAt : topic.createdAt;
    const timeText = englishRelativeTime(timeSource);

    const status = ensureMobileMetaStatus(stats, activity);
    const icon = status.querySelector(".gf-mobile-action-icon");
    const author = status.querySelector(".gf-mobile-meta-author");
    const state = status.querySelector(".gf-mobile-meta-state");

    status.classList.toggle("gf-mobile-meta-replied", hasReply);
    status.classList.toggle("gf-mobile-meta-started", !hasReply);

    if (status.dataset.gfMetaState !== stateText) {
      status.dataset.gfMetaState = stateText;
      icon.innerHTML = mobileMetaIconHtml(hasReply);
      state.textContent = stateText;
    }

    if (author.textContent !== username) {
      author.textContent = username;
    }

    if (activity.textContent !== timeText) {
      activity.textContent = timeText;
    }

    setAttributeIfChanged(activity, "aria-label", hasReply ? "最后回复时间" : "发帖时间");
  }

  function decorateMobileStats() {
    if (!document.documentElement.classList.contains("mobile-view")) {
      document.querySelectorAll(".gf-mobile-replies-badge, .gf-mobile-views-badge").forEach((node) => node.remove());
      return;
    }

    const topics = topicLookup();

    document
      .querySelectorAll(".topic-list tbody.topic-list-body > tr.topic-list-item")
      .forEach((row) => {
        const topicId = Number.parseInt(row.dataset.topicId || "0", 10);
        const topic = topics[topicId] || {};
        const pullRight = row.querySelector(".pull-right");

        decorateMobileMetadata(row, topic);

        if (!pullRight) {
          return;
        }

        const replies = row.querySelector(".pull-right .badge-posts .number")?.textContent?.trim() || topic.replyCount || "0";
        updateBadge(ensureMobileRepliesBadge(pullRight), replies, `回复数：${replies}`);
        updateBadge(ensureMobileViewsBadge(pullRight), topic.views ?? "", `浏览数：${topic.views ?? ""}`);
      });
  }

  let syncQueued = false;

  function syncTopicRows() {
    syncQueued = false;
    decorateDesktopRows();
    decorateMobileStats();
    applyEnglishRelativeDates();
  }

  function scheduleSyncTopicRows(delay = 0) {
    if (syncQueued) {
      return;
    }

    syncQueued = true;

    if (delay > 0) {
      setTimeout(syncTopicRows, delay);
    } else {
      requestAnimationFrame(syncTopicRows);
    }
  }

  api.onPageChange(() => {
    scheduleSyncTopicRows();
    scheduleSyncTopicRows(250);
  });

  const observer = new MutationObserver(() => {
    scheduleSyncTopicRows();
  });

  api.onPageChange(() => {
    const listArea = document.querySelector("#list-area");
    if (listArea && !listArea.dataset.gracefulAvatarObserver) {
      listArea.dataset.gracefulAvatarObserver = "true";
      observer.observe(listArea, { childList: true, subtree: true });
    }
  });
});

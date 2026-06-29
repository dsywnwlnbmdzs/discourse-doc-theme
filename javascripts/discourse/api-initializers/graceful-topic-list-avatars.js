import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.34.0", (api) => {
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

  function buildDesktopStats(row) {
    const stats = document.createElement("div");
    stats.className = "gf-desktop-stats";

    [
      ["posts", cellNumber(row, "td.posts"), "POSTS"],
      ["views", cellNumber(row, "td.views"), "VIEWS"],
    ].forEach(([name, value, label]) => {
      const item = document.createElement("div");
      item.className = `gf-stat-box gf-stat-${name}`;

      const number = document.createElement("span");
      number.className = "gf-stat-number";
      number.textContent = value;

      const text = document.createElement("span");
      text.className = "gf-stat-label";
      text.textContent = label;

      item.append(number, text);
      stats.append(item);
    });

    return stats;
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

    const copy = document.createElement("div");
    copy.className = "gf-last-reply-copy";

    const head = document.createElement("div");
    head.className = "gf-last-reply-head";

    const activityLink = row.querySelector("td.activity .post-activity")?.cloneNode(true);
    if (activityLink) {
      activityLink.classList.add("gf-last-date");
      head.append(activityLink);
    }

    const excerpt = document.createElement("div");
    excerpt.className = "gf-last-reply-excerpt";

    copy.append(head, excerpt);
    latest.append(avatarWrap, copy);

    return latest;
  }

  function buildMobileLikeLeftBlock(mainLink, titleLine, bottomLine, opAvatarLink) {
    const avatar = document.createElement("div");
    avatar.className = "pull-left gf-op-avatar";
    avatar.append(opAvatarLink);

    const metadata = document.createElement("div");
    metadata.className = "topic-item-metadata right gf-topic-copy";

    const mobileTitle = document.createElement("div");
    mobileTitle.className = "main-link gf-topic-title";
    mobileTitle.append(titleLine);
    metadata.append(mobileTitle);

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

  function decorateDesktopTopicRow(row) {
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

    const originalPoster =
      links.find((link) =>
        link.querySelector("img.avatar")?.title?.includes("原始发帖人")
      ) || links[0];

    const latestPoster = links.find((link) => link.classList.contains("latest")) || originalPoster;

    const opAvatarLink = cloneAvatarLink(originalPoster, "gf-op-avatar-link", 40);
    const latestAvatarLink = cloneAvatarLink(latestPoster, "gf-last-avatar-link", 24);

    if (!opAvatarLink || !latestAvatarLink) {
      return;
    }

    const postsCount = Number.parseInt(cellNumber(row, "td.posts"), 10) || 0;
    const hasReplies = postsCount > 0;
    const bottomLine = mainLink.querySelector(".link-bottom-line");

    const left = buildMobileLikeLeftBlock(mainLink, titleLine, bottomLine, opAvatarLink);
    const desktopStats = buildDesktopStats(row);
    const latest = buildLatest(row, latestAvatarLink, hasReplies);

    const rowLayout = document.createElement("div");
    rowLayout.className = "gf-topic-row";
    rowLayout.append(left, desktopStats, latest);

    mainLink.colSpan = 5;
    mainLink.append(rowLayout);
    row.classList.add("gf-topic-list-v2-row");
  }

  function patchMobileStats() {
    if (!document.documentElement.classList.contains("mobile-view")) {
      document.querySelectorAll(".gf-mobile-views-badge").forEach((node) => node.remove());
      return;
    }

    const topics = topicLookup();

    document
      .querySelectorAll(".topic-list tbody.topic-list-body > tr.topic-list-item")
      .forEach((row) => {
        const topicId = Number.parseInt(row.dataset.topicId || "0", 10);
        const topic = topics[topicId] || {};
        const pullRight = row.querySelector(".pull-right");

        if (!pullRight) {
          return;
        }

        let viewsBadge = pullRight.querySelector(".gf-mobile-views-badge");
        if (!viewsBadge) {
          viewsBadge = document.createElement("span");
          viewsBadge.className = "gf-mobile-views-badge";
          pullRight.append(viewsBadge);
        }

        const views = topic.views ?? "";
        viewsBadge.textContent = String(views);
        viewsBadge.title = `浏览数：${views}`;
        viewsBadge.setAttribute("aria-label", `浏览数：${views}`);
      });
  }

  function decorateDesktopTopicRows() {
    if (document.documentElement.classList.contains("mobile-view")) {
      return;
    }

    document.querySelectorAll("tr.topic-list-item").forEach(decorateDesktopTopicRow);
  }

  function syncTopicRows() {
    decorateDesktopTopicRows();
    patchMobileStats();
  }

  api.onPageChange(() => {
    requestAnimationFrame(syncTopicRows);
    setTimeout(syncTopicRows, 250);
  });

  const observer = new MutationObserver(() => {
    requestAnimationFrame(syncTopicRows);
  });

  api.onPageChange(() => {
    const listArea = document.querySelector("#list-area");
    if (listArea && !listArea.dataset.gracefulAvatarObserver) {
      listArea.dataset.gracefulAvatarObserver = "true";
      observer.observe(listArea, { childList: true, subtree: true });
    }
  });
});

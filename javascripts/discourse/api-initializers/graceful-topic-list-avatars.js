import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.34.0", (api) => {
  const AVATAR_SIZE = 40;

  function avatarLinks(posters) {
    return Array.from(posters.querySelectorAll("a")).filter((link) =>
      link.querySelector("img.avatar")
    );
  }

  function cloneAvatarLink(sourceLink, className, size = AVATAR_SIZE) {
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

  function buildStats(row) {
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

  function decorateTopicRow(row) {
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

    const avatar = document.createElement("div");
    avatar.className = "gf-op-avatar";
    avatar.append(opAvatarLink);

    const copy = document.createElement("div");
    copy.className = "gf-topic-copy";

    const title = document.createElement("div");
    title.className = "gf-topic-title";
    title.append(titleLine);
    copy.append(title);

    if (bottomLine) {
      bottomLine.classList.add("gf-topic-meta");
      copy.append(bottomLine);
    }

    const stats = buildStats(row);
    const latest = buildLatest(row, latestAvatarLink, hasReplies);

    const rowLayout = document.createElement("div");
    rowLayout.className = "gf-topic-row";
    rowLayout.append(avatar, copy, stats, latest);

    mainLink.classList.add("gf-topic-cell");
    mainLink.colSpan = 5;
    mainLink.append(rowLayout);
    row.classList.add("gf-topic-list-v2-row");
  }

  function decorateTopicRows() {
    document.querySelectorAll("tr.topic-list-item").forEach(decorateTopicRow);
  }

  api.onPageChange(() => {
    requestAnimationFrame(decorateTopicRows);
    setTimeout(decorateTopicRows, 250);
  });

  const observer = new MutationObserver(() => {
    requestAnimationFrame(decorateTopicRows);
  });

  api.onPageChange(() => {
    const listArea = document.querySelector("#list-area");
    if (listArea && !listArea.dataset.gracefulAvatarObserver) {
      listArea.dataset.gracefulAvatarObserver = "true";
      observer.observe(listArea, { childList: true, subtree: true });
    }
  });
});

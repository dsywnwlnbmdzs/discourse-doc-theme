import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.34.0", (api) => {
  const AVATAR_SIZE = 40;

  function avatarLinks(posters) {
    return Array.from(posters.querySelectorAll("a")).filter((link) =>
      link.querySelector("img.avatar")
    );
  }

  function cloneAvatarLink(sourceLink, className) {
    if (!sourceLink) {
      return null;
    }

    const clone = sourceLink.cloneNode(true);
    clone.classList.add(className);
    clone.classList.add("graceful-topic-list-avatar-link");
    clone.removeAttribute("tabindex");

    const avatar = clone.querySelector("img.avatar");
    if (avatar) {
      avatar.width = AVATAR_SIZE;
      avatar.height = AVATAR_SIZE;
      avatar.classList.add("graceful-topic-list-avatar-image");
      avatar.classList.remove("latest");
    }

    return clone;
  }

  function cellNumber(row, selector) {
    return row.querySelector(`${selector} .number`)?.textContent?.trim() || "0";
  }

  function buildStats(row) {
    const stats = document.createElement("div");
    stats.className = "graceful-topic-list-stats";

    [
      ["posts", cellNumber(row, "td.posts"), "POSTS"],
      ["views", cellNumber(row, "td.views"), "VIEWS"],
    ].forEach(([name, value, label]) => {
      const item = document.createElement("div");
      item.className = `graceful-topic-list-stat graceful-topic-list-stat-${name}`;

      const number = document.createElement("div");
      number.className = "graceful-topic-list-stat-number";
      number.textContent = value;

      const text = document.createElement("div");
      text.className = "graceful-topic-list-stat-label";
      text.textContent = label;

      item.append(number, text);
      stats.append(item);
    });

    return stats;
  }

  function buildLatest(row, latestAvatar, hasReplies) {
    const latest = document.createElement("div");
    latest.className = "graceful-topic-list-latest";

    const latestMeta = document.createElement("div");
    latestMeta.className = "graceful-topic-list-latest-meta";

    const activityDate = row.querySelector("td.activity .relative-date")?.cloneNode(true);
    const time = document.createElement("div");
    time.className = "graceful-topic-list-latest-time";

    if (hasReplies && activityDate) {
      time.append(activityDate);
    } else {
      time.textContent = "No one has replied";
    }

    const summary = document.createElement("div");
    summary.className = "graceful-topic-list-latest-summary";
    summary.setAttribute("aria-hidden", "true");

    latestMeta.append(time, summary);
    latest.append(latestAvatar, latestMeta);

    return latest;
  }

  function decorateTopicRow(row) {
    const mainLink = row.querySelector("td.main-link");
    const posters = row.querySelector("td.posters");
    const titleLine = mainLink?.querySelector(".link-top-line");

    if (!mainLink || !posters || !titleLine) {
      return;
    }

    const links = avatarLinks(posters);
    if (!links.length) {
      return;
    }

    mainLink.querySelector(".graceful-topic-list-layout")?.remove();

    const originalPoster =
      links.find((link) =>
        link.querySelector("img.avatar")?.title?.includes("原始发帖人")
      ) || links[0];

    const latestPoster = links.find((link) => link.classList.contains("latest")) || originalPoster;

    const leftAvatar = cloneAvatarLink(originalPoster, "graceful-topic-list-avatar-left");
    const latestAvatar = cloneAvatarLink(latestPoster, "graceful-topic-list-avatar-right");

    if (!leftAvatar || !latestAvatar) {
      return;
    }

    const postsCount = Number.parseInt(cellNumber(row, "td.posts"), 10) || 0;
    const hasReplies = postsCount > 0;
    const bottomLine = mainLink.querySelector(".link-bottom-line");

    const content = document.createElement("div");
    content.className = "graceful-topic-list-content";

    const stats = buildStats(row);
    const latest = buildLatest(row, latestAvatar, hasReplies);

    const layout = document.createElement("div");
    layout.className = "graceful-topic-list-layout";

    mainLink.colSpan = 5;
    titleLine.parentNode.insertBefore(layout, titleLine);
    content.append(titleLine);

    if (bottomLine) {
      content.append(bottomLine);
    }

    layout.append(leftAvatar, content, stats, latest);
    row.classList.add("graceful-topic-list-v2-row");
  }

  function decorateTopicRows() {
    document
      .querySelectorAll("tr.topic-list-item")
      .forEach((row) => decorateTopicRow(row));
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

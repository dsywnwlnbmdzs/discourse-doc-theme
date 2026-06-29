import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.34.0", (api) => {
  const AVATAR_SIZE = 40;

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
    }

    return clone;
  }

  function decorateTopicRow(row) {
    const mainLink = row.querySelector("td.main-link");
    const posters = row.querySelector("td.posters");
    const titleLine = mainLink?.querySelector(".link-top-line");

    if (!mainLink || !posters || !titleLine) {
      return;
    }

    const posterLinks = Array.from(posters.querySelectorAll("a:has(img.avatar)"));
    if (!posterLinks.length) {
      return;
    }

    mainLink.querySelector(".graceful-topic-list-layout")?.remove();

    const originalPoster =
      posterLinks.find((link) =>
        link.querySelector("img.avatar")?.title?.includes("原始发帖人")
      ) || posterLinks[0];

    const latestPoster = posters.querySelector("a.latest:has(img.avatar)") || originalPoster;

    const leftAvatar = cloneAvatarLink(originalPoster, "graceful-topic-list-avatar-left");
    const rightAvatar = cloneAvatarLink(latestPoster, "graceful-topic-list-avatar-right");

    if (!leftAvatar || !rightAvatar) {
      return;
    }

    const bottomLine = mainLink.querySelector(".link-bottom-line");
    const content = document.createElement("div");
    content.className = "graceful-topic-list-content";

    const layout = document.createElement("div");
    layout.className = "graceful-topic-list-layout";

    titleLine.parentNode.insertBefore(layout, titleLine);
    content.append(titleLine);

    if (bottomLine) {
      content.append(bottomLine);
    }

    layout.append(leftAvatar, content, rightAvatar);
    row.classList.add("graceful-topic-list-avatar-row");
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

import { apiInitializer } from "discourse/lib/api";

const COLOR_SYNC_KEY = "__gracefulTopicColorSyncCleanup";

function syncDesktopLatestReplyMarkerColor() {
  if (document.documentElement.classList.contains("mobile-view")) {
    return;
  }

  document
    .querySelectorAll(".topic-list tbody.topic-list-body > tr.topic-list-item")
    .forEach((row) => {
      const category = row.querySelector(".gf-meta-category");
      const summary = row.querySelector(".gf-last-post-summary");

      if (!category || !summary) {
        return;
      }

      const color = getComputedStyle(category)
        .getPropertyValue("--gf-category-native-color")
        .trim();

      if (color) {
        summary.style.setProperty("--gf-category-native-color", color);
      }
    });
}

export default apiInitializer((api) => {
  globalThis[COLOR_SYNC_KEY]?.();

  let timer = null;
  let frame = null;

  const scheduleSync = () => {
    clearTimeout(timer);

    if (frame) {
      cancelAnimationFrame(frame);
      frame = null;
    }

    timer = setTimeout(() => {
      frame = requestAnimationFrame(() => {
        frame = null;
        syncDesktopLatestReplyMarkerColor();
      });
    }, 50);
  };

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });

  globalThis[COLOR_SYNC_KEY] = () => {
    clearTimeout(timer);
    if (frame) {
      cancelAnimationFrame(frame);
    }
    observer.disconnect();
    delete globalThis[COLOR_SYNC_KEY];
  };

  api.onPageChange(scheduleSync);
  scheduleSync();
});

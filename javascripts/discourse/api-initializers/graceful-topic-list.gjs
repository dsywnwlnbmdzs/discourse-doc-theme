import { concat } from "@ember/helper";
import { helper } from "@ember/component/helper";
import { htmlSafe } from "@ember/template";
import { apiInitializer } from "discourse/lib/api";
import TopicLink from "discourse/components/topic-list/topic-link";
import TopicStatus from "discourse/components/topic-status";
import dAvatar from "discourse/ui-kit/helpers/d-avatar";
import dCategoryLink from "discourse/ui-kit/helpers/d-category-link";
import dDiscourseTags from "discourse/ui-kit/helpers/d-discourse-tags";
import dIcon from "discourse/ui-kit/helpers/d-icon";
import DUserLink from "discourse/ui-kit/d-user-link";
import { i18n } from "discourse-i18n";
import { longDate } from "discourse/lib/formatter";

const GF_CLEANUP_KEY = "__gracefulTopicListCleanup";

const gfCategoryColorStyle = helper(function ([category]) {
  const raw =
    category?.color ||
    category?.get?.("color") ||
    category?.bulletColor ||
    category?.get?.("bulletColor") ||
    "";

  const color = String(raw || "").replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(color)) {
    return htmlSafe("");
  }

  return htmlSafe(`--gf-category-native-color: #${color}; --gf-marker-color: #${color};`);
});

const gfTinyDate = helper(function ([date]) {
  return gfEnglishRelativeTime(date);
});

const gfEnglishDate = helper(function ([date]) {
  return gfEnglishRelativeTime(date);
});

const gfLongDate = helper(function ([date]) {
  if (!date) {
    return "";
  }

  return longDate(new Date(date)) || "";
});

function gfIsMobileView() {
  return document.documentElement.classList.contains("mobile-view");
}

function gfLegacyPreloadedTopicLookup() {
  try {
    const holder = document.querySelector("#data-preloaded");
    if (!holder?.dataset?.preloaded) {
      return {};
    }

    const preloaded = JSON.parse(holder.dataset.preloaded);
    const payload = JSON.parse(preloaded.topic_list || "{}");
    const users = {};

    for (const user of payload.users || []) {
      users[user.id] = user.username;
    }

    const topics = {};
    for (const topic of payload.topic_list?.topics || []) {
      let creatorUsername = topic.creator_username || "";
      if (!creatorUsername && topic.posters?.length) {
        creatorUsername = users[topic.posters[0].user_id] || "";
      }

      topics[topic.id] = {
        replyCount: topic.reply_count ?? 0,
        views: topic.views ?? 0,
        creatorUsername,
        lastPosterUsername: topic.last_poster_username || creatorUsername,
        bumpedAt: topic.bumped_at || topic.last_posted_at || topic.created_at || "",
        createdAt: topic.created_at || "",
      };
    }

    return topics;
  } catch (_e) {
    return {};
  }
}

function gfEnglishRelativeTime(input) {
  if (!input) {
    return "";
  }

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

function gfEnglishRelativeTimeFromElement(node) {
  const raw =
    node?.dataset?.time ||
    node?.getAttribute?.("data-time") ||
    node?.closest?.("[data-time]")?.getAttribute?.("data-time") ||
    "";

  if (!raw) {
    return "";
  }

  const numberValue = Number(raw);
  return Number.isFinite(numberValue) ? gfEnglishRelativeTime(numberValue) : gfEnglishRelativeTime(raw);
}

function patchGracefulEnglishDates() {
  document.querySelectorAll(".topic-list .relative-date[data-time]").forEach((node) => {
    const english = gfEnglishRelativeTimeFromElement(node);
    if (english && node.textContent !== english) {
      node.textContent = english;
      node.dataset.gfEnglishTimeApplied = "true";
    }
  });
}

function mobileActionIconHtml(hasReply) {
  const icon = hasReply ? "reply" : "far-pen-to-square";
  return `<svg class="fa d-icon d-icon-${icon} svg-icon svg-string" width="1em" height="1em" aria-hidden="true"><use href="#${icon}"></use></svg>`;
}

function mobileTimeIconHtml() {
  return `<svg class="fa d-icon d-icon-clock svg-icon svg-string" width="1em" height="1em" aria-hidden="true"><use href="#clock"></use></svg>`;
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

function updateMobileBadge(badge, value, title) {
  const text = String(value ?? "");
  if (badge.dataset.gfBadgeValue === text) {
    return;
  }

  badge.dataset.gfBadgeValue = text;
  badge.textContent = text;
  badge.title = title;
  badge.setAttribute("aria-label", title);
}

function ensureMobileMetaUser(stats, activity) {
  let status = stats.querySelector(":scope > .gf-mobile-meta-status");

  if (!status) {
    status = document.createElement("span");
    status.className = "gf-mobile-meta-status";
    status.innerHTML = `
      <span class="gf-mobile-action-icon" aria-hidden="true"></span>
      <a class="gf-mobile-meta-user" href="#" tabindex="0"></a>
    `;
    stats.insertBefore(status, activity || null);
  } else if (activity && status.nextElementSibling !== activity) {
    stats.insertBefore(status, activity);
  }

  if (!status.querySelector(":scope > .gf-mobile-action-icon")) {
    const icon = document.createElement("span");
    icon.className = "gf-mobile-action-icon";
    icon.setAttribute("aria-hidden", "true");
    status.prepend(icon);
  }

  return status;
}

function ensureMobileMetaTime(activity) {
  let text = activity.querySelector(":scope > .gf-mobile-time-text");

  if (!text) {
    if (activity.dataset.gfOriginalHtml === undefined) {
      activity.dataset.gfOriginalHtml = activity.innerHTML;
    }

    activity.innerHTML = `
      <span class="gf-mobile-time-icon" aria-hidden="true">${mobileTimeIconHtml()}</span>
      <span class="gf-mobile-time-text"></span>
    `;
    text = activity.querySelector(":scope > .gf-mobile-time-text");
  }

  return text;
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

  const hasReply = Number(topic.replyCount || 0) > 0;
  const username = hasReply
    ? topic.lastPosterUsername || topic.creatorUsername || ""
    : topic.creatorUsername || topic.lastPosterUsername || "";
  const timeSource = hasReply ? topic.bumpedAt : topic.createdAt;
  const timeText = gfEnglishRelativeTime(timeSource);

  const status = ensureMobileMetaUser(stats, activity);
  const icon = status.querySelector(".gf-mobile-action-icon");
  const user = status.querySelector(".gf-mobile-meta-user");

  status.classList.toggle("gf-mobile-meta-replied", hasReply);
  status.classList.toggle("gf-mobile-meta-started", !hasReply);

  const iconState = hasReply ? "reply" : "start";
  if (icon.dataset.gfIconState !== iconState) {
    icon.dataset.gfIconState = iconState;
    icon.innerHTML = mobileActionIconHtml(hasReply);
  }

  if (username && user.dataset.gfUsername !== username) {
    user.dataset.gfUsername = username;
    user.textContent = username;
    user.href = `/u/${encodeURIComponent(username)}`;
    user.dataset.userCard = username;
    user.setAttribute("aria-label", `${username} 的个人资料`);
  }

  const text = ensureMobileMetaTime(activity);
  if (text.textContent !== timeText) {
    text.textContent = timeText;
  }

  activity.setAttribute("aria-label", hasReply ? "最后回复时间" : "发帖时间");
}

function patchMobileNativeTopicCards() {
  if (!gfIsMobileView()) {
    cleanupMobileNativeTopicCards();
    return;
  }

  const topics = gfLegacyPreloadedTopicLookup();

  document
    .querySelectorAll(".topic-list tbody.topic-list-body > tr.topic-list-item")
    .forEach((row) => {
      const topicId = Number.parseInt(row.dataset.topicId || "0", 10);
      const topic = topics[topicId] || {};
      const pullRight = row.querySelector(".pull-right");
      const replies =
        row.querySelector(".pull-right .badge-posts .number")?.textContent?.trim() ||
        topic.replyCount ||
        "0";

      decorateMobileMetadata(row, topic);

      if (!pullRight) {
        return;
      }

      updateMobileBadge(ensureMobileRepliesBadge(pullRight), replies, `回复数：${replies}`);
      updateMobileBadge(ensureMobileViewsBadge(pullRight), topic.views ?? "", `浏览数：${topic.views ?? ""}`);
    });
}

function cleanupMobileNativeTopicCards() {
  document
    .querySelectorAll(".gf-mobile-replies-badge, .gf-mobile-views-badge, .gf-mobile-meta-status")
    .forEach((node) => node.remove());

  document.querySelectorAll(".gf-mobile-meta-time").forEach((node) => {
    node.classList.remove("gf-mobile-meta-time");

    if (node.dataset.gfOriginalHtml !== undefined) {
      node.innerHTML = node.dataset.gfOriginalHtml;
      delete node.dataset.gfOriginalHtml;
    }
  });
}

function plainTextFromCooked(cooked) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = cooked || "";
  return (wrapper.textContent || "").replace(/\s+/g, " ").trim();
}

const desktopExcerptCache = new Map();

async function fetchLastReplyExcerpt(topicId) {
  if (!topicId) {
    return "";
  }

  if (desktopExcerptCache.has(topicId)) {
    return desktopExcerptCache.get(topicId);
  }

  const promise = fetch(`/t/${topicId}.json`, { credentials: "same-origin" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      const posts = data?.post_stream?.posts || [];
      const visiblePosts = posts.filter((post) => !post.hidden);
      const lastPost = visiblePosts[visiblePosts.length - 1];

      if (!lastPost || lastPost.post_number === 1) {
        return "";
      }

      return plainTextFromCooked(lastPost.cooked).slice(0, 180);
    })
    .catch(() => "");

  desktopExcerptCache.set(topicId, promise);
  return promise;
}

function patchDesktopReplyExcerpts() {
  if (gfIsMobileView()) {
    return;
  }

  document
    .querySelectorAll(".topic-list tbody.topic-list-body > tr.topic-list-item")
    .forEach((row) => {
      const topicId = Number.parseInt(row.dataset.topicId || "0", 10);
      const excerptNode = row.querySelector(".gf-last-reply-excerpt");
      const repliesText = row.querySelector(".gf-stat-posts .gf-stat-number")?.textContent || "0";
      const replies = Number.parseInt(repliesText.trim(), 10) || 0;

      if (!topicId || !excerptNode || replies <= 0 || excerptNode.dataset.gfExcerptLoaded === "true") {
        return;
      }

      excerptNode.dataset.gfExcerptLoaded = "true";
      fetchLastReplyExcerpt(topicId).then((excerpt) => {
        excerptNode.textContent = excerpt || "暂无回复摘要";
      });
    });
}

function resetDesktopReplyExcerptMarkers() {
  document.querySelectorAll(".gf-last-reply-excerpt[data-gf-excerpt-loaded]").forEach((node) => {
    delete node.dataset.gfExcerptLoaded;
  });
}

const GracefulTopicHeader = <template>
  <th scope="col" class="topic-list-data default gf-topic-header">
    {{i18n "topic.title"}}
  </th>
</template>;

const GracefulTopicCell = <template>
  <td class="main-link topic-list-data gf-topic-cell">
    <div class="gf-topic-row">
      <div class="gf-topic-left">
        <div class="pull-left gf-op-avatar">
          {{#if @topic.creator}}
            <DUserLink @username={{@topic.creator.username}} aria-hidden="true" tabindex="-1">
              {{dAvatar @topic.creator imageSize="large"}}
            </DUserLink>
          {{else if @topic.lastPosterUser}}
            <DUserLink @username={{@topic.lastPosterUser.username}} aria-hidden="true" tabindex="-1">
              {{dAvatar @topic.lastPosterUser imageSize="large"}}
            </DUserLink>
          {{/if}}
        </div>

        <div class="topic-item-metadata right gf-topic-copy">
          <div class="main-link gf-topic-title">
            <span class="topic-statuses"><TopicStatus @topic={{@topic}} @context="topic-list" /></span>
            <TopicLink @topic={{@topic}} class="title raw-link raw-topic-link" />
          </div>

          <div class="gf-topic-meta topic-item-stats clearfix" aria-label="topic metadata">
            {{#unless @hideCategory}}
              {{#if @topic.category}}
                {{#unless @topic.isPinnedUncategorized}}
                  <span
                    class="gf-meta-item gf-meta-category-item"
                    title={{concat "类别：" @topic.category.name}}
                    aria-label={{concat "类别：" @topic.category.name}}
                  >
                    <span class="gf-meta-category" style={{gfCategoryColorStyle @topic.category}}>
                      {{dCategoryLink @topic.category}}
                    </span>
                  </span>
                {{/unless}}
              {{/if}}
            {{/unless}}

            {{#if @topic.creator}}
              <span
                class="gf-meta-item gf-meta-author-item"
                title={{concat "发贴人：" @topic.creator.username}}
                aria-label={{concat "发贴人：" @topic.creator.username}}
              >
                <span class="gf-meta-icon" aria-hidden="true">{{dIcon "user"}}</span>
                <DUserLink class="gf-meta-author" @username={{@topic.creator.username}}>
                  {{@topic.creator.username}}
                </DUserLink>
              </span>
            {{/if}}

            {{#if @topic.tags.length}}
              <span class="gf-meta-item gf-meta-tags-item" title="标签" aria-label="标签">
                <span class="gf-meta-icon" aria-hidden="true">{{dIcon "tag"}}</span>
                <span class="gf-meta-tags">{{dDiscourseTags @topic mode="list" tagsForUser=@tagsForUser}}</span>
              </span>
            {{/if}}

            {{#if @topic.createdAt}}
              <span
                class="gf-meta-item gf-meta-created-item"
                title={{concat "发帖时间：" (gfLongDate @topic.createdAt)}}
                aria-label={{concat "发帖时间：" (gfLongDate @topic.createdAt)}}
              >
                <span class="gf-meta-icon" aria-hidden="true">{{dIcon "clock"}}</span>
                <span class="gf-created-at">{{gfTinyDate @topic.createdAt}}</span>
              </span>
            {{/if}}
          </div>
        </div>
      </div>
    </div>
  </td>
</template>;

const GracefulLastPostHeader = <template>
  <th scope="col" class="topic-list-data gf-last-post-header">
    {{i18n "replies"}}
  </th>
</template>;

const GracefulLastPostCell = <template>
  <td class="topic-list-data gf-last-post-cell">
    <div class="gf-desktop-stats">
      <div class="gf-stat-box gf-stat-posts">
        <span class="gf-stat-number">{{@topic.replyCount}}</span>
        <span class="gf-stat-label">POSTS</span>
      </div>

      <div class="gf-stat-box gf-stat-views">
        <span class="gf-stat-number">{{@topic.views}}</span>
        <span class="gf-stat-label">VIEWS</span>
      </div>
    </div>

    <div class="gf-last-post-summary">
      {{#if @topic.replyCount}}
        <div class="gf-last-avatar-inline">
          {{#if @topic.lastPosterUser}}
            <DUserLink @username={{@topic.lastPosterUser.username}} aria-hidden="true" tabindex="-1">
              {{dAvatar @topic.lastPosterUser imageSize="small"}}
            </DUserLink>
          {{/if}}
        </div>

        <div class="gf-last-reply-copy">
          <div class="gf-last-reply-head">
            {{#if @topic.bumpedAt}}
              <a class="gf-last-date" href={{@topic.lastPostUrl}}>
                {{gfEnglishDate @topic.bumpedAt}}
              </a>
            {{/if}}
          </div>

          <div class="gf-last-reply-excerpt">
            {{#if @topic.lastPosterUser}}
              <DUserLink class="gf-last-author" @username={{@topic.lastPosterUser.username}}>
                {{@topic.lastPosterUser.username}}
              </DUserLink>
            {{/if}}
          </div>
        </div>
      {{else}}
        <div class="gf-no-reply">No one has replied</div>
      {{/if}}
    </div>
  </td>
</template>;

export default apiInitializer((api) => {
  globalThis[GF_CLEANUP_KEY]?.();

  let patchTimer = null;
  let patchFrame = null;
  let patchFollowupTimer = null;
  const cleanupCallbacks = [];

  const runTopicListPatches = () => {
    patchFrame = null;

    if (gfIsMobileView()) {
      patchMobileNativeTopicCards();
    } else {
      cleanupMobileNativeTopicCards();
      patchDesktopReplyExcerpts();
    }

    patchGracefulEnglishDates();
  };

  const scheduleTopicListPatches = ({ resetExcerpts = false } = {}) => {
    if (resetExcerpts) {
      resetDesktopReplyExcerptMarkers();
    }

    clearTimeout(patchTimer);
    clearTimeout(patchFollowupTimer);

    if (patchFrame) {
      cancelAnimationFrame(patchFrame);
      patchFrame = null;
    }

    patchTimer = setTimeout(() => {
      patchFrame = requestAnimationFrame(() => {
        runTopicListPatches();
        patchFollowupTimer = setTimeout(runTopicListPatches, 250);
      });
    }, 30);
  };


  const htmlClassObserver = new MutationObserver(() =>
    scheduleTopicListPatches({ resetExcerpts: true })
  );
  htmlClassObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  cleanupCallbacks.push(() => htmlClassObserver.disconnect());

  globalThis[GF_CLEANUP_KEY] = () => {
    clearTimeout(patchTimer);
    clearTimeout(patchFollowupTimer);

    if (patchFrame) {
      cancelAnimationFrame(patchFrame);
      patchFrame = null;
    }

    cleanupCallbacks.splice(0).forEach((callback) => callback());
    delete globalThis[GF_CLEANUP_KEY];
  };

  api.onPageChange(() => {
    scheduleTopicListPatches({ resetExcerpts: true });
  });

  api.registerValueTransformer("topic-list-columns", ({ value: columns }) => {
    columns.replace("topic", {
      header: GracefulTopicHeader,
      item: GracefulTopicCell,
    });

    for (const key of ["bulk-select", "posters", "replies", "likes", "op-likes", "views"]) {
      columns.delete(key);
    }

    columns.replace("activity", {
      header: GracefulLastPostHeader,
      item: GracefulLastPostCell,
    });
  });

  scheduleTopicListPatches({ resetExcerpts: true });
});

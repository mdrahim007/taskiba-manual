/* Taskiba Manual App JS (no dependencies) */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------------------------
   Helpers
--------------------------- */

function setYear() {
  const el = $("#year");
  if (el) el.textContent = String(new Date().getFullYear());
}

function getThemePreference() {
  const saved = localStorage.getItem("taskiba_docs_theme");
  if (saved === "light" || saved === "dark") return saved;

  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = $("#btnTheme");
  if (btn) btn.setAttribute("aria-checked", String(theme === "dark"));
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("taskiba_docs_theme", next);
  applyTheme(next);
}

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function ensureHeadingIds() {
  const headings = $$("article.doc h2, article.doc h3, article.doc h4");
  const used = new Set(
    $$("[id]")
      .map((el) => el.id)
      .filter(Boolean)
  );

  const ensureUnique = (base) => {
    const safeBase = base || "section";
    let id = safeBase;
    let i = 2;
    while (used.has(id)) {
      id = `${safeBase}-${i++}`;
    }
    used.add(id);
    return id;
  };

  headings.forEach((heading) => {
    if (heading.id) {
      used.add(heading.id);
      return;
    }

    const section = heading.closest(".doc-section");
    if (section && section.id && heading.tagName.toLowerCase() === "h2") {
      heading.id = ensureUnique(`${section.id}-title`);
      return;
    }

    heading.id = ensureUnique(slugify(heading.textContent));
  });
}

function syncTopbarHeight() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  const height = Math.ceil(topbar.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--topbar-h", `${height}px`);
}

function prefersReducedMotion() {
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function expandParentSectionFor(el) {
  const section = el?.closest?.(".doc-section[data-collapsible]");
  if (!section) return null;

  if (section.getAttribute("data-collapsed") === "true") {
    section.setAttribute("data-collapsed", "false");
    const header = $(".doc-section__header", section);
    if (header) header.setAttribute("aria-expanded", "true");
  }

  return section;
}

function expandFromHash() {
  const id = (location.hash || "").slice(1);
  if (!id) return;

  const target = document.getElementById(id);
  if (!target) return;

  expandParentSectionFor(target);
}

/* ---------------------------
   TOC (build + active state)
--------------------------- */

function buildTOC() {
  const toc = $("#toc");
  const doc = $("#doc");
  if (!toc || !doc) return;

  toc.innerHTML = "";

  const headings = $$("h2, h3", doc);

  headings.forEach((heading) => {
    const tag = heading.tagName.toLowerCase();
    const text = heading.textContent.trim();
    const section = heading.closest(".doc-section");
    const targetId =
      tag === "h2" && section?.id ? section.id : heading.id;
    if (!targetId) return;

    const link = document.createElement("a");
    link.href = `#${targetId}`;
    link.className = tag === "h3" ? "toc__depth-3" : "toc__depth-2";
    link.innerHTML = `<span class="dot" aria-hidden="true"></span><span>${text}</span>`;

    link.addEventListener("click", (e) => {
      e.preventDefault();

      const id = link.getAttribute("href")?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;

      expandParentSectionFor(target);
      closeDrawer();

      const reduceMotion = prefersReducedMotion();
      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });

      history.pushState(null, "", `#${id}`);
    });

    toc.appendChild(link);
  });
}

function scrollTOCItemIntoView(activeLink) {
  const toc = document.getElementById("toc");
  if (!toc || !activeLink) return;

  const tocRect = toc.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();
  const padding = 12;

  const linkAbove = linkRect.top < tocRect.top + padding;
  const linkBelow = linkRect.bottom > tocRect.bottom - padding;
  if (!linkAbove && !linkBelow) return;

  const reduceMotion = prefersReducedMotion();
  activeLink.scrollIntoView({
    block: "nearest",
    inline: "nearest",
    behavior: reduceMotion ? "auto" : "smooth",
  });
}

function setupActiveTOC() {
  const links = $$("#toc a");
  if (!links.length) return;

  const items = links
    .map((link) => {
      const id = link.getAttribute("href")?.slice(1);
      const el = id ? document.getElementById(id) : null;
      return el ? { link, el } : null;
    })
    .filter(Boolean);

  if (!items.length) return;

  const setActive = (link) => {
    links.forEach((item) => item.classList.remove("active"));
    if (link) {
      link.classList.add("active");
      scrollTOCItemIntoView(link);
    }
  };

  function headerOffsetPx() {
    const cssVal = getComputedStyle(document.documentElement)
      .getPropertyValue("--topbar-h")
      .trim();
    const height = parseFloat(cssVal || "0");
    return (Number.isFinite(height) ? height : 0) + 16;
  }

  function computeActive() {
    const offset = headerOffsetPx();
    let current = items[0].link;

    for (const item of items) {
      const top = item.el.getBoundingClientRect().top;
      if (top - offset <= 2) {
        current = item.link;
      } else {
        break;
      }
    }

    setActive(current);
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      computeActive();
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  window.addEventListener("hashchange", () => setTimeout(computeActive, 0));

  computeActive();
}

/* ---------------------------
   TOC custom scrollbar
--------------------------- */

function setupTocScrollbar() {
  const toc = $("#toc");
  if (!toc) return;

  const host = toc.parentElement || toc;
  let bar = $(".toc-scrollbar", host);
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "toc-scrollbar";
    const thumb = document.createElement("div");
    thumb.className = "toc-scrollbar__thumb";
    bar.appendChild(thumb);
    host.appendChild(bar);
  }

  const thumb = $(".toc-scrollbar__thumb", bar);
  if (!thumb) return;

  let isHovering = false;
  let isDragging = false;
  let hideTimer = null;
  let dragStartY = 0;
  let dragStartScroll = 0;

  const showBar = () => {
    bar.classList.add("is-visible");
  };

  const scheduleHide = (delay = 600) => {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isHovering && !isDragging) {
        bar.classList.remove("is-visible");
      }
    }, delay);
  };

  const update = () => {
    const { scrollHeight, clientHeight, scrollTop } = toc;
    const barTop = toc.offsetTop + 8;
    const barHeight = Math.max(0, toc.clientHeight - 16);
    bar.style.top = `${barTop}px`;
    bar.style.height = `${barHeight}px`;

    const track = bar.clientHeight || 0;

    if (scrollHeight <= clientHeight + 1 || track <= 0) {
      bar.style.visibility = "hidden";
      return;
    }

    bar.style.visibility = "visible";

    const thumbHeight = Math.max(
      20,
      Math.round((clientHeight / scrollHeight) * track)
    );
    const maxTop = Math.max(0, track - thumbHeight);
    const top =
      scrollHeight <= clientHeight
        ? 0
        : Math.round((scrollTop / (scrollHeight - clientHeight)) * maxTop);

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${top}px)`;
  };

  toc.addEventListener("scroll", () => {
    update();
    showBar();
    scheduleHide();
  }, { passive: true });
  window.addEventListener("resize", update);

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(update);
    ro.observe(toc);
  }

  toc.addEventListener("mouseenter", () => {
    isHovering = true;
    showBar();
  });

  toc.addEventListener("mouseleave", () => {
    isHovering = false;
    scheduleHide(150);
  });

  thumb.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isDragging = true;
    showBar();
    dragStartY = e.clientY;
    dragStartScroll = toc.scrollTop;

    const onMove = (ev) => {
      if (!isDragging) return;
      const { scrollHeight, clientHeight } = toc;
      const track = bar.clientHeight || 1;
      const thumbHeight = thumb.getBoundingClientRect().height;
      const maxTop = Math.max(0, track - thumbHeight);
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      const deltaY = ev.clientY - dragStartY;
      const scrollDelta = maxTop > 0 ? (deltaY / maxTop) * maxScroll : 0;
      toc.scrollTop = dragStartScroll + scrollDelta;
    };

    const onUp = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      scheduleHide();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  bar.addEventListener("mousedown", (e) => {
    if (e.target === thumb) return;
    e.preventDefault();
    const rect = bar.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const { scrollHeight, clientHeight } = toc;
    const track = rect.height || 1;
    const thumbHeight = thumb.getBoundingClientRect().height;
    const maxTop = Math.max(0, track - thumbHeight);
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const targetTop = Math.min(Math.max(clickY - thumbHeight / 2, 0), maxTop);
    toc.scrollTop = maxTop > 0 ? (targetTop / maxTop) * maxScroll : 0;
  });

  update();
}

/* ---------------------------
   Collapsibles
--------------------------- */

function setupCollapsibles() {
  const sections = $$('[data-collapsible]');
  const toggleAllButtons = $$(".js-toggle-all");

  function isAllExpanded() {
    return sections.every((section) => section.getAttribute("data-collapsed") !== "true");
  }

  function updateToggleAllUI() {
    if (!toggleAllButtons.length) return;

    const expanded = isAllExpanded();
    toggleAllButtons.forEach((button) => {
      button.classList.toggle("is-expanded", expanded);
      button.setAttribute(
        "aria-label",
        expanded ? "Collapse all sections" : "Expand all sections"
      );
      button.setAttribute("data-label", expanded ? "Collapse all" : "Expand all");
      const label = button.querySelector(".toggle-all__label");
      if (label) label.textContent = expanded ? "Collapse all" : "Expand all";
    });
  }

  function setSection(section, expand) {
    section.setAttribute("data-collapsed", expand ? "false" : "true");
    const header = $(".doc-section__header", section);
    if (header) header.setAttribute("aria-expanded", expand ? "true" : "false");
  }

  sections.forEach((section) => {
    const header = $(".doc-section__header", section);
    const body = $(".doc-section__body", section);
    if (!header) return;

    const collapsed = section.getAttribute("data-collapsed") === "true";
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (body) {
      if (!body.id) {
        body.id = `${section.id || "section"}-body`;
      }
      header.setAttribute("aria-controls", body.id);
    }

    const toggle = () => {
      const isCollapsed = section.getAttribute("data-collapsed") === "true";
      setSection(section, isCollapsed);
      updateToggleAllUI();
    };

    header.addEventListener("click", (e) => {
      if (e.target.closest("button, a, [data-copy-link]")) return;
      if (header.dataset.longpress === "true") {
        delete header.dataset.longpress;
        return;
      }
      toggle();
    });

    header.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (document.activeElement?.closest("button, a, [data-copy-link]")) return;
      e.preventDefault();
      toggle();
    });
  });

  toggleAllButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const expand = !isAllExpanded();
      sections.forEach((section) => setSection(section, expand));
      updateToggleAllUI();
      if (button.classList.contains("toggle-all--fab")) {
        button.classList.add("is-expanded-temp");
        clearTimeout(button._shrinkTimer);
        button._shrinkTimer = setTimeout(() => {
          button.classList.remove("is-expanded-temp");
        }, 800);
      }
      if (window.innerWidth <= 980) {
        closeDrawer();
      }
    });
  });

  updateToggleAllUI();
}

/* ---------------------------
   Copy links
--------------------------- */

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

let copyTooltip;
function showCopyTooltip(x, y, text = "Link Copied!") {
  if (!copyTooltip) {
    copyTooltip = document.createElement("div");
    copyTooltip.className = "copy-tooltip";
    document.body.appendChild(copyTooltip);
  }

  copyTooltip.textContent = text;
  copyTooltip.style.left = `${x}px`;
  copyTooltip.style.top = `${y}px`;
  copyTooltip.classList.add("show");

  setTimeout(() => copyTooltip.classList.remove("show"), 900);
}

async function copySectionLink(section, x, y) {
  if (!section?.id) return false;
  const origin = location.origin === "null" ? "file://" : location.origin;
  const url = `${origin}${location.pathname}#${section.id}`;
  const ok = await copyToClipboard(url);
  if (!ok) return false;
  showCopyTooltip(x, y);
  return true;
}

function setupCopyLinks() {
  const buttons = $$('[data-copy-link]');
  let activeCopiedBtn = null;

  function resetCopied(btn) {
    if (!btn) return;
    btn.classList.remove("is-copied");
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();

      const section = btn.closest(".doc-section");
      if (!section?.id) return;

      const ok = await copySectionLink(section, e.pageX + 10, e.pageY - 10);
      if (!ok) return;

      if (activeCopiedBtn && activeCopiedBtn !== btn) {
        resetCopied(activeCopiedBtn);
      }

      btn.classList.add("is-copied");
      activeCopiedBtn = btn;

      setTimeout(() => {
        resetCopied(btn);
        if (activeCopiedBtn === btn) {
          activeCopiedBtn = null;
        }
      }, 1200);

      btn.blur();
    });
  });
}

function setupHeaderLongPressCopy() {
  const headers = $$(".doc-section__header");
  headers.forEach((header) => {
    let timer = null;
    let startX = 0;
    let startY = 0;

    const section = header.closest(".doc-section");

    const clear = () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
    };

    header.addEventListener(
      "pointerdown",
      (e) => {
        if (window.innerWidth > 720) return;
        if (e.button !== 0) return;
        if (e.target.closest("button, a, [data-copy-link]")) return;

        startX = e.clientX;
        startY = e.clientY;

        timer = setTimeout(async () => {
          const ok = await copySectionLink(section, e.pageX + 10, e.pageY - 10);
          if (ok) {
            header.dataset.longpress = "true";
            setTimeout(() => {
              delete header.dataset.longpress;
            }, 300);
          }
        }, 600);
      },
      { passive: true }
    );

    header.addEventListener("pointermove", (e) => {
      if (!timer) return;
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx > 10 || dy > 10) clear();
    });

    header.addEventListener("pointerup", clear);
    header.addEventListener("pointerleave", clear);
    header.addEventListener("pointercancel", clear);
  });
}

/* ---------------------------
   Search + highlighting
--------------------------- */

const originalHTML = new WeakMap();

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectHighlightTargets(section) {
  return $$("h2, h3, h4, p, li", section);
}

function clearHighlights(sections) {
  sections.forEach((section) => {
    const nodes = collectHighlightTargets(section);
    nodes.forEach((el) => {
      const original = originalHTML.get(el);
      if (original != null) el.innerHTML = original;
      originalHTML.delete(el);
    });
  });
}

function highlightInSection(section, query) {
  if (!query) return;

  const re = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const nodes = collectHighlightTargets(section);

  nodes.forEach((el) => {
    if (!originalHTML.has(el)) originalHTML.set(el, el.innerHTML);
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.parentElement?.closest("mark")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue;
      if (!text) return;

      const hasMatch = re.test(text);
      re.lastIndex = 0;
      if (!hasMatch) return;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      text.replace(re, (match, _group, offset) => {
        const before = text.slice(lastIndex, offset);
        if (before) fragment.appendChild(document.createTextNode(before));

        const mark = document.createElement("mark");
        mark.textContent = match;
        fragment.appendChild(mark);

        lastIndex = offset + match.length;
        return match;
      });

      const after = text.slice(lastIndex);
      if (after) fragment.appendChild(document.createTextNode(after));

      textNode.parentNode?.replaceChild(fragment, textNode);
      re.lastIndex = 0;
    });
  });
}

function expandSectionIfCollapsed(section) {
  if (section.getAttribute("data-collapsed") !== "true") return;

  section.setAttribute("data-collapsed", "false");
  const header = $(".doc-section__header", section);
  if (header) header.setAttribute("aria-expanded", "true");
}

function setupSearch() {
  const input = $("#searchInput");
  const sections = $$(".doc-section");
  const search = $(".search");
  const toggleBtn = $("#btnSearchToggle");
  const emptyState = $("#searchEmpty");
  if (!input || !sections.length) return;

  function openSearch() {
    if (!search) return;
    search.classList.add("is-open");
    input.focus();
  }

  function closeSearch() {
    if (!search) return;
    search.classList.remove("is-open");
  }

  function apply(query) {
    const value = (query || "").trim().toLowerCase();
    clearHighlights(sections);

    if (!value) {
      sections.forEach((section) => (section.style.display = ""));
      if (emptyState) emptyState.hidden = true;
      return;
    }

    let hits = 0;
    sections.forEach((section) => {
      const text = section.textContent.toLowerCase();
      const hit = text.includes(value);

      section.style.display = hit ? "" : "none";

      if (hit) {
        hits += 1;
        expandSectionIfCollapsed(section);
        highlightInSection(section, value);
      }
    });

    if (emptyState) emptyState.hidden = hits !== 0;
  }

  input.addEventListener("input", (e) => apply(e.target.value));
  toggleBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!search) return;
    if (search.classList.contains("is-open")) {
      closeSearch();
    } else {
      openSearch();
    }
  });

  document.addEventListener("click", (e) => {
    if (!search?.classList.contains("is-open")) return;
    if (search.contains(e.target) || toggleBtn?.contains(e.target)) return;
    closeSearch();
  });

  window.addEventListener("keydown", (e) => {
    const isK = (e.key || "").toLowerCase() === "k";
    if ((e.ctrlKey || e.metaKey) && isK) {
      e.preventDefault();
      openSearch();
    }
    if (e.key === "Escape") {
      closeSearch();
    }
  });
}

/* ---------------------------
   Mobile drawer
--------------------------- */

let scrollY = 0;

function openDrawer() {
  const sidebar = $("#sidebar");
  const backdrop = $("#backdrop");
  if (!sidebar || !backdrop) return;

  scrollY = window.scrollY;

  document.documentElement.classList.add("no-scroll");
  document.body.classList.add("no-scroll");
  document.body.style.top = `-${scrollY}px`;

  sidebar.classList.add("open");
  backdrop.hidden = false;
}

function closeDrawer() {
  const sidebar = $("#sidebar");
  const backdrop = $("#backdrop");
  if (!sidebar || !backdrop) return;

  sidebar.classList.remove("open");
  backdrop.hidden = true;

  document.documentElement.classList.remove("no-scroll");
  document.body.classList.remove("no-scroll");
  document.body.style.top = "";

  window.scrollTo(0, scrollY);
}

function setupDrawer() {
  $("#btnMenu")?.addEventListener("click", () => {
    const sidebar = $("#sidebar");
    if (sidebar?.classList.contains("open")) {
      closeDrawer();
      return;
    }
    openDrawer();
  });

  $("#btnCloseMenu")?.addEventListener("click", closeDrawer);
  $("#backdrop")?.addEventListener("click", closeDrawer);

  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) closeDrawer();
  });
}

/* ---------------------------
   Init
--------------------------- */

(function init() {
  setYear();

  applyTheme(getThemePreference());
  $("#btnTheme")?.addEventListener("click", toggleTheme);

  syncTopbarHeight();
  window.addEventListener("resize", syncTopbarHeight);

  ensureHeadingIds();
  buildTOC();
  setupActiveTOC();
  setupTocScrollbar();

  setupCollapsibles();
  expandFromHash();
  window.addEventListener("hashchange", expandFromHash);

  setupCopyLinks();
  setupHeaderLongPressCopy();
  setupSearch();
  setupDrawer();
})();

/* Taskiba Manual – App JS (no dependencies) */

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
  const saved = localStorage.getItem("taskiba_docs_theme"); // "light" | "dark"
  if (saved === "light" || saved === "dark") return saved;

  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  // const icon = $("#themeIcon");
  // if (icon) icon.textContent = theme === "dark" ? "☀️" : "🌙";
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
  const headings = $$('article.doc h2, article.doc h3, article.doc h4');
  headings.forEach(h => {
    if (!h.id) {
      const section = h.closest('.doc-section');

      // ✅ Make H2 id exactly equal to its section id (stable + accurate tracking)
      if (section && section.id && h.tagName.toLowerCase() === 'h2') {
        h.id = section.id;
      } else {
        h.id = slugify(h.textContent);
      }
    }
  });
}


function syncTopbarHeight() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  const h = Math.ceil(topbar.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--topbar-h", `${h}px`);
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
  const toc = $('#toc');
  const doc = $('#doc');
  if (!toc || !doc) return;

  toc.innerHTML = '';

  // TOC from h2/h3
  const headings = $$('h2, h3', doc);

  headings.forEach(h => {
    const tag = h.tagName.toLowerCase();
    const text = h.textContent.trim();

    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.className = tag === 'h3' ? 'toc__depth-3' : 'toc__depth-2';
    a.innerHTML = `<span class="dot">•</span><span>${text}</span>`;

    a.addEventListener("click", (e) => {
  e.preventDefault();

  const id = a.getAttribute("href")?.slice(1);
  const target = id ? document.getElementById(id) : null;
  if (!target) return;

  // ✅ Expand parent section first
  expandParentSectionFor(target);

  // Close drawer (mobile)
  closeDrawer();

  // ✅ Scroll to the heading (standard docs behavior)
  const reduce = prefersReducedMotion();
  target.scrollIntoView({
    behavior: reduce ? "auto" : "smooth",
    block: "start",
  });

  // ✅ Update URL hash without jumping again
  history.pushState(null, "", `#${id}`);
});

    toc.appendChild(a);
  });
}

//auto scroll TOC active item into view
function scrollTOCItemIntoView(activeLink) {
  const toc = document.getElementById("toc");
  if (!toc || !activeLink) return;

  const tocRect = toc.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();

  const padding = 12;

  const linkAbove = linkRect.top < tocRect.top + padding;
  const linkBelow = linkRect.bottom > tocRect.bottom - padding;

  if (!linkAbove && !linkBelow) return;

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  activeLink.scrollIntoView({
    block: "nearest",
    inline: "nearest",
    behavior: reduceMotion ? "auto" : "smooth",
  });
}



function setupActiveTOC() {
  const links = $$("#toc a");
  if (!links.length) return;

  // Map TOC links -> target heading elements
  const items = links
    .map((a) => {
      const id = a.getAttribute("href")?.slice(1);
      const el = id ? document.getElementById(id) : null;
      return el ? { a, el } : null;
    })
    .filter(Boolean);

  if (!items.length) return;

const setActive = (a) => {
  links.forEach((l) => l.classList.remove("active"));
  if (a) {
    a.classList.add("active");
    scrollTOCItemIntoView(a);
  }
};



  // Read your fixed header height from CSS var
  function headerOffsetPx() {
    const cssVal = getComputedStyle(document.documentElement)
      .getPropertyValue("--topbar-h")
      .trim();
    const h = parseFloat(cssVal || "0");
    // +16 matches your CSS scroll-margin-top: calc(var(--topbar-h) + 16px)
    return (Number.isFinite(h) ? h : 0) + 16;
  }

  function computeActive() {
    const offset = headerOffsetPx();

    // Choose the LAST heading that is above the activation line (serial order)
    let current = items[0].a;

    for (const item of items) {
      const top = item.el.getBoundingClientRect().top;
      if (top - offset <= 2) {
        current = item.a;
      } else {
        // ✅ IMPORTANT: break keeps serial behavior and prevents skipping H3 near H2
        break;
      }
    }

    setActive(current);
  }

  // rAF-throttled scroll tracking
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

  // Update after clicking TOC / direct hash navigation
  window.addEventListener("hashchange", () => {
    setTimeout(computeActive, 0);
  });

  // Initial
  computeActive();
}


function setupCollapsibles() {
  const sections = $$("[data-collapsible]");
  const toggleAllBtn = $("#btnToggleAll");

  function isAllExpanded() {
    return sections.every((s) => s.getAttribute("data-collapsed") !== "true");
  }

  function updateToggleAllUI() {
    if (!toggleAllBtn) return;

    const expanded = isAllExpanded();
    toggleAllBtn.classList.toggle("is-expanded", expanded);
    toggleAllBtn.setAttribute("aria-label", expanded ? "Collapse all sections" : "Expand all sections");
    toggleAllBtn.setAttribute("title", expanded ? "Collapse all" : "Expand all");
  }

  function setSection(section, expand) {
    section.setAttribute("data-collapsed", expand ? "false" : "true");
    const header = $(".doc-section__header", section);
    if (header) header.setAttribute("aria-expanded", expand ? "true" : "false");
  }

  // Per section toggle
  sections.forEach((section) => {
    const header = $(".doc-section__header", section);
    if (!header) return;

    const collapsed = section.getAttribute("data-collapsed") === "true";
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", collapsed ? "false" : "true");

    const toggle = () => {
      const isCollapsed = section.getAttribute("data-collapsed") === "true";
      setSection(section, isCollapsed); // if collapsed -> expand
      updateToggleAllUI();
    };

    header.addEventListener("click", (e) => {
      // don't toggle when clicking interactive elements in header (copy link etc.)
      if (e.target.closest("button, a, [data-copy-link]")) return;
      toggle();
    });

    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        if (document.activeElement?.closest("button, a, [data-copy-link]")) return;
        e.preventDefault();
        toggle();
      }
    });
  });

  // Global toggle all
  toggleAllBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const expand = !isAllExpanded();
    sections.forEach((s) => setSection(s, expand));
    updateToggleAllUI();
  });

  // Initial sync
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

function setupCopyLinks() {
  const buttons = $$("[data-copy-link]");
  let tooltip;
  let activeCopiedBtn = null; // ✅ track last copied button

  function showTooltip(x, y, text = "Copied!") {
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "copy-tooltip";
      document.body.appendChild(tooltip);
    }

    tooltip.textContent = text;
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
    tooltip.classList.add("show");

    setTimeout(() => tooltip.classList.remove("show"), 900);
  }

  function resetCopied(btn) {
    if (!btn) return;
    btn.classList.remove("is-copied");
  }

  buttons.forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    e.stopPropagation(); // prevent section toggle

    const section = btn.closest(".doc-section");
    if (!section?.id) return;

    const url = `${location.origin}${location.pathname}#${section.id}`;
    const ok = await copyToClipboard(url);
    if (!ok) return;

    // ✅ Reset previous copied icon
    if (activeCopiedBtn && activeCopiedBtn !== btn) {
      resetCopied(activeCopiedBtn);
    }

    // ✅ Set new copied icon
    btn.classList.add("is-copied");
    activeCopiedBtn = btn;

    // Tooltip near cursor
    showTooltip(e.pageX + 10, e.pageY - 10);

    // ✅ Auto-reset after delay
    setTimeout(() => {
      resetCopied(btn);
      if (activeCopiedBtn === btn) {
        activeCopiedBtn = null;
      }
    }, 1200);

    // ✅ IMPORTANT: remove focus so the icon hides again naturally
    btn.blur();
  });
});
}



/* ---------------------------
   Search + highlighting
--------------------------- */

// Store original HTML so we can restore after removing highlights
const __originalHTML = new WeakMap();

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectHighlightTargets(section) {
  // Keep it practical: highlight within readable content only
  return $$("h2, h3, h4, p, li", section);
}

function clearHighlights(sections) {
  sections.forEach((section) => {
    const nodes = collectHighlightTargets(section);
    nodes.forEach((el) => {
      const original = __originalHTML.get(el);
      if (original != null) el.innerHTML = original;
      __originalHTML.delete(el);
    });
  });
}

function highlightInSection(section, query) {
  if (!query) return;

  const re = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const nodes = collectHighlightTargets(section);

  nodes.forEach((el) => {
    // Save original once
    if (!__originalHTML.has(el)) __originalHTML.set(el, el.innerHTML);

    // Only operate on text nodes by rewriting innerHTML (safe enough for this static doc)
    // If the element already contains mark tags from previous query, restoring via map handles it.
    el.innerHTML = el.innerHTML.replace(re, "<mark>$1</mark>");
  });
}

//start search setup
function expandSectionIfCollapsed(section) {
  if (section.getAttribute("data-collapsed") !== "true") return;

  section.setAttribute("data-collapsed", "false");

  const header = $(".doc-section__header", section);
  if (header) header.setAttribute("aria-expanded", "true");
}


function setupSearch() {
  const input = $('#searchInput');
  const sections = $$('.doc-section');
  if (!input || !sections.length) return;

  function apply(q) {
    const query = (q || '').trim().toLowerCase();

    // clear previous highlight (keep your existing clearHighlights if you already added it)
    clearHighlights(sections);

    if (!query) {
      sections.forEach(s => (s.style.display = ''));
      return;
    }

    sections.forEach(s => {
      const text = s.textContent.toLowerCase();
      const hit = text.includes(query);

      s.style.display = hit ? '' : 'none';

      if (hit) {
        // ✅ NEW: auto-expand matching collapsed sections
        expandSectionIfCollapsed(s);

        // keep your existing highlight function (if you already use it)
        highlightInSection(s, query);
      }
    });
  }

  input.addEventListener('input', (e) => apply(e.target.value));

  window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase() === 'k';
    if ((e.ctrlKey || e.metaKey) && k) {
      e.preventDefault();
      input.focus();
    }
  });
}


/* ---------------------------
   Mobile drawer
--------------------------- */

let __scrollY = 0;

function openDrawer() {
  const sidebar = $("#sidebar");
  const backdrop = $("#backdrop");
  if (!sidebar || !backdrop) return;

  __scrollY = window.scrollY;

  document.documentElement.classList.add("no-scroll");
  document.body.classList.add("no-scroll");
  document.body.style.top = `-${__scrollY}px`;

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

  window.scrollTo(0, __scrollY);
}

function setupDrawer() {
  $("#btnMenu")?.addEventListener("click", openDrawer);
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

  // ✅ Must be before setupCollapsibles()
  setupCollapsibles();
  expandFromHash();
  window.addEventListener("hashchange", expandFromHash);
  setupCopyLinks();
  setupSearch();
  setupDrawer();
})();

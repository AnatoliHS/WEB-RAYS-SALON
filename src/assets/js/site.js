
// Footer year
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

// Nav: transparent over the hero, solid once scrolled
const nav = document.getElementById("nav");
const hero = document.querySelector(".hero");
const setNav = () => {
  const limit = hero ? hero.offsetHeight - nav.offsetHeight : 40;
  nav.classList.toggle("is-solid", window.scrollY > Math.max(limit, 40));
};
window.addEventListener("scroll", setNav, { passive: true });
window.addEventListener("resize", setNav);
setNav();

// Mobile menu ("Ivory bloom"): the sheet opens as a circle from the menu
// button. It stays in the page (so it can animate closed too) and is made
// inert while closed so it can't be tabbed into or read out.
const toggle = document.getElementById("nav-toggle");
const menu = document.getElementById("menu");
let menuOpen = false;
menu.hidden = false;
menu.inert = true;
menu.setAttribute("aria-hidden", "true");
const setMenu = (open) => {
  menuOpen = open;
  if (open) {
    const r = toggle.getBoundingClientRect();
    menu.style.setProperty("--mx", `${r.left + r.width / 2}px`);
    menu.style.setProperty("--my", `${r.top + r.height / 2}px`);
  }
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  menu.classList.toggle("is-open", open);
  menu.inert = !open;
  menu.setAttribute("aria-hidden", String(!open));
  // while it closes, hold the nav's colour change until the ivory has pulled back
  if (!open && document.body.classList.contains("menu-open")) {
    document.body.classList.add("menu-closing");
    clearTimeout(setMenu.closing);
    setMenu.closing = setTimeout(() => document.body.classList.remove("menu-closing"), 900);
  }
  document.body.classList.toggle("menu-open", open);
};
toggle.addEventListener("click", () => setMenu(!menuOpen));
menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menuOpen) { setMenu(false); toggle.focus(); } });
window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

// Services: tabs (WAI-ARIA tabs pattern, arrow keys move between them) and a
// cluster of circles that re-arranges for each category. Layouts come from
// src/_data/menuBubbles.json. On a change: circles not in the new layout
// shrink to nothing (staggered), circles in both glide and resize to their new
// spot, and new circles spring open in place one after another.
//
// For smoothness, every circle from every layout is built once up front (its
// photo decoded before the first animation) and then only shown, hidden or
// moved through CSS transforms; nothing is added to or removed from the page
// while a transition is running.
(() => {
  const stage = document.querySelector("[data-bubbles]");
  const data = document.getElementById("services-bubbles");
  if (!stage || !data) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layouts = JSON.parse(data.textContent);
  const tabs = [...document.querySelectorAll(".services__tab")];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
  const all = new Map(); // id -> element, for every circle in every layout
  let shown = new Set();
  let active = tabs[0].dataset.id;

  const make = (def) => {
    const el = document.createElement("div");
    el.className = "bubble is-hidden";
    const inner = document.createElement("div");
    inner.className = `bubble__in${def.tone ? ` bubble--${def.tone}` : ""}`;
    if (def.img) {
      const img = document.createElement("img");
      img.src = def.img;
      img.alt = "";
      if (def.pos) img.style.objectPosition = def.pos;
      inner.append(img);
    } else if (def.text) {
      const span = document.createElement("span");
      span.textContent = def.text;
      inner.append(span);
    }
    el.append(inner);
    return el;
  };
  const place = (el, def) => {
    el.style.setProperty("--x", def.x);
    el.style.setProperty("--y", def.y);
    el.style.setProperty("--d", def.d);
  };
  // circles open roughly from the top of the cluster down, like a pour
  const byHeight = (defs) => [...defs].sort((a, b) => a.y - b.y);

  Object.values(layouts).forEach((defs) => {
    if (!Array.isArray(defs)) return;
    defs.forEach((def) => {
      if (all.has(def.id)) return;
      const el = make(def);
      place(el, def);
      stage.append(el);
      all.set(def.id, el);
    });
  });
  const ready = Promise.all([...stage.querySelectorAll("img")].map((img) => img.decode().catch(() => {})));

  // Works out the change and returns a function that starts it. Leaving and
  // gliding start straight away; the arrivals open when the returned function runs.
  const render = (id, { intro = false } = {}) => {
    const defs = layouts[id];
    const keep = new Set(defs.map((d) => d.id));

    let out = 0;
    shown.forEach((key) => {
      if (keep.has(key)) return;
      const el = all.get(key);
      el.style.setProperty("--pop-delay", `${out++ * 0.035}s`);
      el.classList.add("is-hidden");
    });

    const arriving = [];
    defs.forEach((def) => {
      const el = all.get(def.id);
      if (shown.has(def.id)) {
        el.style.setProperty("--delay", "0.1s");
        place(el, def);
      } else {
        // jump (hidden) to where it will open
        el.classList.add("is-placing");
        el.style.setProperty("--delay", "0s");
        place(el, def);
        arriving.push(def);
      }
    });
    shown = keep;

    void stage.offsetWidth; // commit the jumps before glides are allowed again
    arriving.forEach((def) => all.get(def.id).classList.remove("is-placing"));

    const start = intro ? 0 : 0.28;
    return () => byHeight(arriving).forEach((def, i) => {
      if (!shown.has(def.id)) return; // switched away again in the meantime
      const el = all.get(def.id);
      el.style.setProperty("--pop-delay", `${start + i * 0.06}s`);
      el.classList.remove("is-hidden");
    });
  };

  const showPanel = (next) => panels.forEach((p) => {
    const on = p === next;
    p.hidden = !on;
    p.classList.remove("is-entering");
    if (on && !reduce) { void p.offsetWidth; p.classList.add("is-entering"); }
  });

  const select = (tab) => {
    const id = tab.dataset.id;
    if (id === active) return;
    active = id;
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    showPanel(panels[tabs.indexOf(tab)]);
    requestAnimationFrame(render(id));
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      next.focus();
      select(next);
    });
  });

  // first cluster pours in once its photos are decoded and the section is in view
  const playIntro = render(active, { intro: true });
  const inView = new Promise((resolve) => {
    if (!("IntersectionObserver" in window) || reduce) return resolve();
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      resolve();
    }, { threshold: 0.35 });
    io.observe(stage);
  });
  Promise.all([ready, inView]).then(() => requestAnimationFrame(playIntro));
})();

// Studio reel: plays the clips in order (1 → 4) on a loop, crossfading between
// them. Each next clip starts loading while the current one plays. Pauses when
// scrolled out of view; with reduced motion it stays on the still poster.
const reel = document.querySelector("[data-reel]");
if (reel && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const clips = [...reel.querySelectorAll(".studio__clip")];
  let current = 0;
  let inView = false;

  const warm = (i) => {
    const v = clips[i];
    if (v.preload !== "auto") { v.preload = "auto"; v.load(); }
  };
  const play = () => {
    // a refused autoplay (e.g. low-power mode) just leaves the poster showing
    clips[current].play().then(() => warm((current + 1) % clips.length)).catch(() => {});
  };
  const show = (i) => {
    clips.forEach((v, n) => v.classList.toggle("is-on", n === i));
    current = i;
    clips[i].currentTime = 0;
    if (inView) play();
  };

  clips.forEach((v, i) => v.addEventListener("ended", () => show((i + 1) % clips.length)));

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) play();
      else clips[current].pause();
    }, { threshold: 0.25 }).observe(reel);
  } else {
    inView = true;
    play();
  }
}

// Fill wave: split each statement into letters (keeping <em> and spaces intact)
// and drive the colour wave from scroll: it starts as the text comes up past
// the bottom of the screen and completes by the time it's a little above the
// middle. Screen readers get the sentence once, from a visually hidden copy.
const fillWaves = [];
document.querySelectorAll(".fill-wave").forEach((el) => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const plain = el.textContent.replace(/\s+/g, " ").trim();
  let i = 0;
  const split = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const ch of child.textContent) {
          if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); continue; }
          const span = document.createElement("span");
          span.className = "fw-char";
          span.style.setProperty("--i", i++);
          span.textContent = ch;
          frag.appendChild(span);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        split(child);
      }
    });
  };
  const visual = document.createElement("span");
  visual.setAttribute("aria-hidden", "true");
  while (el.firstChild) visual.appendChild(el.firstChild);
  split(visual);
  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = plain;
  el.append(sr, visual);

  fillWaves.push({ el, count: i });
});

if (fillWaves.length) {
  const step = 0.07; // keep in step with --fw-step in site.css
  const paintWaves = () => {
    const vh = window.innerHeight;
    fillWaves.forEach(({ el, count }) => {
      const top = el.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, (vh * 0.88 - top) / (vh * 0.5)));
      el.style.setProperty("--fw-t", (p * ((count - 1) * step + 1)).toFixed(3));
    });
  };
  let wavesQueued = false;
  const queueWaves = () => { if (!wavesQueued) { wavesQueued = true; requestAnimationFrame(() => { wavesQueued = false; paintWaves(); }); } };
  window.addEventListener("scroll", queueWaves, { passive: true });
  window.addEventListener("resize", queueWaves);
  paintWaves();
}

// Reveal on scroll
const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add("is-in"));
}

// Lookbook gallery: choosing a thumbnail grows its photo out of that
// thumbnail's exact position until it fills the stage.
//
// Rules that keep it glitch-free:
//  - only one transition runs at a time; requests made meanwhile are queued
//    (latest wins) and played the moment the current one lands, so the stage
//    is never left partly uncovered;
//  - a photo is decoded before it starts opening, so it never opens blank;
//  - exactly two slides are visible during a transition (outgoing below,
//    incoming above) and exactly one at rest.
(() => {
  const root = document.querySelector(".lookbook");
  if (!root) return;

  const slides = [...root.querySelectorAll(".lookbook__slide")];
  const thumbs = [...root.querySelectorAll(".lookbook__thumb")];
  const indexEl = document.getElementById("lookbook-index");
  const nameEl = document.getElementById("lookbook-name");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  // Each slide has a landscape photo (wide screens) and a portrait photo (upright screens).
  const portraitMQ = window.matchMedia("(orientation: portrait)");
  const titleOf = (i) => (portraitMQ.matches ? thumbs[i].dataset.titlePortrait : thumbs[i].dataset.title) || thumbs[i].dataset.title;

  const EASE_REVEAL = "cubic-bezier(0.77, 0, 0.18, 1)";
  const EASE_SETTLE = "cubic-bezier(0.16, 1, 0.3, 1)";
  const REVEAL_MS = 950;

  let current = 0;
  let busy = false;
  let queued = null;

  // Start fetching every gallery photo once the section is near.
  const preload = () => slides.forEach((s) => { s.querySelector("img").loading = "eager"; });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { preload(); io.disconnect(); }
    }, { rootMargin: "800px 0px" });
    io.observe(root);
  } else {
    preload();
  }

  const ready = (img) => {
    img.loading = "eager";
    const decoded = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2000));
    return Promise.race([decoded, timeout]);
  };

  const press = (i) => thumbs.forEach((t, n) => t.setAttribute("aria-pressed", String(n === i)));

  const setLabel = (i) => {
    indexEl.textContent = String(i + 1).padStart(2, "0");
    nameEl.classList.add("is-swapping");
    setTimeout(() => {
      nameEl.textContent = titleOf(i);
      nameEl.classList.remove("is-swapping");
    }, 180);
  };

  const rest = (i) => {
    slides.forEach((s, n) => {
      const on = n === i;
      s.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      s.classList.toggle("is-active", on);
      s.classList.remove("is-leaving");
      s.style.zIndex = on ? 1 : "";
      on ? s.removeAttribute("aria-hidden") : s.setAttribute("aria-hidden", "true");
    });
  };

  const transition = async (i) => {
    busy = true;
    const prev = slides[current];
    const next = slides[i];
    const nextImg = next.querySelector("img");

    await ready(nextImg);

    press(i);
    setLabel(i);
    current = i;

    if (reduceMotion || !next.animate) {
      rest(i);
    } else {
      prev.classList.add("is-leaving");
      prev.style.zIndex = 1;
      next.classList.add("is-active");
      next.style.zIndex = 2;
      next.removeAttribute("aria-hidden");

      // Clip starts exactly over the chosen thumbnail, then opens to the full stage.
      const st = root.getBoundingClientRect();
      const th = thumbs[i].getBoundingClientRect();
      const from = `inset(${th.top - st.top}px ${st.right - th.right}px ${st.bottom - th.bottom}px ${th.left - st.left}px)`;

      const reveal = next.animate(
        [{ clipPath: from }, { clipPath: "inset(0px 0px 0px 0px)" }],
        { duration: REVEAL_MS, easing: EASE_REVEAL, fill: "forwards" }
      );
      const zoom = nextImg.animate(
        [{ transform: "scale(1.3)" }, { transform: "scale(1)" }],
        { duration: REVEAL_MS + 450, easing: EASE_SETTLE, fill: "forwards" }
      );
      // clear finished animations so no stale animation state lingers on the photo
      zoom.finished.then(() => zoom.cancel()).catch(() => {});
      // the outgoing photo drifts back slightly, adding depth
      prev.querySelector("img").animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.06)" }],
        { duration: REVEAL_MS, easing: EASE_REVEAL, fill: "forwards" }
      );

      await reveal.finished.catch(() => {});
      // Hide the outgoing photo; let the incoming photo's zoom finish settling.
      slides.forEach((s, n) => {
        if (n === i) return;
        s.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        s.classList.remove("is-active", "is-leaving");
        s.style.zIndex = "";
        s.setAttribute("aria-hidden", "true");
      });
      next.style.zIndex = 1;
      reveal.cancel(); // its end state (fully open) is the slide's natural state
    }

    busy = false;
    if (queued !== null) {
      const q = queued;
      queued = null;
      if (q !== current) transition(q);
      else press(current);
    }
  };

  const request = (i) => {
    if (busy) {
      queued = i;
      press(i); // immediate feedback on the strip
      return;
    }
    if (i !== current) transition(i);
  };

  // Keep the label, alt text and button names in step with whichever photo set is showing.
  const syncOrientation = () => {
    slides.forEach((s) => {
      const img = s.querySelector("img");
      if (!img.dataset.altLandscape) img.dataset.altLandscape = img.alt;
      img.alt = portraitMQ.matches ? img.dataset.altPortrait : img.dataset.altLandscape;
    });
    thumbs.forEach((t, n) => t.setAttribute("aria-label", `Show photo ${n + 1}: ${titleOf(n)}`));
    nameEl.textContent = titleOf(current);
  };
  syncOrientation();
  portraitMQ.addEventListener("change", syncOrientation);

  rest(0);

  // Hover previews on desktop (with a short intent delay); click/tap everywhere.
  let hoverTimer;
  thumbs.forEach((thumb, i) => {
    thumb.addEventListener("click", () => { stopAuto(); request(i); });
    if (canHover) {
      thumb.addEventListener("mouseenter", () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => { stopAuto(); request(i); }, 120);
      });
      thumb.addEventListener("mouseleave", () => clearTimeout(hoverTimer));
    }
    thumb.addEventListener("keydown", (e) => {
      const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const n = (i + dir + thumbs.length) % thumbs.length;
      thumbs[n].focus();
      stopAuto();
      request(n);
    });
  });

  // Gentle autoplay while the gallery is on screen, until the visitor takes over.
  let autoTimer = null;
  let autoEnabled = !reduceMotion;
  let inView = false;
  const tick = () => { if (!busy) request((current + 1) % slides.length); };
  const startAuto = () => { if (autoEnabled && inView && !document.hidden && !autoTimer) autoTimer = setInterval(tick, 4800); };
  const pauseAuto = () => { clearInterval(autoTimer); autoTimer = null; };
  function stopAuto() { autoEnabled = false; pauseAuto(); }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      inView ? startAuto() : pauseAuto();
    }, { threshold: 0.6 }).observe(root);
  }
  const strip = root.querySelector(".lookbook__strip");
  strip.addEventListener("mouseenter", pauseAuto);
  strip.addEventListener("mouseleave", startAuto);
  document.addEventListener("visibilitychange", () => (document.hidden ? pauseAuto() : startAuto()));
})();

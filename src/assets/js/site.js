
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

// Mobile menu
const toggle = document.getElementById("nav-toggle");
const menu = document.getElementById("menu");
const setMenu = (open) => {
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  menu.hidden = !open;
  document.body.classList.toggle("menu-open", open);
};
toggle.addEventListener("click", () => setMenu(menu.hidden));
menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) setMenu(false); });
window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

// Service tabs (WAI-ARIA tabs pattern with arrow-key support).
// The chosen category's photo crossfades in and the caption follows.
const tabs = [...document.querySelectorAll(".tabs__btn")];
const svcImgs = document.querySelectorAll(".services__img");
const svcNum = document.querySelector("[data-svc-num]");
const svcName = document.querySelector("[data-svc-name]");
const selectTab = (tab) => {
  tabs.forEach((t) => {
    const on = t === tab;
    const panel = document.getElementById(t.getAttribute("aria-controls"));
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    panel.hidden = !on;
    if (on) {
      const id = panel.id.replace("panel-", "");
      svcImgs.forEach((img) => img.classList.toggle("is-on", img.dataset.for === id));
      if (svcNum) svcNum.textContent = panel.dataset.num;
      if (svcName) svcName.textContent = panel.dataset.name;
    }
  });
};
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (e) => {
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    selectTab(next);
    next.focus();
  });
});

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

// /nav-concepts/ prototype: drives every live preview on the page.
// Each [data-stage] holds a frame with a nav and a scrollable mini homepage.
// Scrolling the mini page sets state classes on the frame, which each
// concept's CSS reacts to:
//   is-scrolled  moved at all
//   is-solid     past the hero
//   is-tucked    scrolling down below the hero (concept 4 hides its bar)
//   menu-open    the concept's menu is open
// plus --progress (0..1) and aria-current on the link for the section in view.

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll("[data-stage]").forEach((stage) => {
  const frame = stage.querySelector(".nc-frame");
  const scroller = frame.querySelector("[data-scroller]");
  const hero = scroller.querySelector(".nc-hero");
  const secs = [...scroller.querySelectorAll("[data-sec]")];
  const links = [...frame.querySelectorAll("[data-go]")].filter((a) => !scroller.contains(a));
  const toggles = [...frame.querySelectorAll("[data-menu-toggle]")];
  const menus = [...frame.querySelectorAll("[data-menu]")];
  const indicator = frame.querySelector("[data-indicator]");
  const previews = [...frame.querySelectorAll("[data-preview]")];
  let lastY = 0;
  let active = "top";
  let hovered = null;

  // ----- menu -----
  let open = false;
  const setMenu = (next) => {
    open = next;
    frame.classList.toggle("menu-open", open);
    toggles.forEach((t) => {
      t.setAttribute("aria-expanded", String(open));
      t.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    menus.forEach((m) => { m.inert = !open; });
  };
  setMenu(false);
  toggles.forEach((t) => t.addEventListener("click", () => setMenu(!open)));
  frame.querySelectorAll("[data-menu-close]").forEach((el) => el.addEventListener("click", () => setMenu(false)));
  frame.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) { setMenu(false); toggles.find((t) => t.offsetParent)?.focus(); }
  });

  // ----- gliding highlight (concept 2) -----
  const moveIndicator = () => {
    if (!indicator) return;
    const target = hovered || links.find((a) => a.closest(".nc-links") && a.dataset.go === active);
    if (!target || !target.offsetParent) { indicator.style.setProperty("--o", 0); return; }
    indicator.style.setProperty("--x", `${target.offsetLeft}px`);
    indicator.style.setProperty("--w", `${target.offsetWidth}px`);
    indicator.style.setProperty("--o", 1);
  };
  if (indicator) {
    indicator.parentElement.querySelectorAll("a").forEach((a) => {
      a.addEventListener("pointerenter", () => { hovered = a; moveIndicator(); });
      a.addEventListener("focus", () => { hovered = a; moveIndicator(); });
      a.addEventListener("blur", () => { hovered = null; moveIndicator(); });
    });
    indicator.parentElement.addEventListener("pointerleave", () => { hovered = null; moveIndicator(); });
  }

  // ----- photo preview (concept 4) -----
  if (previews.length) {
    frame.querySelectorAll("[data-key]").forEach((a) => {
      const show = () => previews.forEach((img) => img.classList.toggle("is-on", img.dataset.preview === a.dataset.key));
      a.addEventListener("pointerenter", show);
      a.addEventListener("focus", show);
    });
  }

  // ----- scroll state -----
  const update = () => {
    const y = scroller.scrollTop;
    const view = scroller.clientHeight;
    const max = scroller.scrollHeight - view;
    const heroEnd = hero.offsetHeight - 80;

    frame.classList.toggle("is-scrolled", y > 8);
    frame.classList.toggle("is-solid", y > heroEnd);
    if (Math.abs(y - lastY) > 6) {
      frame.classList.toggle("is-tucked", y > lastY && y > heroEnd + 120);
      lastY = y;
    }
    if (y <= heroEnd) frame.classList.remove("is-tucked");
    frame.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : 0);

    let current = "top";
    for (const s of secs) if (s.offsetTop - view * 0.45 <= y) current = s.dataset.sec;
    if (y >= max - 2) current = secs[secs.length - 1].dataset.sec;
    if (current === "book") current = "visit";
    if (current !== active) {
      active = current;
      links.forEach((a) => {
        if (a.dataset.go === active) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      moveIndicator();
    }
  };
  scroller.addEventListener("scroll", update, { passive: true });
  new ResizeObserver(() => { update(); moveIndicator(); }).observe(frame);
  update();

  // ----- links scroll the mini page -----
  frame.addEventListener("click", (e) => {
    const a = e.target.closest("a[href='#']");
    if (!a) return;
    e.preventDefault();
    const go = a.dataset.go;
    if (!go) return;
    const target = go === "top" ? null : scroller.querySelector(`[data-sec="${go}"]`);
    const top = target ? target.offsetTop - 40 : 0;
    setMenu(false);
    scroller.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  });

  // ----- desktop / phone switch -----
  const deviceBtns = [...stage.querySelectorAll("[data-device]")];
  deviceBtns.forEach((btn) => btn.addEventListener("click", () => {
    deviceBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    setMenu(false);
    frame.classList.toggle("is-phone", btn.dataset.device === "phone");
  }));
});

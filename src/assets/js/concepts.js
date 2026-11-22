// /menu-concepts/ prototype: two takes on "The Menu" section.
// Loaded only on that page, after site.js.

const cxReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const cxServices = JSON.parse(document.getElementById("cx-services")?.textContent || "[]");

// show one category panel inside a container, replaying its entrance
const showPanel = (panels, next) => {
  panels.forEach((p) => {
    const on = p === next;
    p.hidden = !on;
    p.classList.remove("is-entering");
    if (on && !cxReduce) { void p.offsetWidth; p.classList.add("is-entering"); }
  });
};

// ---------------------------------------------------------------------------
// Concept A: swap rail
// Choosing a thumbnail flies a copy of it from the rail up to the feature
// spot while a copy of the feature photo flies down into the rail slot it
// left. Both copies animate size, position and corner radius, so they cross
// paths; the real images are swapped underneath and shown again on landing.
// ---------------------------------------------------------------------------
(() => {
  const root = document.querySelector("[data-swap]");
  if (!root) return;
  const stage = root.querySelector(".swap__stage");
  const stageImg = root.querySelector("[data-swap-stage]");
  const numEl = root.querySelector("[data-swap-num]");
  const panels = [...root.querySelectorAll(".cx-panel")];
  const thumbs = [...root.querySelectorAll(".swap__thumb")];
  const FLY_MS = 900;
  const FLY_EASE = "cubic-bezier(0.76, 0, 0.24, 1)";
  let current = 0;
  let busy = false;

  const box = (el) => {
    const g = root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { left: `${r.left - g.left}px`, top: `${r.top - g.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: getComputedStyle(el).borderRadius };
  };
  const setImg = (img, s) => { img.src = s.image.src; img.style.objectPosition = s.image.pos; };

  // the outgoing photo travels a little faster, so the two visibly pass each
  // other instead of meeting in the same spot halfway
  const fly = (service, from, to, cls, ms = FLY_MS) => {
    const el = document.createElement("div");
    el.className = `swap__fly ${cls}`;
    const img = document.createElement("img");
    img.alt = "";
    setImg(img, service);
    el.append(img);
    Object.assign(el.style, from);
    root.append(el);
    // a touch of zoom on the photo itself makes the move feel less flat
    img.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: ms, easing: FLY_EASE });
    return { el, anim: el.animate([from, to], { duration: ms, easing: FLY_EASE, fill: "forwards" }) };
  };

  const swap = async (thumb) => {
    if (busy) return;
    const next = Number(thumb.dataset.index);
    const prev = current;
    const thumbImg = thumb.querySelector("img");
    const thumbBox = thumb.querySelector(".swap__thumb-img");
    const nameEl = thumb.querySelector(".swap__thumb-name");
    current = next;

    const commit = () => {
      setImg(stageImg, cxServices[next]);
      stageImg.alt = cxServices[next].image.alt;
      setImg(thumbImg, cxServices[prev]);
      thumb.dataset.index = prev;
      thumb.setAttribute("aria-label", `Show ${cxServices[prev].title}`);
      nameEl.textContent = cxServices[prev].title;
    };

    numEl.textContent = String(next + 1).padStart(2, "0");
    if (cxReduce || !root.animate) { commit(); showPanel(panels, panels[next]); return; }

    busy = true;
    const S = box(stage);
    const T = box(thumbBox);
    const flyOut = fly(cxServices[prev], S, T, "swap__fly--out", FLY_MS * 0.78);
    const flyIn = fly(cxServices[next], T, S, "swap__fly--in");
    stage.classList.add("is-landing");
    thumb.classList.add("is-landing");
    setTimeout(() => showPanel(panels, panels[next]), FLY_MS * 0.3);

    // timer rather than animation.finished, so it also settles in a background tab
    await new Promise((r) => setTimeout(r, FLY_MS));
    commit();
    await Promise.all([stageImg.decode?.(), thumbImg.decode?.()].map((p) => p && p.catch(() => {})));
    stage.classList.remove("is-landing");
    thumb.classList.remove("is-landing");
    flyIn.el.remove();
    flyOut.el.remove();
    busy = false;
  };

  thumbs.forEach((t) => t.addEventListener("click", () => swap(t)));
  // warm the cache so the first swap never flies an empty frame
  cxServices.forEach((s) => { const i = new Image(); i.src = s.image.src; });
})();

// ---------------------------------------------------------------------------
// Concept B: bubble tabs
// Each category has a cluster layout (src/_data/menuBubbles.json). On a tab
// change: circles not in the new layout shrink to nothing (staggered), circles
// in both glide and resize to their new spot, and new circles spring open
// in place one after another.
//
// For smoothness, every circle from every layout is built once up front (its
// photo decoded before the first animation) and then only shown, hidden or
// moved through CSS transforms; nothing is added to or removed from the page
// while a transition is running.
// ---------------------------------------------------------------------------
(() => {
  const stage = document.querySelector("[data-bubbles]");
  if (!stage) return;
  const layouts = JSON.parse(document.getElementById("cx-bubbles").textContent);
  const tabs = [...document.querySelectorAll(".bubbles__tab")];
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

  const select = (tab) => {
    const id = tab.dataset.id;
    if (id === active) return;
    active = id;
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    showPanel(panels, panels[tabs.indexOf(tab)]);
    requestAnimationFrame(render(id));
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
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
    if (!("IntersectionObserver" in window) || cxReduce) return resolve();
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      resolve();
    }, { threshold: 0.35 });
    io.observe(stage);
  });
  Promise.all([ready, inView]).then(() => requestAnimationFrame(playIntro));
})();

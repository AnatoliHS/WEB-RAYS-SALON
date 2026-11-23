// /studio-concepts/ prototype: runs every Studio reel on the page.
// Same behaviour as the reel in site.js: clips 1 → 4 on a loop with a
// crossfade, each only plays while on screen, and with reduced motion the
// still poster stays.

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll("[data-sreel]").forEach((reel) => {
    const clips = [...reel.querySelectorAll(".sc-clip")];
    let current = 0;
    let inView = false;

    const warm = (i) => {
      const v = clips[i];
      if (v.preload !== "auto") { v.preload = "auto"; v.load(); }
    };
    const play = () => {
      warm(current);
      clips[current].play().then(() => warm((current + 1) % clips.length)).catch(() => {});
    };
    const show = (i) => {
      clips.forEach((v, n) => v.classList.toggle("is-on", n === i));
      current = i;
      clips[i].currentTime = 0;
      if (inView) play();
    };

    clips.forEach((v, i) => v.addEventListener("ended", () => show((i + 1) % clips.length)));

    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) play();
      else clips[current].pause();
    }, { threshold: 0.2 }).observe(reel);
  });
}

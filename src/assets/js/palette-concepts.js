// /palette-concepts/ prototype: live palette switching on the real homepage.
// The homepage loads in an iframe (same origin), so this page adds
// palettes.css to it and flips <html data-palette>; nothing on the live site
// changes. "" means whatever site.css has (now Main Street).

const frame = document.querySelector("[data-live]");
const paletteBtns = [...document.querySelectorAll("[data-palette-btn]")];
const widthBtns = [...document.querySelectorAll("[data-width]")];
let palette = "";

const check = (btns, on) => btns.forEach((b) => b.setAttribute("aria-checked", String(b === on)));

const apply = () => {
  const doc = frame.contentDocument;
  if (!doc || !doc.head) return;
  if (!doc.getElementById("pc-palettes")) {
    const link = doc.createElement("link");
    link.id = "pc-palettes";
    link.rel = "stylesheet";
    link.href = "/assets/css/palettes.css";
    doc.head.append(link);
  }
  if (palette) doc.documentElement.dataset.palette = palette;
  else delete doc.documentElement.dataset.palette;
};

const choose = (id) => {
  palette = id;
  check(paletteBtns, paletteBtns.find((b) => b.dataset.paletteBtn === id));
  apply();
};

frame.addEventListener("load", apply); // also re-applies after in-frame navigation
paletteBtns.forEach((b) => b.addEventListener("click", () => choose(b.dataset.paletteBtn)));

widthBtns.forEach((b) => b.addEventListener("click", () => {
  check(widthBtns, b);
  frame.classList.toggle("is-phone", b.dataset.width === "390");
}));

// "Try it live" on a card: pick that palette and scroll to the preview
document.querySelectorAll("[data-try]").forEach((b) => b.addEventListener("click", () => {
  choose(b.dataset.try);
  document.getElementById("live").scrollIntoView({ behavior: "smooth" });
}));

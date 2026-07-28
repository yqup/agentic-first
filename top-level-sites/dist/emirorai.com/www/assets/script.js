const page = document.querySelector("[data-page]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (page && !reduceMotion.matches) {
  window.addEventListener(
    "pointermove",
    (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * -8;
      const y = (event.clientY / window.innerHeight - 0.5) * -6;

      page.style.setProperty("--shift-x", `${x.toFixed(2)}px`);
      page.style.setProperty("--shift-y", `${y.toFixed(2)}px`);
    },
    { passive: true },
  );
}

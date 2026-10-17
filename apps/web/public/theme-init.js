/* global matchMedia, localStorage, document */
// Runs before first paint. Explicit choices override the system preference.
(() => {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const read = () => {
    try {
      return localStorage.getItem("flowdrop-theme");
    } catch {
      return null;
    }
  };
  const apply = () => {
    const choice = read();
    const dark = choice === "dark" || (choice !== "light" && media.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#101b29" : "#f5f8fa");
  };
  apply();
  media.addEventListener("change", apply);
  addEventListener("storage", apply);
  addEventListener("flowdrop-theme", apply);
})();

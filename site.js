/* Top-bar menu. Pages are real documents now, so the only job left here is the
   narrow-screen panel: open it, close it on Escape, and close it if the window
   grows back to a width where the full bar fits. */
(function () {
  var toggle = document.querySelector(".navtoggle");
  if (!toggle) return;
  var icon = toggle.querySelector(".navicon");

  function close() {
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    icon.innerHTML = "&#9776;";
  }
  toggle.addEventListener("click", function () {
    var open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    icon.innerHTML = open ? "&#10005;" : "&#9776;";
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  window.addEventListener("resize", function () { if (window.innerWidth > 960) close(); });
})();

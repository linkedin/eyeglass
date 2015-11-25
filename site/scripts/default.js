(function() {
  "use strict";

  function toggleClass(node, className) {
    if (node && node.classList) {
      var method = node.classList.contains(className) ? "remove" : "add";
      console.log(method, className);
      node.classList[method](className);
    }
  }

  var asideToggle = document.getElementById("menu-toggle");
  var asideContent;
  if (asideToggle) {
    asideToggle.addEventListener("click", function(event) {
      asideContent = asideContent || document.getElementById("global-sidebar-content");
      if (asideContent) {
        toggleClass(asideContent, "expanded");
      }
      event.preventDefault();
    });
  }
}());

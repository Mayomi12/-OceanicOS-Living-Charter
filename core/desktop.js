/*
 * Ω∞ OceanicOS :: Desktop
 * Build 0025 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * The last Application of Stage 3, and the one that gathers the others. The
 * Desktop is a windowed workspace: it composites the apps already built — the
 * Harbor dashboard, the Terminal, the Documentation, the Continuous Verification
 * — into one screen of movable, focusable windows.
 *
 * The screen is just glass; the WINDOW MANAGER is the capability, and it is what
 * gets verified. createWorkspace() tracks which panels are open and their
 * z-order (which is on top), with the small, exact rules a window manager needs:
 *   - open(id)   show a panel and bring it to the front (focus it).
 *   - focus(id)  raise an already-open panel to the top.
 *   - close(id)  hide it; focus falls to whatever is now on top.
 *   - toggle(id) open if closed, close if open.
 * Nothing here touches the DOM — desktop.html renders list()/order() as windows.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createWorkspace = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULT_PANELS = [
    { id: "harbor",   title: "Harbor",       src: "harbor.html" },
    { id: "terminal", title: "Terminal",     src: "terminal.html" },
    { id: "docs",     title: "Documentation", src: "docs.html" },
    { id: "verify",   title: "Verification", src: "verify-all.html" }
  ];

  function createWorkspace(options) {
    options = options || {};
    var defs = (options.panels || DEFAULT_PANELS).map(function (p) { return { id: p.id, title: p.title, src: p.src }; });
    if (!defs.length) throw new TypeError("createWorkspace needs at least one panel");
    var byId = {};
    defs.forEach(function (p) {
      if (!p.id || byId[p.id]) throw new TypeError("panels need unique ids; bad id: " + p.id);
      byId[p.id] = p;
    });

    var openOrder = []; // ids, bottom → top (last = focused/frontmost)

    function known(id) { if (!byId[id]) throw new Error("unknown panel: " + id); }
    function raise(id) {
      var i = openOrder.indexOf(id);
      if (i >= 0) openOrder.splice(i, 1);
      openOrder.push(id);
    }

    function open(id) { known(id); raise(id); return state(); }
    function focus(id) {
      known(id);
      if (openOrder.indexOf(id) < 0) throw new Error("panel is not open: " + id);
      raise(id); return state();
    }
    function close(id) {
      known(id);
      var i = openOrder.indexOf(id);
      if (i >= 0) openOrder.splice(i, 1);
      return state();
    }
    function toggle(id) { known(id); return openOrder.indexOf(id) >= 0 ? close(id) : open(id); }

    function isOpen(id) { return openOrder.indexOf(id) >= 0; }
    function focused() { return openOrder.length ? openOrder[openOrder.length - 1] : null; }
    function order() { return openOrder.slice(); }
    function reset() { openOrder = []; return state(); }

    function list() {
      var top = focused();
      return defs.map(function (p) {
        var z = openOrder.indexOf(p.id);
        return { id: p.id, title: p.title, src: p.src, open: z >= 0, focused: p.id === top, z: z >= 0 ? z + 1 : 0 };
      });
    }

    function state() { return { panels: list(), order: order(), focused: focused() }; }
    function status() { return { panels: defs.length, open: openOrder.length, focused: focused() }; }

    return { open: open, focus: focus, close: close, toggle: toggle,
             isOpen: isOpen, focused: focused, order: order, list: list, reset: reset, state: state, status: status };
  }

  createWorkspace.DEFAULT_PANELS = DEFAULT_PANELS.map(function (p) { return { id: p.id, title: p.title, src: p.src }; });
  return createWorkspace;
});

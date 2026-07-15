/*
 * Ω∞ OceanicOS :: Desktop
 * Build 0025 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * The workspace application. The Harbor (0019) is one screen; Mobile (0024) is
 * one thumb; the Desktop is MANY WINDOWS over ONE Memory Ocean. It does not
 * reimplement the applications it hosts — it composes the two already-verified
 * view-models (Harbor for console + dashboard, Mobile for capture + inbox) onto
 * a single Kernel with a single shared Logger, so a drop captured in one window
 * is visible in every other window at once.
 *
 * As always, the application LOGIC is separated from the screen so it can be
 * verified: createDesktop() is a window manager / view-model.
 *   - menu()                 → the launcher: the registered apps.
 *   - launch(appId)          → open a window (singleton per app: relaunching
 *                              focuses instead of duplicating).
 *   - focus/minimize/restore/close(id) → window lifecycle; z-order maintained.
 *   - windows()              → open windows in z-order, topmost last.
 *   - desktop()              → a plain snapshot for rendering.
 *   - exec/capture/inbox/triage → the panes' workers, all on the one ocean.
 * desktop.html is only the shell that draws these.
 *
 * Dependencies resolve from the OceanicCore namespace the Core scripts
 * populate; pass createDesktop({ oceanic, deps }) to inject them.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createDesktop = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.25.0";

  var APPS = [
    { id: "console",   title: "Console",   icon: "⌨️" },
    { id: "capture",   title: "Capture",   icon: "💧" },
    { id: "inbox",     title: "Inbox",     icon: "📥" },
    { id: "dashboard", title: "Dashboard", icon: "🌊" },
    { id: "activity",  title: "Activity",  icon: "📖" }
  ];

  function createDesktop(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.status) {
      throw new TypeError("createDesktop requires an assembled OceanicOS: createDesktop({ oceanic })");
    }
    var D = options.deps || (root && root.OceanicCore) || {};
    function need(fn, what) { if (typeof fn !== "function") throw new Error("createDesktop: " + what + " factory is unavailable — load the Core scripts or pass { deps }"); return fn; }

    // one shared logger — the unified activity of the whole workspace
    var logger = options.logger || need(D.createLogger, "logger")({ now: options.now, minLevel: "info" });
    var harbor = need(D.createHarbor, "harbor")({ oceanic: os, logger: logger, now: options.now, deps: D });
    var mobile = need(D.createMobile, "mobile")({ oceanic: os, logger: logger, now: options.now, deps: D });

    var openWindows = [];   // z-order: topmost LAST
    var nextWin = 0;
    var booted = false;

    function appById(id) { for (var i = 0; i < APPS.length; i++) if (APPS[i].id === id) return APPS[i]; return null; }
    function winIndex(id) { for (var i = 0; i < openWindows.length; i++) if (openWindows[i].id === id) return i; return -1; }
    function winByApp(appId) { for (var i = 0; i < openWindows.length; i++) if (openWindows[i].app === appId) return openWindows[i]; return null; }
    function shapeWindow(w, i) { return { id: w.id, app: w.app, title: w.title, icon: w.icon, minimized: w.minimized, focused: focusedId() === w.id }; }
    function focusedId() {
      for (var i = openWindows.length - 1; i >= 0; i--) if (!openWindows[i].minimized) return openWindows[i].id;
      return null;
    }

    function boot() {
      if (booted) return desktop();
      var b = os.start();
      booted = true;
      logger.info("desktop online — OceanicOS v" + os.version + " booted on pulse " + b.pulse);
      return desktop();
    }

    function menu() { return APPS.map(function (a) { return { id: a.id, title: a.title, icon: a.icon }; }); }

    function launch(appId) {
      var app = appById(appId);
      if (!app) return { ok: false, error: "unknown app '" + appId + "' — see menu()" };
      var existing = winByApp(appId);
      if (existing) {                       // singleton: relaunch focuses
        existing.minimized = false;
        raise(existing.id);
        logger.info("window focused: " + app.title);
        return { ok: true, window: shapeWindow(existing) };
      }
      var w = { id: "w-" + (++nextWin), app: app.id, title: app.title, icon: app.icon, minimized: false };
      openWindows.push(w);
      logger.info("window opened: " + app.title);
      return { ok: true, window: shapeWindow(w) };
    }

    function raise(id) {
      var i = winIndex(id);
      if (i < 0) return false;
      var w = openWindows.splice(i, 1)[0];
      openWindows.push(w);
      return true;
    }

    function focus(id) {
      var i = winIndex(id);
      if (i < 0) return { ok: false, error: "no such window '" + id + "'" };
      openWindows[i].minimized = false;
      raise(id);
      return { ok: true, window: shapeWindow(openWindows[openWindows.length - 1]) };
    }

    function minimize(id) {
      var i = winIndex(id);
      if (i < 0) return { ok: false, error: "no such window '" + id + "'" };
      openWindows[i].minimized = true;
      return { ok: true, window: shapeWindow(openWindows[i]) };
    }

    function restore(id) {
      var i = winIndex(id);
      if (i < 0) return { ok: false, error: "no such window '" + id + "'" };
      openWindows[i].minimized = false;
      raise(id);
      return { ok: true, window: shapeWindow(openWindows[openWindows.length - 1]) };
    }

    function close(id) {
      var i = winIndex(id);
      if (i < 0) return { ok: false, error: "no such window '" + id + "'" };
      var w = openWindows.splice(i, 1)[0];
      logger.info("window closed: " + w.title);
      return { ok: true };
    }

    function windows() { return openWindows.map(shapeWindow); }

    function shapeLog(e) { return { at: e.at, level: e.level, message: e.message }; }

    function desktop() {
      var s = os.status();
      return {
        version: VERSION,
        systemVersion: s.version,
        booted: booted,
        pulse: s.pulse,
        ocean: s.memory.count,
        pending: s.reality.pending,
        windows: windows(),
        engines: {
          reality:   { verified: s.reality.verified, pending: s.reality.pending, total: s.reality.total },
          decisions: { decided: s.decisions.decided, open: s.decisions.open, total: s.decisions.total },
          knowledge: { established: s.knowledge.established, topics: s.knowledge.topics, total: s.knowledge.total },
          projects:  { active: s.projects.active, total: s.projects.total }
        },
        activity: logger.recent(8).map(shapeLog)
      };
    }

    function status() {
      return { version: VERSION, booted: booted, windows: openWindows.length, pending: os.status().reality.pending };
    }

    return {
      version: VERSION,
      boot: boot, menu: menu,
      launch: launch, focus: focus, minimize: minimize, restore: restore, close: close,
      windows: windows, desktop: desktop, status: status,
      // the panes' workers — every one drives the SAME ocean
      exec: function (line) { return harbor.exec(line); },
      capture: function (text) { return mobile.capture(text); },
      inbox: function () { return mobile.inbox(); },
      triage: function (id, action) { return mobile.triage(id, action); },
      apps: { harbor: harbor, mobile: mobile },
      oceanic: os, logger: logger
    };
  }

  createDesktop.VERSION = VERSION;
  createDesktop.APPS = APPS.slice();
  return createDesktop;
});

/*
 * Ω∞ OceanicOS :: Developer SDK
 * Build 0020 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * One import, the whole system. Everything until now has lived under the
 * internal OceanicCore namespace — a workshop of parts. The SDK is the front
 * door: it introduces the public OceanicOS namespace and a single call,
 * OceanicOS.create(), that assembles the Kernel, API, CLI, Logger, Docs and
 * Versioning — all wired to ONE Memory Ocean — and hands the developer a clean,
 * frozen, versioned handle.
 *
 *   var os = OceanicOS.create();
 *   os.start();
 *   os.api.call("reality.observe", { observation: "the tide is rising" });
 *   os.cli.exec("status");
 *   os.describe();      // the whole system, self-described
 *
 * Internals stay in OceanicCore; developers use OceanicOS. The two names mark
 * the boundary between the parts and the product.
 *
 * Dependencies resolve from OceanicCore (load the Core scripts first) or via
 * createSDK({ deps }) for embedding.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api.createSDK;
  else {
    root.OceanicCore = root.OceanicCore || {};
    root.OceanicCore.createSDK = api.createSDK;
    // the public product namespace — the developer's front door
    root.OceanicOS = { version: api.VERSION, create: api.createSDK };
  }
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.20.0"; // SDK version = build 0020

  function createSDK(options) {
    options = options || {};
    var D = options.deps || (root && root.OceanicCore) || {};
    function need(fn, what) {
      if (typeof fn !== "function") throw new Error("createSDK: the '" + what + "' factory is unavailable — load the Core scripts first, or pass createSDK({ deps })");
      return fn;
    }

    // one assembled system over one Memory Ocean
    var system = options.system || need(D.createOceanic, "createOceanic")({
      core: D, now: options.now, storage: options.storage, storageKey: options.storageKey,
      manual: options.manual, name: options.name
    });

    var logger     = options.logger || need(D.createLogger, "createLogger")({ now: options.now });
    var api        = need(D.createAPI, "createAPI")({ oceanic: system });
    var cli        = need(D.createCLI, "createCLI")({ oceanic: system });
    var docs       = need(D.createDocs, "createDocs")({ api: api });
    var versioning = D.versioning || null;

    function start() { return system.start(); }
    function status() { return system.status(); }

    // the whole system, self-described — SDK + API contract + capability index
    function describe() {
      return {
        sdk: VERSION,
        system: system.version,
        api: api.describe(),
        capabilities: docs.capabilities()
      };
    }
    function capabilities() { return docs.capabilities(); }
    function operations() { return api.operations(); }
    function toMarkdown() { return docs.toMarkdown(); }

    var handle = {
      version: VERSION,
      system: system,
      api: api,
      cli: cli,
      logger: logger,
      docs: docs,
      versioning: versioning,
      start: start,
      status: status,
      describe: describe,
      capabilities: capabilities,
      operations: operations,
      toMarkdown: toMarkdown
    };
    // the developer's handle is a stable surface — freeze the shape (not the engines)
    return Object.freeze(handle);
  }

  createSDK.VERSION = VERSION;
  return { createSDK: createSDK, VERSION: VERSION };
});

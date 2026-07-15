/*
 * Ω∞ OceanicOS :: Permissions
 * Build 0036 · Stage 5 (Collaboration) · zero-runtime (plain browser or any JS engine)
 *
 * Once the system knows WHO (Identity, 0035), it can govern WHAT each actor may
 * do. Permissions is an authorization layer over operations, keyed to the role
 * ladder observer < contributor < steward < admin:
 *
 *   - reads (list / status / search) need only an observer;
 *   - recording new reality/decisions/knowledge needs a contributor;
 *   - passing a VERDICT on reality or committing a decision needs a steward
 *     (verify / reject / archive / decide) — the Charter's weightier acts;
 *   - changing the register of actors needs an admin.
 *
 * It composes on Identity for the current actor, and can WRAP an API (0017) so
 * every call is checked first: an unauthorized call is refused as
 * { ok:false, error } — never thrown — exactly like any other refusal. The
 * policy is data and can be overridden; nothing here can override the Charter,
 * under which humans keep final authority regardless of role.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createPermissions = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ROLES = ["observer", "contributor", "steward", "admin"];
  function authority(role) { return ROLES.indexOf(role); }

  // default policy: operation → minimum role. Covers the API's 17 operations.
  var DEFAULT_POLICY = {
    "system.status": "observer", "snapshot": "observer",
    "reality.list": "observer", "decision.list": "observer",
    "knowledge.list": "observer", "project.list": "observer", "builds.list": "observer",
    "reality.observe": "contributor",
    "decision.propose": "contributor",
    "knowledge.learn": "contributor",
    "project.open": "contributor", "project.link": "contributor",
    "reality.verify": "steward", "reality.reject": "steward", "reality.archive": "steward",
    "decision.decide": "steward",
    "system.start": "steward",
    "identity.register": "admin", "identity.setRole": "admin", "identity.retire": "admin"
  };

  function createPermissions(options) {
    options = options || {};
    var identity = options.identity;
    if (!identity || typeof identity.current !== "function") {
      throw new TypeError("createPermissions requires an Identity: createPermissions({ identity })");
    }
    var policy = {};
    Object.keys(DEFAULT_POLICY).forEach(function (k) { policy[k] = DEFAULT_POLICY[k]; });
    if (options.policy) Object.keys(options.policy).forEach(function (k) {
      if (authority(options.policy[k]) < 0) throw new TypeError("policy for " + k + " must be a role: " + ROLES.join(", "));
      policy[k] = options.policy[k];
    });
    // the fallback role required by any operation not named in the policy
    var defaultRole = options.defaultRole || "steward";
    if (authority(defaultRole) < 0) throw new TypeError("defaultRole must be a role");
    // how much an unauthenticated caller may do (null = nothing until signed in)
    var anonymous = options.anonymous || null;
    if (anonymous && authority(anonymous) < 0) throw new TypeError("anonymous must be a role or null");

    function requiredFor(action) {
      return Object.prototype.hasOwnProperty.call(policy, action) ? policy[action] : defaultRole;
    }

    function effectiveAuthority(actor) {
      if (actor) return authority(actor.role);
      return anonymous ? authority(anonymous) : -1; // -1 = below observer, i.e. denied
    }

    function can(action, actor) {
      if (actor === undefined) actor = identity.current();
      return effectiveAuthority(actor) >= authority(requiredFor(action));
    }

    function guard(action, actor) {
      if (actor === undefined) actor = identity.current();
      if (!can(action, actor)) {
        throw new Error("permission denied: " + action + " requires " + requiredFor(action) +
          " (actor: " + (actor ? actor.id + "/" + actor.role : "anonymous") + ")");
      }
      return true;
    }

    function reason(action, actor) {
      if (actor === undefined) actor = identity.current();
      return can(action, actor) ? null :
        (action + " requires " + requiredFor(action) + "; " + (actor ? actor.id + " is " + actor.role : "no actor is signed in"));
    }

    // wrap an API (0017) so every call is permission-checked for the current actor
    function wrap(api) {
      if (!api || typeof api.call !== "function") throw new TypeError("wrap requires an OceanicOS API");
      return {
        call: function (op, params) {
          if (!can(op)) {
            return { ok: false, op: op, data: null, error: "permission denied: " + reason(op) };
          }
          return api.call(op, params);
        },
        describe: api.describe ? function () { return api.describe(); } : undefined,
        operations: api.operations ? function () { return api.operations(); } : undefined,
        permissions: function () { return { policy: policyOf(), current: identity.current() }; }
      };
    }

    function policyOf() { var out = {}; Object.keys(policy).forEach(function (k) { out[k] = policy[k]; }); return out; }

    return { can: can, guard: guard, reason: reason, requiredFor: requiredFor, wrap: wrap, policy: policyOf };
  }

  createPermissions.ROLES = ROLES.slice();
  createPermissions.DEFAULT_POLICY = (function () { var o = {}; Object.keys(DEFAULT_POLICY).forEach(function (k) { o[k] = DEFAULT_POLICY[k]; }); return o; })();
  return createPermissions;
});

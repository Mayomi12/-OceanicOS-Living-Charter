/*
 * Ω∞ OceanicOS :: Education
 * Build 0052 · Stage 7 (Ecosystem) · zero-runtime (plain browser or any JS engine)
 *
 * An ecosystem endures when it turns users into builders. Education is
 * learn-by-doing: a lesson is a sequence of steps, each with an instruction
 * and a CHECK that inspects the learner's REAL ocean — you advance by actually
 * doing the thing, never by clicking "next". Wrong or missing work is refused
 * GENTLY (a hint, not an error); the doctrine "verification before acceptance"
 * applied to learning itself.
 *
 *   lessons()                → the catalogue (built-ins + registered)
 *   registerLesson(def)      → contribute a lesson (id, title, description,
 *                              steps: [{ title, instruction, hint, check(os) }])
 *   enroll(lessonId, opts?)  → a session over a fresh, fully real OceanicOS:
 *       current()            → where you are and what to do
 *       attempt()            → re-inspect the ocean; advance iff the work is done
 *       progress()           → { step, total, percent, done }
 *       completed()          → true once every step's work stands in the ocean
 *
 * Completing a lesson writes a `type:"lesson"` record into the learner's own
 * ocean — education leaves evidence, like everything else here.
 *
 * Built-ins:
 *   first-drop         — the founding loop: observe → verify → decide → learn
 *   honest-corrections — the memory law: reject what was wrong, record what is
 *                        right, and prove the history survived
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createEducation = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function createEducation(options) {
    options = options || {};
    var C = options.core || (root && root.OceanicCore) || {};
    var oceanicFactory = options.oceanicFactory || C.createOceanic;
    if (typeof oceanicFactory !== "function") {
      throw new Error("createEducation needs the Kernel factory — load core/oceanic.js first, or pass { oceanicFactory }");
    }

    var catalogue = {};

    function registerLesson(def) {
      if (!def || typeof def.id !== "string" || !def.id) throw new TypeError("a lesson requires an id");
      if (catalogue[def.id]) throw new Error("a lesson with id '" + def.id + "' already exists");
      if (typeof def.title !== "string" || !def.title) throw new TypeError("a lesson requires a title");
      if (typeof def.description !== "string" || !def.description) throw new TypeError("a lesson requires a description");
      if (!Array.isArray(def.steps) || !def.steps.length) throw new TypeError("a lesson requires at least one step");
      def.steps.forEach(function (s, i) {
        if (!s || typeof s.instruction !== "string" || typeof s.check !== "function") {
          throw new TypeError("step " + (i + 1) + " needs an instruction and a check(os) function");
        }
      });
      catalogue[def.id] = { id: def.id, title: def.title, description: def.description,
                            steps: def.steps, builtin: !!def._builtin };
      return lessons();
    }

    function lessons() {
      return Object.keys(catalogue).sort().map(function (id) {
        var l = catalogue[id];
        return { id: l.id, title: l.title, description: l.description, steps: l.steps.length, builtin: l.builtin };
      });
    }

    function enroll(lessonId, opts) {
      var lesson = catalogue[lessonId];
      if (!lesson) throw new Error("no lesson with id '" + lessonId + "' — see lessons()");
      opts = opts || {};
      var os = opts.oceanic || oceanicFactory({ manual: true, name: "lesson-" + lessonId, now: opts.now });
      if (!opts.oceanic) os.start();
      var cursor = 0;
      var done = false;

      function current() {
        if (done) return { done: true, lesson: lesson.title };
        var s = lesson.steps[cursor];
        return { done: false, lesson: lesson.title, step: cursor + 1, total: lesson.steps.length,
                 title: s.title || ("step " + (cursor + 1)), instruction: s.instruction };
      }

      function attempt() {
        if (done) return { ok: false, done: true, hint: "the lesson is complete — enroll in another" };
        var s = lesson.steps[cursor];
        var passed = false;
        try { passed = s.check(os) === true; }
        catch (e) { passed = false; } // a broken world is not an error, just not yet the answer
        if (!passed) {
          return { ok: false, done: false, step: cursor + 1,
                   hint: s.hint || "not yet — re-read the instruction and inspect your ocean" };
        }
        cursor += 1;
        if (cursor >= lesson.steps.length) {
          done = true;
          os.memory.remember({
            type: "lesson", body: "completed lesson: " + lesson.title,
            source: "education", confidence: "certain",
            meta: { lesson: lesson.id, steps: lesson.steps.length, status: "completed" }
          });
          return { ok: true, done: true, message: "lesson complete — the evidence is in your ocean" };
        }
        return { ok: true, done: false, step: cursor + 1, next: current() };
      }

      function progress() {
        return { step: done ? lesson.steps.length : cursor, total: lesson.steps.length,
                 percent: Math.round(((done ? lesson.steps.length : cursor) / lesson.steps.length) * 100),
                 done: done };
      }

      return { lesson: lesson.id, oceanic: os, current: current, attempt: attempt,
               progress: progress, completed: function () { return done; } };
    }

    /* ---------------- built-in lessons ---------------- */

    registerLesson({ _builtin: true,
      id: "first-drop", title: "The First Drop",
      description: "the founding loop — observe reality, verify it, decide on it, distill knowledge from it",
      steps: [
        { title: "observe",
          instruction: "Record an observation about the world: oceanic.reality.observe({ observation: '...', source: '...' })",
          hint: "the ocean has no observations yet — call reality.observe()",
          check: function (os) { return os.reality.observations(false).length >= 1; } },
        { title: "verify",
          instruction: "Reality must be checked before it is trusted. Verify your observation: oceanic.reality.verify(oid)",
          hint: "your observation is still pending — pass its oid to reality.verify()",
          check: function (os) {
            return os.reality.observations(false).some(function (o) { return o.meta.status === "verified"; });
          } },
        { title: "decide",
          instruction: "Propose a decision grounded on your VERIFIED observation and commit it: decisions.propose({ question, options, grounds: [oid] }) then decisions.decide(did, choice)",
          hint: "no decided decision grounded on your observation yet — propose(), then decide()",
          check: function (os) {
            return os.memory.recall({ type: "decision" }).some(function (d) {
              return d.meta.status === "decided" && d.meta.grounds && d.meta.grounds.length >= 1;
            });
          } },
        { title: "learn",
          instruction: "Distill what this taught you: knowledge.learn({ statement, topics, grounds: [oid] })",
          hint: "no knowledge in the ocean yet — knowledge.learn() with your observation as ground",
          check: function (os) {
            return os.memory.recall({ type: "knowledge" }).some(function (k) {
              return k.meta.grounds && k.meta.grounds.length >= 1;
            });
          } }
      ]
    });

    registerLesson({ _builtin: true,
      id: "honest-corrections", title: "Honest Corrections",
      description: "the memory law — what was wrong is rejected openly, what is right is recorded beside it, and the history survives",
      steps: [
        { title: "observe (and be wrong)",
          instruction: "Record an observation you will later find was mistaken: reality.observe({ observation: '...', source: '...' })",
          hint: "record at least one observation first",
          check: function (os) { return os.reality.observations(false).length >= 1; } },
        { title: "reject openly",
          instruction: "It was wrong. Do NOT try to delete it (there is no delete) — reject it: reality.reject(oid)",
          hint: "no rejected observation yet — reality.reject(oid) marks it wrong WITHOUT erasing it",
          check: function (os) {
            return os.reality.observations(false).some(function (o) { return o.meta.status === "rejected"; });
          } },
        { title: "record what is right",
          instruction: "Now record the corrected observation and verify it",
          hint: "the ocean needs a VERIFIED observation standing beside the rejected one",
          check: function (os) {
            var obs = os.reality.observations(false);
            return obs.some(function (o) { return o.meta.status === "rejected"; }) &&
                   obs.some(function (o) { return o.meta.status === "verified"; });
          } },
        { title: "prove the history survived",
          instruction: "Nothing was erased: confirm memory.status().superseded > 0 and that recall({ includeSuperseded: true }) still shows the original pending record",
          hint: "look at memory.status() — the amendments that changed status are all still there",
          check: function (os) {
            var s = os.memory.status();
            return s.superseded > 0 && os.memory.recall({ includeSuperseded: true }).length > os.memory.recall({}).length;
          } }
      ]
    });

    return { lessons: lessons, registerLesson: registerLesson, enroll: enroll };
  }

  return createEducation;
});

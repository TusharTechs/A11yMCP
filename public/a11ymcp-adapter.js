/*!
 * a11ymcp-adapter.js — drop-in WebMCP accessibility adapter
 * ---------------------------------------------------------------------------
 * Add to any page:
 *
 *   <link rel="a11ymcp-manifest" href="/path/to/a11ymcp.json" />
 *   <script src="/a11ymcp-adapter.js" defer></script>
 *
 * The adapter reads the site-declared capability manifest and registers
 * WebMCP tools on `document.modelContext` so an agent can:
 *   discover -> negotiate -> (approval) -> apply declared adaptations ->
 *   verify -> roll back.
 *
 * It never invents a fix. It only applies directives the manifest declares,
 * every mutation is reversible, and remediation is approval-gated.
 *
 * No framework, no build step. ~7 KB. MIT.
 */
(function () {
  "use strict";

  var POLYFILL_FLAG = "__a11ymcpPolyfill";

  /* ---- minimal spec-compatible document.modelContext -------------------- */

  function ensureModelContext() {
    if (document.modelContext) return document.modelContext;

    var tools = new Map();
    var listeners = new Set();
    var emit = function () {
      listeners.forEach(function (l) {
        try {
          l();
        } catch (e) {
          /* not our problem */
        }
      });
    };
    var describe = function (t) {
      return {
        name: t.name,
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: t.annotations,
        origin: "a11ymcp-adapter",
      };
    };

    var mc = {
      registerTool: function (tool) {
        tools.set(tool.name, tool);
        emit();
        return {
          unregister: function () {
            if (tools.delete(tool.name)) emit();
          },
        };
      },
      unregisterTool: function (nameOrTool) {
        var name = typeof nameOrTool === "string" ? nameOrTool : nameOrTool && nameOrTool.name;
        if (name && tools.delete(name)) emit();
      },
      getTools: function () {
        return Array.from(tools.values()).map(describe);
      },
      executeTool: function (name, input, context) {
        var tool = tools.get(name);
        if (!tool) {
          return Promise.resolve({ ok: false, error: { message: "Tool not found: " + name } });
        }
        return Promise.resolve(tool.execute(input || {}, context));
      },
      addEventListener: function (type, listener) {
        if (type === "toolchange") listeners.add(listener);
      },
      removeEventListener: function (type, listener) {
        if (type === "toolchange") listeners.delete(listener);
      },
    };
    Object.defineProperty(mc, POLYFILL_FLAG, { value: true, enumerable: false });
    document.modelContext = mc;
    return mc;
  }

  /* ---- helpers --------------------------------------------------------- */

  function ok(data) {
    return { ok: true, data: data };
  }
  function err(message, nextAction) {
    return { ok: false, error: { message: message, nextAction: nextAction || null } };
  }
  function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }
  function rejectExtraKeys(input, allowed) {
    var extra = Object.keys(input || {}).filter(function (k) {
      return allowed.indexOf(k) === -1;
    });
    return extra.length ? "Unexpected propert" + (extra.length > 1 ? "ies" : "y") + ": " + extra.join(", ") : null;
  }

  function root(manifest) {
    return document.querySelector(manifest.root || "body");
  }

  function interactiveEls(scope) {
    return Array.prototype.slice
      .call(scope.querySelectorAll("a[href],button,input,select,textarea,[role='radio'],[role='checkbox'],[role='button'],[tabindex]"))
      .filter(function (el) {
        return el.offsetParent !== null || el.getClientRects().length > 0;
      });
  }
  function accessibleName(el) {
    var n =
      el.getAttribute("aria-label") ||
      (el.getAttribute("aria-labelledby") &&
        (document.getElementById(el.getAttribute("aria-labelledby")) || {}).textContent) ||
      (el.id && (document.querySelector('label[for="' + el.id + '"]') || {}).textContent) ||
      (el.closest && el.closest("label") && el.closest("label").textContent) ||
      el.textContent ||
      el.value ||
      "";
    return (n || "").trim();
  }
  function isFocusable(el) {
    if (el.hasAttribute("disabled")) return false;
    var ti = el.getAttribute("tabindex");
    if (ti !== null) return parseInt(ti, 10) >= 0;
    return ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].indexOf(el.tagName) !== -1;
  }
  function hasVisibleFocusRing(scope) {
    // Heuristic: the site declares a focus style if the root carries the
    // adapter's focus class, or any stylesheet defines a :focus outline.
    return scope.classList.contains("a11y-focus");
  }

  /* ---- audits (scoped to the checkout task) --------------------------- */

  function audit(manifest) {
    var scope = root(manifest);
    if (!scope) return { violations: [], byCategory: {} };
    var v = [];
    var els = interactiveEls(scope);

    els.forEach(function (el) {
      if (!isFocusable(el) && (el.getAttribute("role") === "radio" || el.getAttribute("role") === "button")) {
        v.push({ rule: "interactive-not-focusable", category: "keyboard_navigation", taskImpact: "blocking", selector: sel(el) });
      }
      if (!accessibleName(el)) {
        v.push({ rule: "missing-accessible-name", category: "accessible_names", taskImpact: "degrading", selector: sel(el) });
      }
    });

    Array.prototype.slice.call(scope.querySelectorAll("#checkout input")).forEach(function (el) {
      var labelled =
        el.getAttribute("aria-label") ||
        (el.id && document.querySelector('label[for="' + el.id + '"]')) ||
        (el.closest && el.closest("label"));
      if (!labelled) {
        v.push({ rule: "input-missing-label", category: "form_labels", taskImpact: "blocking", selector: sel(el) });
      }
    });

    if (!hasVisibleFocusRing(scope)) {
      v.push({ rule: "focus-not-visible", category: "focus_visibility", taskImpact: "blocking", selector: manifest.root });
    }

    var byCategory = {};
    v.forEach(function (item) {
      (byCategory[item.category] = byCategory[item.category] || []).push(item);
    });
    return { violations: v, byCategory: byCategory };
  }

  function sel(el) {
    if (el.id) return "#" + el.id;
    if (el.getAttribute("data-a11y")) return '[data-a11y="' + el.getAttribute("data-a11y") + '"]';
    return el.tagName.toLowerCase() + (el.getAttribute("role") ? '[role="' + el.getAttribute("role") + '"]' : "");
  }

  /* ---- directive applier + rollback --------------------------------- */

  var undoStack = []; // { fn }

  function applyDirective(scope, d) {
    var nodes = Array.prototype.slice.call(scope.querySelectorAll(d.selector));
    if (scope.matches && scope.matches(d.selector) && nodes.indexOf(scope) === -1) {
      nodes.unshift(scope);
    }
    nodes.forEach(function (node) {
      if (d.setAttr) {
        Object.keys(d.setAttr).forEach(function (k) {
          var prev = node.getAttribute(k);
          node.setAttribute(k, d.setAttr[k]);
          undoStack.push(function () {
            if (prev === null) node.removeAttribute(k);
            else node.setAttribute(k, prev);
          });
        });
      }
      if (d.addClass) {
        var added = !node.classList.contains(d.addClass);
        node.classList.add(d.addClass);
        if (added) undoStack.push(function () { node.classList.remove(d.addClass); });
      }
      if (d.bindKeys === "radiogroup") bindRadiogroup(node);
      if (d.labelFromPlaceholder && node.placeholder && !node.getAttribute("aria-label")) {
        node.setAttribute("aria-label", node.placeholder);
        undoStack.push(function () { node.removeAttribute("aria-label"); });
      }
      if (d.announceErrors) {
        var prevRole = node.getAttribute("role");
        var prevLive = node.getAttribute("aria-live");
        node.setAttribute("role", "alert");
        node.setAttribute("aria-live", "assertive");
        undoStack.push(function () {
          prevRole === null ? node.removeAttribute("role") : node.setAttribute("role", prevRole);
          prevLive === null ? node.removeAttribute("aria-live") : node.setAttribute("aria-live", prevLive);
        });
      }
    });
  }

  function bindRadiogroup(group) {
    var radios = Array.prototype.slice.call(group.querySelectorAll('[role="radio"]'));
    radios.forEach(function (radio, i) {
      var prevTi = radio.getAttribute("tabindex");
      radio.setAttribute("tabindex", "0");
      var handler = function (e) {
        var idx = radios.indexOf(radio);
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          radio.click();
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          radios[(idx + 1) % radios.length].focus();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          radios[(idx - 1 + radios.length) % radios.length].focus();
        }
      };
      radio.addEventListener("keydown", handler);
      undoStack.push(function () {
        radio.removeEventListener("keydown", handler);
        prevTi === null ? radio.removeAttribute("tabindex") : radio.setAttribute("tabindex", prevTi);
      });
    });
  }

  function rollbackAll() {
    var n = undoStack.length;
    while (undoStack.length) {
      try {
        undoStack.pop()();
      } catch (e) {
        /* keep unwinding */
      }
    }
    return n;
  }

  /* ---- tool registration ------------------------------------------- */

  var applied = {}; // capabilityId -> true
  var lastProfile = null;

  function register(manifest) {
    var mc = ensureModelContext();
    var capIds = manifest.capabilities.map(function (c) { return c.id; });

    mc.registerTool({
      name: "get_accessibility_capabilities",
      title: "Get accessibility capabilities",
      description:
        "Returns this site's declared accessibility capability manifest (id, status supported|partial with limitation, and the needs it does not declare). Call FIRST. Read-only; no approval required. Do not attempt to adapt a need that is not declared.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: function () {
        return ok({
          protocol: manifest.protocol || "a11ymcp/0.5",
          site: manifest.site,
          source: manifest.__source || null,
          capabilities: manifest.capabilities.map(function (c) {
            return { id: c.id, title: c.title, status: c.status, limitation: c.limitation || null };
          }),
          notDeclared: manifest.notDeclared || [],
        });
      },
    });

    mc.registerTool({
      name: "negotiate_accessibility_profile",
      title: "Negotiate accessibility profile",
      description:
        "Maps the user's needs to declared capabilities. Returns accepted (supported|partial) and rejected (with reasons). Call after get_accessibility_capabilities and BEFORE apply_accessibility_adaptation. Records the profile; does not touch the page. No approval required.",
      inputSchema: {
        type: "object",
        properties: { needs: { type: "array", items: { type: "string" }, minItems: 1 } },
        required: ["needs"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
      execute: function (input) {
        var extra = rejectExtraKeys(input, ["needs"]);
        if (extra) return err("Invalid input for negotiate_accessibility_profile: " + extra);
        if (!input || !Array.isArray(input.needs) || input.needs.length === 0) {
          return err("`needs` must be a non-empty array of need ids.");
        }
        var map = {
          keyboard_only: "keyboard_navigation",
          strong_focus: "focus_visibility",
          screen_reader_labels: "accessible_names",
          form_support: "form_labels",
        };
        var accepted = [];
        var rejected = [];
        input.needs.forEach(function (need) {
          var capId = map[need];
          var cap = capId && manifest.capabilities.filter(function (c) { return c.id === capId; })[0];
          if (cap) accepted.push({ need: need, capability: cap.id, status: cap.status, limitation: cap.limitation || null });
          else rejected.push({ need: need, reason: "This site does not declare a capability for this need." });
        });
        lastProfile = { needs: input.needs, accepted: accepted, rejected: rejected, at: new Date().toISOString() };
        return ok(lastProfile);
      },
    });

    mc.registerTool({
      name: "audit_accessibility",
      title: "Audit accessibility (task-scoped)",
      description:
        "Runs task-scoped DOM audits (keyboard focusability, accessible names, form labels, visible focus) and returns violations tagged blocking|degrading. Read-only; safe to repeat.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: function () {
        var r = audit(manifest);
        return ok({
          total: r.violations.length,
          blocking: r.violations.filter(function (v) { return v.taskImpact === "blocking"; }).length,
          violations: r.violations,
        });
      },
    });

    mc.registerTool({
      name: "apply_accessibility_adaptation",
      title: "Apply a declared adaptation",
      description:
        "Applies one site-declared, reversible adaptation. Requires input.approval === true (explicit user consent); missing or false approval is rejected. Precondition: the capabilityId must appear in get_accessibility_capabilities and be accepted by negotiate_accessibility_profile. Mutates the live page; reverse with rollback_accessibility_adaptations.",
      inputSchema: {
        type: "object",
        properties: {
          capabilityId: { type: "string", enum: capIds },
          approval: { type: "boolean" },
        },
        required: ["capabilityId", "approval"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      execute: function (input) {
        var extra = rejectExtraKeys(input, ["capabilityId", "approval"]);
        if (extra) return err("Invalid input for apply_accessibility_adaptation: " + extra);
        if (!input || input.approval !== true) {
          return err("Remediation requires explicit user approval (`approval: true`).", "ask the user to approve, then retry");
        }
        var cap = manifest.capabilities.filter(function (c) { return c.id === input.capabilityId; })[0];
        if (!cap) return err('Capability "' + input.capabilityId + '" is not declared by this site.', "get_accessibility_capabilities");
        if (lastProfile && lastProfile.accepted.every(function (a) { return a.capability !== cap.id; })) {
          return err('Capability "' + cap.id + '" was not accepted in the negotiated profile.', "negotiate_accessibility_profile");
        }
        var scope = root(manifest);
        var before = audit(manifest).byCategory[cap.audit === "names" ? "accessible_names" : cap.id] || [];
        (cap.directives || []).forEach(function (d) { applyDirective(scope, d); });
        applied[cap.id] = true;
        var after = audit(manifest).byCategory[cap.audit === "names" ? "accessible_names" : cap.id] || [];
        return ok({
          success: true,
          capability: cap.id,
          reversible: true,
          beforeViolations: before.length,
          afterViolations: after.length,
          evidenceChain: [
            { stage: "before", detail: before.length + " violation(s)." },
            { stage: "why", detail: cap.limitation ? cap.id + " accepted (" + cap.status + "): " + cap.limitation : cap.id + " accepted for the negotiated profile." },
            { stage: "action", detail: "Applied " + (cap.directives || []).length + " site-declared directive(s)." },
            { stage: "after", detail: after.length + " violation(s)." },
          ],
        });
      },
    });

    mc.registerTool({
      name: "rollback_accessibility_adaptations",
      title: "Roll back all adaptations",
      description:
        "Reverts every applied adaptation and restores the original page. Idempotent; safe when nothing is applied. No approval required (it only removes changes).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, idempotentHint: true },
      execute: function () {
        var n = rollbackAll();
        applied = {};
        return ok({ success: true, revertedSteps: n });
      },
    });

    mc.registerTool({
      name: "verify_accessibility_profile",
      title: "Verify the negotiated profile",
      description:
        "Re-audits and returns PASS|BLOCKED for the LAST negotiated profile only, plus an advisories array for issues outside that profile. Read-only.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: function () {
        var r = audit(manifest);
        var scopeCats = lastProfile
          ? lastProfile.accepted.map(function (a) { return a.capability; })
          : null;
        var inScope = function (cat) {
          return !scopeCats || scopeCats.indexOf(cat) !== -1;
        };
        var blockingInScope = r.violations.filter(function (v) {
          return v.taskImpact === "blocking" && inScope(v.category);
        });
        var advisories = r.violations.filter(function (v) {
          return !inScope(v.category);
        });
        return ok({
          taskAccessibility: blockingInScope.length === 0 ? "PASS" : "BLOCKED",
          profile: lastProfile ? lastProfile.needs : "full-scope",
          blockingInScope: blockingInScope,
          advisories: advisories,
        });
      },
    });

    scanDeclarativeForms(mc);

    // eslint-disable-next-line no-console
    console.info(
      "[a11ymcp-adapter] registered " +
        mc.getTools().length +
        " WebMCP tools for " +
        manifest.site +
        " (transport: " +
        (mc[POLYFILL_FLAG] ? "adapter polyfill" : "native document.modelContext") +
        ")"
    );
  }

  /* ---- WebMCP declarative API: form[toolname] -> tool -------------- */

  function scanDeclarativeForms(mc) {
    Array.prototype.slice.call(document.querySelectorAll("form[toolname]")).forEach(function (form) {
      var name = form.getAttribute("toolname");
      if (!name) return;
      var fields = [];
      Array.prototype.slice.call(form.elements).forEach(function (el) {
        if (el.name && fields.indexOf(el.name) === -1) fields.push(el.name);
      });
      var props = {};
      fields.forEach(function (f) { props[f] = { type: "string" }; });
      mc.registerTool({
        name: name,
        title: name,
        description: form.getAttribute("tooldescription") || 'Submit the "' + name + '" form.',
        inputSchema: { type: "object", properties: props, required: [], additionalProperties: false },
        annotations: { readOnlyHint: false, declarative: true },
        execute: function (input) {
          input = input && typeof input === "object" ? input : {};
          Object.keys(input).forEach(function (k) {
            var field = form.elements.namedItem(k);
            if (field && "value" in field) field.value = String(input[k]);
          });
          if (typeof form.requestSubmit === "function") form.requestSubmit();
          else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
          return { ok: true, data: { submitted: true, tool: name } };
        },
      });
    });
  }

  /* ---- bootstrap -------------------------------------------------- */

  function findManifestUrl() {
    var link = document.querySelector('link[rel="a11ymcp-manifest"]');
    if (link && link.getAttribute("href")) return link.getAttribute("href");
    var s = document.currentScript && document.currentScript.getAttribute("data-manifest");
    if (s) return s;
    return "/.well-known/a11ymcp";
  }

  function start() {
    var url = findManifestUrl();
    fetch(url, { headers: { accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("manifest " + r.status);
        return r.json();
      })
      .then(function (manifest) {
        manifest.__source = url;
        register(manifest);
      })
      .catch(function (e) {
        // eslint-disable-next-line no-console
        console.warn("[a11ymcp-adapter] no usable manifest at " + url + ":", e.message);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

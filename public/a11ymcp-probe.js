/*!
 * a11ymcp-probe.js — "what does this page look like to an agent?"
 * ---------------------------------------------------------------------------
 * A bookmarklet-sized probe you can run on ANY page. It answers four
 * questions and changes nothing:
 *
 *   1. Does this browser have WebMCP at all — native, or a page polyfill?
 *   2. How many tools does this page register on document.modelContext?
 *   3. Does the page declare an accessibility capability contract?
 *   4. If not: what would an agent have to do instead?
 *
 * It deliberately does NOT adapt the page. Mutating someone else's site
 * without their knowledge is precisely the overlay behaviour A11yMCP argues
 * against; a probe that did it would be arguing against itself. The only DOM
 * this script adds is its own dismissible panel, and removing the panel
 * removes every trace of it.
 *
 * MIT. See https://a11ymcp.vercel.app
 */
(function () {
  "use strict";

  var PANEL_ID = "a11ymcp-probe-panel";

  var existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.remove();
    return;
  }

  /* ---- gather ---------------------------------------------------------- */

  function transport() {
    var mc = document.modelContext;
    if (!mc) return { label: "none", detail: "This browser has no document.modelContext, and this page did not install a polyfill. An agent has no tools to call here — only pixels and DOM." };
    if (mc.__a11ymcpPolyfill) return { label: "page polyfill", detail: "The page installed a spec-compatible document.modelContext itself, so its tools work in browsers that do not ship WebMCP yet." };
    return { label: "native", detail: "The browser implements document.modelContext. Tools registered by this page are available to an agent directly." };
  }

  function tools() {
    var mc = document.modelContext;
    if (!mc || typeof mc.getTools !== "function") return Promise.resolve(null);
    try {
      return Promise.resolve(mc.getTools()).then(function (list) {
        return Array.isArray(list) ? list : null;
      });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function declarativeForms() {
    return Array.prototype.slice.call(document.querySelectorAll("form[toolname]"));
  }

  function manifestLink() {
    var link = document.querySelector('link[rel="a11ymcp-manifest"]');
    return link ? link.getAttribute("href") : null;
  }

  function wellKnown() {
    return fetch("/.well-known/a11ymcp", { headers: { accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* ---- render ---------------------------------------------------------- */

  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === "text") node.textContent = props[k];
      else if (k === "style") node.setAttribute("style", props[k]);
      else node.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (child) { node.appendChild(child); });
    return node;
  }

  var PANEL_STYLE = [
    "position:fixed", "inset-block-start:16px", "inset-inline-end:16px",
    "z-index:2147483647", "max-inline-size:380px", "max-block-size:80vh",
    "overflow:auto", "background:#ffffff", "color:#0f172a",
    "border:2px solid #2563eb", "border-radius:12px", "padding:16px",
    "font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif",
    "box-shadow:0 10px 40px rgba(0,0,0,.25)",
  ].join(";");

  function row(label, value, good) {
    return el("div", { style: "margin:10px 0" }, [
      el("div", {
        text: label,
        style: "font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#475569",
      }),
      el("div", {
        text: value,
        style:
          "font-weight:600;color:" +
          (good === true ? "#15803d" : good === false ? "#b91c1c" : "#0f172a"),
      }),
    ]);
  }

  function paragraph(text) {
    return el("p", {
      text: text,
      style: "margin:6px 0 0;font-size:12.5px;color:#475569",
    });
  }

  var panel = el("div", {
    id: PANEL_ID,
    role: "dialog",
    "aria-modal": "false",
    "aria-label": "A11yMCP probe results",
    tabindex: "-1",
    style: PANEL_STYLE,
  });

  var close = el("button", {
    type: "button",
    "aria-label": "Close the A11yMCP probe",
    text: "✕",
    style:
      "position:absolute;inset-block-start:8px;inset-inline-end:8px;background:transparent;border:0;font-size:16px;cursor:pointer;color:#0f172a;padding:4px 8px",
  });
  close.addEventListener("click", function () { panel.remove(); });
  panel.appendChild(close);

  panel.appendChild(
    el("div", {
      text: "A11yMCP probe",
      style: "font-weight:700;font-size:15px;padding-inline-end:24px",
    })
  );
  panel.appendChild(
    el("div", {
      text: location.host,
      style: "font-size:12px;color:#475569;margin-block-end:4px",
    })
  );

  var body = el("div", { "aria-live": "polite" });
  panel.appendChild(body);
  document.body.appendChild(panel);
  panel.focus();

  document.addEventListener("keydown", function onKey(event) {
    if (event.key === "Escape" && document.getElementById(PANEL_ID)) {
      panel.remove();
      document.removeEventListener("keydown", onKey);
    }
  });

  /* ---- report ---------------------------------------------------------- */

  var t = transport();
  body.appendChild(row("WebMCP transport", t.label, t.label !== "none"));
  body.appendChild(paragraph(t.detail));

  Promise.all([tools(), wellKnown()]).then(function (results) {
    var toolList = results[0];
    var wk = results[1];
    var forms = declarativeForms();
    var link = manifestLink();

    body.appendChild(
      row(
        "Tools registered by this page",
        toolList ? String(toolList.length) : "0",
        Boolean(toolList && toolList.length)
      )
    );
    if (toolList && toolList.length) {
      body.appendChild(
        el("div", {
          text: toolList
            .map(function (tool) { return tool && tool.name; })
            .filter(Boolean)
            .join(", "),
          style:
            "font-family:ui-monospace,Menlo,monospace;font-size:11.5px;background:#f1f5f9;border-radius:6px;padding:6px 8px;margin-block-start:4px;word-break:break-word",
        })
      );
    }

    body.appendChild(
      row(
        "Declarative form tools",
        String(forms.length),
        forms.length > 0 ? true : null
      )
    );

    var contract = link || wk;
    body.appendChild(
      row(
        "Accessibility capability contract",
        contract ? "declared" : "none",
        Boolean(contract)
      )
    );

    if (contract) {
      var caps = (wk && wk.capabilities) || [];
      body.appendChild(
        paragraph(
          "This site declares what it is willing to adapt" +
            (caps.length
              ? ": " + caps.map(function (c) { return c.id; }).join(", ") + "."
              : ".") +
            " An agent can discover it, negotiate against it, ask permission, and verify the result."
        )
      );
    } else {
      body.appendChild(
        paragraph(
          "This page declares nothing about what it can adapt. An agent " +
            "helping a disabled person here has to infer meaning from the DOM " +
            "and, to change anything, inject CSS or attributes the site never " +
            "authorised — with no way to check whether the site considers the " +
            "result correct."
        )
      );
      body.appendChild(
        paragraph(
          "Adoption is a manifest file and a script tag. This probe will not " +
            "adapt the page: doing that uninvited is the overlay behaviour " +
            "A11yMCP exists to replace."
        )
      );
    }

    body.appendChild(
      el("a", {
        href: contract
          ? "https://a11ymcp.vercel.app/demo?judge=1"
          : "https://a11ymcp.vercel.app/partner",
        target: "_blank",
        rel: "noreferrer noopener",
        text: contract
          ? "Watch an agent use a contract like this →"
          : "See a page that does declare one →",
        style: "display:inline-block;margin-block-start:10px;color:#2563eb;font-size:12.5px",
      })
    );
  });
})();

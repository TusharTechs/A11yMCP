/**
 * Demo director — drives a real, visible Chrome window through the shooting
 * script so you can screen-record it.
 *
 *   node docs/direct-demo.mjs                # the whole run, in order
 *   node docs/direct-demo.mjs --scene 5      # set up, wait for you, then scene 5
 *   node docs/direct-demo.mjs --list         # scene numbers and names
 *
 * This is NOT a headless capture. It opens Chrome on your machine and
 * performs the demo in it; you record your own screen with OBS or QuickTime.
 * The video is genuinely a recording of your screen — the script only
 * removes the risk of fumbling a Tab count on take nine.
 *
 * Because Playwright dispatches input through the browser rather than the OS,
 * your physical cursor never moves. The script injects its own cursor and a
 * keycast overlay so the recording shows what is being pressed and clicked.
 *
 *   RECORD WITH THE CURSOR OFF. In OBS, uncheck "Show Cursor" on the display
 *   capture. Otherwise your parked physical pointer appears alongside the
 *   synthetic one. If you must use QuickTime, park the real pointer in a
 *   screen corner outside the browser window.
 *
 * Options:
 *   --url <url>      default https://a11ymcp.vercel.app
 *   --width  <px>    window width  (default 1180 — below 1200 the demo's
 *                    three-column layout stacks, so the storefront is
 *                    full-width and legible in the Tab drills)
 *   --height <px>    window height (default 820)
 *   --zoom <n>       page zoom, e.g. 1.15 for legibility (default 1)
 *   --pace <n>       multiply every pause. A full run is ~1:47 at pace 1;
 *                    use 1.5 to land near the 2:48 shooting script.
 *   --keep-open      leave the browser open when the run finishes
 *   --headless       dry run — validate the whole sequence with no window
 *   --no-wait        skip the "press Enter" pause (for dry runs)
 *   --record <dir>   ALSO capture the window to WebM in <dir>. Implies a
 *                    headless run: a fallback track if you would rather not
 *                    record your own screen. No cursor from the OS, 25fps.
 */

import { chromium } from "@playwright/test";
import readline from "node:readline";

/* ---------------------------------------------------------------- args -- */

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const BASE = (flag("url", "https://a11ymcp.vercel.app")).replace(/\/$/, "");
const WIDTH = Number(flag("width", 1180));
const HEIGHT = Number(flag("height", 820));
const ZOOM = Number(flag("zoom", 1));
const PACE = Number(flag("pace", 1));
const ONLY = flag("scene", null);
const RECORD = flag("record", null);

/* -------------------------------------------------------------- timing -- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms * PACE));

/** A pause with a little human variance, so nothing lands on a metronome. */
const human = (base, spread = 0.25) =>
  sleep(base * (1 + (Math.random() * 2 - 1) * spread));

const easeInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* ------------------------------------------------------------ overlays -- */

/**
 * Injected once per document: a synthetic pointer and a keycast strip.
 * Both are inert — `pointer-events: none`, `aria-hidden`, nothing focusable —
 * so they cannot appear in the page's own accessibility audits or tab order.
 */
const OVERLAY = () => {
  if (window.__demoOverlay) return;
  window.__demoOverlay = true;

  const CSS = `
    #demo-cursor {
      position: fixed; z-index: 2147483647; inset-block-start: 0; inset-inline-start: 0;
      width: 24px; height: 24px; pointer-events: none; opacity: 0;
      transition: opacity 160ms ease;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,.5));
    }
    #demo-ring {
      position: fixed; z-index: 2147483646; pointer-events: none;
      width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      border: 2px solid #2563eb; opacity: 0; transform: scale(.4);
    }
    #demo-ring.fire { animation: demo-ping 520ms ease-out; }
    @keyframes demo-ping {
      0%   { opacity: .95; transform: scale(.35); }
      100% { opacity: 0;   transform: scale(1.6); }
    }
    #demo-keys {
      position: fixed; z-index: 2147483647; inset-block-end: 30px;
      inset-inline-start: 50%; transform: translateX(-50%);
      display: flex; gap: 9px; pointer-events: none;
      font: 700 21px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    #demo-focus {
      position: fixed; z-index: 2147483645; pointer-events: none;
      border: 3px dashed #e11d8f; border-radius: 8px;
      opacity: 0; transition: opacity 120ms ease;
    }
    #demo-focus::after {
      content: "focus"; position: absolute;
      inset-block-end: 100%; inset-inline-end: -3px; margin-block-end: 4px;
      background: #e11d8f; color: #fff; border-radius: 4px;
      padding: 2px 7px; white-space: nowrap;
      font: 700 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .08em; text-transform: uppercase;
    }
    #demo-keys span {
      background: rgba(15,23,42,.94); color: #f8fafc;
      border: 1px solid rgba(255,255,255,.24); border-bottom-width: 3px;
      border-radius: 9px; padding: 11px 15px;
      box-shadow: 0 8px 26px rgba(0,0,0,.4);
      animation: demo-key 1100ms ease-out forwards;
    }
    @keyframes demo-key {
      0%   { opacity: 0; transform: translateY(9px) scale(.94); }
      10%  { opacity: 1; transform: none; }
      75%  { opacity: 1; }
      100% { opacity: 0; transform: translateY(-7px); }
    }
  `;

  const CURSOR_SVG =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M4 2 L4 19 L8.4 14.6 L11.4 21.4 L14.8 19.8 L11.7 13.3 L18 13.1 Z" ' +
    'fill="#ffffff" stroke="#0f172a" stroke-width="1.7" stroke-linejoin="round"/></svg>';

  let cursor = null;
  let ring = null;
  let keys = null;
  let focusBox = null;
  let pending = null;
  let focusOn = false;

  // addInitScript runs at document-start, before <head> and <body> exist, so
  // every DOM touch has to wait for the document to be ready. Getting this
  // wrong fails silently: the flag above is set, and nothing else happens.
  const mount = () => {
    if (cursor) return;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = CURSOR_SVG;

    ring = document.createElement("div");
    ring.id = "demo-ring";
    ring.setAttribute("aria-hidden", "true");

    keys = document.createElement("div");
    keys.id = "demo-keys";
    keys.setAttribute("aria-hidden", "true");

    focusBox = document.createElement("div");
    focusBox.id = "demo-focus";
    focusBox.setAttribute("aria-hidden", "true");

    document.body.append(cursor, ring, keys, focusBox);
    if (pending) {
      window.__cursorTo(pending[0], pending[1]);
      pending = null;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  window.__cursorTo = (x, y) => {
    if (!cursor) { pending = [x, y]; return; }
    cursor.style.opacity = "1";
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    ring.style.insetInlineStart = `${x}px`;
    ring.style.insetBlockStart = `${y}px`;
  };

  /**
   * Draws where keyboard focus actually is.
   *
   * Before adaptation the storefront sets `outline: none !important` on
   * `:focus`, so focus is genuinely invisible — that IS the barrier, but it
   * makes for a scene where nothing appears to happen. This annotation is
   * deliberately unlike a real focus ring (dashed, magenta, labelled) so it
   * reads as the director pointing at something, never as a style the site
   * provides. In the "after" scene it sits alongside the site's own solid
   * blue ring, which is the whole comparison.
   */
  const drawFocus = () => {
    if (!focusBox) return;
    const el = document.activeElement;
    if (!focusOn || !el || el === document.body || el === document.documentElement) {
      focusBox.style.opacity = "0";
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      focusBox.style.opacity = "0";
      return;
    }
    const pad = 4;
    focusBox.style.opacity = "1";
    focusBox.style.insetInlineStart = `${r.left - pad}px`;
    focusBox.style.insetBlockStart = `${r.top - pad}px`;
    focusBox.style.width = `${r.width + pad * 2}px`;
    focusBox.style.height = `${r.height + pad * 2}px`;
  };

  window.__focusTracker = (on) => {
    focusOn = Boolean(on);
    drawFocus();
  };

  document.addEventListener("focusin", drawFocus, true);
  document.addEventListener("focusout", () => setTimeout(drawFocus, 0), true);
  window.addEventListener("scroll", drawFocus, true);
  window.addEventListener("resize", drawFocus);

  window.__cursorClick = () => {
    if (!ring) return;
    ring.classList.remove("fire");
    void ring.offsetWidth;
    ring.classList.add("fire");
  };

  const LABEL = {
    Tab: "Tab", Enter: "Enter", Escape: "Esc", " ": "Space",
    ArrowRight: "\u2192", ArrowLeft: "\u2190", ArrowUp: "\u2191", ArrowDown: "\u2193",
    Shift: "Shift", Control: "Ctrl", Meta: "Cmd", Alt: "Alt",
  };

  window.addEventListener(
    "keydown",
    (event) => {
      if (!keys) return;
      const label = LABEL[event.key] ?? (event.key.length === 1 ? event.key : null);
      if (!label) return;
      const cap = document.createElement("span");
      cap.textContent = label;
      keys.appendChild(cap);
      setTimeout(() => cap.remove(), 1150);
    },
    true
  );
};

/* --------------------------------------------------------------- input -- */

let cursorAt = { x: WIDTH / 2, y: HEIGHT / 2 };

/** Moves the pointer along an eased path, so it reads as a hand, not a jump. */
async function glideTo(page, x, y, ms = 520) {
  const from = { ...cursorAt };
  const steps = Math.max(12, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const t = easeInOut(i / steps);
    const nx = from.x + (x - from.x) * t;
    const ny = from.y + (y - from.y) * t;
    await page.mouse.move(nx, ny);
    await page.evaluate(([a, b]) => window.__cursorTo?.(a, b), [nx, ny]).catch(() => {});
    await sleep(ms / steps);
  }
  cursorAt = { x, y };
}

async function clickTarget(page, locator, { settle = 420 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  await sleep(200);
  const box = await locator.boundingBox();
  if (!box) throw new Error("target has no box — is it visible?");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await glideTo(page, x, y);
  await human(settle);           // the beat before a real click
  await page.evaluate(() => window.__cursorClick?.()).catch(() => {});
  await page.mouse.click(x, y);
  await human(240);
}

/** Centres an element in the window the way a person would scroll to it. */
async function frame(page, locator, hold = 500) {
  await locator.evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "smooth" })
  );
  await sleep(900);
  await sleep(hold);
}

/** Turns the director's focus annotation on or off. */
async function focusTracker(page, on) {
  await page.evaluate((v) => window.__focusTracker?.(v), on).catch(() => {});
}

async function press(page, key, gap = 850) {
  await page.keyboard.press(key);
  await human(gap, 0.18);
}

/* -------------------------------------------------------------- scenes -- */

const S = (n) => `#noma-fixture ${n}`;

const scenes = [
  {
    n: 1,
    name: "The wall",
    setup: async (page) => {
      await page.goto(`${BASE}/demo?judge=1`, { waitUntil: "networkidle" });
      await page.evaluate(() => localStorage.removeItem("a11ymcp:profile"));
      await page.reload({ waitUntil: "networkidle" });
    },
    run: async (page) => {
      const search = page.locator(S('input[type="search"]'));
      await frame(page, page.locator("#noma-fixture"), 700);
      await focusTracker(page, true);
      await clickTarget(page, search);
      await sleep(600);
      // Past the last product, and straight to Add to cart. The site draws no
      // focus indicator at all here, so without the annotation this scene
      // shows nothing moving — the barrier is literally invisible.
      for (let i = 0; i < 5; i++) await press(page, "Tab", 950);
      await sleep(2200);
      await focusTracker(page, false);
    },
  },

  {
    n: 2,
    name: "Ask the website",
    setup: async (page) => scenes[0].setup(page),
    run: async (page) => {
      const judge = page.getByRole("region", { name: "Judge mode" });
      await frame(page, judge, 900);
      // Rest on the transport chip for a beat before starting.
      await glideTo(page, WIDTH * 0.32, HEIGHT * 0.34);
      await sleep(1400);
      await clickTarget(page, judge.getByRole("button", { name: "Start the run" }));
      await page.getByText("3/8 steps").waitFor({ timeout: 30000 }).catch(() => {});
      await sleep(1200);
    },
  },

  {
    n: 3,
    name: "The honest no",
    needsRun: "negotiated",
    run: async (page) => {
      const judge = page.getByRole("region", { name: "Judge mode" });
      await judge
        .getByText(/Negotiation: \d+ accepted, [1-9]\d* rejected/)
        .waitFor({ timeout: 30000 });
      await frame(page, judge.getByText(/rejected/).first(), 300);
      await sleep(4200); // hold — this is the punch-in in post
    },
  },

  {
    n: 4,
    name: "It asks first",
    needsRun: "negotiated",
    run: async (page) => {
      const judge = page.getByRole("region", { name: "Judge mode" });
      const dialog = judge.getByRole("alertdialog", { name: "Approval requested" });
      await dialog.waitFor({ timeout: 30000 });
      await frame(page, dialog, 400);
      await sleep(2200); // the pause is the point
      await clickTarget(page, dialog.getByRole("button", { name: "Approve", exact: true }));
      await sleep(900);
    },
  },

  {
    n: 5,
    name: "Tab, again",
    needsRun: "adapted",
    run: async (page) => {
      const search = page.locator(S('input[type="search"]'));
      await frame(page, page.locator("#noma-fixture"), 700);
      // Same annotation as scene 1 — but now the site's own solid blue ring
      // is under it. That contrast is the point of the scene.
      await focusTracker(page, true);
      await clickTarget(page, search);
      await sleep(600);
      await press(page, "Tab", 900);          // Search
      await press(page, "Tab", 900);          // Select NOMA Runner
      await press(page, "Tab", 1000);         // size 8  — the ring is visible now
      await sleep(500);
      await press(page, "ArrowRight", 1000);  // 9, and it selects as it moves
      await press(page, "ArrowRight", 900);   // 10
      await press(page, "ArrowLeft", 1100);   // back to 9
      await sleep(2400);
      await focusTracker(page, false);
    },
  },

  {
    n: 6,
    name: "It checks its own work",
    needsRun: "adapted",
    run: async (page) => {
      const judge = page.getByRole("region", { name: "Judge mode" });
      const pass = judge.getByText(/Verification: PASS/);
      await pass.waitFor({ timeout: 30000 });
      await frame(page, pass, 400);
      await sleep(3200);
    },
  },

  {
    n: 7,
    name: "She buys the shoes",
    needsRun: "adapted",
    run: async (page) => {
      const judge = page.getByRole("region", { name: "Judge mode" });
      const dialog = judge.getByRole("alertdialog", { name: "Order confirmation" });
      await dialog.waitFor({ timeout: 30000 });
      await frame(page, dialog, 400);
      await sleep(1200);
      await clickTarget(page, dialog.getByRole("button", { name: "Confirm order" }));
      await page.getByText("8/8 steps").waitFor({ timeout: 30000 });
      await sleep(3200); // hold on the order id
    },
  },

  {
    n: 8,
    name: "The same task, two ways",
    needsRun: "ordered",
    run: async (page) => {
      const race = page.getByRole("region", { name: "Side-by-side proof" });
      await frame(page, race, 700);
      await clickTarget(page, race.getByRole("button", { name: "Run both lanes" }));

      const dialog = race.getByRole("alertdialog", { name: "Approval requested" });
      await dialog.waitFor({ timeout: 40000 });
      await sleep(1400);
      await clickTarget(page, dialog.getByRole("button", { name: "Approve", exact: true }));

      await race
        .getByText(/ORDER PLACED — verified by the site/)
        .waitFor({ timeout: 60000 });
      // Centre the verdict row, not the whole section: the lanes are ~960px
      // tall and centring them puts the two verdicts off the bottom of the
      // frame — and the verdicts are the shot.
      await frame(page, race.locator(".race-verdict").first(), 600);
      await sleep(4500); // both verdicts in one frame — the thumbnail
    },
  },

  {
    n: 9,
    name: "Not just this app",
    run: async (page) => {
      await page.goto(`${BASE}/partner`, { waitUntil: "networkidle" });
      await sleep(1200);
      await frame(page, page.locator(".note, .note *, p").first(), 300);
      await sleep(4200);

      await page.goto(`${BASE}/inspector`, { waitUntil: "networkidle" });
      const co = page.getByRole("region", { name: "Cross-origin tools" });
      await frame(page, co, 600);
      await clickTarget(page, co.getByRole("button", { name: "Ask the widget for its tools" }));
      await co.getByText(/of 3 tools visible/).waitFor({ timeout: 30000 });
      await sleep(4500);
    },
  },

  {
    n: 10,
    name: "Close",
    run: async (page) => {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await sleep(4500); // static hero — drop your title card over this in post
    },
  },
];

/* ------------------------------------------------- run-state fast-forward */

/**
 * Scenes 3–8 need the guided run to already be part-way through. When you
 * record one of them on its own, this gets the page there *before* you start
 * recording, so the setup never lands in the take.
 */
async function fastForward(page, needed) {
  if (!needed) return;
  await scenes[0].setup(page);

  const judge = page.getByRole("region", { name: "Judge mode" });
  await judge.getByRole("button", { name: "Start the run" }).click();

  if (needed === "negotiated") {
    await judge
      .getByText(/Negotiation: \d+ accepted, [1-9]\d* rejected/)
      .waitFor({ timeout: 40000 });
    return;
  }

  await judge
    .getByRole("alertdialog", { name: "Approval requested" })
    .getByRole("button", { name: "Approve", exact: true })
    .click();

  if (needed === "adapted") {
    await judge
      .getByRole("alertdialog", { name: "Order confirmation" })
      .waitFor({ timeout: 40000 });
    return;
  }

  if (needed === "ordered") {
    await judge
      .getByRole("alertdialog", { name: "Order confirmation" })
      .getByRole("button", { name: "Confirm order" })
      .click();
    await page.getByText("8/8 steps").waitFor({ timeout: 40000 });
  }
}

/* ----------------------------------------------------------------- main -- */

function waitForEnter(prompt) {
  if (has("no-wait")) {
    console.log(prompt + "(skipped)");
    return Promise.resolve();
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => { rl.close(); resolve(); }));
}

async function countdown(seconds) {
  if (has("no-wait")) return;
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r  rolling in ${i}… `);
    await new Promise((r) => setTimeout(r, 1000));
  }
  process.stdout.write("\r  action.            \n");
}

if (has("list")) {
  console.log("\n  A11yMCP demo scenes\n");
  scenes.forEach((s) => console.log(`   ${String(s.n).padStart(2)}  ${s.name}`));
  console.log("\n  node docs/direct-demo.mjs --scene 5\n");
  process.exit(0);
}

const browser = await chromium.launch({
  // --headless is a dry run: same script, no window, nothing to record.
  // Use it to check the whole sequence still passes before you set up.
  headless: has("headless") || Boolean(RECORD),
  args: [
    `--window-size=${WIDTH},${HEIGHT}`,
    "--window-position=0,0",
    "--hide-crash-restore-bubble",
    "--disable-infobars",
  ],
});

const context = await browser.newContext({
  // A recorded run needs a fixed viewport; a live one fills the real window.
  viewport: RECORD ? { width: WIDTH, height: HEIGHT } : null,
  reducedMotion: "no-preference", // guarantee the app animates, whatever the OS says
  ...(RECORD
    ? { recordVideo: { dir: RECORD, size: { width: WIDTH, height: HEIGHT } } }
    : {}),
});
await context.addInitScript(OVERLAY);

const page = await context.newPage();
if (ZOOM !== 1) {
  await context.addInitScript((z) => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.zoom = String(z);
    });
  }, ZOOM);
}

const chosen = ONLY ? scenes.filter((s) => String(s.n) === String(ONLY)) : scenes;
if (chosen.length === 0) {
  console.error(`No scene ${ONLY}. Try --list.`);
  await browser.close();
  process.exit(1);
}

console.log(`\n  A11yMCP demo director → ${BASE}`);
console.log(`  window ${WIDTH}×${HEIGHT} · pace ×${PACE}${ZOOM !== 1 ? ` · zoom ${ZOOM}` : ""}\n`);

if (ONLY) {
  const scene = chosen[0];
  console.log(`  Scene ${scene.n} — ${scene.name}`);
  if (scene.setup) await scene.setup(page);
  else if (scene.needsRun) await fastForward(page, scene.needsRun);
  else await page.goto(`${BASE}/demo?judge=1`, { waitUntil: "networkidle" });

  console.log("\n  Set up. Position the window, start your recorder,");
  await waitForEnter("  then press Enter here to roll. ");
  await countdown(3);
  await scene.run(page);
  console.log(`\n  Scene ${scene.n} done. Stop recording.\n`);
} else {
  await scenes[0].setup(page);
  console.log("  Set up. Start your recorder,");
  await waitForEnter("  then press Enter here to roll. ");
  await countdown(5);

  for (const scene of scenes) {
    console.log(`  ▸ ${String(scene.n).padStart(2)}  ${scene.name}`);
    await scene.run(page);
    await sleep(400); // a clean seam to cut on
  }
  console.log("\n  Done. Stop recording.\n");
}

if (RECORD) {
  await sleep(600);
  await context.close();          // flushes the video file
  const file = await page.video()?.path();
  console.log(`  video → ${file}\n`);
}

if (!has("keep-open")) {
  await sleep(1200);
  await browser.close();
}

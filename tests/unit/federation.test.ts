// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  ToolFrameClient,
  ToolFrameUnavailable,
  installToolFrameHost,
} from "@/lib/webmcp/federation";
import { ensureModelContext } from "@/lib/webmcp/polyfill";

/**
 * The framed document is the authority on who may see and run its tools.
 * These tests drive the host half directly — `public/tool-frame.html` mirrors
 * it in vanilla JS for the sandboxed-iframe demo, and
 * `tests/e2e/cross-origin.spec.ts` exercises that across a real origin
 * boundary.
 */

const EMBEDDER = "https://embedder.example";
const STRANGER = "https://somebody-else.example";

interface Reply {
  ok: boolean;
  tools?: Array<{ name: string }>;
  result?: { ok: boolean; data?: unknown; error?: { message: string } };
  error?: string;
}

function setup(): { ask: (origin: string, body: object) => Promise<Reply> } {
  document.modelContext = undefined;
  const modelContext = ensureModelContext()!;

  modelContext.registerTool(
    {
      name: "get_next_departures",
      description: "Shared.",
      execute: () => ({
        content: [{ type: "text", text: "ok" }],
        structuredContent: { ok: true, data: { stop: "Central Quay" } },
        isError: false,
      }),
    },
    { exposedTo: [EMBEDDER] }
  );

  modelContext.registerTool({
    // No exposedTo at all: same-origin only.
    name: "charge_travel_card",
    description: "Private.",
    execute: () => ({
      content: [{ type: "text", text: "charged" }],
      structuredContent: { ok: true, data: { charged: true } },
      isError: false,
    }),
  });

  installToolFrameHost({ allowedOrigins: [EMBEDDER] });

  let counter = 0;
  const ask = (origin: string, body: object): Promise<Reply> =>
    new Promise((resolve) => {
      counter += 1;
      const id = `t-${counter}`;
      const source = {
        postMessage: (message: Reply & { id?: string }) => {
          if (message.id === id) resolve(message);
        },
      };
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { channel: "a11ymcp/federation@1", id, ...body },
          origin,
          source: source as unknown as Window,
        })
      );
    });

  return { ask };
}

describe("cross-origin tool access is default-deny", () => {
  let ask: (origin: string, body: object) => Promise<Reply>;

  beforeEach(() => {
    ask = setup().ask;
  });

  it("lists only the tools exposed to the asking origin", async () => {
    const reply = await ask(EMBEDDER, { op: "getTools" });
    expect(reply.ok).toBe(true);
    expect(reply.tools?.map((tool) => tool.name)).toEqual([
      "get_next_departures",
    ]);
  });

  it("runs a tool that was exposed to the asking origin", async () => {
    const reply = await ask(EMBEDDER, {
      op: "executeTool",
      name: "get_next_departures",
      input: {},
    });
    expect(reply.ok).toBe(true);
    expect(reply.result).toEqual({ ok: true, data: { stop: "Central Quay" } });
  });

  it("refuses a tool that was never exposed, by name", async () => {
    // Not merely absent from getTools — asking for it directly must be
    // refused, and the refusal must say why.
    const reply = await ask(EMBEDDER, {
      op: "executeTool",
      name: "charge_travel_card",
      input: {},
    });
    expect(reply.ok).toBe(false);
    expect(reply.error).toContain("charge_travel_card");
    expect(reply.error).toContain("not exposed");
  });

  it("refuses an origin that is not allowed to ask at all", async () => {
    const listed = await ask(STRANGER, { op: "getTools" });
    expect(listed.ok).toBe(false);
    expect(listed.error).toContain(STRANGER);

    const executed = await ask(STRANGER, {
      op: "executeTool",
      name: "get_next_departures",
      input: {},
    });
    expect(executed.ok).toBe(false);
  });

  it("ignores messages that are not on its channel", async () => {
    let answered = false;
    const source = {
      postMessage: () => {
        answered = true;
      },
    };
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { channel: "something/else", id: "x", op: "getTools" },
        origin: EMBEDDER,
        source: source as unknown as Window,
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(answered).toBe(false);
  });
});

describe("the embedder honours the tools Permissions Policy", () => {
  it("refuses to talk to a frame that was not granted allow=\"tools\"", () => {
    const frame = document.createElement("iframe");
    expect(() => new ToolFrameClient(frame, "*")).toThrow(ToolFrameUnavailable);

    frame.setAttribute("allow", "camera");
    expect(() => new ToolFrameClient(frame, "*")).toThrow(/Permissions Policy/);
  });

  it("accepts a frame that was", () => {
    const frame = document.createElement("iframe");
    frame.setAttribute("allow", "tools");
    expect(() => new ToolFrameClient(frame, "*")).not.toThrow();
  });
});

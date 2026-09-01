// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  buildDeclarativeSchema,
  fillForm,
} from "@/lib/webmcp/declarative";

function form(html: string): HTMLFormElement {
  document.body.innerHTML = `<form toolname="t">${html}</form>`;
  return document.querySelector("form")!;
}

describe("declarative form schemas", () => {
  it("prefers toolparamdescription over everything else", () => {
    const schema = buildDeclarativeSchema(
      form(`
        <label for="e">Email</label>
        <input id="e" name="email" type="email"
               toolparamdescription="Where the receipt is sent." />
      `)
    );
    expect(schema.properties.email.description).toBe(
      "Where the receipt is sent."
    );
    expect(schema.properties.email.format).toBe("email");
  });

  it("falls back to the label, then aria-description, then placeholder", () => {
    const schema = buildDeclarativeSchema(
      form(`
        <label for="a">Shipping address</label>
        <input id="a" name="address" />
        <input name="city" aria-description="The delivery city." />
        <input name="zip" placeholder="Postal code" />
        <input name="bare" />
      `)
    );
    expect(schema.properties.address.description).toBe("Shipping address");
    expect(schema.properties.city.description).toBe("The delivery city.");
    expect(schema.properties.zip.description).toBe("Postal code");
    expect(schema.properties.bare.description).toBeUndefined();
  });

  it("strips nested controls out of a wrapping label", () => {
    const schema = buildDeclarativeSchema(
      form(`<label>Full name <input name="fullName" value="Alex"></label>`)
    );
    expect(schema.properties.fullName.description).toBe("Full name");
  });

  it("marks required fields, including a radio group with one required member", () => {
    const schema = buildDeclarativeSchema(
      form(`
        <input name="email" required />
        <input name="nickname" />
        <input type="radio" name="size" value="8" />
        <input type="radio" name="size" value="9" required />
      `)
    );
    expect(schema.required).toContain("email");
    expect(schema.required).toContain("size");
    expect(schema.required).not.toContain("nickname");
  });

  it("derives enums from selects and radio groups", () => {
    const schema = buildDeclarativeSchema(
      form(`
        <select name="team">
          <option value="">Choose…</option>
          <option value="returns">Returns</option>
          <option value="billing">Billing</option>
        </select>
        <input type="radio" name="size" value="8" />
        <input type="radio" name="size" value="9" />
      `)
    );
    expect(schema.properties.team).toMatchObject({
      type: "string",
      enum: ["returns", "billing"],
    });
    expect(schema.properties.size).toMatchObject({
      type: "string",
      enum: ["8", "9"],
    });
  });

  it("treats one checkbox as a boolean and several sharing a name as an array", () => {
    const single = buildDeclarativeSchema(
      form(`<input type="checkbox" name="gift" />`)
    );
    expect(single.properties.gift.type).toBe("boolean");

    const many = buildDeclarativeSchema(
      form(`
        <input type="checkbox" name="needs" value="keyboard_only" />
        <input type="checkbox" name="needs" value="strong_focus" />
      `)
    );
    expect(many.properties.needs).toMatchObject({
      type: "array",
      items: { type: "string", enum: ["keyboard_only", "strong_focus"] },
    });
  });

  it("carries numeric bounds", () => {
    const schema = buildDeclarativeSchema(
      form(`<input type="number" name="qty" min="1" max="5" />`)
    );
    expect(schema.properties.qty).toMatchObject({
      type: "number",
      minimum: 1,
      maximum: 5,
    });
  });

  it("never exposes fields that are not the agent's to set", () => {
    const schema = buildDeclarativeSchema(
      form(`
        <input type="hidden" name="csrf" value="secret" />
        <input type="password" name="password" />
        <input type="file" name="upload" />
        <button type="submit" name="go">Go</button>
        <input name="email" />
      `)
    );
    expect(Object.keys(schema.properties)).toEqual(["email"]);
    expect(schema.additionalProperties).toBe(false);
  });
});

describe("filling a declarative form", () => {
  it("writes values and reports which fields it touched", () => {
    const target = form(`
      <input name="email" />
      <input type="radio" name="size" value="8" />
      <input type="radio" name="size" value="9" />
      <input type="checkbox" name="gift" />
    `);

    const filled = fillForm(target, {
      email: "alex@example.com",
      size: "9",
      gift: true,
      unknownField: "ignored",
    });

    expect(filled.sort()).toEqual(["email", "gift", "size"]);
    expect(
      (target.querySelector('[name="email"]') as HTMLInputElement).value
    ).toBe("alex@example.com");
    expect(
      (target.querySelector('[value="9"]') as HTMLInputElement).checked
    ).toBe(true);
    expect(
      (target.querySelector('[name="gift"]') as HTMLInputElement).checked
    ).toBe(true);
  });

  it("checks exactly the requested boxes in a checkbox group", () => {
    const target = form(`
      <input type="checkbox" name="needs" value="keyboard_only" />
      <input type="checkbox" name="needs" value="strong_focus" checked />
      <input type="checkbox" name="needs" value="high_contrast" />
    `);

    fillForm(target, { needs: ["keyboard_only", "high_contrast"] });

    const checked = Array.from(
      target.querySelectorAll<HTMLInputElement>('[name="needs"]')
    )
      .filter((box) => box.checked)
      .map((box) => box.value);
    expect(checked).toEqual(["keyboard_only", "high_contrast"]);
  });

  it("dispatches input and change so controlled components see the value", () => {
    const target = form(`<input name="email" />`);
    const field = target.querySelector('[name="email"]') as HTMLInputElement;
    const seen: string[] = [];
    field.addEventListener("input", () => seen.push("input"));
    field.addEventListener("change", () => seen.push("change"));

    fillForm(target, { email: "alex@example.com" });

    expect(seen).toEqual(["input", "change"]);
  });

  it("ignores a radio value the form does not offer", () => {
    const target = form(`
      <input type="radio" name="size" value="8" />
      <input type="radio" name="size" value="9" />
    `);
    expect(fillForm(target, { size: "42" })).toEqual([]);
    expect(
      Array.from(target.querySelectorAll<HTMLInputElement>('[name="size"]')).some(
        (radio) => radio.checked
      )
    ).toBe(false);
  });
});

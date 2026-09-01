/**
 * WebMCP declarative API: turning an annotated `<form>` into a tool.
 *
 * Per the Chrome declarative-API docs, a form carries:
 *
 *   - `toolname`             — the tool's name
 *   - `tooldescription`      — what the tool does
 *   - `toolparamdescription` — on a *field*, the description for that
 *                              property; without it the browser falls back to
 *                              the associated `<label>` (skipping labelable
 *                              descendants), then to `aria-description`
 *   - `toolautosubmit`       — submit the form when the agent invokes the
 *                              tool. **Without it the tool fills the fields
 *                              and stops**, leaving the human to submit.
 *
 * Deriving a real schema — types, enums, required — matters more here than it
 * looks: the declarative API's whole promise is that a form a person already
 * uses becomes a tool an agent can use correctly, without the author writing
 * a schema by hand.
 */

/** Fields that are never exposed: they are not the agent's to set. */
const EXCLUDED_TYPES = new Set([
  "submit",
  "button",
  "reset",
  "image",
  "hidden",
  "file",
  "password",
]);

const LABELABLE = "input,select,textarea,button,meter,output,progress";

export interface DeclarativeToolSchema {
  type: "object";
  properties: Record<string, Record<string, unknown>>;
  required: string[];
  additionalProperties: false;
  [key: string]: unknown;
}

type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isExposable(element: Element): element is FormField {
  const tag = element.tagName.toLowerCase();
  if (tag !== "input" && tag !== "select" && tag !== "textarea") return false;
  const type = (element as HTMLInputElement).type?.toLowerCase() ?? "";
  if (EXCLUDED_TYPES.has(type)) return false;
  return Boolean((element as FormField).name);
}

/**
 * The label text for a field, with nested form controls stripped — a
 * wrapping `<label>Email <input></label>` should describe the field as
 * "Email", not "Email" plus whatever the control renders.
 */
function labelText(field: FormField): string | null {
  const byFor = field.id
    ? field.ownerDocument.querySelector<HTMLLabelElement>(
        `label[for="${CSS.escape(field.id)}"]`
      )
    : null;
  const label = byFor ?? field.closest("label");
  if (!label) return null;

  const clone = label.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(LABELABLE).forEach((node) => node.remove());
  const text = (clone.textContent ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function describe(field: FormField): string | undefined {
  return (
    field.getAttribute("toolparamdescription") ??
    labelText(field) ??
    field.getAttribute("aria-description") ??
    field.getAttribute("placeholder") ??
    undefined
  );
}

/** JSON Schema type/format/enum for one control. */
function typeOf(field: FormField, group: FormField[]): Record<string, unknown> {
  const tag = field.tagName.toLowerCase();

  if (tag === "select") {
    const select = field as HTMLSelectElement;
    const options = Array.from(select.options)
      .map((option) => option.value)
      .filter((value) => value !== "");
    return {
      type: select.multiple ? "array" : "string",
      ...(options.length > 0
        ? select.multiple
          ? { items: { type: "string", enum: options } }
          : { enum: options }
        : {}),
    };
  }

  if (tag === "textarea") return { type: "string" };

  const type = (field as HTMLInputElement).type?.toLowerCase() ?? "text";

  if (type === "checkbox") {
    // Several checkboxes sharing a name are a multi-select, not a boolean.
    if (group.length > 1) {
      return {
        type: "array",
        items: {
          type: "string",
          enum: group.map((item) => (item as HTMLInputElement).value),
        },
      };
    }
    return { type: "boolean" };
  }

  if (type === "radio") {
    return {
      type: "string",
      enum: group.map((item) => (item as HTMLInputElement).value),
    };
  }

  if (type === "number" || type === "range") {
    const input = field as HTMLInputElement;
    return {
      type: "number",
      ...(input.min !== "" ? { minimum: Number(input.min) } : {}),
      ...(input.max !== "" ? { maximum: Number(input.max) } : {}),
    };
  }

  const FORMATS: Record<string, string> = {
    email: "email",
    url: "uri",
    date: "date",
    "datetime-local": "date-time",
    time: "time",
    tel: "phone",
  };
  return { type: "string", ...(FORMATS[type] ? { format: FORMATS[type] } : {}) };
}

/** Groups a form's exposable controls by name, preserving document order. */
export function formFieldGroups(form: HTMLFormElement): Map<string, FormField[]> {
  const groups = new Map<string, FormField[]>();
  Array.from(form.elements).forEach((element) => {
    if (!isExposable(element)) return;
    const existing = groups.get(element.name);
    if (existing) existing.push(element);
    else groups.set(element.name, [element]);
  });
  return groups;
}

/** Derives the tool input schema for an annotated form. */
export function buildDeclarativeSchema(
  form: HTMLFormElement
): DeclarativeToolSchema {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const [name, group] of formFieldGroups(form)) {
    const field = group[0];
    const description = describe(field);
    properties[name] = {
      ...typeOf(field, group),
      ...(description ? { description } : {}),
    };
    // A radio group is required if any member is; a single control if it is.
    if (group.some((item) => item.hasAttribute("required"))) {
      required.push(name);
    }
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

/**
 * Writes agent-supplied values into the form, dispatching `input`/`change`
 * so frameworks with controlled inputs actually see them.
 */
export function fillForm(
  form: HTMLFormElement,
  values: Record<string, unknown>
): string[] {
  const filled: string[] = [];
  const groups = formFieldGroups(form);

  for (const [name, value] of Object.entries(values)) {
    const group = groups.get(name);
    if (!group || group.length === 0) continue;

    const first = group[0];
    const type = (first as HTMLInputElement).type?.toLowerCase() ?? "";

    if (type === "radio") {
      const match = group.find(
        (item) => (item as HTMLInputElement).value === String(value)
      ) as HTMLInputElement | undefined;
      if (!match) continue;
      match.checked = true;
      match.dispatchEvent(new Event("change", { bubbles: true }));
      filled.push(name);
      continue;
    }

    if (type === "checkbox") {
      const wanted = Array.isArray(value)
        ? value.map(String)
        : [String(value)];
      group.forEach((item) => {
        const checkbox = item as HTMLInputElement;
        checkbox.checked =
          group.length > 1
            ? wanted.includes(checkbox.value)
            : value === true || value === "true";
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      });
      filled.push(name);
      continue;
    }

    const control = first as HTMLInputElement;
    control.value = Array.isArray(value) ? value.map(String).join(",") : String(value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    filled.push(name);
  }

  return filled;
}

/** Submits a form the way a user's click would. */
export function submitForm(form: HTMLFormElement): void {
  if (typeof form.requestSubmit === "function") form.requestSubmit();
  else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}

/** Attributes worth re-scanning on, for the MutationObserver. */
export const DECLARATIVE_ATTRIBUTES = [
  "toolname",
  "tooldescription",
  "toolparamdescription",
  "toolautosubmit",
];

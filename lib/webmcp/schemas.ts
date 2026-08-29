import { z } from "zod";

export const EmptyInputSchema = z.object({}).strict();

export const emptyInputJsonSchema: WebMCPToolInputSchema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
};

export const RepairFocusInputSchema = z
  .object({
    scope: z.enum(["page", "preview"]).default("page"),
    approval: z.boolean(),
  })
  .strict()
  .refine((value) => value.approval === true, {
    message: "User approval must be true.",
    path: ["approval"],
  });

export const repairFocusInputJsonSchema: WebMCPToolInputSchema = {
  type: "object",
  properties: {
    scope: {
      type: "string",
      enum: ["page", "preview"],
    },
    approval: {
      type: "boolean",
    },
  },
  required: ["approval"],
  additionalProperties: false,
};
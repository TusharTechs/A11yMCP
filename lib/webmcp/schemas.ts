import { z } from "zod";

export const EmptyInputSchema = z.object({}).strict();

export const emptyInputJsonSchema: WebMCPToolInputSchema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
};

export const ApprovalInputSchema = z
  .object({
    approval: z.boolean(),
  })
  .strict()
  .refine((value) => value.approval === true, {
    message: "User approval must be true.",
    path: ["approval"],
  });

export const approvalInputJsonSchema: WebMCPToolInputSchema = {
  type: "object",
  properties: {
    approval: {
      type: "boolean",
    },
  },
  required: ["approval"],
  additionalProperties: false,
};
import { z } from "zod";
import { ALL_NEEDS } from "@/types/accessibility";

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

export const NegotiateInputSchema = z
  .object({
    needs: z.array(z.enum(ALL_NEEDS)).min(1).max(ALL_NEEDS.length),
  })
  .strict();

export const negotiateInputJsonSchema: WebMCPToolInputSchema = {
  type: "object",
  properties: {
    needs: {
      type: "array",
      items: {
        type: "string",
        enum: [...ALL_NEEDS],
      },
      minItems: 1,
    },
  },
  required: ["needs"],
  additionalProperties: false,
};
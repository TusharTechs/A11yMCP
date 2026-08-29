import { z } from "zod";
import { ALL_NEEDS } from "@/types/accessibility";
import { CheckoutValuesSchema } from "@/lib/ecommerce/checkout";

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

/* Phase 4 — commerce */

export const SearchInputSchema = z
  .object({
    query: z.string().max(60),
  })
  .strict();

export const searchInputJsonSchema: WebMCPToolInputSchema = {
  type: "object",
  properties: {
    query: { type: "string", maxLength: 60 },
  },
  required: ["query"],
  additionalProperties: false,
};

export const AddToCartInputSchema = z
  .object({
    productId: z.string(),
    variantId: z.string(),
  })
  .strict();

export const addToCartInputJsonSchema: WebMCPToolInputSchema = {
  type: "object",
  properties: {
    productId: { type: "string" },
    variantId: { type: "string" },
  },
  required: ["productId", "variantId"],
  additionalProperties: false,
};

export const FillCheckoutInputSchema = z
  .object({
    sessionId: z.string(),
    values: CheckoutValuesSchema,
  })
  .strict();

export const fillCheckoutInputJsonSchema: WebMCPToolInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string" },
    values: {
      type: "object",
      properties: {
        email: { type: "string" },
        fullName: { type: "string" },
        address: { type: "string" },
        city: { type: "string" },
        postalCode: { type: "string" },
      },
      required: ["email", "fullName", "address", "city", "postalCode"],
      additionalProperties: false,
    },
  },
  required: ["sessionId", "values"],
  additionalProperties: false,
};

export const PlaceOrderInputSchema = z
  .object({
    sessionId: z.string(),
    confirmation: z.literal(true),
  })
  .strict();

export const placeOrderInputJsonSchema: WebMCPToolInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string" },
    confirmation: { type: "boolean", enum: [true] },
  },
  required: ["sessionId", "confirmation"],
  additionalProperties: false,
};
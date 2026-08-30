import { describe, expect, it } from "vitest";
import {
  ApprovalInputSchema,
  FillCheckoutInputSchema,
  NegotiateInputSchema,
  PlaceOrderInputSchema,
} from "@/lib/webmcp/schemas";

describe("approval gate", () => {
  it("accepts approval true", () => {
    expect(ApprovalInputSchema.safeParse({ approval: true }).success).toBe(true);
  });
  it("rejects approval false", () => {
    expect(ApprovalInputSchema.safeParse({ approval: false }).success).toBe(false);
  });
  it("rejects missing approval", () => {
    expect(ApprovalInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("consequential gate", () => {
  it("rejects confirmation false", () => {
    expect(
      PlaceOrderInputSchema.safeParse({
        sessionId: "x",
        confirmation: false,
      }).success
    ).toBe(false);
  });
  it("accepts confirmation true", () => {
    expect(
      PlaceOrderInputSchema.safeParse({
        sessionId: "x",
        confirmation: true,
      }).success
    ).toBe(true);
  });
});

describe("negotiation schema", () => {
  it("rejects unknown needs", () => {
    expect(
      NegotiateInputSchema.safeParse({ needs: ["telepathy"] }).success
    ).toBe(false);
  });
  it("rejects empty needs", () => {
    expect(NegotiateInputSchema.safeParse({ needs: [] }).success).toBe(false);
  });
});

describe("checkout schema", () => {
  const values = {
    email: "not-an-email",
    fullName: "Alex Sharma",
    address: "12 Lake Street",
    city: "Bengaluru",
    postalCode: "560001",
  };
  it("rejects invalid email with field path", () => {
    const parsed = FillCheckoutInputSchema.safeParse({
      sessionId: "s",
      values,
    });
    expect(parsed.success).toBe(false);
  });
});
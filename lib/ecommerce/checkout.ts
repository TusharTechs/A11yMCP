import { z } from "zod";
import type { CheckoutFieldErrors, CheckoutValues } from "@/types/ecommerce";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CheckoutValuesSchema = z.object({
  email: z.string().regex(EMAIL_PATTERN, "Enter a valid email address."),
  fullName: z.string().min(2, "Enter your full name."),
  address: z.string().min(5, "Enter your street address."),
  city: z.string().min(2, "Enter your city."),
  postalCode: z.string().regex(/^\d{4,10}$/, "Enter a valid postal code."),
});

export type CheckoutValidationResult =
  | { success: true; values: CheckoutValues }
  | { success: false; errors: CheckoutFieldErrors };

export function validateCheckoutValues(
  values: CheckoutValues
): CheckoutValidationResult {
  const parsed = CheckoutValuesSchema.safeParse(values);

  if (parsed.success) {
    return { success: true, values: parsed.data };
  }

  const errors: CheckoutFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (
      typeof field === "string" &&
      field in errors === false &&
      !errors[field as keyof CheckoutValues]
    ) {
      errors[field as keyof CheckoutValues] = issue.message;
    }
  }

  return { success: false, errors };
}
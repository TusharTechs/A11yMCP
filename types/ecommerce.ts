export interface Product {
  id: string;
  name: string;
  priceCents: number;
  sizes: string[];
  description: string;
}

export interface CartItem {
  productId: string;
  name: string;
  size: string;
  priceCents: number;
  quantity: number;
}

export type TaskState =
  | "idle"
  | "searched"
  | "variant_selected"
  | "cart_ready"
  | "checkout_started"
  | "checkout_filled"
  | "order_completed";

export interface CheckoutValues {
  email: string;
  fullName: string;
  address: string;
  city: string;
  postalCode: string;
}

export type CheckoutFieldErrors = Partial<
  Record<keyof CheckoutValues, string>
>;

export interface PlacedOrder {
  id: string;
  items: CartItem[];
  totalCents: number;
  email: string;
  placedAt: string;
}
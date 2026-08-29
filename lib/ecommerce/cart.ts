import type {
  CartItem,
  CheckoutFieldErrors,
  CheckoutValues,
  PlacedOrder,
  Product,
  TaskState,
} from "@/types/ecommerce";
import { findProduct, searchCatalog } from "./catalog";
import { validateCheckoutValues } from "./checkout";

export interface CommerceSnapshot {
  searchQuery: string;
  searchResults: Product[];
  selectedProductId: string;
  selectedSize: string | null;
  items: CartItem[];
  checkoutSessionId: string | null;
  checkoutValues: CheckoutValues;
  checkoutErrors: CheckoutFieldErrors;
  checkoutFilled: boolean;
  order: PlacedOrder | null;
  taskState: TaskState;
  statusMessage: string;
}

const EMPTY_VALUES: CheckoutValues = {
  email: "",
  fullName: "",
  address: "",
  city: "",
  postalCode: "",
};

function initialState(): CommerceSnapshot {
  return {
    searchQuery: "",
    searchResults: searchCatalog(""),
    selectedProductId: "noma-runner",
    selectedSize: null,
    items: [],
    checkoutSessionId: null,
    checkoutValues: EMPTY_VALUES,
    checkoutErrors: {},
    checkoutFilled: false,
    order: null,
    taskState: "idle",
    statusMessage: "",
  };
}

let snapshot: CommerceSnapshot = initialState();
const listeners = new Set<() => void>();
let sessionCounter = 0;
let orderCounter = 0;

export function subscribeCommerce(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCommerceSnapshot(): CommerceSnapshot {
  return snapshot;
}

function set(partial: Partial<CommerceSnapshot>): void {
  snapshot = { ...snapshot, ...partial };
  listeners.forEach((listener) => listener());
}

export function searchProducts(query: string): Product[] {
  const results = searchCatalog(query);
  set({
    searchQuery: query,
    searchResults: results,
    taskState: snapshot.taskState === "idle" ? "searched" : snapshot.taskState,
    statusMessage: `${results.length} product(s) found.`,
  });
  return results;
}

export function selectProduct(productId: string): boolean {
  const product = findProduct(productId);
  if (!product) return false;
  set({
    selectedProductId: productId,
    selectedSize: null,
    statusMessage: `Selected ${product.name}.`,
  });
  return true;
}

export function selectSize(size: string): void {
  set({ selectedSize: size, taskState: "variant_selected" });
}

export function addProductToCart(): { success: boolean; message: string } {
  const product = findProduct(snapshot.selectedProductId);
  if (!product) {
    return { success: false, message: "No product selected." };
  }
  if (!snapshot.selectedSize) {
    set({ statusMessage: "Select a size first." });
    return { success: false, message: "Select a size first." };
  }

  const existing = snapshot.items.find(
    (item) =>
      item.productId === product.id && item.size === snapshot.selectedSize
  );

  const items = existing
    ? snapshot.items.map((item) =>
        item === existing ? { ...item, quantity: item.quantity + 1 } : item
      )
    : [
        ...snapshot.items,
        {
          productId: product.id,
          name: product.name,
          size: snapshot.selectedSize,
          priceCents: product.priceCents,
          quantity: 1,
        },
      ];

  set({
    items,
    taskState: "cart_ready",
    statusMessage: `Added ${product.name} (size ${snapshot.selectedSize}) to cart.`,
  });
  return { success: true, message: "Added to cart." };
}

export function beginCheckout(): {
  success: boolean;
  sessionId?: string;
  message: string;
} {
  if (snapshot.items.length === 0) {
    return { success: false, message: "Cart is empty." };
  }
  if (snapshot.order) {
    return { success: false, message: "Order already placed. Start over first." };
  }

  sessionCounter += 1;
  const sessionId = `checkout-${sessionCounter}`;
  set({
    checkoutSessionId: sessionId,
    checkoutValues: EMPTY_VALUES,
    checkoutErrors: {},
    checkoutFilled: false,
    taskState: "checkout_started",
    statusMessage: "Checkout started.",
  });
  return { success: true, sessionId, message: "Checkout started." };
}

export function updateCheckoutField(
  field: keyof CheckoutValues,
  value: string
): void {
  if (!snapshot.checkoutSessionId) return;
  set({
    checkoutValues: { ...snapshot.checkoutValues, [field]: value },
    checkoutFilled: false,
  });
}

export function fillCheckoutForm(
  sessionId: string,
  values: CheckoutValues
): { success: boolean; message: string; errors?: CheckoutFieldErrors } {
  if (!snapshot.checkoutSessionId) {
    return { success: false, message: "Checkout session not started." };
  }
  if (snapshot.checkoutSessionId !== sessionId) {
    return { success: false, message: "Unknown checkout session." };
  }

  const result = validateCheckoutValues(values);
  if (!result.success) {
    set({
      checkoutValues: values,
      checkoutErrors: result.errors,
      checkoutFilled: false,
      statusMessage: "Checkout form has errors.",
    });
    return {
      success: false,
      message: "Checkout validation failed.",
      errors: result.errors,
    };
  }

  set({
    checkoutValues: values,
    checkoutErrors: {},
    checkoutFilled: true,
    taskState: "checkout_filled",
    statusMessage: "Checkout form completed.",
  });
  return { success: true, message: "Checkout form completed." };
}

export function placeOrder(sessionId: string): {
  success: boolean;
  order?: PlacedOrder;
  message: string;
} {
  if (!snapshot.checkoutSessionId || snapshot.checkoutSessionId !== sessionId) {
    return { success: false, message: "Unknown checkout session." };
  }

  if (!snapshot.checkoutFilled) {
    const result = validateCheckoutValues(snapshot.checkoutValues);
    if (!result.success) {
      set({ checkoutErrors: result.errors });
      return { success: false, message: "Checkout form is incomplete." };
    }
  }

  const totalCents = snapshot.items.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0
  );

  orderCounter += 1;
  const order: PlacedOrder = {
    id: `NOMA-2026-${String(orderCounter).padStart(4, "0")}`,
    items: snapshot.items,
    totalCents,
    email: snapshot.checkoutValues.email,
    placedAt: new Date().toISOString(),
  };

  set({
    order,
    taskState: "order_completed",
    statusMessage: `Order ${order.id} placed.`,
  });
  return { success: true, order, message: "Order placed." };
}

export function resetCommerce(): void {
  snapshot = initialState();
  listeners.forEach((listener) => listener());
}
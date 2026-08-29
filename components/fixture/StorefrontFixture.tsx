"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { useCommerceState } from "@/hooks/use-commerce-state";
import { useRemediationState } from "@/hooks/use-remediation-state";
import {
  addProductToCart,
  beginCheckout,
  placeOrder,
  resetCommerce,
  searchProducts,
  selectProduct,
  selectSize,
  updateCheckoutField,
} from "@/lib/ecommerce/cart";
import { formatPrice } from "@/lib/ecommerce/catalog";
import type { CheckoutValues } from "@/types/ecommerce";

const FIELD_CONFIG: Array<{
  id: keyof CheckoutValues;
  label: string;
  placeholder: string;
  type: string;
}> = [
  { id: "email", label: "Email", placeholder: "Email", type: "email" },
  { id: "fullName", label: "Full name", placeholder: "Full name", type: "text" },
  { id: "address", label: "Address", placeholder: "Address", type: "text" },
  { id: "city", label: "City", placeholder: "City", type: "text" },
  { id: "postalCode", label: "Postal code", placeholder: "Postal code", type: "text" },
];

export default function StorefrontFixture() {
  const remediation = useRemediationState();
  const commerce = useCommerceState();
  const [searchText, setSearchText] = useState("");
  const [wishlisted, setWishlisted] = useState(false);

  const keyboardFixed = remediation.applied.keyboard_navigation;
  const formsFixed = remediation.applied.form_association;
  const selectedProduct = commerce.searchResults.length
    ? commerce.searchResults.find((p) => p.id === commerce.selectedProductId)
    : undefined;
  const activeProduct =
    selectedProduct ??
    commerce.searchResults[0];

  const sizes = activeProduct?.sizes ?? [];

  function handleRadioKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    size: string
  ): void {
    if (!keyboardFixed) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectSize(size);
      return;
    }

    const index = sizes.indexOf(size);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % sizes.length;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + sizes.length) % sizes.length;
    }
    if (next === -1) return;

    event.preventDefault();
    const group = event.currentTarget.parentElement;
    const radios = group
      ? Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'))
      : [];
    radios[next]?.focus();
    selectSize(sizes[next]);
  }

  return (
    <section
      id="noma-fixture"
      aria-label="NOMA demo storefront"
      className={`fixture ${
        remediation.applied.focus_management ? "fixed-focus" : "defect-focus"
      }`}
    >
      <div className="fixture-header">
        <h2>NOMA Store</h2>
        <button
          type="button"
          className="icon-btn"
          data-a11ymcp-target="wishlist"
          aria-label={
            remediation.applied.accessible_names
              ? "Add NOMA Runner to wishlist"
              : undefined
          }
          onClick={() => setWishlisted((current) => !current)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            style={{ color: wishlisted ? "#dc2626" : "inherit" }}
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
      </div>

      <div className="search-row">
        <label htmlFor="product-search">Search products</label>
        <input
          id="product-search"
          type="search"
          placeholder="Search shoes"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <button type="button" onClick={() => searchProducts(searchText)}>
          Search
        </button>
      </div>

      <ul className="product-list">
        {commerce.searchResults.map((product) => (
          <li key={product.id} className="product-card">
            <div>
              <strong>{product.name}</strong>
              <span className="muted"> {formatPrice(product.priceCents)}</span>
            </div>
            <button
              type="button"
              aria-pressed={product.id === commerce.selectedProductId}
              onClick={() => selectProduct(product.id)}
            >
              Select {product.name}
            </button>
          </li>
        ))}
        {commerce.searchResults.length === 0 ? (
          <li className="muted">No products match this search.</li>
        ) : null}
      </ul>

      {activeProduct ? (
        <div className="product-detail">
          <h3>
            {activeProduct.name} — {formatPrice(activeProduct.priceCents)}
          </h3>
          <p className="muted">{activeProduct.description}</p>

          <div role="radiogroup" aria-label="Select size" className="size-group">
            {sizes.map((size) => (
              <div
                key={size}
                role="radio"
                aria-checked={commerce.selectedSize === size}
                tabIndex={keyboardFixed ? 0 : undefined}
                onKeyDown={(event) => handleRadioKeyDown(event, size)}
                onClick={() => selectSize(size)}
                className="size-option"
              >
                {size}
              </div>
            ))}
          </div>

          <button type="button" onClick={() => addProductToCart()}>
            Add to cart
          </button>
        </div>
      ) : null}

      <p className="muted" aria-live="polite">
        {commerce.statusMessage || "Ready."} Selected size:{" "}
        {commerce.selectedSize ?? "none"}.
      </p>

      {commerce.items.length > 0 && !commerce.order ? (
        <div className="cart-panel">
          <h3>Cart</h3>
          <ul>
            {commerce.items.map((item) => (
              <li key={`${item.productId}-${item.size}`}>
                {item.quantity} × {item.name} (size {item.size}) —{" "}
                {formatPrice(item.priceCents * item.quantity)}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => beginCheckout()}>
            Checkout
          </button>
        </div>
      ) : null}

      {commerce.checkoutSessionId && !commerce.order ? (
        <form
          className="checkout-panel"
          onSubmit={(event) => {
            event.preventDefault();
            placeOrder(commerce.checkoutSessionId as string);
          }}
          noValidate
        >
          <h3>Checkout</h3>
          {FIELD_CONFIG.map((field) => {
            const error = commerce.checkoutErrors[field.id];
            return (
              <div className="field" key={field.id}>
                {formsFixed ? (
                  <label htmlFor={field.id}>{field.label}</label>
                ) : null}
                <input
                  id={field.id}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={commerce.checkoutValues[field.id]}
                  aria-describedby={formsFixed ? `${field.id}-error` : undefined}
                  aria-invalid={Boolean(error) || undefined}
                  onChange={(event) =>
                    updateCheckoutField(field.id, event.target.value)
                  }
                />
                <p
                  id={`${field.id}-error`}
                  className="field-error"
                  role={formsFixed ? "alert" : undefined}
                  hidden={!error}
                >
                  {error}
                </p>
              </div>
            );
          })}
          <button type="submit">Place order</button>
        </form>
      ) : null}

      {commerce.order ? (
        <div className="order-confirm" role="status">
          <h3>Task completed successfully.</h3>
          <p>
            Order {commerce.order.id} — {formatPrice(commerce.order.totalCents)}
          </p>
          <p className="muted">Confirmation sent to {commerce.order.email}.</p>
          <button type="button" onClick={() => resetCommerce()}>
            Start over
          </button>
        </div>
      ) : null}
    </section>
  );
}
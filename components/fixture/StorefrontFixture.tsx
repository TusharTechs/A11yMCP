"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import {
  addProductToCart,
  beginCheckout,
  placeOrder,
  resetCommerce,
  searchProducts,
  selectProduct,
  selectSize,
  updateCheckoutField,
  type CommerceSnapshot,
} from "@/lib/ecommerce/cart";
import { formatPrice } from "@/lib/ecommerce/catalog";
import type { RemediationCategory as AppliedMap } from "@/types/accessibility";
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

export interface StorefrontFixtureProps {
  applied: Record<AppliedMap, boolean>;
  commerce: CommerceSnapshot;
  interactive: boolean;
  rootId: string;
}

export default function StorefrontFixture({
  applied,
  commerce,
  rootId,
}: StorefrontFixtureProps) {
  const [searchText, setSearchText] = useState("");
  const [wishlisted, setWishlisted] = useState(false);

  const keyboardFixed = applied.keyboard_navigation;
  const formsFixed = applied.form_association;

  const selectedProduct = commerce.searchResults.find(
    (product) => product.id === commerce.selectedProductId
  );
  const activeProduct = selectedProduct ?? commerce.searchResults[0];
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
      id={rootId}
      aria-label="NOMA demo storefront"
      data-motion={applied.reduced_motion ? "reduced" : "full"}
      className={`fixture ${
        applied.focus_management ? "fixed-focus" : "defect-focus"
      }`}
    >
      <div className="fixture-header">
        <h2>NOMA Store</h2>
        <button
          type="button"
          className="icon-btn"
          data-a11ymcp-target="wishlist"
          aria-label={
            applied.accessible_names
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
            <path d="M12 20 C 7 15.2 4 12.2 4 8.9 C 4 6.3 6 4.5 8.3 4.5 C 9.8 4.5 11.2 5.3 12 6.7 C 12.8 5.3 14.2 4.5 15.7 4.5 C 18 4.5 20 6.3 20 8.9 C 20 12.2 17 15.2 12 20 Z" />
          </svg>
        </button>
      </div>

      <div className="promo" aria-hidden="true">
        Free shipping this week
      </div>

      <div className="search-row">
        <label htmlFor={`${rootId}-search`}>Search products</label>
        <input
          id={`${rootId}-search`}
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

          <div
            role="radiogroup"
            aria-label="Select size"
            className="size-group"
          >
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
                  aria-describedby={
                    formsFixed ? `${field.id}-error` : undefined
                  }
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
          <p className="muted">
            Confirmation sent to {commerce.order.email}.
          </p>
          <button type="button" onClick={() => resetCommerce()}>
            Start over
          </button>
        </div>
      ) : null}
    </section>
  );
}
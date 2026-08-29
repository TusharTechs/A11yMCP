"use client";

import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useRemediationState } from "@/hooks/use-remediation-state";

const SIZES = ["8", "9", "10"] as const;
type Size = (typeof SIZES)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function StorefrontFixture() {
  const remediation = useRemediationState();
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);

  const keyboardFixed = remediation.applied.keyboard_navigation;

  function handleRadioKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    size: Size
  ): void {
    if (!keyboardFixed) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedSize(size);
      return;
    }

    const index = SIZES.indexOf(size);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % SIZES.length;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + SIZES.length) % SIZES.length;
    }
    if (next === -1) return;

    event.preventDefault();
    const group = event.currentTarget.parentElement;
    const radios = group
      ? Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'))
      : [];
    radios[next]?.focus();
    setSelectedSize(SIZES[next]);
  }

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setEmailError(!EMAIL_PATTERN.test(email));
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
        <h2>NOMA Runner</h2>
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

      <div role="radiogroup" aria-label="Select size" className="size-group">
        {SIZES.map((size) => (
          <div
            key={size}
            role="radio"
            aria-checked={selectedSize === size}
            tabIndex={keyboardFixed ? 0 : undefined}
            onKeyDown={(event) => handleRadioKeyDown(event, size)}
            onClick={() => setSelectedSize(size)}
            className="size-option"
          >
            {size}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!selectedSize}
        onClick={() => setCartCount((current) => current + 1)}
      >
        Add to cart
      </button>

      <form onSubmit={handleEmailSubmit} noValidate>
        {remediation.applied.form_association ? (
          <label htmlFor="email">Email</label>
        ) : null}
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={
            remediation.applied.form_association ? "email-error" : undefined
          }
          aria-invalid={emailError || undefined}
        />
        <p
          id="email-error"
          className="field-error"
          role={remediation.applied.form_association ? "alert" : undefined}
          hidden={!emailError}
        >
          Enter a valid email address.
        </p>
        <button type="submit">Continue</button>
      </form>

      <p className="muted" aria-live="polite">
        Selected size: {selectedSize ?? "none"} · Cart: {cartCount} item
        {cartCount === 1 ? "" : "s"}
      </p>
    </section>
  );
}
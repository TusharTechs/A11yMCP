import { useSyncExternalStore } from "react";
import {
  getCommerceSnapshot,
  subscribeCommerce,
} from "@/lib/ecommerce/cart";

export function useCommerceState() {
  return useSyncExternalStore(
    subscribeCommerce,
    getCommerceSnapshot,
    getCommerceSnapshot
  );
}
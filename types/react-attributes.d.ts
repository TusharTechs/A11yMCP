import "react";

declare module "react" {
  interface HTMLAttributes<T> {
    /** WebMCP declarative API: exposes a form as a tool in supporting browsers. */
    toolname?: string;
    /** WebMCP declarative API: tool description for the exposed form. */
    tooldescription?: string;
  }
}
import "react";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLAttributes<T> {
    /** WebMCP declarative API: exposes a form as a tool in supporting browsers. */
    toolname?: string;
    /** WebMCP declarative API: tool description for the exposed form. */
    tooldescription?: string;
    /**
     * WebMCP declarative API: on a form *field*, the description for that
     * property in the generated schema.
     */
    toolparamdescription?: string;
    /**
     * WebMCP declarative API: on a form, submit it when the agent invokes
     * the tool. Without it the tool fills the fields and leaves the submit
     * to the human.
     */
    toolautosubmit?: boolean | "";
  }
}
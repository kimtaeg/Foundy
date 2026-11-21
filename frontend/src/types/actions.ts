/** true means the command consumed the element's native default action. */
export type ActionHandler = (element: HTMLElement) => boolean | void;
export type ActionHandlers = Record<string, ActionHandler>;

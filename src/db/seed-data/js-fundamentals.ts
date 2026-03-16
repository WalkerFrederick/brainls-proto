export const JS_FRONT_BACK = [
  {
    front: "What is a closure?",
    back: "A function that retains access to its lexical scope even when called outside that scope",
  },
  {
    front: "Difference between == and ===?",
    back: "== performs type coercion, === checks value and type (strict equality)",
  },
];

export const JS_CLOZE = [
  {
    text: "The {{c1::event loop}} processes the {{c2::callback queue}} after the {{c2::call stack}} is empty.",
  },
  {
    text: "{{c1::Hoisting}} moves {{c2::variable}} and {{c2::function}} declarations to the top of their scope.",
  },
];

export const JS_KEYBOARD_SHORTCUTS = [
  {
    prompt: "Open the browser dev tools console",
    shortcut: { key: "j", ctrl: true, shift: true, alt: false, meta: false },
    explanation: "Ctrl+Shift+J opens the console directly in Chrome",
  },
  {
    prompt: "Comment out the selected lines in VS Code",
    shortcut: { key: "/", ctrl: true, shift: false, alt: false, meta: false },
    explanation: "Ctrl+/ toggles line comments in most editors",
  },
];

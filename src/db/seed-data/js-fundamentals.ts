export const JS_FRONT_BACK = [
  {
    front: "<p>What is a closure?</p>",
    back: "<p>A function that retains access to its lexical scope even when called outside that scope</p>",
  },
  {
    front: "<p>Difference between == and ===?</p>",
    back: "<p>== performs type coercion, === checks value and type (strict equality)</p>",
  },
];

export const JS_CLOZE = [
  {
    text: "<p>The {{c1::event loop}} processes the {{c2::callback queue}} after the {{c2::call stack}} is empty.</p>",
  },
  {
    text: "<p>{{c1::Hoisting}} moves {{c2::variable}} and {{c2::function}} declarations to the top of their scope.</p>",
  },
];

export const JS_KEYBOARD_SHORTCUTS = [
  {
    prompt: "<p>Open the browser dev tools console</p>",
    shortcut: { key: "j", ctrl: true, shift: true, alt: false, meta: false },
    explanation: "<p>Ctrl+Shift+J opens the console directly in Chrome</p>",
  },
  {
    prompt: "<p>Comment out the selected lines in VS Code</p>",
    shortcut: { key: "/", ctrl: true, shift: false, alt: false, meta: false },
    explanation: "<p>Ctrl+/ toggles line comments in most editors</p>",
  },
];

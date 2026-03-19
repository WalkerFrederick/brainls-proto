export const WORLD_CAPITALS_FRONT_BACK = [
  { front: "<p>What is the capital of Japan?</p>", back: "<p>Tokyo</p>" },
  { front: "<p>What is the capital of Australia?</p>", back: "<p>Canberra</p>" },
  { front: "<p>What is the capital of Brazil?</p>", back: "<p>Brasília</p>" },
  { front: "<p>What is the capital of Canada?</p>", back: "<p>Ottawa</p>" },
  { front: "<p>What is the capital of Egypt?</p>", back: "<p>Cairo</p>" },
];

export const ENGLISH_IDIOMS_FRONT_BACK = [
  { front: "<p>Break the ice</p>", back: "<p>To initiate conversation in a social setting</p>" },
  { front: "<p>Hit the nail on the head</p>", back: "<p>To be exactly right about something</p>" },
  { front: "<p>Piece of cake</p>", back: "<p>Something very easy to do</p>" },
  { front: "<p>Under the weather</p>", back: "<p>Feeling ill or sick</p>" },
];

export const PROGRAMMING_FUNDAMENTALS_MC = [
  {
    question: "<p>Which data structure uses FIFO ordering?</p>",
    choices: ["Stack", "Queue", "Tree", "Graph"],
    correctChoiceIndexes: [1],
  },
  {
    question: "<p>What does HTML stand for?</p>",
    choices: [
      "Hyper Text Markup Language",
      "High Tech Modern Language",
      "Hyper Transfer Markup Language",
      "Home Tool Markup Language",
    ],
    correctChoiceIndexes: [0],
  },
];

export const PROGRAMMING_FUNDAMENTALS_CLOZE = [
  { text: "<p>The time complexity of {{c1::binary search}} is {{c2::O(log n)}}.</p>" },
  {
    text: "<p>In Git, {{c1::git commit}} saves staged changes and {{c2::git push}} uploads them to the remote.</p>",
  },
];

export const PROGRAMMING_FUNDAMENTALS_SHORTCUTS = [
  {
    prompt: "<p>Save the current file</p>",
    shortcut: { key: "s", ctrl: true, shift: false, alt: false, meta: false },
  },
  {
    prompt: "<p>Undo the last action</p>",
    shortcut: { key: "z", ctrl: true, shift: false, alt: false, meta: false },
  },
];

export const MUSIC_THEORY_FRONT_BACK = [
  { front: "<p>How many semitones in an octave?</p>", back: "<p>12</p>" },
  { front: "<p>What does 'forte' mean?</p>", back: "<p>Play loudly</p>" },
];

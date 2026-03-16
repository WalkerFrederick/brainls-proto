export const WORLD_CAPITALS_FRONT_BACK = [
  { front: "What is the capital of Japan?", back: "Tokyo" },
  { front: "What is the capital of Australia?", back: "Canberra" },
  { front: "What is the capital of Brazil?", back: "Brasília" },
  { front: "What is the capital of Canada?", back: "Ottawa" },
  { front: "What is the capital of Egypt?", back: "Cairo" },
];

export const ENGLISH_IDIOMS_FRONT_BACK = [
  { front: "Break the ice", back: "To initiate conversation in a social setting" },
  { front: "Hit the nail on the head", back: "To be exactly right about something" },
  { front: "Piece of cake", back: "Something very easy to do" },
  { front: "Under the weather", back: "Feeling ill or sick" },
];

export const PROGRAMMING_FUNDAMENTALS_MC = [
  {
    question: "Which data structure uses FIFO ordering?",
    choices: ["Stack", "Queue", "Tree", "Graph"],
    correctChoiceIndexes: [1],
  },
  {
    question: "What does HTML stand for?",
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
  { text: "The time complexity of {{c1::binary search}} is {{c2::O(log n)}}." },
  {
    text: "In Git, {{c1::git commit}} saves staged changes and {{c2::git push}} uploads them to the remote.",
  },
];

export const PROGRAMMING_FUNDAMENTALS_SHORTCUTS = [
  {
    prompt: "Save the current file",
    shortcut: { key: "s", ctrl: true, shift: false, alt: false, meta: false },
  },
  {
    prompt: "Undo the last action",
    shortcut: { key: "z", ctrl: true, shift: false, alt: false, meta: false },
  },
];

export const MUSIC_THEORY_FRONT_BACK = [
  { front: "How many semitones in an octave?", back: "12" },
  { front: "What does 'forte' mean?", back: "Play loudly" },
];

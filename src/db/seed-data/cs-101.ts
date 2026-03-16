export const CS101_FRONT_BACK: Record<string, unknown>[] = [
  {
    front: "What is an algorithm?",
    back: "A step-by-step procedure for solving a problem or accomplishing a task",
  },
  {
    front: "What is Big-O notation?",
    back: "A mathematical notation that describes the upper bound of an algorithm's time or space complexity",
  },
  {
    front: "What is a compiler?",
    back: "A program that translates source code written in a high-level language into machine code",
  },
  {
    front: "What is an interpreter?",
    back: "A program that executes source code line by line without prior compilation",
  },
  {
    front: "What is recursion?",
    back: "A technique where a function calls itself to solve smaller instances of the same problem",
  },
  {
    front: "What is a binary tree?",
    back: "A tree data structure where each node has at most two children (left and right)",
  },
  {
    front: "What is a hash function?",
    back: "A function that maps data of arbitrary size to fixed-size values, used in hash tables",
  },
  {
    front: "What is polymorphism?",
    back: "The ability of different objects to respond to the same method call in different ways",
  },
  {
    front: "What is encapsulation?",
    back: "Bundling data and the methods that operate on that data within a single unit (class), restricting direct access",
  },
  {
    front: "What is inheritance?",
    back: "A mechanism where a class derives properties and behaviors from a parent class",
  },
  {
    front: "What is abstraction?",
    back: "Hiding complex implementation details and showing only the necessary features of an object",
  },
  {
    front: "What is a deadlock?",
    back: "A situation where two or more processes are blocked forever, each waiting for the other to release a resource",
  },
  {
    front: "What is a mutex?",
    back: "A mutual exclusion lock that ensures only one thread can access a shared resource at a time",
  },
  {
    front: "What is a semaphore?",
    back: "A signaling mechanism that controls access to a shared resource by multiple threads using a counter",
  },
  {
    front: "What is virtual memory?",
    back: "A memory management technique that gives each process the illusion of a large, contiguous address space",
  },
  {
    front: "What is a page fault?",
    back: "An interrupt that occurs when a program accesses a memory page not currently in physical RAM",
  },
  {
    front: "What is TCP?",
    back: "Transmission Control Protocol — a reliable, connection-oriented protocol that ensures ordered delivery of data",
  },
  {
    front: "What is UDP?",
    back: "User Datagram Protocol — a connectionless protocol that sends packets without guaranteeing delivery or order",
  },
  {
    front: "What is DNS?",
    back: "Domain Name System — translates human-readable domain names (e.g. google.com) into IP addresses",
  },
  {
    front: "What is HTTP?",
    back: "HyperText Transfer Protocol — the foundation of data communication on the World Wide Web",
  },
  {
    front: "What is REST?",
    back: "Representational State Transfer — an architectural style for designing networked APIs using standard HTTP methods",
  },
  {
    front: "What is a foreign key?",
    back: "A column in a relational database table that references the primary key of another table",
  },
  {
    front: "What is normalization?",
    back: "The process of organizing a database to reduce redundancy and improve data integrity",
  },
  {
    front: "What is an index in a database?",
    back: "A data structure that improves the speed of data retrieval operations on a table at the cost of extra storage",
  },
  {
    front: "What is ACID in databases?",
    back: "Atomicity, Consistency, Isolation, Durability — properties that guarantee reliable database transactions",
  },
  {
    front: "What is a race condition?",
    back: "A flaw where the system's behavior depends on the timing of uncontrollable events (e.g., thread scheduling)",
  },
  {
    front: "What is a design pattern?",
    back: "A reusable solution to a commonly occurring problem in software design",
  },
  {
    front: "What is the Singleton pattern?",
    back: "A design pattern that restricts a class to a single instance and provides a global access point",
  },
  {
    front: "What is the Observer pattern?",
    back: "A design pattern where an object notifies its dependents automatically of any state changes",
  },
  {
    front: "What is the Factory pattern?",
    back: "A design pattern that provides an interface for creating objects without specifying their concrete classes",
  },
  {
    front: "What is a graph?",
    back: "A non-linear data structure consisting of vertices (nodes) connected by edges",
  },
  {
    front: "What is BFS?",
    back: "Breadth-First Search — a graph traversal that explores all neighbors at the current depth before moving deeper",
  },
  {
    front: "What is DFS?",
    back: "Depth-First Search — a graph traversal that explores as far as possible along each branch before backtracking",
  },
  {
    front: "What is dynamic programming?",
    back: "An optimization technique that solves problems by breaking them into overlapping subproblems and caching results",
  },
  {
    front: "What is memoization?",
    back: "Caching the results of expensive function calls and returning the cached result for repeated inputs",
  },
  {
    front: "What is a stack overflow?",
    back: "An error that occurs when the call stack exceeds its maximum size, often caused by infinite recursion",
  },
  {
    front: "What is garbage collection?",
    back: "Automatic memory management that reclaims memory occupied by objects no longer in use",
  },
  {
    front: "What is a pointer?",
    back: "A variable that stores the memory address of another variable",
  },
  {
    front: "What is the difference between a process and a thread?",
    back: "A process is an independent program with its own memory space; a thread is a lightweight unit of execution within a process sharing the same memory",
  },
  {
    front: "What is an API?",
    back: "Application Programming Interface — a set of rules and protocols for building and interacting with software",
  },
  {
    front: "What is a container?",
    back: "A lightweight, standalone package that includes everything needed to run a piece of software (code, runtime, libraries)",
  },
  {
    front: "What is a microservice?",
    back: "An architectural style where an application is composed of small, independently deployable services",
  },
  {
    front: "What is latency?",
    back: "The time delay between a request being sent and the response being received",
  },
  {
    front: "What is throughput?",
    back: "The amount of data or number of operations processed per unit of time",
  },
  {
    front: "What is a cache?",
    back: "A high-speed storage layer that stores a subset of data so future requests are served faster",
  },
  {
    front: "What is a CDN?",
    back: "Content Delivery Network — a geographically distributed group of servers that deliver content to users from the nearest location",
  },
  {
    front: "What is sharding?",
    back: "Splitting a database into smaller, faster pieces (shards) distributed across multiple servers",
  },
  {
    front: "What is a lambda function?",
    back: "A small, anonymous function defined inline, often used for short-lived operations",
  },
  {
    front: "What is type safety?",
    back: "A property of a programming language that prevents type errors by enforcing type constraints at compile time or runtime",
  },
  {
    front: "What is a memory leak?",
    back: "A bug where a program fails to release memory it no longer needs, causing increasing memory usage over time",
  },
  {
    front: "What is idempotency?",
    back: "A property where performing an operation multiple times produces the same result as performing it once",
  },
  {
    front: "What is a binary heap?",
    back: "A complete binary tree that satisfies the heap property: parent nodes are always greater (max-heap) or smaller (min-heap) than children",
  },
  {
    front: "What is a trie?",
    back: "A tree-like data structure used to store strings where each node represents a character, enabling efficient prefix searches",
  },
  {
    front: "What is a bloom filter?",
    back: "A space-efficient probabilistic data structure that tests whether an element is a member of a set (may have false positives, never false negatives)",
  },
  {
    front: "What is eventual consistency?",
    back: "A consistency model where, given enough time without new updates, all replicas will converge to the same value",
  },
  {
    front: "What is the CAP theorem?",
    back: "A distributed systems theorem stating you can only guarantee two of three: Consistency, Availability, Partition Tolerance",
  },
  {
    front: "What is a message queue?",
    back: "A form of asynchronous communication where messages are stored in a queue until the receiving service is ready to process them",
  },
  {
    front: "What is WebSocket?",
    back: "A protocol that provides full-duplex communication channels over a single TCP connection, enabling real-time data transfer",
  },
  {
    front: "What is GraphQL?",
    back: "A query language for APIs that lets clients request exactly the data they need, avoiding over-fetching and under-fetching",
  },
];

export const CS101_MC: Record<string, unknown>[] = [
  {
    question: "What is the time complexity of binary search?",
    choices: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
    correctChoiceIndexes: [1],
  },
  {
    question: "Which sorting algorithm has the best average-case time complexity?",
    choices: [
      "Bubble Sort — O(n²)",
      "Merge Sort — O(n log n)",
      "Selection Sort — O(n²)",
      "Insertion Sort — O(n²)",
    ],
    correctChoiceIndexes: [1],
  },
  {
    question: "What does HTTPS add on top of HTTP?",
    choices: ["Speed", "Encryption via TLS/SSL", "Compression", "Caching"],
    correctChoiceIndexes: [1],
  },
  {
    question: "Which layer of the OSI model does a router operate on?",
    choices: [
      "Data Link (Layer 2)",
      "Network (Layer 3)",
      "Transport (Layer 4)",
      "Application (Layer 7)",
    ],
    correctChoiceIndexes: [1],
  },
  {
    question: "What is the primary purpose of a load balancer?",
    choices: [
      "Encrypt traffic",
      "Distribute requests across servers",
      "Store session data",
      "Compile code",
    ],
    correctChoiceIndexes: [1],
  },
  {
    question: "Which data structure is used by function calls in most languages?",
    choices: ["Queue", "Stack", "Heap", "Linked List"],
    correctChoiceIndexes: [1],
  },
  {
    question: "What type of database is MongoDB?",
    choices: ["Relational", "Document (NoSQL)", "Graph", "Key-Value"],
    correctChoiceIndexes: [1],
  },
  {
    question: "What is the worst-case time complexity of quicksort?",
    choices: ["O(n log n)", "O(n)", "O(n²)", "O(log n)"],
    correctChoiceIndexes: [2],
  },
  {
    question: "Which protocol is used to send email?",
    choices: ["FTP", "SMTP", "HTTP", "SSH"],
    correctChoiceIndexes: [1],
  },
  {
    question: "What does CI/CD stand for?",
    choices: [
      "Continuous Integration / Continuous Deployment",
      "Code Inspection / Code Delivery",
      "Compiled Integration / Compiled Deployment",
      "Central Integration / Central Delivery",
    ],
    correctChoiceIndexes: [0],
  },
  {
    question: "Which of these is NOT a valid HTTP method?",
    choices: ["GET", "POST", "SEND", "DELETE"],
    correctChoiceIndexes: [2],
  },
  {
    question: "In SQL, which keyword is used to filter grouped results?",
    choices: ["WHERE", "HAVING", "FILTER", "GROUP BY"],
    correctChoiceIndexes: [1],
  },
  {
    question: "What is the space complexity of merge sort?",
    choices: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
    correctChoiceIndexes: [2],
  },
  {
    question: "Which principle states 'a class should have only one reason to change'?",
    choices: [
      "Open/Closed",
      "Single Responsibility",
      "Liskov Substitution",
      "Dependency Inversion",
    ],
    correctChoiceIndexes: [1],
  },
  {
    question: "What is the default port for HTTPS?",
    choices: ["80", "443", "8080", "3000"],
    correctChoiceIndexes: [1],
  },
  {
    question: "Which traversal of a BST gives nodes in sorted order?",
    choices: ["Preorder", "Inorder", "Postorder", "Level-order"],
    correctChoiceIndexes: [1],
  },
  {
    question: "What does the 'S' in SOLID stand for?",
    choices: ["Singleton", "Single Responsibility", "Separation", "Stateless"],
    correctChoiceIndexes: [1],
  },
  {
    question: "Which of these is a non-comparison-based sorting algorithm?",
    choices: ["Merge Sort", "Quick Sort", "Radix Sort", "Heap Sort"],
    correctChoiceIndexes: [2],
  },
  {
    question: "What is a primary key?",
    choices: [
      "The most important column in a table",
      "A unique identifier for each row in a table",
      "The first column in a table",
      "A column that references another table",
    ],
    correctChoiceIndexes: [1],
  },
  {
    question: "What does 'idempotent' mean in the context of HTTP methods?",
    choices: [
      "The request is encrypted",
      "Multiple identical requests have the same effect as a single one",
      "The request is cached",
      "The response is always JSON",
    ],
    correctChoiceIndexes: [1],
  },
];

export const CS101_CLOZE: Record<string, unknown>[] = [
  {
    text: "The two main types of memory are {{c1::RAM}} (volatile) and {{c2::ROM}} (non-volatile).",
  },
  { text: "{{c1::TCP}} guarantees delivery while {{c2::UDP}} does not." },
  {
    text: "In object-oriented programming, the four pillars are {{c1::encapsulation}}, {{c1::abstraction}}, {{c1::inheritance}}, and {{c1::polymorphism}}.",
  },
  {
    text: "A {{c1::binary search tree}} has the property that left children are {{c2::less than}} the parent and right children are {{c2::greater than}} the parent.",
  },
  {
    text: "The {{c1::CAP theorem}} states that a distributed system can guarantee at most two of {{c2::Consistency}}, {{c2::Availability}}, and {{c2::Partition tolerance}}.",
  },
  { text: "{{c1::DNS}} resolves domain names to {{c2::IP addresses}}." },
  { text: "A {{c1::hash table}} provides average-case {{c2::O(1)}} lookup time." },
  { text: "{{c1::Git}} is a distributed {{c2::version control}} system." },
  { text: "The {{c1::heap}} data structure is used to implement a {{c2::priority queue}}." },
  {
    text: "In SQL, {{c1::JOIN}} combines rows from two or more {{c2::tables}} based on a related column.",
  },
  {
    text: "{{c1::Dijkstra's algorithm}} finds the shortest path in a graph with {{c2::non-negative}} edge weights.",
  },
  { text: "A {{c1::trie}} (prefix tree) is optimized for {{c2::string}} search operations." },
  {
    text: "The HTTP status code {{c1::404}} means {{c2::Not Found}}, while {{c1::500}} means {{c2::Internal Server Error}}.",
  },
  {
    text: "{{c1::Docker}} packages applications into {{c2::containers}} for consistent deployment across environments.",
  },
  {
    text: "In networking, the {{c1::three-way handshake}} (SYN, SYN-ACK, ACK) establishes a {{c2::TCP}} connection.",
  },
  { text: "A {{c1::B-tree}} is a self-balancing tree commonly used in {{c2::database}} indexing." },
  { text: "The {{c1::time complexity}} of inserting into a balanced BST is {{c2::O(log n)}}." },
  {
    text: "{{c1::Kubernetes}} orchestrates {{c2::containerized}} applications across a cluster of machines.",
  },
  {
    text: "{{c1::OAuth 2.0}} is an authorization framework that enables third-party applications to obtain limited access to a {{c2::web service}}.",
  },
  {
    text: "A {{c1::microservice}} architecture decomposes an application into small, {{c2::independently deployable}} services.",
  },
];

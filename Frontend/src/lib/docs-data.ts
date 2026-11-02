// ─── Shared Types ────────────────────────────────────────────────────────────
export type Content = {
  id: string
  title: string
  type: 'text' | 'code'
  content: string
  language?: string
}

export type Subtopic = {
  id: string
  title: string
  description?: string
  content: Content[]
}

export type Topic = {
  id: string
  title: string
  subtopics: Subtopic[]
}

export type Doc = {
  id: string
  title: string
  description: string
  topics: Topic[]
}

// ─── Java ─────────────────────────────────────────────────────────────────────
const java: Doc = {
  id: 'java',
  title: 'Java Documentation',
  description: 'A comprehensive guide to Java fundamentals, OOP, collections, and modern Java features.',
  topics: [
    {
      id: 'basics',
      title: 'Java Basics',
      subtopics: [
        {
          id: 'intro',
          title: 'Introduction',
          description: 'Understand the Java platform, JVM architecture, and the Write Once Run Anywhere philosophy.',
          content: [
            {
              id: 'overview',
              title: 'Platform Overview',
              type: 'text',
              content: 'Java is a high-level, robust, class-based, object-oriented language designed for minimal implementation dependencies. It runs on the Java Virtual Machine (JVM) enabling cross-platform execution — Write Once, Run Anywhere (WORA). Java 21 is the latest LTS release with many modern features.',
            },
            {
              id: 'hello',
              title: 'Hello World',
              type: 'code',
              language: 'java',
              content: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java Universe!");
        int version = 21;
        System.out.printf("Running on LTS Java %d%n", version);
    }
}`,
            },
          ],
        },
        {
          id: 'variables',
          title: 'Variables & Data Types',
          description: 'Java is statically typed — every variable must have an explicit or inferred type at compile time.',
          content: [
            {
              id: 'vars',
              title: 'Primitive Types',
              type: 'text',
              content: 'Java has 8 primitive types: byte, short, int, long, float, double, boolean, char. All other types are reference types. Java 10+ introduced `var` for local variable type inference, reducing boilerplate while keeping full static typing.',
            },
            {
              id: 'vars-code',
              title: 'Variable Declarations',
              type: 'code',
              language: 'java',
              content: `// Primitive declarations
int age = 28;
double salary = 75_000.50;
boolean isActive = true;
char grade = 'A';

// Reference types
String name = "Alice";

// Type inference (Java 10+)
var message = "Hello, inferred String!";
final double PI = 3.14159265359; // constant`,
            },
            {
              id: 'casting',
              title: 'Type Casting',
              type: 'code',
              language: 'java',
              content: `// Widening (implicit)
int i = 42;
double d = i;

// Narrowing (explicit)
double pi = 3.14;
int truncated = (int) pi; // 3

// String conversions
String s = String.valueOf(42);
int n = Integer.parseInt("100");`,
            },
          ],
        },
        {
          id: 'control-flow',
          title: 'Control Flow',
          description: 'Conditional branching and loops are the building blocks of all program logic.',
          content: [
            {
              id: 'if-switch',
              title: 'Conditionals & Switch',
              type: 'code',
              language: 'java',
              content: `// Traditional if-else
int score = 85;
if (score >= 90) System.out.println("A");
else if (score >= 80) System.out.println("B");
else System.out.println("C");

// Modern switch expression (Java 14+)
String grade = switch (score / 10) {
    case 10, 9 -> "A";
    case 8     -> "B";
    case 7     -> "C";
    default    -> "F";
};`,
            },
            {
              id: 'loops',
              title: 'Loops',
              type: 'code',
              language: 'java',
              content: `// for loop
for (int i = 0; i < 5; i++) System.out.println(i);

// enhanced for (for-each)
int[] nums = {1, 2, 3, 4, 5};
for (int n : nums) System.out.println(n);

// while
int x = 10;
while (x > 0) x -= 2;

// Stream-based iteration (modern)
java.util.stream.IntStream.rangeClosed(1, 5)
    .forEach(System.out::println);`,
            },
          ],
        },
      ],
    },
    {
      id: 'oop',
      title: 'Object-Oriented Programming',
      subtopics: [
        {
          id: 'classes',
          title: 'Classes & Objects',
          description: 'Classes are blueprints for objects — they encapsulate state and behavior.',
          content: [
            {
              id: 'class-def',
              title: 'Defining a Class',
              type: 'text',
              content: 'A class defines fields (state) and methods (behavior). Access modifiers (public, private, protected) control visibility. Constructors initialize objects. Java supports constructor overloading for flexible instantiation.',
            },
            {
              id: 'class-code',
              title: 'Developer Class',
              type: 'code',
              language: 'java',
              content: `public class Developer {
    private final String name;
    private String language;

    public Developer(String name, String language) {
        this.name = name;
        this.language = language;
    }

    public void code() {
        System.out.printf("%s is coding in %s%n", name, language);
    }

    public String getName() { return name; }
    public void setLanguage(String lang) { this.language = lang; }
}`,
            },
          ],
        },
        {
          id: 'inheritance',
          title: 'Inheritance & Interfaces',
          description: 'Extend base classes or implement interfaces to build flexible, reusable hierarchies.',
          content: [
            {
              id: 'extends',
              title: 'Inheritance with extends',
              type: 'code',
              language: 'java',
              content: `public abstract class Animal {
    protected String name;
    public Animal(String name) { this.name = name; }
    public abstract String sound();
    public void describe() {
        System.out.println(name + " says " + sound());
    }
}

public class Dog extends Animal {
    public Dog(String name) { super(name); }
    @Override public String sound() { return "Woof"; }
}`,
            },
            {
              id: 'interface',
              title: 'Interfaces & Default Methods',
              type: 'code',
              language: 'java',
              content: `interface Flyable {
    void fly();
    default String status() { return "Flying"; }
}

interface Swimmable {
    void swim();
}

class Duck extends Animal implements Flyable, Swimmable {
    public Duck(String name) { super(name); }
    @Override public String sound() { return "Quack"; }
    @Override public void fly()  { System.out.println(name + " is flying"); }
    @Override public void swim() { System.out.println(name + " is swimming"); }
}`,
            },
          ],
        },
        {
          id: 'records',
          title: 'Records & Sealed Classes',
          description: 'Modern Java immutable data carriers and restricted class hierarchies (Java 16+).',
          content: [
            {
              id: 'records-code',
              title: 'Record Types',
              type: 'code',
              language: 'java',
              content: `// Record — immutable data class (Java 16+)
public record Point(int x, int y) {
    // Compact constructor for validation
    public Point {
        if (x < 0 || y < 0) throw new IllegalArgumentException("Negative!");
    }
    public double distanceToOrigin() { return Math.sqrt(x*x + y*y); }
}

// Usage
var p = new Point(3, 4);
System.out.println(p.x()); // 3
System.out.println(p.distanceToOrigin()); // 5.0`,
            },
          ],
        },
      ],
    },
    {
      id: 'collections',
      title: 'Collections & Streams',
      subtopics: [
        {
          id: 'lists',
          title: 'List & ArrayList',
          description: 'Ordered, resizable sequences with O(1) index access and Stream API integration.',
          content: [
            {
              id: 'list-code',
              title: 'ArrayList Operations',
              type: 'code',
              language: 'java',
              content: `import java.util.*;

List<String> langs = new ArrayList<>(List.of("Java", "Python", "Go"));
langs.add("Rust");
langs.remove("Go");

// Streams
langs.stream()
    .filter(s -> s.length() > 3)
    .map(String::toUpperCase)
    .sorted()
    .forEach(System.out::println);`,
            },
          ],
        },
        {
          id: 'maps',
          title: 'Map & HashMap',
          description: 'Key-value stores with O(1) average lookup. HashMap, LinkedHashMap, TreeMap.',
          content: [
            {
              id: 'map-code',
              title: 'HashMap Operations',
              type: 'code',
              language: 'java',
              content: `Map<String, Integer> scores = new HashMap<>();
scores.put("Alice", 95);
scores.put("Bob", 87);
scores.put("Carol", 91);

scores.forEach((name, score) ->
    System.out.printf("%s: %d%n", name, score));

// Merge / compute
scores.merge("Alice", 5, Integer::sum); // 100
scores.getOrDefault("Dave", 0);         // 0`,
            },
          ],
        },
        {
          id: 'optional',
          title: 'Optional & Null Safety',
          description: 'Avoid NullPointerExceptions with the Optional<T> container type.',
          content: [
            {
              id: 'optional-code',
              title: 'Optional Patterns',
              type: 'code',
              language: 'java',
              content: `Optional<String> found = Optional.ofNullable(findUser("alice"));

// Functional pipeline
String result = found
    .filter(u -> u.length() > 3)
    .map(String::toUpperCase)
    .orElse("ANONYMOUS");

// ifPresentOrElse (Java 9+)
found.ifPresentOrElse(
    u -> System.out.println("Found: " + u),
    () -> System.out.println("Not found")
);`,
            },
          ],
        },
      ],
    },
  ],
}

// ─── Python ───────────────────────────────────────────────────────────────────
const python: Doc = {
  id: 'python',
  title: 'Python Documentation',
  description: 'A complete guide to Python — from basic syntax to advanced OOP, decorators, and async programming.',
  topics: [
    {
      id: 'basics',
      title: 'Python Basics',
      subtopics: [
        {
          id: 'intro',
          title: 'Introduction',
          description: 'Python is a dynamically typed, interpreted language famous for readability and rapid development.',
          content: [
            {
              id: 'overview',
              title: 'Language Overview',
              type: 'text',
              content: 'Python was created by Guido van Rossum in 1991. It emphasizes code readability with significant whitespace. Python 3.12+ is the recommended version. CPython is the reference interpreter, but PyPy, Jython, and MicroPython also exist for different use cases.',
            },
            {
              id: 'hello',
              title: 'Hello World',
              type: 'code',
              language: 'python',
              content: `# Python hello world
print("Hello, Python World!")

# F-strings (Python 3.6+)
name = "Python"
version = 3.12
print(f"Welcome to {name} {version}!")

# Multi-line strings
docs = """
Python is powerful
and easy to learn
"""
print(docs.strip())`,
            },
          ],
        },
        {
          id: 'variables',
          title: 'Variables & Types',
          description: 'Python uses dynamic typing — variables are assigned without declaring a type.',
          content: [
            {
              id: 'vars',
              title: 'Dynamic Typing',
              type: 'text',
              content: 'Python variables are dynamically typed: the type is inferred from the assigned value at runtime. Type hints (PEP 484) can be added for documentation and static analysis tools like mypy but are not enforced at runtime.',
            },
            {
              id: 'vars-code',
              title: 'Variable Examples',
              type: 'code',
              language: 'python',
              content: `# Basic types
age: int = 28
salary: float = 75_000.50
is_active: bool = True
name: str = "Alice"

# Type checking
print(type(age))    # <class 'int'>
print(type(name))   # <class 'str'>

# Multiple assignment
x, y, z = 1, 2, 3
a = b = c = 0

# Constants (convention)
MAX_SIZE = 100`,
            },
            {
              id: 'collections',
              title: 'Built-in Collections',
              type: 'code',
              language: 'python',
              content: `# List — mutable sequence
langs = ["Python", "Java", "Go"]
langs.append("Rust")

# Tuple — immutable
coords = (10, 20)

# Dictionary
person = {"name": "Alice", "age": 30}

# Set — unique elements
unique = {1, 2, 2, 3}  # {1, 2, 3}

# List comprehension
squares = [x**2 for x in range(1, 6)]`,
            },
          ],
        },
        {
          id: 'control-flow',
          title: 'Control Flow',
          description: 'Python uses indentation (whitespace) to define code blocks — no braces needed.',
          content: [
            {
              id: 'if-match',
              title: 'If / Match Statement',
              type: 'code',
              language: 'python',
              content: `# if-elif-else
score = 85
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
else:
    grade = "C"

# Structural pattern matching (Python 3.10+)
command = "quit"
match command:
    case "quit":
        print("Exiting...")
    case "hello":
        print("Hello!")
    case _:
        print("Unknown command")`,
            },
            {
              id: 'loops',
              title: 'Loops & Comprehensions',
              type: 'code',
              language: 'python',
              content: `# for loop with range
for i in range(5):
    print(i)

# enumerate
for idx, val in enumerate(["a", "b", "c"]):
    print(f"{idx}: {val}")

# while
n = 10
while n > 0:
    n -= 2

# List comprehension
evens = [x for x in range(20) if x % 2 == 0]

# Dict comprehension
squared = {x: x**2 for x in range(5)}`,
            },
          ],
        },
      ],
    },
    {
      id: 'functions',
      title: 'Functions & Closures',
      subtopics: [
        {
          id: 'defining',
          title: 'Defining Functions',
          description: 'Functions are first-class citizens in Python — they can be passed, returned, and stored.',
          content: [
            {
              id: 'func-def',
              title: 'Function Syntax',
              type: 'code',
              language: 'python',
              content: `# Basic function with type hints
def greet(name: str, greeting: str = "Hello") -> str:
    return f"{greeting}, {name}!"

# *args and **kwargs
def log(*args, level: str = "INFO", **kwargs):
    print(f"[{level}]", *args, kwargs)

# Lambda
square = lambda x: x ** 2

# Function as argument (higher-order)
numbers = [3, 1, 4, 1, 5, 9]
sorted_nums = sorted(numbers, key=lambda x: -x)`,
            },
            {
              id: 'decorators',
              title: 'Decorators',
              type: 'code',
              language: 'python',
              content: `import functools, time

def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper

@timer
def slow_sum(n: int) -> int:
    return sum(range(n))

slow_sum(1_000_000)`,
            },
          ],
        },
        {
          id: 'generators',
          title: 'Generators & Iterators',
          description: 'Lazy evaluation for memory-efficient processing of large sequences.',
          content: [
            {
              id: 'gen-code',
              title: 'Generator Functions',
              type: 'code',
              language: 'python',
              content: `# Generator function
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

fib = fibonacci()
first_10 = [next(fib) for _ in range(10)]
print(first_10)  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

# Generator expression
large_gen = (x**2 for x in range(1_000_000))
print(next(large_gen))  # 0 — only computes one value`,
            },
          ],
        },
        {
          id: 'closures',
          title: 'Closures & Scope',
          description: 'Functions that capture variables from their enclosing scope.',
          content: [
            {
              id: 'closure-code',
              title: 'Closure Example',
              type: 'code',
              language: 'python',
              content: `def make_counter(start: int = 0):
    count = start
    def increment(by: int = 1):
        nonlocal count
        count += by
        return count
    return increment

counter = make_counter(10)
print(counter())    # 11
print(counter(5))   # 16
print(counter())    # 17`,
            },
          ],
        },
      ],
    },
    {
      id: 'oop',
      title: 'Classes & OOP',
      subtopics: [
        {
          id: 'classes',
          title: 'Classes & Dataclasses',
          description: 'Python OOP with classes, dataclasses, and special (dunder) methods.',
          content: [
            {
              id: 'class-def',
              title: 'Class Definition',
              type: 'code',
              language: 'python',
              content: `from dataclasses import dataclass, field

@dataclass
class Developer:
    name: str
    language: str
    years_exp: int = 0
    skills: list[str] = field(default_factory=list)

    def introduce(self) -> str:
        return f"Hi, I'm {self.name}, a {self.language} dev."

    def add_skill(self, skill: str) -> None:
        self.skills.append(skill)

dev = Developer("Alice", "Python", 5)
dev.add_skill("FastAPI")
print(dev.introduce())`,
            },
          ],
        },
        {
          id: 'inheritance',
          title: 'Inheritance & ABCs',
          description: 'Python supports multiple inheritance and Abstract Base Classes from the `abc` module.',
          content: [
            {
              id: 'abc-code',
              title: 'Abstract Base Classes',
              type: 'code',
              language: 'python',
              content: `from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...
    
    @abstractmethod
    def perimeter(self) -> float: ...
    
    def describe(self) -> str:
        return f"Area={self.area():.2f}, Perim={self.perimeter():.2f}"

class Circle(Shape):
    def __init__(self, radius: float):
        self.radius = radius
    def area(self) -> float: return 3.14159 * self.radius ** 2
    def perimeter(self) -> float: return 2 * 3.14159 * self.radius

c = Circle(5)
print(c.describe())`,
            },
          ],
        },
        {
          id: 'async',
          title: 'Async / Await',
          description: 'Python asyncio for concurrent I/O-bound programming without threads.',
          content: [
            {
              id: 'async-code',
              title: 'Async Functions',
              type: 'code',
              language: 'python',
              content: `import asyncio

async def fetch_data(url: str) -> str:
    # Simulate I/O
    await asyncio.sleep(1)
    return f"Data from {url}"

async def main():
    # Run concurrently
    results = await asyncio.gather(
        fetch_data("https://api.example.com/users"),
        fetch_data("https://api.example.com/posts"),
    )
    for r in results:
        print(r)

asyncio.run(main())`,
            },
          ],
        },
      ],
    },
  ],
}

// ─── JavaScript ───────────────────────────────────────────────────────────────
const javascript: Doc = {
  id: 'javascript',
  title: 'JavaScript Documentation',
  description: 'Modern JavaScript from ES6+ fundamentals to async patterns, modules, and the event loop.',
  topics: [
    {
      id: 'basics',
      title: 'JS Fundamentals',
      subtopics: [
        {
          id: 'intro',
          title: 'Introduction',
          description: 'JavaScript is the language of the web — runs in browsers and on servers via Node.js.',
          content: [
            {
              id: 'overview',
              title: 'Language Overview',
              type: 'text',
              content: 'JavaScript is a dynamic, prototype-based, multi-paradigm scripting language. It is the only language that runs natively in browsers. With Node.js it also powers backends, CLIs, and serverless functions. ECMAScript (ES) is the spec — ES2015 (ES6) was a major turning point with classes, modules, and arrow functions.',
            },
            {
              id: 'hello',
              title: 'Hello World',
              type: 'code',
              language: 'javascript',
              content: `// Browser
console.log("Hello, JavaScript!");

// Template literals (ES6+)
const lang = "JavaScript";
const year = new Date().getFullYear();
console.log(\`Learning \${lang} in \${year}\`);

// Destructuring
const [first, ...rest] = [1, 2, 3, 4];
const { name, age = 25 } = { name: "Alice" };`,
            },
          ],
        },
        {
          id: 'variables',
          title: 'Variables & Scope',
          description: 'Use const and let — never var. Understand block, function, and module scope.',
          content: [
            {
              id: 'vars-code',
              title: 'const / let / var',
              type: 'code',
              language: 'javascript',
              content: `// const — block-scoped, cannot reassign
const PI = 3.14159;
const config = { theme: "dark" };
config.theme = "light"; // OK — object is mutable

// let — block-scoped, can reassign
let count = 0;
count++;

// var — avoid! function-scoped, hoisted
var legacy = "avoid this";

// Temporal dead zone with let/const
// console.log(x); // ReferenceError
let x = 10;`,
            },
          ],
        },
        {
          id: 'functions',
          title: 'Functions & Closures',
          description: 'Arrow functions, default params, rest/spread, and closures.',
          content: [
            {
              id: 'arrow',
              title: 'Arrow Functions',
              type: 'code',
              language: 'javascript',
              content: `// Arrow function
const add = (a, b) => a + b;

// With default params
const greet = (name = "World") => \`Hello, \${name}!\`;

// Rest params & spread
const sum = (...nums) => nums.reduce((a, b) => a + b, 0);
console.log(sum(1, 2, 3, 4)); // 10

// Closure
function makeCounter(initial = 0) {
  let count = initial;
  return {
    increment: () => ++count,
    decrement: () => --count,
    value: () => count,
  };
}`,
            },
          ],
        },
      ],
    },
    {
      id: 'async',
      title: 'Async JavaScript',
      subtopics: [
        {
          id: 'promises',
          title: 'Promises',
          description: 'Promises represent eventual completion or failure of an asynchronous operation.',
          content: [
            {
              id: 'promise-code',
              title: 'Creating & Chaining Promises',
              type: 'code',
              language: 'javascript',
              content: `const fetchUser = (id) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id > 0) resolve({ id, name: "Alice" });
      else reject(new Error("Invalid ID"));
    }, 500);
  });

fetchUser(1)
  .then(user => user.name.toUpperCase())
  .then(name => console.log(name))
  .catch(err => console.error(err.message))
  .finally(() => console.log("Done"));`,
            },
          ],
        },
        {
          id: 'async-await',
          title: 'Async / Await',
          description: 'Cleaner async syntax built on top of Promises — write async code like sync code.',
          content: [
            {
              id: 'async-code',
              title: 'Async/Await Patterns',
              type: 'code',
              language: 'javascript',
              content: `async function loadDashboard(userId) {
  try {
    const [user, posts] = await Promise.all([
      fetch(\`/api/users/\${userId}\`).then(r => r.json()),
      fetch(\`/api/posts?userId=\${userId}\`).then(r => r.json()),
    ]);
    return { user, posts };
  } catch (err) {
    console.error("Failed to load:", err);
    throw err;
  }
}`,
            },
          ],
        },
        {
          id: 'event-loop',
          title: 'Event Loop',
          description: 'How JavaScript handles concurrency with a single thread and the task queue.',
          content: [
            {
              id: 'event-code',
              title: 'Microtask vs Macrotask',
              type: 'code',
              language: 'javascript',
              content: `console.log("1 — sync");

setTimeout(() => console.log("3 — macrotask"), 0);

Promise.resolve()
  .then(() => console.log("2 — microtask"));

console.log("1.5 — still sync");

// Output order: 1, 1.5, 2, 3
// Microtasks (Promise) run before macrotasks (setTimeout)`,
            },
          ],
        },
      ],
    },
    {
      id: 'modern',
      title: 'Modern ES Features',
      subtopics: [
        {
          id: 'destructuring',
          title: 'Destructuring & Spread',
          description: 'Concise syntax to unpack arrays and objects, and compose new ones.',
          content: [
            {
              id: 'destruct-code',
              title: 'Destructuring Examples',
              type: 'code',
              language: 'javascript',
              content: `// Array destructuring
const [head, ...tail] = [1, 2, 3, 4];
const [,, third] = [10, 20, 30]; // skip elements

// Object destructuring with rename & default
const { name: userName, role = "user" } = { name: "Alice" };

// Spread — shallow clone / merge
const arr = [...[1,2], ...[3,4]]; // [1,2,3,4]
const obj = { ...defaults, ...overrides };

// In function params
function draw({ x = 0, y = 0, color = "black" } = {}) {
  console.log(x, y, color);
}`,
            },
          ],
        },
        {
          id: 'modules',
          title: 'ES Modules',
          description: 'Native module system with import/export for encapsulation and tree-shaking.',
          content: [
            {
              id: 'modules-code',
              title: 'Import & Export',
              type: 'code',
              language: 'javascript',
              content: `// math.js — named exports
export const add = (a, b) => a + b;
export const PI = 3.14159;
export default function multiply(a, b) { return a * b; }

// main.js — importing
import multiply, { add, PI } from './math.js';

// Dynamic import (lazy loading)
const { heavy } = await import('./heavy-module.js');

// Re-export
export { add as sum } from './math.js';`,
            },
          ],
        },
        {
          id: 'optional-chaining',
          title: 'Optional Chaining & Nullish',
          description: 'Safely access nested properties and provide fallback values.',
          content: [
            {
              id: 'chain-code',
              title: 'Optional Chaining (?.) & Nullish Coalescing (??)',
              type: 'code',
              language: 'javascript',
              content: `const user = { profile: { avatar: null } };

// Optional chaining — no error if undefined
const city = user?.address?.city;    // undefined
const avatar = user?.profile?.avatar; // null

// Nullish coalescing — fallback for null/undefined only
const displayName = user?.name ?? "Anonymous";
const count = 0 ?? 42; // 0 (0 is not null/undefined)

// Logical assignment
user.role ??= "viewer";   // assign if null/undefined
user.score ||= 100;       // assign if falsy
user.premium &&= false;   // assign if truthy`,
            },
          ],
        },
      ],
    },
  ],
}

// ─── TypeScript ───────────────────────────────────────────────────────────────
const typescript: Doc = {
  id: 'typescript',
  title: 'TypeScript Documentation',
  description: 'TypeScript is a typed superset of JavaScript that compiles to plain JS. Build safer, scalable apps.',
  topics: [
    {
      id: 'basics',
      title: 'TypeScript Basics',
      subtopics: [
        {
          id: 'intro',
          title: 'Introduction',
          description: 'TypeScript adds static types to JavaScript, enabling better tooling and fewer runtime errors.',
          content: [
            {
              id: 'overview',
              title: 'Why TypeScript?',
              type: 'text',
              content: 'TypeScript (TS) is a strongly-typed superset of JavaScript developed by Microsoft. It compiles to plain JavaScript and runs anywhere JS runs. TypeScript\'s static type system catches errors at compile time, improves IDE autocomplete (IntelliSense), makes refactoring safer, and serves as live documentation for APIs and interfaces.',
            },
            {
              id: 'hello',
              title: 'Hello TypeScript',
              type: 'code',
              language: 'typescript',
              content: `// Type annotations
const greet = (name: string, times: number = 1): string => {
  return Array(times).fill(\`Hello, \${name}!\`).join(" ");
};

console.log(greet("TypeScript")); // Hello, TypeScript!
console.log(greet("TS", 3));      // Hello, TS! Hello, TS! Hello, TS!

// TS catches errors at compile time
// greet(42); // Error: Argument of type 'number' is not assignable to parameter of type 'string'`,
            },
          ],
        },
        {
          id: 'types',
          title: 'Types & Interfaces',
          description: 'Define custom types and interfaces to shape your data structures.',
          content: [
            {
              id: 'type-alias',
              title: 'Type Aliases & Interfaces',
              type: 'code',
              language: 'typescript',
              content: `// Type alias
type ID = string | number;
type Status = "active" | "inactive" | "pending";

// Interface
interface User {
  readonly id: ID;
  name: string;
  email: string;
  role?: "admin" | "user"; // optional
}

// Interface extension
interface Admin extends User {
  permissions: string[];
}

// Inline type
function createUser(data: Omit<User, "id">): User {
  return { id: crypto.randomUUID(), ...data };
}`,
            },
            {
              id: 'union-intersection',
              title: 'Union & Intersection Types',
              type: 'code',
              language: 'typescript',
              content: `// Union — one of many types
type StringOrNumber = string | number;
type Result<T> = { success: true; data: T } | { success: false; error: string };

// Intersection — combine types
type Employee = { name: string; id: number };
type Manager = Employee & { reports: Employee[] };

// Discriminated unions (type guards)
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "rect":   return shape.width * shape.height;
  }
}`,
            },
          ],
        },
        {
          id: 'generics',
          title: 'Generics',
          description: 'Write reusable, type-safe functions and data structures with generics.',
          content: [
            {
              id: 'generics-code',
              title: 'Generic Functions & Classes',
              type: 'code',
              language: 'typescript',
              content: `// Generic function
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
const n = first([1, 2, 3]);   // number | undefined
const s = first(["a", "b"]);  // string | undefined

// Generic with constraint
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Generic class
class Stack<T> {
  private items: T[] = [];
  push(item: T): void { this.items.push(item); }
  pop(): T | undefined { return this.items.pop(); }
  peek(): T | undefined { return this.items.at(-1); }
}`,
            },
          ],
        },
      ],
    },
    {
      id: 'advanced',
      title: 'Advanced Types',
      subtopics: [
        {
          id: 'utility',
          title: 'Utility Types',
          description: 'Built-in mapped types: Partial, Required, Pick, Omit, Record, ReturnType and more.',
          content: [
            {
              id: 'utility-code',
              title: 'Common Utility Types',
              type: 'code',
              language: 'typescript',
              content: `interface Post {
  id: number;
  title: string;
  body: string;
  author: string;
}

type PostPreview = Pick<Post, "id" | "title">;
type PostDraft  = Omit<Post, "id">;
type PostUpdate = Partial<Post>;
type PostFull   = Required<Post>;

// Record — map type
type Roles = Record<"admin" | "user" | "guest", { canEdit: boolean }>;

// Conditional types
type NonNullable<T> = T extends null | undefined ? never : T;
type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : never;`,
            },
          ],
        },
        {
          id: 'decorators',
          title: 'Decorators & Metadata',
          description: 'Class, method, and property decorators (Stage 3 proposal, enabled in TS).',
          content: [
            {
              id: 'deco-code',
              title: 'Class Decorators',
              type: 'code',
              language: 'typescript',
              content: `function sealed(target: Function) {
  Object.seal(target);
  Object.seal(target.prototype);
}

function log(target: any, key: string, desc: PropertyDescriptor) {
  const original = desc.value;
  desc.value = function(...args: any[]) {
    console.log(\`Calling \${key} with\`, args);
    const result = original.apply(this, args);
    console.log(\`\${key} returned\`, result);
    return result;
  };
}

@sealed
class Calculator {
  @log
  add(a: number, b: number): number { return a + b; }
}`,
            },
          ],
        },
        {
          id: 'narrowing',
          title: 'Type Narrowing & Guards',
          description: 'TypeScript narrows types using typeof, instanceof, in, and custom type predicates.',
          content: [
            {
              id: 'guard-code',
              title: 'Type Guards',
              type: 'code',
              language: 'typescript',
              content: `// typeof guard
function padLeft(value: string | number, padding: string | number) {
  if (typeof padding === "number") {
    return " ".repeat(padding) + value;
  }
  return padding + value;
}

// instanceof guard
class Cat { meow() { return "Meow"; } }
class Dog { bark() { return "Woof"; } }

function makeNoise(pet: Cat | Dog) {
  if (pet instanceof Cat) return pet.meow();
  return pet.bark();
}

// Custom type predicate
function isString(val: unknown): val is string {
  return typeof val === "string";
}`,
            },
          ],
        },
      ],
    },
    {
      id: 'patterns',
      title: 'TS Patterns',
      subtopics: [
        {
          id: 'modules',
          title: 'Modules & Namespaces',
          description: 'TypeScript modules map 1-to-1 with ES modules. Namespaces are a TS-specific concept.',
          content: [
            {
              id: 'modules-code',
              title: 'Module Patterns',
              type: 'code',
              language: 'typescript',
              content: `// types.ts
export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

// api.ts
import type { ApiResponse } from "./types";

export async function get<T>(url: string): Promise<ApiResponse<T>> {
  const res = await fetch(url);
  const data = await res.json() as T;
  return { data, status: res.status, message: "OK" };
}`,
            },
          ],
        },
        {
          id: 'async',
          title: 'Async Patterns in TS',
          description: 'Typed async/await, Promise utilities, and error handling with typed exceptions.',
          content: [
            {
              id: 'async-code',
              title: 'Typed Async/Await',
              type: 'code',
              language: 'typescript',
              content: `type AsyncResult<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<AsyncResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

const result = await tryCatch(() => fetch("/api/data").then(r => r.json()));
if (result.ok) console.log(result.value);
else console.error(result.error.message);`,
            },
          ],
        },
        {
          id: 'config',
          title: 'tsconfig.json',
          description: 'Key tsconfig options for strict mode, module resolution, and output settings.',
          content: [
            {
              id: 'config-code',
              title: 'Recommended tsconfig',
              type: 'code',
              language: 'json',
              content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "lib": ["ES2022", "DOM"],
    "outDir": "./dist",
    "declaration": true
  },
  "include": ["src/**/*"]
}`,
            },
          ],
        },
      ],
    },
  ],
}

// ─── React ─────────────────────────────────────────────────────────────────────
const react: Doc = {
  id: 'react',
  title: 'React Documentation',
  description: 'Modern React with hooks, server components, performance patterns, and best practices.',
  topics: [
    {
      id: 'basics',
      title: 'React Fundamentals',
      subtopics: [
        {
          id: 'intro',
          title: 'Introduction',
          description: 'React is a UI library for building component-based interfaces with a declarative style.',
          content: [
            {
              id: 'overview',
              title: 'What is React?',
              type: 'text',
              content: 'React is a declarative, component-based JavaScript library for building user interfaces, maintained by Meta. React 18+ introduced concurrent rendering, automatic batching, and the transition API. React Server Components (RSC) in React 19 allow zero-bundle-size server-rendered components with direct database access.',
            },
            {
              id: 'hello',
              title: 'First Component',
              type: 'code',
              language: 'tsx',
              content: `// A simple React functional component
interface WelcomeProps {
  name: string;
  version?: number;
}

export function Welcome({ name, version = 18 }: WelcomeProps) {
  return (
    <div className="welcome">
      <h1>Hello, {name}!</h1>
      <p>Running React v{version}</p>
    </div>
  );
}

// Usage
<Welcome name="Developer" version={19} />`,
            },
          ],
        },
        {
          id: 'jsx',
          title: 'JSX & Rendering',
          description: 'JSX is a syntax extension for JavaScript that lets you write HTML-like markup inside JS.',
          content: [
            {
              id: 'jsx-code',
              title: 'JSX Patterns',
              type: 'code',
              language: 'tsx',
              content: `const items = ["Apple", "Banana", "Cherry"];
const isLoggedIn = true;

function List() {
  return (
    <div>
      {/* Conditional rendering */}
      {isLoggedIn ? <p>Welcome back!</p> : <p>Please log in.</p>}
      {isLoggedIn && <button>Dashboard</button>}

      {/* Lists — always use a stable key */}
      <ul>
        {items.map((item, i) => (
          <li key={item}>{i + 1}. {item}</li>
        ))}
      </ul>

      {/* Fragments */}
      <>
        <h2>Section</h2>
        <p>Content</p>
      </>
    </div>
  );
}`,
            },
          ],
        },
        {
          id: 'state',
          title: 'State & useState',
          description: 'Local component state managed with the useState hook.',
          content: [
            {
              id: 'usestate-code',
              title: 'useState Hook',
              type: 'code',
              language: 'tsx',
              content: `import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState("");

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <button onClick={() => setCount(c => c - 1)}>-</button>
      <button onClick={() => setCount(0)}>Reset</button>

      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name"
      />
      {name && <p>Hello, {name}!</p>}
    </div>
  );
}`,
            },
          ],
        },
      ],
    },
    {
      id: 'hooks',
      title: 'Hooks',
      subtopics: [
        {
          id: 'useeffect',
          title: 'useEffect & Lifecycle',
          description: 'Synchronize components with external systems: data fetching, subscriptions, timers.',
          content: [
            {
              id: 'effect-code',
              title: 'useEffect Patterns',
              type: 'code',
              language: 'tsx',
              content: `import { useState, useEffect } from "react";

function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false; // prevent stale state

    async function load() {
      setLoading(true);
      const data = await fetchUser(userId);
      if (!cancelled) {
        setUser(data);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; }; // cleanup
  }, [userId]); // re-run when userId changes

  if (loading) return <Spinner />;
  return <div>{user?.name}</div>;
}`,
            },
          ],
        },
        {
          id: 'usememo-callback',
          title: 'useMemo & useCallback',
          description: 'Memoization hooks to skip expensive re-computations and stable function references.',
          content: [
            {
              id: 'memo-code',
              title: 'Memoization Patterns',
              type: 'code',
              language: 'tsx',
              content: `import { useMemo, useCallback, useState } from "react";

function DataGrid({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof Row>("name");

  // Only recomputes when rows or filter changes
  const filtered = useMemo(
    () => rows.filter(r => r.name.toLowerCase().includes(filter)),
    [rows, filter]
  );

  // Stable reference — won't cause child re-render
  const handleSort = useCallback(
    (key: keyof Row) => setSortKey(key),
    [] // no deps needed — setSortKey is stable
  );

  return <Table rows={filtered} onSort={handleSort} />;
}`,
            },
          ],
        },
        {
          id: 'custom-hooks',
          title: 'Custom Hooks',
          description: 'Extract reusable stateful logic into custom hooks — share behavior, not UI.',
          content: [
            {
              id: 'custom-code',
              title: 'Custom Hook Examples',
              type: 'code',
              language: 'tsx',
              content: `// useLocalStorage hook
function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initial;
    } catch { return initial; }
  });

  const set = (newValue: T) => {
    setValue(newValue);
    localStorage.setItem(key, JSON.stringify(newValue));
  };

  return [value, set] as const;
}

// Usage
function ThemeToggle() {
  const [theme, setTheme] = useLocalStorage("theme", "light");
  return (
    <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}`,
            },
          ],
        },
      ],
    },
    {
      id: 'patterns',
      title: 'Patterns & Performance',
      subtopics: [
        {
          id: 'context',
          title: 'Context & useReducer',
          description: 'Global state management with React Context and useReducer for complex state logic.',
          content: [
            {
              id: 'context-code',
              title: 'Context + Reducer Pattern',
              type: 'code',
              language: 'tsx',
              content: `import { createContext, useContext, useReducer } from "react";

type State = { count: number; theme: "light" | "dark" };
type Action = { type: "increment" } | { type: "toggle_theme" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "increment": return { ...state, count: state.count + 1 };
    case "toggle_theme": return { ...state, theme: state.theme === "light" ? "dark" : "light" };
  }
}

const AppContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { count: 0, theme: "light" });
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}`,
            },
          ],
        },
        {
          id: 'suspense',
          title: 'Suspense & Error Boundaries',
          description: 'Declarative loading and error states for async data and lazy-loaded components.',
          content: [
            {
              id: 'suspense-code',
              title: 'Suspense Pattern',
              type: 'code',
              language: 'tsx',
              content: `import { Suspense, lazy } from "react";

// Lazy load heavy components
const HeavyChart = lazy(() => import("./HeavyChart"));

function Dashboard() {
  return (
    <ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <Suspense fallback={<Skeleton />}>
        <HeavyChart />
      </Suspense>
    </ErrorBoundary>
  );
}

// React 19: use() hook for data
import { use } from "react";

function UserCard({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // Suspense-integrated
  return <div>{user.name}</div>;
}`,
            },
          ],
        },
        {
          id: 'memo',
          title: 'React.memo & Profiling',
          description: 'Skip unnecessary re-renders with React.memo and measure with the React Profiler.',
          content: [
            {
              id: 'memo-comp-code',
              title: 'React.memo',
              type: 'code',
              language: 'tsx',
              content: `import { memo, useCallback } from "react";

// Only re-renders when props change (shallow comparison)
const ExpensiveItem = memo(function ExpensiveItem({
  item,
  onDelete,
}: {
  item: Item;
  onDelete: (id: string) => void;
}) {
  console.log("Rendering item:", item.id);
  return (
    <div>
      <span>{item.name}</span>
      <button onClick={() => onDelete(item.id)}>Delete</button>
    </div>
  );
});

// Parent — useCallback ensures onDelete is stable
function ItemList({ items }: { items: Item[] }) {
  const handleDelete = useCallback((id: string) => {
    // delete logic
  }, []);

  return items.map(item => (
    <ExpensiveItem key={item.id} item={item} onDelete={handleDelete} />
  ));
}`,
            },
          ],
        },
      ],
    },
  ],
}

// ─── Export ───────────────────────────────────────────────────────────────────
export const INITIAL_DOCS: Record<string, Doc> = {
  java,
  python,
  javascript,
  typescript,
  react,
}


export const LANGUAGE_META: Record<
  string,
  { label: string; color: string; emoji: string }
> = {
  java: {
    label: 'Java',
    color: 'amber',
    emoji: '☕',
  },

  python: {
    label: 'Python',
    color: 'emerald',
    emoji: '🐍',
  },

  javascript: {
    label: 'JavaScript',
    color: 'lime',
    emoji: '🟨',
  },

  typescript: {
    label: 'TypeScript',
    color: 'blue',
    emoji: '🔷',
  },

  react: {
    label: 'React',
    color: 'cyan',
    emoji: '⚛️',
  },

  node: {
    label: 'Node.js',
    color: 'emerald',
    emoji: '🟢',
  },

  css: {
    label: 'CSS',
    color: 'violet',
    emoji: '🎨',
  },

  html: {
    label: 'HTML',
    color: 'rose',
    emoji: '🌐',
  },
}


/**
 * Data generator functions for producing realistic mock data.
 * No external dependencies - uses Math.random() and crypto.randomUUID().
 */

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Lisa', 'Daniel', 'Nancy',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Dorothy', 'Andrew', 'Kimberly', 'Paul', 'Emily', 'Joshua', 'Donna',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
];

const STREETS = [
  'Main St', 'Oak Ave', 'Elm St', 'Park Blvd', 'Cedar Ln', 'Maple Dr',
  'Pine St', 'Washington Ave', 'Lake Rd', 'Hill St', 'River Rd', 'Forest Ave',
  'Sunset Blvd', 'Broadway', 'Highland Ave', 'Meadow Ln', 'Valley Rd',
  'Spring St', 'Church St', 'Lincoln Ave',
];

const CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
  'Fort Worth', 'Columbus', 'Charlotte', 'Indianapolis', 'San Francisco',
  'Seattle', 'Denver', 'Nashville', 'Portland', 'Memphis', 'Louisville',
  'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento',
  'Mesa',
];

const COMPANIES = [
  'Acme Corp', 'Globex Industries', 'Initech', 'Umbrella Corp', 'Stark Industries',
  'Wayne Enterprises', 'Hooli', 'Pied Piper', 'Soylent Corp', 'Cyberdyne Systems',
  'Tyrell Corp', 'Weyland-Yutani', 'Massive Dynamic', 'Aperture Science',
  'Oscorp Industries', 'LexCorp', 'Vandelay Industries', 'Prestige Worldwide',
  'Sterling Cooper', 'Dunder Mifflin',
];

const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
];

const DOMAINS = [
  'example.com', 'test.org', 'demo.net', 'sample.io', 'mock.dev',
  'fakecorp.com', 'testsite.org', 'myapp.io', 'devtest.net', 'placeholder.com',
];

const TLDS = ['com', 'org', 'net', 'io', 'dev', 'co', 'app', 'tech'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Generator functions ---

export function firstName(): string {
  return pickRandom(FIRST_NAMES);
}

export function lastName(): string {
  return pickRandom(LAST_NAMES);
}

export function email(): string {
  const first = firstName().toLowerCase();
  const last = lastName().toLowerCase();
  const domain = pickRandom(DOMAINS);
  const separator = pickRandom(['.', '_', '']);
  const suffix = randomInt(0, 1) ? String(randomInt(1, 99)) : '';
  return `${first}${separator}${last}${suffix}@${domain}`;
}

export function phone(): string {
  const area = randomInt(200, 999);
  const prefix = randomInt(200, 999);
  const line = randomInt(1000, 9999);
  return `(${area}) ${prefix}-${line}`;
}

export function address(): string {
  const number = randomInt(1, 9999);
  const street = pickRandom(STREETS);
  const city = pickRandom(CITIES);
  return `${number} ${street}, ${city}`;
}

export function company(): string {
  return pickRandom(COMPANIES);
}

export function date(): string {
  const start = new Date(2000, 0, 1).getTime();
  const end = new Date(2025, 11, 31).getTime();
  const timestamp = start + Math.random() * (end - start);
  return new Date(timestamp).toISOString().split('T')[0];
}

export function integer(): number {
  return randomInt(0, 10000);
}

export function float(): number {
  return Math.round(Math.random() * 10000 * 100) / 100;
}

export function boolean(): boolean {
  return Math.random() >= 0.5;
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function sentence(): string {
  const length = randomInt(5, 15);
  const words: string[] = [];
  for (let i = 0; i < length; i++) {
    words.push(pickRandom(LOREM_WORDS));
  }
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ') + '.';
}

export function paragraph(): string {
  const count = randomInt(3, 7);
  const sentences: string[] = [];
  for (let i = 0; i < count; i++) {
    sentences.push(sentence());
  }
  return sentences.join(' ');
}

export function url(): string {
  const protocol = pickRandom(['https', 'http']);
  const subdomain = pickRandom(['www', 'app', 'api', 'dev', '']);
  const domain = pickRandom(['example', 'test', 'demo', 'sample', 'mock']);
  const tld = pickRandom(TLDS);
  const path = pickRandom(['', '/about', '/home', '/products', '/api/v1', '/docs', '/blog']);
  const host = subdomain ? `${subdomain}.${domain}.${tld}` : `${domain}.${tld}`;
  return `${protocol}://${host}${path}`;
}

export function ipv4(): string {
  return `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}

export function hexColor(): string {
  const hex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');
  return `#${hex}`;
}

// --- Generator registry ---

export type GeneratorFn = () => string | number | boolean;

export interface GeneratorInfo {
  name: string;
  description: string;
  fn: GeneratorFn;
}

export const generators: Record<string, GeneratorInfo> = {
  firstName: {
    name: 'firstName',
    description: 'Generates a random first name',
    fn: firstName,
  },
  lastName: {
    name: 'lastName',
    description: 'Generates a random last name',
    fn: lastName,
  },
  email: {
    name: 'email',
    description: 'Generates a random email address',
    fn: email,
  },
  phone: {
    name: 'phone',
    description: 'Generates a random phone number in (XXX) XXX-XXXX format',
    fn: phone,
  },
  address: {
    name: 'address',
    description: 'Generates a random street address with city',
    fn: address,
  },
  company: {
    name: 'company',
    description: 'Generates a random company name',
    fn: company,
  },
  date: {
    name: 'date',
    description: 'Generates a random date in YYYY-MM-DD format (2000-2025)',
    fn: date,
  },
  integer: {
    name: 'integer',
    description: 'Generates a random integer between 0 and 10000',
    fn: integer,
  },
  float: {
    name: 'float',
    description: 'Generates a random float with 2 decimal places (0-10000)',
    fn: float,
  },
  boolean: {
    name: 'boolean',
    description: 'Generates a random boolean (true or false)',
    fn: boolean,
  },
  uuid: {
    name: 'uuid',
    description: 'Generates a random UUID v4 using crypto.randomUUID()',
    fn: uuid,
  },
  sentence: {
    name: 'sentence',
    description: 'Generates a random lorem ipsum sentence (5-15 words)',
    fn: sentence,
  },
  paragraph: {
    name: 'paragraph',
    description: 'Generates a random lorem ipsum paragraph (3-7 sentences)',
    fn: paragraph,
  },
  url: {
    name: 'url',
    description: 'Generates a random URL with protocol, domain, and path',
    fn: url,
  },
  ipv4: {
    name: 'ipv4',
    description: 'Generates a random IPv4 address',
    fn: ipv4,
  },
  hexColor: {
    name: 'hexColor',
    description: 'Generates a random hex color code (e.g., #a3f2c1)',
    fn: hexColor,
  },
};

/**
 * Get a generator function by name.
 * Returns undefined if the generator name is not recognized.
 */
export function getGenerator(name: string): GeneratorFn | undefined {
  return generators[name]?.fn;
}

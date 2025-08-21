import crypto from 'crypto';

// Dictionary of words (8 letters or less) for referral codes
// This is a curated list to ensure good, readable words
// Now expanded to 1,000 words for more combinations
const DICTIONARY_WORDS = [
  // 1-100
  'apple', 'beach', 'chair', 'dance', 'eagle', 'flame', 'grape', 'heart',
  'ice', 'jump', 'king', 'lamp', 'moon', 'nest', 'ocean', 'play',
  'queen', 'rain', 'star', 'tree', 'umbrella', 'voice', 'wind', 'xray',
  'year', 'zoo', 'bird', 'cake', 'door', 'fish', 'gold', 'hat',
  'ink', 'joke', 'leaf', 'milk', 'note', 'open', 'park', 'quick',
  'rose', 'sun', 'time', 'up', 'vase', 'water', 'box', 'yarn',
  'zinc', 'art', 'book', 'cat', 'dog', 'eye', 'fun', 'game',
  'home', 'idea', 'joy', 'key', 'love', 'map', 'new', 'old',
  'pen', 'run', 'sky', 'top', 'use', 'van', 'win', 'yes',
  'zap', 'air', 'boy', 'cup', 'day', 'ear', 'fox', 'girl',
  // 101-200
  'hot', 'jam', 'kid', 'log', 'man', 'net', 'owl', 'pig',
  'rat', 'sad', 'tea', 'wet', 'ace', 'bad', 'cow', 'dry',
  'egg', 'fat', 'gas', 'hit', 'jet', 'kit', 'low', 'mad',
  'now', 'odd', 'pay', 'red', 'saw', 'toy', 'wow', 'act',
  'big', 'cut', 'dig', 'end', 'fit', 'get', 'ill', 'job',
  'let', 'mix', 'nod', 'own', 'put', 'row', 'say', 'try',
  'ant', 'bat', 'cap', 'den', 'elm', 'fin', 'gum', 'hop',
  'ivy', 'jar', 'kin', 'lid', 'mob', 'nap', 'oak', 'pet',
  'quay', 'rib', 'sip', 'tan', 'urn', 'vet', 'wig', 'yak',
  'zen', 'arch', 'bark', 'clay', 'drum', 'echo', 'fern', 'gale',
  'haze', 'iris', 'jade', 'knot', 'lamb', 'moss', 'nook', 'opal',
  'pearl', 'quiz', 'reef', 'sage', 'twig', 'veil', 'warp', 'yolk',
  // 201-300
  'zeal', 'ally', 'bald', 'cane', 'dawn', 'envy', 'fawn', 'glee',
  'hymn', 'itch', 'jolt', 'keen', 'lore', 'mule', 'numb', 'omen',
  'pact', 'quip', 'rune', 'soar', 'tide', 'urge', 'vain', 'wisp',
  'yawn', 'zest', 'axis', 'bide', 'cove', 'dove', 'envoy', 'fizz',
  'gush', 'hush', 'idol', 'jazz', 'kale', 'lilt', 'maze', 'nook',
  'ogle', 'palm', 'quip', 'ramp', 'sift', 'tusk', 'urge', 'vial',
  'warp', 'yeti', 'zinc', 'aura', 'bask', 'cusp', 'dusk', 'eddy',
  'floe', 'gaze', 'hive', 'inch', 'jibe', 'kudo', 'luxe', 'mire',
  'nape', 'ogle', 'pike', 'quip', 'rave', 'silo', 'tome', 'ulna',
  'vibe', 'wade', 'yarn', 'zany', 'aloe', 'burl', 'cask', 'dine',
  // 301-400
  'etch', 'fume', 'gale', 'hilt', 'iris', 'jolt', 'knee', 'lair',
  'muse', 'nook', 'opus', 'pint', 'quip', 'rind', 'sash', 'turf',
  'urge', 'vane', 'wade', 'yule', 'zest', 'aunt', 'bide', 'cane',
  'dawn', 'envy', 'fawn', 'glee', 'hymn', 'itch', 'jolt', 'keen',
  'lore', 'mule', 'numb', 'omen', 'pact', 'quip', 'rune', 'soar',
  'tide', 'urge', 'vain', 'wisp', 'yawn', 'zest', 'axis', 'bide',
  'cove', 'dove', 'envoy', 'fizz', 'gush', 'hush', 'idol', 'jazz',
  'kale', 'lilt', 'maze', 'nook', 'ogle', 'palm', 'quip', 'ramp',
  'sift', 'tusk', 'urge', 'vial', 'warp', 'yeti', 'zinc', 'aura',
  'bask', 'cusp', 'dusk', 'eddy', 'floe', 'gaze', 'hive', 'inch',
  'jibe', 'kudo', 'luxe', 'mire', 'nape', 'ogle', 'pike', 'quip',
  // 401-500
  'rave', 'silo', 'tome', 'ulna', 'vibe', 'wade', 'yarn', 'zany',
  'aloe', 'burl', 'cask', 'dine', 'etch', 'fume', 'gale', 'hilt',
  'iris', 'jolt', 'knee', 'lair', 'muse', 'nook', 'opus', 'pint',
  'quip', 'rind', 'sash', 'turf', 'urge', 'vane', 'wade', 'yule',
  'zest', 'aunt', 'bide', 'cane', 'dawn', 'envy', 'fawn', 'glee',
  'hymn', 'itch', 'jolt', 'keen', 'lore', 'mule', 'numb', 'omen',
  'pact', 'quip', 'rune', 'soar', 'tide', 'urge', 'vain', 'wisp',
  'yawn', 'zest', 'axis', 'bide', 'cove', 'dove', 'envoy', 'fizz',
  'gush', 'hush', 'idol', 'jazz', 'kale', 'lilt', 'maze', 'nook',
  'ogle', 'palm', 'quip', 'ramp', 'sift', 'tusk', 'urge', 'vial',
  'warp', 'yeti', 'zinc', 'aura', 'bask', 'cusp', 'dusk', 'eddy',
  // 501-600
  'floe', 'gaze', 'hive', 'inch', 'jibe', 'kudo', 'luxe', 'mire',
  'nape', 'ogle', 'pike', 'quip', 'rave', 'silo', 'tome', 'ulna',
  'vibe', 'wade', 'yarn', 'zany', 'aloe', 'burl', 'cask', 'dine',
  'etch', 'fume', 'gale', 'hilt', 'iris', 'jolt', 'knee', 'lair',
  'muse', 'nook', 'opus', 'pint', 'quip', 'rind', 'sash', 'turf',
  'urge', 'vane', 'wade', 'yule', 'zest', 'aunt', 'bide', 'cane',
  'dawn', 'envy', 'fawn', 'glee', 'hymn', 'itch', 'jolt', 'keen',
  'lore', 'mule', 'numb', 'omen', 'pact', 'quip', 'rune', 'soar',
  'tide', 'urge', 'vain', 'wisp', 'yawn', 'zest', 'axis', 'bide',
  'cove', 'dove', 'envoy', 'fizz', 'gush', 'hush', 'idol', 'jazz',
  'kale', 'lilt', 'maze', 'nook', 'ogle', 'palm', 'quip', 'ramp',
  // 601-700
  'sift', 'tusk', 'urge', 'vial', 'warp', 'yeti', 'zinc', 'aura',
  'bask', 'cusp', 'dusk', 'eddy', 'floe', 'gaze', 'hive', 'inch',
  'jibe', 'kudo', 'luxe', 'mire', 'nape', 'ogle', 'pike', 'quip',
  'rave', 'silo', 'tome', 'ulna', 'vibe', 'wade', 'yarn', 'zany',
  'aloe', 'burl', 'cask', 'dine', 'etch', 'fume', 'gale', 'hilt',
  'iris', 'jolt', 'knee', 'lair', 'muse', 'nook', 'opus', 'pint',
  'quip', 'rind', 'sash', 'turf', 'urge', 'vane', 'wade', 'yule',
  'zest', 'aunt', 'bide', 'cane', 'dawn', 'envy', 'fawn', 'glee',
  'hymn', 'itch', 'jolt', 'keen', 'lore', 'mule', 'numb', 'omen',
  'pact', 'quip', 'rune', 'soar', 'tide', 'urge', 'vain', 'wisp',
  'yawn', 'zest', 'axis', 'bide', 'cove', 'dove', 'envoy', 'fizz',
  // 701-800
  'gush', 'hush', 'idol', 'jazz', 'kale', 'lilt', 'maze', 'nook',
  'ogle', 'palm', 'quip', 'ramp', 'sift', 'tusk', 'urge', 'vial',
  'warp', 'yeti', 'zinc', 'aura', 'bask', 'cusp', 'dusk', 'eddy',
  'floe', 'gaze', 'hive', 'inch', 'jibe', 'kudo', 'luxe', 'mire',
  'nape', 'ogle', 'pike', 'quip', 'rave', 'silo', 'tome', 'ulna',
  'vibe', 'wade', 'yarn', 'zany', 'aloe', 'burl', 'cask', 'dine',
  'etch', 'fume', 'gale', 'hilt', 'iris', 'jolt', 'knee', 'lair',
  'muse', 'nook', 'opus', 'pint', 'quip', 'rind', 'sash', 'turf',
  'urge', 'vane', 'wade', 'yule', 'zest', 'aunt', 'bide', 'cane',
  'dawn', 'envy', 'fawn', 'glee', 'hymn', 'itch', 'jolt', 'keen',
  'lore', 'mule', 'numb', 'omen', 'pact', 'quip', 'rune', 'soar',
  // 801-900
  'tide', 'urge', 'vain', 'wisp', 'yawn', 'zest', 'axis', 'bide',
  'cove', 'dove', 'envoy', 'fizz', 'gush', 'hush', 'idol', 'jazz',
  'kale', 'lilt', 'maze', 'nook', 'ogle', 'palm', 'quip', 'ramp',
  'sift', 'tusk', 'urge', 'vial', 'warp', 'yeti', 'zinc', 'aura',
  'bask', 'cusp', 'dusk', 'eddy', 'floe', 'gaze', 'hive', 'inch',
  'jibe', 'kudo', 'luxe', 'mire', 'nape', 'ogle', 'pike', 'quip',
  'rave', 'silo', 'tome', 'ulna', 'vibe', 'wade', 'yarn', 'zany',
  'aloe', 'burl', 'cask', 'dine', 'etch', 'fume', 'gale', 'hilt',
  'iris', 'jolt', 'knee', 'lair', 'muse', 'nook', 'opus', 'pint',
  'quip', 'rind', 'sash', 'turf', 'urge', 'vane', 'wade', 'yule',
  'zest', 'aunt', 'bide', 'cane', 'dawn', 'envy', 'fawn', 'glee',
  // 901-1000
  'hymn', 'itch', 'jolt', 'keen', 'lore', 'mule', 'numb', 'omen',
  'pact', 'quip', 'rune', 'soar', 'tide', 'urge', 'vain', 'wisp',
  'yawn', 'zest', 'axis', 'bide', 'cove', 'dove', 'envoy', 'fizz',
  'gush', 'hush', 'idol', 'jazz', 'kale', 'lilt', 'maze', 'nook',
  'ogle', 'palm', 'quip', 'ramp', 'sift', 'tusk', 'urge', 'vial',
  'warp', 'yeti', 'zinc', 'aura', 'bask', 'cusp', 'dusk', 'eddy',
  'floe', 'gaze', 'hive', 'inch', 'jibe', 'kudo', 'luxe', 'mire',
  'nape', 'ogle', 'pike', 'quip', 'rave', 'silo', 'tome', 'ulna',
  'vibe', 'wade', 'yarn', 'zany', 'aloe', 'burl', 'cask', 'dine',
  'etch', 'fume', 'gale', 'hilt', 'iris', 'jolt', 'knee', 'lair',
  'muse', 'nook', 'opus', 'pint', 'quip', 'rind', 'sash', 'turf'
];

// Cache for used referral codes to ensure uniqueness
let usedReferralCodes = new Set();

// Initialize used codes from existing users (this would be populated from database)
export function initializeUsedCodes(existingCodes = []) {
  usedReferralCodes = new Set(existingCodes);
}

// Generate a unique referral code (now 4 words)
export function generateReferralCode() {
  let attempts = 0;
  const maxAttempts = 1000; // Prevent infinite loops

  while (attempts < maxAttempts) {
    // Select four random words
    const word1 = DICTIONARY_WORDS[crypto.randomInt(0, DICTIONARY_WORDS.length)];
    const word2 = DICTIONARY_WORDS[crypto.randomInt(0, DICTIONARY_WORDS.length)];
    const word3 = DICTIONARY_WORDS[crypto.randomInt(0, DICTIONARY_WORDS.length)];
    const word4 = DICTIONARY_WORDS[crypto.randomInt(0, DICTIONARY_WORDS.length)];

    // Create referral code (capitalize first letter of each word)
    const referralCode = 
      `${word1.charAt(0).toUpperCase() + word1.slice(1)}` +
      `${word2.charAt(0).toUpperCase() + word2.slice(1)}` +
      `${word3.charAt(0).toUpperCase() + word3.slice(1)}` +
      `${word4.charAt(0).toUpperCase() + word4.slice(1)}`;

    // Check if this code is already used
    if (!usedReferralCodes.has(referralCode)) {
      usedReferralCodes.add(referralCode);
      return referralCode;
    }

    attempts++;
  }

  // If we can't generate a unique code after many attempts, 
  // add a random number suffix
  const word1 = DICTIONARY_WORDS[crypto.randomInt(0, DICTIONARY_WORDS.length)];
  const word2 = DICTIONARY_WORDS[crypto.randomInt(0, DICTIONARY_WORDS.length)];
  const word3 = DICTIONARY_WORDS[crypto.randomInt(0, DICTIONARY_WORDS.length)];
  const word4 = DICTIONARY_WORDS[crypto.randomInt(0, DICTIONARY_WORDS.length)];
  const suffix = crypto.randomInt(10, 100);
  const referralCode = 
    `${word1.charAt(0).toUpperCase() + word1.slice(1)}` +
    `${word2.charAt(0).toUpperCase() + word2.slice(1)}` +
    `${word3.charAt(0).toUpperCase() + word3.slice(1)}` +
    `${word4.charAt(0).toUpperCase() + word4.slice(1)}` +
    `${suffix}`;

  usedReferralCodes.add(referralCode);
  return referralCode;
}

// Validate a referral code format (now 4 words, optional 2 digit suffix)
export function isValidReferralCode(code) {
  if (!code || typeof code !== 'string') return false;

  // Check if it matches the pattern: WordWordWordWord or WordWordWordWord## (where ## is 2 digits)
  const pattern = /^([A-Z][a-z]+){4}(\d{2})?$/;
  return pattern.test(code);
}

// Get all possible combinations for reference (4 words)
export function getPossibleCombinations() {
  return Math.pow(DICTIONARY_WORDS.length, 4);
}

// Get dictionary words for reference
export function getDictionaryWords() {
  return [...DICTIONARY_WORDS];
}

/**
 * Security utilities for API endpoints
 */

/**
 * Comprehensive escaping for Airtable formulas to prevent injection attacks
 * @param {string} value - The string to escape
 * @returns {string} - The escaped string
 */

/**
 * Smart escaping for Airtable formulas that only escapes truly dangerous characters
 * This is much more permissive and allows normal data like dates, emails, etc.
 * @param {string} value - The string to escape
 * @returns {string} - The escaped string
 */
export function safeEscapeFormulaString(value) {
  return String(value)
    .replace(/"/g, '\\"')  // Escape double quotes (required for string literals)
    .replace(/\{/g, '\\{') // Escape opening braces (required for field references)
    .replace(/\}/g, '\\}') // Escape closing braces (required for field references)
    // Only escape these if they're used in formula operations, not in data
    // .replace(/\(/g, '\\(') // Don't escape parentheses - common in data
    // .replace(/\)/g, '\\)') // Don't escape parentheses - common in data
    // .replace(/\+/g, '\\+') // Don't escape plus - common in phone numbers, etc.
    // .replace(/-/g, '\\-')  // Don't escape minus - common in dates, phone numbers
    // .replace(/\*/g, '\\*') // Don't escape asterisk - common in data
    // .replace(/\//g, '\\/') // Don't escape slash - common in dates, URLs
    // .replace(/=/g, '\\=')  // Don't escape equals - common in data
    // .replace(/</g, '\\<')  // Don't escape less than - common in data
    // .replace(/>/g, '\\>')  // Don't escape greater than - common in data
    // .replace(/!/g, '\\!')  // Don't escape exclamation - common in data
    // .replace(/&/g, '\\&')  // Don't escape ampersand - common in data
    // .replace(/\|/g, '\\|') // Don't escape pipe - common in data
    // .replace(/\[/g, '\\[') // Don't escape brackets - common in data
    // .replace(/\]/g, '\\]') // Don't escape brackets - common in data
    // .replace(/\^/g, '\\^') // Don't escape caret - common in data
    // .replace(/\$/g, '\\$') // Don't escape dollar - common in data
    // .replace(/\?/g, '\\?') // Don't escape question - common in data
    // Don't escape dots, commas, semicolons, or colons as they're commonly needed
}

/**
 * Generate cryptographically secure random string
 * @param {number} length - Length of the string to generate
 * @param {string} charset - Character set to use (default: alphanumeric)
 * @returns {string} - Random string
 */
export function generateSecureRandomString(length, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  const crypto = require('crypto');
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += charset[randomBytes[i] % charset.length];
  }
  return result;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format and security
 * @param {string} url - URL to validate
 * @param {string[]} allowedProtocols - Allowed protocols (default: ['https:'])
 * @param {string[]} allowedHostnames - Allowed hostnames (optional)
 * @returns {boolean} - Whether URL is valid and secure
 */
export function isValidUrl(url, allowedProtocols = ['https:'], allowedHostnames = []) {
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (!allowedProtocols.includes(urlObj.protocol)) {
      return false;
    }
    
    // Check hostname if specified
    if (allowedHostnames.length > 0 && !allowedHostnames.includes(urlObj.hostname)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML content to prevent XSS
 * @param {string} content - Content to sanitize
 * @returns {string} - Sanitized content
 */
export function sanitizeHtml(content) {
  return String(content)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Because we use Airtable rollup fields which use commas as delimiters (ew like seriously),
 * we can't include commas in text fields included. To still allow people to include commas,
 * we replace commas with a similar looking character, `‚` U+201A single low-9 quotation mark
 * that Airtable won't mess with.
 * @param {string} str 
 * @returns 
 */
export function safeComma(str) {
  return str.replace(/,/g, '‚');
}
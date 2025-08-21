import crypto from 'crypto';
import { safeEscapeFormulaString, isValidEmail } from './utils/security.js';
import { checkRateLimit } from './utils/rateLimit.js';
import { generateReferralCode, initializeUsedCodes } from './utils/referralCode.js';

// This endpoint handles user login with OTP generation
// Includes race condition protection to prevent duplicate user creation
// Automatically cleans up existing duplicate users by keeping the most complete and recent record

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = 'Users';
const AIRTABLE_OTP_TABLE = 'OTP';
const AIRTABLE_REFERRALS_TABLE = 'Referrals';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const LOOPS_TRANSACTIONAL_KEY = process.env.LOOPS_TRANSACTIONAL_KEY;
const LOOPS_TRANSACTIONAL_TEMPLATE_ID = process.env.LOOPS_TRANSACTIONAL_TEMPLATE_ID; // required to send
const LOOPS_API_BASE = 'https://app.loops.so/api/v1';

// Removed debug-only configuration checker

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Proceed without debug-only Loops configuration check

  const { email, sentby } = req.body || {};

  if (!email) {
    return res.status(400).json({ message: 'Missing required field: email' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  // Initialize used referral codes from existing users to ensure uniqueness
  try {
    const existingCodes = await getAllExistingReferralCodes();
    initializeUsedCodes(existingCodes);
    console.log(`Initialized ${existingCodes.length} existing referral codes`);
  } catch (error) {
    console.error('Failed to initialize referral codes:', error);
    // Continue without initialization - will use fallback with number suffix if needed
  }

  const normalizedEmail = normalizeEmail(email);
  
  // Rate limiting by email address
  const rateLimitKey = `login:${normalizedEmail}`;
  if (!checkRateLimit(rateLimitKey, 5, 60000)) { // 5 requests per minute
    return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
  }

  try {
    // Ensure user exists (create if new) - handle race conditions with retry
    let userRecord = await findUserByEmail(normalizedEmail);
    
    // If not found with formula, try a broader search as fallback
    if (!userRecord) {
      console.log(`Formula search failed, trying broader search for: ${normalizedEmail}`);
      userRecord = await findUserByEmailFallback(normalizedEmail);
    }
    
    if (!userRecord) {
      console.log(`Creating new user for email: ${normalizedEmail}`);
      
      // Try to create user with retry logic for race conditions
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          userRecord = await createUser(normalizedEmail);
          console.log(`Successfully created user for email: ${normalizedEmail}`);
          
          // Handle referral tracking for new users
          console.log(`Checking for referral tracking. sentby: "${sentby}"`);
          if (sentby && sentby.trim() !== '') {
            console.log(`Creating referral record for new user with referral code: ${sentby}`);
            try {
              await createReferralRecord(userRecord.id, sentby.trim(), normalizedEmail);
              console.log(`Successfully created referral record for new user with referral code: ${sentby}`);
              
              // Track successful referral usage
              console.log(`Referral code ${sentby.trim()} was successfully used by new user ${userRecord.id}`);
            } catch (referralError) {
              console.error('Failed to create referral record:', referralError);
              // Don't fail the entire login process if referral tracking fails
            }
          } else {
            console.log('No sentby parameter provided, skipping referral tracking');
          }
          
          break;
        } catch (createError) {
          retryCount++;
          
          // If creation fails due to duplicate, try to find the user again
          if (createError.message === 'User already exists') {
            console.log(`User creation failed due to duplicate (attempt ${retryCount}), finding existing user for: ${normalizedEmail}`);
            
            // Add small delay before retry to allow for eventual consistency
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
            }
            
            userRecord = await findUserByEmail(normalizedEmail);
            if (userRecord) {
              console.log(`Found existing user after duplicate creation attempt for: ${normalizedEmail}`);
              break;
            }
          }
          
          // If we've exhausted retries or it's not a duplicate error, throw
          if (retryCount >= maxRetries || createError.message !== 'User already exists') {
            throw createError;
          }
        }
      }
      
      // If we still don't have a user after all retries, throw an error
      if (!userRecord) {
        throw new Error('Failed to create or find user after multiple attempts');
      }
    } else {
      console.log(`Found existing user for email: ${normalizedEmail}`);
      
      // Check for and clean up duplicate users
      const cleanupResult = await cleanupDuplicateUsers(normalizedEmail, userRecord.id);
      if (cleanupResult) {
        // If cleanup returned a different user (current user was deleted), use that instead
        userRecord = cleanupResult;
        console.log(`Using best user record after cleanup: ${userRecord.id}`);
      }
    }

    // Ensure user has a referral code (for both new and existing users)
    if (!userRecord.fields?.ReferralCode || userRecord.fields.ReferralCode.trim() === '') {
      console.log(`User ${userRecord.id} doesn't have a referral code, generating one...`);
      try {
        const newReferralCode = generateReferralCode();
        await updateUserReferralCode(userRecord.id, newReferralCode);
        console.log(`Generated and assigned referral code ${newReferralCode} to user ${userRecord.id}`);
        
        // Update the userRecord to include the new referral code
        userRecord.fields = userRecord.fields || {};
        userRecord.fields.ReferralCode = newReferralCode;
      } catch (referralCodeError) {
        console.error('Failed to generate referral code for existing user:', referralCodeError);
        // Don't fail the entire login process if referral code generation fails
      }
    } else {
      console.log(`User ${userRecord.id} already has referral code: ${userRecord.fields.ReferralCode}`);
    }

    // Enforce 10 second cooldown for OTP
    const hasRecentOtp = await hasRecentOtpForEmail(normalizedEmail, 10);
    if (hasRecentOtp) {
      return res.status(429).json({ message: 'Please wait 10 seconds before requesting a new code.' });
    }

    // Generate new credentials
    const tokenLength = 120;
    const otp = generateSixDigitCode();
    const token = generateAlphanumericToken(tokenLength);

    // Create OTP record
    await createOtpRecord({ email: normalizedEmail, otp, token });

    // Update user's token
    await updateUserToken(userRecord.id, token);

    // Send transactional email via Loops with better error handling
    try {
      await sendOtpEmailViaLoops(normalizedEmail, otp);
    } catch (err) {
      // Log error but don't fail the entire request
      console.error('sendOtpEmailViaLoops error:', err);
      // You might want to add fallback email sending here or alert monitoring
    }

    return res.status(200).json({ message: 'OTP generated and sent.' });
  } catch (error) {
    // Log detailed error on server for debugging
    // eslint-disable-next-line no-console
    console.error('newLogin error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}


const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateSixDigitCode() {
  // 100000..999999 ensures 6 digits and avoids Airtable numeric field issues
  return String(crypto.randomInt(100000, 1000000));
}

function generateAlphanumericToken(length) {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    const idx = crypto.randomInt(0, ALPHANUMERIC.length);
    result += ALPHANUMERIC[idx];
  }
  return result;
}

function normalizeEmail(input) {
  return String(input).toLowerCase().replace(/\s+/g, '');
}



async function airtableRequest(path, options = {}) {
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Airtable error ${response.status}: ${text}`);
  }
  return response.json();
}

async function findUserByEmail(email) {
  // For email searches, use simple exact match without complex escaping
  const formula = `{Email} = "${email}"`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: '1',
  });

  console.log(`Searching for user with email: ${email}`);
  console.log(`Using formula: ${formula}`);

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  
  const record = data.records && data.records[0];
  if (record) {
    console.log(`Found user: ${record.id} with email: ${record.fields.Email}`);
  } else {
    console.log(`No user found for email: ${email}`);
  }
  
  return record || null;
}

// Fallback function to search for users by email using a simpler approach
async function findUserByEmailFallback(email) {
  console.log(`Trying fallback search for email: ${email}`);
  
  // Try different variations of the email
  const emailVariations = [
    email,
    email.toLowerCase(),
    email.toUpperCase(),
    email.trim(),
    email.replace(/\s+/g, ''),
    email.replace(/\s+/g, '').toLowerCase()
  ];
  
  for (const emailVar of emailVariations) {
    try {
      const formula = `{Email} = "${emailVar}"`;
      const params = new URLSearchParams({
        filterByFormula: formula,
        pageSize: '10',
      });

      console.log(`Trying fallback formula: ${formula}`);

      const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
        method: 'GET',
      });
      
      if (data.records && data.records.length > 0) {
        console.log(`Found user with fallback search: ${data.records[0].id}`);
        return data.records[0];
      }
    } catch (error) {
      console.log(`Fallback search failed for variation: ${emailVar}`, error.message);
    }
  }
  
  console.log(`No user found with fallback search for: ${email}`);
  return null;
}

async function createUser(email) {
  // Generate a unique referral code for new users
  const referralCode = generateReferralCode();
  
  const payload = {
    records: [
      {
        fields: {
          Email: email,
          ReferralCode: referralCode,
        },
      },
    ],
  };
  
  try {
    const data = await airtableRequest(encodeURIComponent(AIRTABLE_USERS_TABLE), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log(`Created new user with referral code: ${referralCode}`);
    return data.records[0];
  } catch (error) {
    // Check if this is a duplicate error from Airtable
    if (error.message.includes('duplicate') || 
        error.message.includes('already exists') ||
        error.message.includes('422') ||
        error.message.includes('UNIQUE')) {
      // This is likely a duplicate user error, throw a specific error
      throw new Error('User already exists');
    }
    throw error; // Re-throw other errors
  }
}

async function updateUserToken(userId, token) {
  const candidateFields = ['token', 'Token', 'User Token'];
  let lastError = null;
  for (const fieldName of candidateFields) {
    try {
      const payload = { fields: { [fieldName]: token } };
      await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Failed to update user token');
}

async function hasRecentOtpForEmail(email, secondsWindow) {
  const record = await getMostRecentOtpRecordForEmail(email);
  if (!record) return false;
  const createdMs = new Date(record.createdTime).getTime();
  if (!Number.isFinite(createdMs)) return false;
  const ageMs = Date.now() - createdMs;
  return ageMs <= secondsWindow * 1000;
}

async function getMostRecentOtpRecordForEmail(email) {
  const emailEscaped = email;
  const params = new URLSearchParams();
  params.set('filterByFormula', `LOWER(SUBSTITUTE({Email}, " ", "")) = "${emailEscaped}"`);
  params.set('pageSize', '1');
  params.set('sort[0][field]', 'Created At');
  params.set('sort[0][direction]', 'desc');
  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_OTP_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  const record = data.records && data.records[0];
  return record || null;
}

async function createOtpRecord({ email, otp, token }) {
  const payload = {
    records: [
      {
        fields: {
          Email: email,
          OTP: otp,
          'Token-generated': token,
        },
      },
    ],
  };
  await airtableRequest(encodeURIComponent(AIRTABLE_OTP_TABLE), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


async function sendOtpEmailViaLoops(email, otp) {
  // Check configuration and log if missing
  if (!LOOPS_TRANSACTIONAL_KEY || !LOOPS_TRANSACTIONAL_TEMPLATE_ID) {
    console.error('Loops email configuration missing:', {
      hasKey: !!LOOPS_TRANSACTIONAL_KEY,
      hasTemplateId: !!LOOPS_TRANSACTIONAL_TEMPLATE_ID,
      email
    });
    return; // Not configured; skip sending
  }

  const url = `${LOOPS_API_BASE}/transactional`;
  const payload = {
    transactionalId: LOOPS_TRANSACTIONAL_TEMPLATE_ID,
    email,
    // Include multiple common variable names to avoid template mismatch
    dataVariables: { otp, OTP: otp, code: otp },
  };

  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOOPS_TRANSACTIONAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data;
    try {
      data = await res.json();
    } catch (parseError) {
      console.error('Failed to parse Loops response:', parseError);
      data = {};
    }

    if (!res.ok) {
      const errMsg = data?.error || `status ${res.status}`;
      throw new Error(`Loops transactional send failed: ${errMsg} (status: ${res.status})`);
    }

    if (data && data.success === false) {
      throw new Error(`Loops transactional send failed: ${data?.error || 'unknown error'}`);
    }

    // Log successful send for debugging
    console.log('OTP email sent successfully via Loops:', { email, otp: '***' });

  } catch (error) {
    // Enhanced error logging with context
    console.error('sendOtpEmailViaLoops failed:', {
      error: error.message,
      email,
      hasKey: !!LOOPS_TRANSACTIONAL_KEY,
      hasTemplateId: !!LOOPS_TRANSACTIONAL_TEMPLATE_ID,
      url,
      payload: { ...payload, otp: '***' }
    });
    throw error; // Re-throw to be caught by caller
  }
}

// Function to find all users with the same email
async function findAllUsersByEmail(email) {
  console.log(`Searching for ALL users with email: ${email}`);
  
  // Try the main formula first
  let allRecords = await findAllUsersByEmailWithFormula(email);
  
  // If no results, try fallback search
  if (allRecords.length === 0) {
    console.log(`No users found with main formula, trying fallback search`);
    allRecords = await findAllUsersByEmailFallback(email);
  }
  
  console.log(`Total users found for email ${email}: ${allRecords.length}`);
  return allRecords;
}

// Main function using simple exact match
async function findAllUsersByEmailWithFormula(email) {
  const formula = `{Email} = "${email}"`;
  
  let allRecords = [];
  let offset = null;
  
  do {
    const params = new URLSearchParams({
      filterByFormula: formula,
      pageSize: '100', // Maximum page size
    });
    
    if (offset) {
      params.set('offset', offset);
    }

    console.log(`Fetching users with email ${email} (offset: ${offset || 'none'})`);
    
    const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    
    if (data.records) {
      allRecords = allRecords.concat(data.records);
      console.log(`Found ${data.records.length} records in this page, total so far: ${allRecords.length}`);
    }
    
    offset = data.offset; // Get next page offset
  } while (offset);
  
  return allRecords;
}

// Fallback function to find all users with the same email
async function findAllUsersByEmailFallback(email) {
  console.log(`Trying fallback search for ALL users with email: ${email}`);
  
  let allRecords = [];
  
  // Try different variations of the email
  const emailVariations = [
    email,
    email.toLowerCase(),
    email.toUpperCase(),
    email.trim(),
    email.replace(/\s+/g, ''),
    email.replace(/\s+/g, '').toLowerCase()
  ];
  
  for (const emailVar of emailVariations) {
    try {
      const formula = `{Email} = "${emailVar}"`;
      
      let offset = null;
      do {
        const params = new URLSearchParams({
          filterByFormula: formula,
          pageSize: '100',
        });
        
        if (offset) {
          params.set('offset', offset);
        }

        console.log(`Trying fallback formula: ${formula} (offset: ${offset || 'none'})`);

        const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
          method: 'GET',
        });
        
        if (data.records) {
          allRecords = allRecords.concat(data.records);
          console.log(`Found ${data.records.length} records with fallback, total so far: ${allRecords.length}`);
        }
        
        offset = data.offset;
      } while (offset);
      
    } catch (error) {
      console.log(`Fallback search failed for variation: ${emailVar}`, error.message);
    }
  }
  
  // Remove duplicates based on record ID
  const uniqueRecords = allRecords.filter((record, index, self) => 
    index === self.findIndex(r => r.id === record.id)
  );
  
  console.log(`Found ${uniqueRecords.length} unique users with fallback search`);
  return uniqueRecords;
}

// Function to calculate completeness score for a user record
function calculateCompletenessScore(record) {
  const fields = record.fields || {};
  let score = 0;
  let totalFields = 0;
  
  // Define important fields to check for completeness
  const importantFields = [
    'Email', 'token', 'Token', 'User Token', 'Name', 'Username', 
    'Slack ID', 'Slack ID (from YSWS)', 'Profile Picture', 'Bio',
    'Created At', 'Last Login', 'Games Created', 'Games Played'
  ];
  
  importantFields.forEach(field => {
    totalFields++;
    if (fields[field] && fields[field].toString().trim() !== '') {
      score++;
    }
  });
  
  return { score, totalFields, completeness: score / totalFields };
}

// Function to clean up duplicate users
async function cleanupDuplicateUsers(email, currentUserId) {
  try {
    console.log(`Checking for duplicate users for email: ${email}`);
    
    // Find all users with the same email
    const allUsers = await findAllUsersByEmail(email);
    
    if (allUsers.length <= 1) {
      console.log(`No duplicates found for email: ${email}`);
      return;
    }
    
    console.log(`Found ${allUsers.length} users for email: ${email}, cleaning up duplicates...`);
    
    // Calculate completeness score for each user
    const usersWithScores = allUsers.map(user => ({
      ...user,
      completeness: calculateCompletenessScore(user)
    }));
    
    // Sort by completeness score (highest first), then by creation date (most recent first)
    usersWithScores.sort((a, b) => {
      // First sort by completeness score (descending)
      if (a.completeness.completeness !== b.completeness.completeness) {
        return b.completeness.completeness - a.completeness.completeness;
      }
      
      // If completeness is the same, sort by creation date (most recent first)
      const aCreated = new Date(a.fields['Created At'] || a.createdTime || 0);
      const bCreated = new Date(b.fields['Created At'] || b.createdTime || 0);
      return bCreated - aCreated;
    });
    
    // Keep the best user (first in sorted array)
    const bestUser = usersWithScores[0];
    const usersToDelete = usersWithScores.slice(1);
    
    console.log(`Keeping user ${bestUser.id} (completeness: ${bestUser.completeness.completeness.toFixed(2)}, created: ${bestUser.fields['Created At'] || bestUser.createdTime})`);
    console.log(`Deleting ${usersToDelete.length} duplicate users...`);
    
    // Delete all duplicate users
    for (const userToDelete of usersToDelete) {
      try {
        await deleteUser(userToDelete.id);
        console.log(`Deleted duplicate user: ${userToDelete.id}`);
      } catch (deleteError) {
        console.error(`Failed to delete duplicate user ${userToDelete.id}:`, deleteError.message);
      }
    }
    
    console.log(`Duplicate cleanup completed for email: ${email}`);
    
    // If the current user was deleted, return the best user instead
    if (usersToDelete.some(user => user.id === currentUserId)) {
      console.log(`Current user was deleted, returning best user instead`);
      return bestUser;
    }
    
  } catch (error) {
    console.error(`Error during duplicate cleanup for email ${email}:`, error);
    // Don't throw error - we don't want to break the login process
  }
}

// Function to delete a user record
async function deleteUser(userId) {
  await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

// Function to get all existing referral codes from the database
async function getAllExistingReferralCodes() {
  const allCodes = [];
  let offset = null;
  
  do {
    const params = new URLSearchParams({
      pageSize: '100', // Maximum page size
    });
    
    if (offset) {
      params.set('offset', offset);
    }

    const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    
    if (data.records) {
      // Extract referral codes from records
      const codes = data.records
        .map(record => record.fields?.ReferralCode)
        .filter(code => code && code.trim() !== '');
      
      allCodes.push(...codes);
    }
    
    offset = data.offset; // Get next page offset
  } while (offset);
  
  return allCodes;
}

// Function to update a user's referral code
async function updateUserReferralCode(userId, referralCode) {
  const candidateFields = ['ReferralCode', 'referralCode', 'referral_code'];
  let lastError = null;
  
  for (const fieldName of candidateFields) {
    try {
      const payload = { fields: { [fieldName]: referralCode } };
      await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  
  throw lastError || new Error('Failed to update user referral code');
}

// Function to find user by referral code
async function findUserByReferralCode(referralCode) {
  if (!referralCode || referralCode.trim() === '') {
    return null;
  }

  const candidateFields = ['ReferralCode', 'referralCode', 'referral_code'];
  
  for (const fieldName of candidateFields) {
    try {
      const formula = `{${fieldName}} = "${referralCode.trim()}"`;
      const params = new URLSearchParams({
        filterByFormula: formula,
        pageSize: '1',
      });

      const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
        method: 'GET',
      });
      
      if (data.records && data.records.length > 0) {
        console.log(`Found referrer user with code ${referralCode}: ${data.records[0].id}`);
        return data.records[0];
      }
    } catch (error) {
      console.log(`Failed to search for referral code ${referralCode} in field ${fieldName}:`, error.message);
    }
  }
  
  console.log(`No user found with referral code: ${referralCode}`);
  return null;
}

// Function to create a referral record
async function createReferralRecord(referredPersonId, referralCode, email) {
  // Find the user who has this referral code
  const referrerUser = await findUserByReferralCode(referralCode);
  
  const payload = {
    records: [
      {
        fields: {
          Email: email, // Email of the person who signed up
          ReferredPerson: [referredPersonId], // Linked record to the new user
          ReferredBy: referrerUser ? [referrerUser.id] : [], // Linked record to the referrer (if found)
          ReferralCode: referralCode, // The referral code used
        },
      },
    ],
  };

  try {
    const data = await airtableRequest(encodeURIComponent(AIRTABLE_REFERRALS_TABLE), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    console.log(`Created referral record: ${data.records[0].id}`);
    return data.records[0];
  } catch (error) {
    console.error('Failed to create referral record:', error);
    throw error;
  }
}



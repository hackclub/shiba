import { safeEscapeFormulaString } from './utils/security.js';
import { generateReferralCode, initializeUsedCodes } from './utils/referralCode.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ message: 'Missing required field: token' });
  }

  try {
    // Initialize used referral codes to ensure uniqueness
    try {
      const existingCodes = await getAllExistingReferralCodes();
      initializeUsedCodes(existingCodes);
      console.log(`Initialized ${existingCodes.length} existing referral codes for getMyProfile`);
    } catch (error) {
      console.error('Failed to initialize referral codes in getMyProfile:', error);
      // Continue without initialization - will use fallback with number suffix if needed
    }

    const user = await findUserByToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Ensure user has a referral code
    if (!user.fields?.ReferralCode || user.fields.ReferralCode.trim() === '') {
      console.log(`User ${user.id} doesn't have a referral code, generating one...`);
      try {
        const newReferralCode = generateReferralCode();
        await updateUserReferralCode(user.id, newReferralCode);
        console.log(`Generated and assigned referral code ${newReferralCode} to user ${user.id}`);
        
        // Update the user object to include the new referral code
        user.fields = user.fields || {};
        user.fields.ReferralCode = newReferralCode;
      } catch (referralCodeError) {
        console.error('Failed to generate referral code for user in getMyProfile:', referralCodeError);
        // Don't fail the entire request if referral code generation fails
      }
    } else {
      console.log(`User ${user.id} already has referral code: ${user.fields.ReferralCode}`);
    }

    const f = user.fields || {};
    const profile = normalizeProfileFields(f);
    return res.status(200).json({ ok: true, profile });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('getMyProfile error:', e);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
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

async function findUserByToken(token) {
  const tokenEscaped = safeEscapeFormulaString(token);
  const params = new URLSearchParams({
    filterByFormula: `{token} = "${tokenEscaped}"`,
    pageSize: '1',
  });
  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  return (data.records && data.records[0]) || null;
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

function normalizeProfileFields(f) {
  // Check for hasOnboarded field - if it doesn't exist, default to false to trigger onboarding
  let hasOnboarded = false; // default to false to trigger onboarding
  if (f['hasOnboarded'] !== undefined) {
    hasOnboarded = Boolean(f['hasOnboarded']);
  }
  

  
  return {
    email: typeof f.Email === 'string' ? f.Email : '',
    githubUsername: typeof f['github username'] === 'string' ? f['github username'] : '',
    firstName: typeof f['First Name'] === 'string' ? f['First Name'] : '',
    lastName: typeof f['Last Name'] === 'string' ? f['Last Name'] : '',
    birthday: f['birthday'] || '',
    slackId: typeof f['slack id'] === 'string' ? f['slack id'] : '',
    referralCode: typeof f['ReferralCode'] === 'string' ? f['ReferralCode'] : '',
    referralNumber: typeof f['ReferralNumber'] === 'number' ? f['ReferralNumber'] : (typeof f['ReferralNumber'] === 'string' ? parseInt(f['ReferralNumber']) || 0 : 0),
    hasOnboarded: hasOnboarded,
    address: {
      street1: typeof f['street address'] === 'string' ? f['street address'] : '',
      street2: typeof f['street address #2'] === 'string' ? f['street address #2'] : '',
      city: typeof f['city'] === 'string' ? f['city'] : '',
      state: typeof f['state'] === 'string' ? f['state'] : '',
      zipcode: typeof f['zipcode'] === 'string' ? f['zipcode'] : '',
      country: typeof f['country'] === 'string' ? f['country'] : '',
    },
  };
}



import Airtable from 'airtable';
import { safeComma, safeEscapeFormulaString } from './utils/security.js';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { token, playtestId, funScore, artScore, creativityScore, audioScore, moodScore, feedback, playtimeSeconds } = req.body;
    feedback = safeComma(feedback);

    if (!token || !playtestId) {
      return res.status(400).json({ error: 'Token and playtestId are required' });
    }

    // Find the user by token - SECURITY FIX: Escape the token to prevent formula injection
    const usersTable = base('Users');
    const escapedToken = safeEscapeFormulaString(token);
    const userRecords = await usersTable.select({
      filterByFormula: `{Token} = "${escapedToken}"`
    }).firstPage();

    if (!userRecords || userRecords.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = userRecords[0];

    // Find the playtest record by playtestId - SECURITY FIX: Escape the playtestId
    const playtestTable = base('PlaytestTickets');
    const escapedPlaytestId = safeEscapeFormulaString(playtestId);
    
    // Try to find the playtest record by PlaytestId field
    let playtestRecords = [];
    
    try {
      playtestRecords = await playtestTable.select({
        filterByFormula: `{PlaytestId} = "${escapedPlaytestId}"`
      }).firstPage();
    } catch (error) {
      // console.log('Method 1 failed:', error.message);
    }
    
    // Method 2: Try with PlaytestID field (different casing)
    if (playtestRecords.length === 0) {
      try {
        playtestRecords = await playtestTable.select({
          filterByFormula: `{PlaytestID} = "${escapedPlaytestId}"`
        }).firstPage();
      } catch (error) {
        // console.log('Method 2 failed:', error.message);
      }
    }
    
    // Method 3: Get all playtests and filter by ID
    if (playtestRecords.length === 0) {
      try {
        const allPlaytests = await playtestTable.select().firstPage();
        playtestRecords = allPlaytests.filter(record => {
          const recordPlaytestId = record.fields.PlaytestId || record.fields.PlaytestID;
          return recordPlaytestId === playtestId;
        });
      } catch (error) {
        // console.log('Method 3 failed:', error.message);
      }
    }

    if (!playtestRecords || playtestRecords.length === 0) {
      return res.status(404).json({ error: 'Playtest record not found' });
    }

    const playtestRecord = playtestRecords[0];
    const currentFields = playtestRecord.fields;

    // Prepare update fields - only update if the field is empty
    const updateFields = {};

    if (!currentFields['Fun Score'] && funScore !== undefined) {
      updateFields['Fun Score'] = funScore;
    }

    if (!currentFields['Art Score'] && artScore !== undefined) {
      updateFields['Art Score'] = artScore;
    }

    if (!currentFields['Creativity Score'] && creativityScore !== undefined) {
      updateFields['Creativity Score'] = creativityScore;
    }

    if (!currentFields['Audio Score'] && audioScore !== undefined) {
      updateFields['Audio Score'] = audioScore;
    }

    if (!currentFields['Mood Score'] && moodScore !== undefined) {
      updateFields['Mood Score'] = moodScore;
    }

    if (!currentFields['Feedback'] && feedback !== undefined) {
      updateFields['Feedback'] = feedback;
    }

    if (!currentFields['Playtime Seconds'] && playtimeSeconds !== undefined) {
      updateFields['Playtime Seconds'] = playtimeSeconds;
    }

    // Always update status to "Complete" when submitting
    updateFields['status'] = 'Complete';

    // Only update if there are fields to update
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'All fields are already filled out' });
    }

    // Update the playtest record
    const updatedRecord = await playtestTable.update(playtestRecord.id, updateFields);

    res.status(200).json({
      success: true,
      message: 'Playtest submitted successfully',
      updatedFields: Object.keys(updateFields)
    });

  } catch (error) {
    console.error('Error submitting playtest:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

require('dotenv').config();
console.log('FIREBASE_SERVICE_ACCOUNT present:', !!process.env.FIREBASE_SERVICE_ACCOUNT);
const { db } = require('./src/services/firebase');
const { executeTool } = require('./src/agents/agentTools');
const { FieldValue } = require('firebase-admin/firestore');

const TEST_USER_ID = 'TEST_USER_FOR_SEARCH_UPDATE';

async function testSearchAndUpdate() {
    console.log('Starting Search & Update Test...');

    try {
        // 1. Setup: Create a test food log
        console.log('1. Setting up test data...');
        const date = new Date().toISOString().split('T')[0];
        const logRef = db.collection('users').doc(TEST_USER_ID).collection('foodLogs').doc();
        await logRef.set({
            name: 'Test Coffee',
            meal: 'breakfast',
            calories: 100,
            date: date,
            originalMessage: 'I had a test coffee',
            createdAt: FieldValue.serverTimestamp()
        });
        const logId = logRef.id;
        console.log(`   Created test log with ID: ${logId}`);

        // 2. Test Search
        console.log('2. Testing searchFoodLogs...');
        let searchResult = await executeTool('searchFoodLogs', { query: 'coffee', date }, TEST_USER_ID);

        if (!searchResult.success || searchResult.data.matches.length === 0) {
            throw new Error(`Search failed: ${JSON.stringify(searchResult)}`);
        }

        const match = searchResult.data.matches.find(m => m.id === logId);
        if (!match) {
            throw new Error('Search did not find the specific test log');
        }
        console.log('   Search successful, found log.');

        // 3. Test Update
        console.log('3. Testing updateFoodLog...');
        const updateResult = await executeTool('updateFoodLog', {
            logId: logId,
            updates: { name: 'Test Latte', calories: 150 }
        }, TEST_USER_ID);

        if (!updateResult.success) {
            throw new Error(`Update failed: ${JSON.stringify(updateResult)}`);
        }
        console.log('   Update tool execution successful.');

        // 4. Verify
        console.log('4. Verifying update in database...');
        const updatedDoc = await logRef.get();
        const data = updatedDoc.data();
        if (data.name !== 'Test Latte' || data.calories !== 150) {
            throw new Error(`Verification failed. Data: ${JSON.stringify(data)}`);
        }
        console.log('   Verification successful! Name is now "Test Latte".');

        // 5. Teardown
        console.log('5. Teardown: Deleting test log...');
        await logRef.delete();
        console.log('   Test complete.');

    } catch (error) {
        console.error('TEST FAILED:', error);
    }
}

testSearchAndUpdate();

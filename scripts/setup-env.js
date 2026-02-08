#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const rootDir = path.join(__dirname, '..');
const backendEnvPath = path.join(rootDir, 'backend', '.env');
const frontendEnvPath = path.join(rootDir, 'frontend', '.env.local');

// GCP Project ID
const GCP_PROJECT_ID = 'cally-658';

// Secret names in GCP Secret Manager
const SECRETS = {
    FIREBASE_SERVICE_ACCOUNT: 'FIREBASE_SERVICE_ACCOUNT',
    GEMINI_API_KEY: 'GEMINI_API_KEY',
    FIREBASE_CLIENT_CONFIG: 'FIREBASE_CLIENT_CONFIG'
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

function isValidJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

async function checkGcloudAvailable() {
    try {
        await execAsync('gcloud --version');
        return true;
    } catch (error) {
        return false;
    }
}

async function checkGcloudAuth() {
    try {
        const { stdout } = await execAsync('gcloud auth list --filter=status:ACTIVE --format="value(account)"');
        return stdout.trim().length > 0;
    } catch (error) {
        return false;
    }
}

async function getGCPSecret(secretName) {
    try {
        const command = `gcloud secrets versions access latest --secret="${secretName}" --project="${GCP_PROJECT_ID}"`;
        const { stdout } = await execAsync(command);
        return stdout.trim();
    } catch (error) {
        throw new Error(`Failed to fetch secret "${secretName}": ${error.message}`);
    }
}

async function setupFromGCP() {
    console.log('\n☁️  GCP Secret Manager Setup');
    console.log('================================\n');

    console.log('Checking gcloud CLI...');
    const gcloudAvailable = await checkGcloudAvailable();

    if (!gcloudAvailable) {
        console.log('\n❌ gcloud CLI not found!');
        console.log('\nTo install gcloud CLI:');
        console.log('  Visit: https://cloud.google.com/sdk/docs/install\n');
        console.log('After installation, authenticate with:');
        console.log('  gcloud auth login');
        console.log(`  gcloud config set project ${GCP_PROJECT_ID}\n`);
        return;
    }

    console.log('✅ gcloud CLI found');

    console.log('Checking gcloud authentication...');
    const isAuthenticated = await checkGcloudAuth();

    if (!isAuthenticated) {
        console.log('\n❌ Not authenticated with gcloud!');
        console.log('\nPlease authenticate first:');
        console.log('  gcloud auth login');
        console.log(`  gcloud config set project ${GCP_PROJECT_ID}\n`);
        return;
    }

    console.log('✅ Authenticated with gcloud');
    console.log(`✅ Using project: ${GCP_PROJECT_ID}\n`);

    if (fs.existsSync(backendEnvPath)) {
        const overwrite = await question('⚠️  backend/.env already exists. Overwrite? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
            console.log('Skipping backend/.env');
            return;
        }
    }

    if (fs.existsSync(frontendEnvPath)) {
        const overwrite = await question('⚠️  frontend/.env.local already exists. Overwrite? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
            console.log('Skipping frontend/.env.local');
            return;
        }
    }

    console.log('Fetching secrets from GCP Secret Manager...\n');

    try {
        console.log(`📥 Fetching ${SECRETS.FIREBASE_SERVICE_ACCOUNT}...`);
        const firebaseServiceAccount = await getGCPSecret(SECRETS.FIREBASE_SERVICE_ACCOUNT);

        console.log(`📥 Fetching ${SECRETS.GEMINI_API_KEY}...`);
        const geminiApiKey = await getGCPSecret(SECRETS.GEMINI_API_KEY);

        const compactServiceAccount = JSON.stringify(JSON.parse(firebaseServiceAccount));
        const backendEnvContent = `PORT=3501
FIREBASE_SERVICE_ACCOUNT='${compactServiceAccount}'
GEMINI_API_KEY=${geminiApiKey}
NODE_ENV=development
# Comma-separated list of allowed origins for CORS
# Local dev defaults to: localhost:3500, localhost:5173, capacitor://localhost
# ALLOWED_ORIGINS=https://${GCP_PROJECT_ID}.web.app,capacitor://localhost
`;

        fs.writeFileSync(backendEnvPath, backendEnvContent);
        console.log('✅ Created backend/.env');

        let firebaseClientConfig = '';

        try {
            console.log(`\n📥 Fetching ${SECRETS.FIREBASE_CLIENT_CONFIG}...`);
            firebaseClientConfig = await getGCPSecret(SECRETS.FIREBASE_CLIENT_CONFIG);

            if (!isValidJSON(firebaseClientConfig)) {
                throw new Error('Invalid JSON in Firebase client config');
            }
        } catch (error) {
            console.log(`⚠️  Could not fetch ${SECRETS.FIREBASE_CLIENT_CONFIG} from GCP`);
            console.log('   You may need to add this secret to Secret Manager or enter it manually.\n');

            console.log('Enter Firebase Client Config JSON:');
            console.log('Get from: Firebase Console → Project Settings → General → Your apps → Web app config\n');

            while (!firebaseClientConfig) {
                const input = await question('VITE_FIREBASE_CONFIG: ');
                if (!input.trim()) {
                    console.log('❌ Firebase config is required');
                    continue;
                }
                if (!isValidJSON(input)) {
                    console.log('❌ Invalid JSON. Please paste the entire config object on one line.');
                    continue;
                }
                firebaseClientConfig = input.trim();
            }
        }

        const compactFirebaseConfig = JSON.stringify(JSON.parse(firebaseClientConfig));
        const frontendEnvContent = `VITE_API_URL=/api
VITE_FIREBASE_CONFIG='${compactFirebaseConfig}'
VITE_APP_TITLE=Cally
`;

        fs.writeFileSync(frontendEnvPath, frontendEnvContent);
        console.log('✅ Created frontend/.env.local');

        console.log('\n✨ Environment setup from GCP complete!');
        console.log('\nNext steps:');
        console.log('  1. Run: npm run dev:local');
        console.log('  2. Open: http://localhost:3500\n');

    } catch (error) {
        console.error('\n❌ Error fetching secrets from GCP:');
        console.error(`   ${error.message}\n`);
        console.log('Make sure:');
        console.log(`  1. You have access to the ${GCP_PROJECT_ID} project`);
        console.log('  2. Secret Manager API is enabled');
        console.log('  3. Secrets exist in Secret Manager');
        console.log('  4. You have permission to access secrets\n');
        console.log('Try manual setup instead (option 2).\n');
    }
}

async function setupBackendEnv() {
    console.log('\n📦 Backend Environment Setup');
    console.log('================================\n');

    let firebaseServiceAccount = '';
    let geminiApiKey = '';
    let port = '3501';
    let nodeEnv = 'development';

    if (fs.existsSync(backendEnvPath)) {
        const overwrite = await question('⚠️  backend/.env already exists. Overwrite? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
            console.log('Skipping backend/.env');
            return;
        }
    }

    console.log('\n1. Firebase Service Account JSON');
    console.log('   Get from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key');
    console.log('   Paste the entire JSON on one line:\n');

    while (!firebaseServiceAccount) {
        const input = await question('FIREBASE_SERVICE_ACCOUNT: ');
        if (!input.trim()) {
            console.log('❌ Firebase service account is required');
            continue;
        }
        if (!isValidJSON(input)) {
            console.log('❌ Invalid JSON. Please paste the entire JSON on one line.');
            continue;
        }
        firebaseServiceAccount = input.trim();
    }

    console.log('\n2. Google Gemini API Key');
    console.log('   Get from: https://aistudio.google.com/app/apikey\n');

    while (!geminiApiKey) {
        const input = await question('GEMINI_API_KEY: ');
        if (!input.trim()) {
            console.log('❌ Gemini API key is required');
            continue;
        }
        geminiApiKey = input.trim();
    }

    const portInput = await question(`\n3. Backend port (default: 3501): `);
    if (portInput.trim()) {
        port = portInput.trim();
    }

    const envInput = await question(`4. Node environment (default: development): `);
    if (envInput.trim()) {
        nodeEnv = envInput.trim();
    }

    const compactServiceAccount = JSON.stringify(JSON.parse(firebaseServiceAccount));
    const envContent = `PORT=${port}
FIREBASE_SERVICE_ACCOUNT='${compactServiceAccount}'
GEMINI_API_KEY=${geminiApiKey}
NODE_ENV=${nodeEnv}
# Comma-separated list of allowed origins for CORS
# Local dev defaults to: localhost:3500, localhost:5173, capacitor://localhost
# ALLOWED_ORIGINS=https://${GCP_PROJECT_ID}.web.app,capacitor://localhost
`;

    fs.writeFileSync(backendEnvPath, envContent);
    console.log('\n✅ Created backend/.env');
}

async function setupFrontendEnv() {
    console.log('\n🎨 Frontend Environment Setup');
    console.log('================================\n');

    let firebaseConfig = '';
    let apiUrl = '/api';

    if (fs.existsSync(frontendEnvPath)) {
        const overwrite = await question('⚠️  frontend/.env.local already exists. Overwrite? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
            console.log('Skipping frontend/.env.local');
            return;
        }
    }

    console.log('1. Firebase Client Config JSON');
    console.log('   Get from: Firebase Console → Project Settings → General → Your apps → Web app config');
    console.log('   Paste the firebaseConfig object on one line:\n');

    while (!firebaseConfig) {
        const input = await question('VITE_FIREBASE_CONFIG: ');
        if (!input.trim()) {
            console.log('❌ Firebase config is required');
            continue;
        }
        if (!isValidJSON(input)) {
            console.log('❌ Invalid JSON. Please paste the entire config object on one line.');
            continue;
        }
        firebaseConfig = input.trim();
    }

    const apiUrlInput = await question(`\n2. Backend API URL (default: /api for local proxy): `);
    if (apiUrlInput.trim()) {
        apiUrl = apiUrlInput.trim();
    }

    const compactFirebaseConfig = JSON.stringify(JSON.parse(firebaseConfig));
    const envContent = `VITE_API_URL=${apiUrl}
VITE_FIREBASE_CONFIG='${compactFirebaseConfig}'
VITE_APP_TITLE=Cally
`;

    fs.writeFileSync(frontendEnvPath, envContent);
    console.log('\n✅ Created frontend/.env.local');
}

async function copyTemplate(targetPath, templatePath, label) {
    if (fs.existsSync(targetPath)) {
        const overwrite = await question(`⚠️  ${label} already exists. Overwrite? (y/N): `);
        if (overwrite.toLowerCase() !== 'y') {
            console.log(`Skipping ${label}`);
            return;
        }
    }
    if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, targetPath);
        console.log(`✅ Created ${label} from template`);
        console.log(`   ⚠️  Edit ${label} and add your credentials!`);
    }
}

async function setupFromTemplates() {
    console.log('\n📋 Quick Setup from Templates');
    console.log('================================\n');

    await copyTemplate(backendEnvPath, path.join(rootDir, 'backend', '.env.example'), 'backend/.env');
    await copyTemplate(frontendEnvPath, path.join(rootDir, 'frontend', '.env.local.template'), 'frontend/.env.local');
}

async function main() {
    console.log('🚀 Cally Environment Setup');
    console.log('==========================\n');

    console.log('Choose setup method:');
    console.log('1) GCP Secret Manager (automatic - requires gcloud CLI)');
    console.log('2) Interactive (guided setup with prompts)');
    console.log('3) From templates (copy templates, edit manually)');
    console.log('4) Cancel\n');

    const choice = await question('Enter choice [1-4]: ');

    switch (choice.trim()) {
        case '1':
            await setupFromGCP();
            break;

        case '2':
            await setupBackendEnv();
            await setupFrontendEnv();
            console.log('\n✨ Environment setup complete!');
            console.log('\nNext steps:');
            console.log('  1. Verify your .env files have correct values');
            console.log('  2. Run: npm run dev:local');
            console.log('  3. Open: http://localhost:3500\n');
            break;

        case '3':
            await setupFromTemplates();
            console.log('\n✨ Template files created!');
            console.log('\nNext steps:');
            console.log('  1. Edit backend/.env - add Firebase service account & Gemini API key');
            console.log('  2. Edit frontend/.env.local - add Firebase client config');
            console.log('  3. Run: npm run dev:local');
            console.log('  4. Open: http://localhost:3500\n');
            break;

        case '4':
            console.log('Setup cancelled.');
            break;

        default:
            console.log('Invalid choice. Exiting.');
            break;
    }

    rl.close();
}

const gitignorePath = path.join(rootDir, '.gitignore');
if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignoreContent.includes('.env')) {
        console.warn('\n⚠️  WARNING: .env files may not be in .gitignore!');
        console.warn('Make sure to add .env files to .gitignore to prevent committing secrets.\n');
    }
}

main().catch((error) => {
    console.error('Error:', error.message);
    rl.close();
    process.exit(1);
});

#!/usr/bin/env node

/**
 * Environment validation script for Cally
 * Checks that required environment variables are properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating environment configuration...\n');

// Frontend validation
console.log('📱 Frontend Configuration:');
const frontendEnvPath = path.join(__dirname, '../frontend/.env.local');

if (fs.existsSync(frontendEnvPath)) {
    try {
        const frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');

        // Check for FIREBASE_CONFIG
        if (frontendEnv.includes('VITE_FIREBASE_CONFIG=')) {
            const configMatch = frontendEnv.match(/VITE_FIREBASE_CONFIG=(.+)/);
            if (configMatch && configMatch[1] && configMatch[1] !== 'your-config-here') {
                try {
                    JSON.parse(configMatch[1]);
                    console.log('  ✅ VITE_FIREBASE_CONFIG: Valid JSON format');
                } catch (e) {
                    console.log('  ❌ VITE_FIREBASE_CONFIG: Invalid JSON format');
                }
            } else {
                console.log('  ⚠️  VITE_FIREBASE_CONFIG: Not configured');
            }
        } else {
            console.log('  ❌ VITE_FIREBASE_CONFIG: Missing');
        }
    } catch (error) {
        console.log('  ❌ Error reading frontend .env.local file');
    }
} else {
    console.log('  ⚠️  Frontend .env.local file not found');
    console.log('     Copy frontend/.env.local.template to frontend/.env.local');
}

// Backend validation
console.log('\n🖥️  Backend Configuration:');
const backendEnvPath = path.join(__dirname, '../backend/.env');

if (fs.existsSync(backendEnvPath)) {
    try {
        const backendEnv = fs.readFileSync(backendEnvPath, 'utf8');

        // Check required variables
        const requiredVars = ['FIREBASE_SERVICE_ACCOUNT', 'GEMINI_API_KEY', 'PORT'];

        requiredVars.forEach(varName => {
            if (backendEnv.includes(`${varName}=`)) {
                const match = backendEnv.match(new RegExp(`${varName}=(.+)`));
                if (match && match[1] && !match[1].includes('your-') && !match[1].includes('key-here')) {
                    if (varName === 'FIREBASE_SERVICE_ACCOUNT') {
                        try {
                            JSON.parse(match[1]);
                            console.log(`  ✅ ${varName}: Valid JSON format`);
                        } catch (e) {
                            console.log(`  ❌ ${varName}: Invalid JSON format`);
                        }
                    } else {
                        console.log(`  ✅ ${varName}: Configured`);
                    }
                } else {
                    console.log(`  ⚠️  ${varName}: Not configured (using template value)`);
                }
            } else {
                console.log(`  ❌ ${varName}: Missing`);
            }
        });
    } catch (error) {
        console.log('  ❌ Error reading backend .env file');
    }
} else {
    console.log('  ⚠️  Backend .env file not found');
    console.log('     Copy backend/.env.example to backend/.env');
}

console.log('\n📖 For setup instructions, read README.md');
console.log('🚀 Ready to run? Try: npm run dev:local\n');

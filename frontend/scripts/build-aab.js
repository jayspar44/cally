#!/usr/bin/env node
/* global process */

/**
 * AAB Build Script
 *
 * Builds an Android App Bundle (AAB) via Gradle and copies it to output directory.
 * For Play Store uploads, use release builds.
 *
 * Usage:
 *   node scripts/build-aab.js [flavor] [buildType]
 *
 * Arguments:
 *   flavor    - dev, prod (default: dev) - note: local not supported for AAB
 *   buildType - debug, release (default: release)
 *
 * Examples:
 *   node scripts/build-aab.js              # Build devRelease AAB
 *   node scripts/build-aab.js dev release  # Build devRelease AAB
 *   node scripts/build-aab.js prod release # Build prodRelease AAB
 *
 * Environment:
 *   For release builds, set these environment variables OR the script will
 *   prompt/use defaults from gradle.properties:
 *   - KEYSTORE_PASSWORD
 *   - KEY_ALIAS
 *   - KEY_PASSWORD
 */

import { existsSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendDir = join(__dirname, '..');
const androidDir = join(frontendDir, 'android');
const configPath = join(frontendDir, 'capacitor.config.json');
const gradlePropsPath = join(androidDir, 'gradle.properties');

// Output destination
const OUTPUT_PATH = process.env.AAB_OUTPUT_PATH || join(homedir(), 'aab-builds');

// App configuration
const APP_ID_BASE = 'com.kalli.app';
const APP_NAME = 'Kalli';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Valid flavors and build types (local not supported for AAB - no Play Store use case)
const VALID_FLAVORS = ['dev', 'prod'];
const VALID_BUILD_TYPES = ['debug', 'release'];

// Flavor configurations
const flavorConfigs = {
  dev: {
    appId: `${APP_ID_BASE}.dev`,
    appName: `${APP_NAME} Dev`,
    server: { androidScheme: 'https' },
    buildMode: 'dev'
  },
  prod: {
    appId: APP_ID_BASE,
    appName: APP_NAME,
    server: { androidScheme: 'https' },
    buildMode: 'production'
  }
};

// Parse command line arguments
const flavor = process.argv[2] || 'dev';
const buildType = process.argv[3] || 'release';

// Validate arguments
if (!VALID_FLAVORS.includes(flavor)) {
  console.error(`${colors.red}Invalid flavor: ${flavor}${colors.reset}`);
  console.error(`Valid flavors: ${VALID_FLAVORS.join(', ')}`);
  process.exit(1);
}

if (!VALID_BUILD_TYPES.includes(buildType)) {
  console.error(`${colors.red}Invalid build type: ${buildType}${colors.reset}`);
  console.error(`Valid build types: ${VALID_BUILD_TYPES.join(', ')}`);
  process.exit(1);
}

// Get version from package.json
function getVersion() {
  const packageJson = JSON.parse(readFileSync(join(frontendDir, 'package.json'), 'utf-8'));
  return packageJson.version;
}

// Generate timestamp in format YYYYMMDD-HHmm
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

// Status logging
function logStep(status, message) {
  const icons = {
    pending: `${colors.dim}[ ]${colors.reset}`,
    running: `${colors.cyan}[>]${colors.reset}`,
    success: `${colors.green}[+]${colors.reset}`,
    error: `${colors.red}[x]${colors.reset}`,
    warning: `${colors.yellow}[!]${colors.reset}`,
  };
  console.log(`${icons[status]} ${message}`);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Print banner
function printBanner() {
  const version = getVersion();
  const gradleTask = `bundle${capitalize(flavor)}${capitalize(buildType)}`;

  console.log('');
  console.log(`${colors.bright}========================================${colors.reset}`);
  console.log(`${colors.bright}  AAB BUILD: ${flavor}${capitalize(buildType)} (v${version})${colors.reset}`);
  console.log(`${colors.bright}========================================${colors.reset}`);
  console.log(`  Flavor:     ${flavor}`);
  console.log(`  Build Type: ${buildType}`);
  console.log(`  Gradle:     ${gradleTask}`);
  console.log(`  Output:     ${OUTPUT_PATH}`);
  console.log('');
}

// Save original configs for restoration
let originalCapConfig;
let originalGradleProps;

// Write the Capacitor config for the build
function writeCapConfig() {
  originalCapConfig = readFileSync(configPath, 'utf-8');
  const config = flavorConfigs[flavor];
  const capConfig = {
    appId: config.appId,
    appName: config.appName,
    webDir: 'dist',
    server: config.server,
    plugins: {
      Keyboard: {
        resize: 'native',
        style: 'dark',
        resizeOnFullScreen: true
      },
      StatusBar: {
        overlay: true
      },
      SystemBars: {
        insetsHandling: 'disable'
      }
    }
  };
  writeFileSync(configPath, JSON.stringify(capConfig, null, 2));
  logStep('success', `Capacitor config updated for ${flavor}`);
}

// Setup signing credentials in gradle.properties for release builds
function setupSigning() {
  if (buildType !== 'release') {
    return;
  }

  // Read existing gradle.properties
  originalGradleProps = readFileSync(gradlePropsPath, 'utf-8');

  const keystorePassword = process.env.KEYSTORE_PASSWORD;
  const keyAlias = process.env.KEY_ALIAS;
  const keyPassword = process.env.KEY_PASSWORD;

  if (!keystorePassword || !keyAlias || !keyPassword) {
    console.error(`${colors.red}Error: Missing required signing credentials${colors.reset}`);
    console.error('For release builds, set these environment variables:');
    console.error('  KEYSTORE_PASSWORD - Keystore password');
    console.error('  KEY_ALIAS         - Key alias name');
    console.error('  KEY_PASSWORD      - Key password');
    console.error('');
    console.error('Example:');
    console.error('  export KEYSTORE_PASSWORD="your-password"');
    console.error('  export KEY_ALIAS="your-alias"');
    console.error('  export KEY_PASSWORD="your-key-password"');
    process.exit(1);
  }

  const signingConfig = `
# Signing credentials (added by build-aab.js)
KEYSTORE_PASSWORD=${keystorePassword}
KEY_ALIAS=${keyAlias}
KEY_PASSWORD=${keyPassword}
`;

  writeFileSync(gradlePropsPath, originalGradleProps + signingConfig);
  logStep('success', 'Signing credentials configured');
}

// Restore original configs
function restoreConfigs() {
  if (originalCapConfig) {
    writeFileSync(configPath, originalCapConfig);
    logStep('success', 'Capacitor config restored');
  }
  if (originalGradleProps) {
    writeFileSync(gradlePropsPath, originalGradleProps);
    logStep('success', 'Gradle properties restored');
  }
}

// Run a command and return a promise
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    logStep('running', `${command} ${args.join(' ')}`);
    const proc = spawn(command, args, {
      cwd: options.cwd || frontendDir,
      stdio: 'inherit',
      shell: true,
      ...options
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

// Main execution
async function main() {
  printBanner();

  const version = getVersion();
  const timestamp = getTimestamp();
  const gradleTask = `bundle${capitalize(flavor)}${capitalize(buildType)}`;

  // AAB source path
  const aabFileName = `app-${flavor}-${buildType}.aab`;
  const aabSourcePath = join(
    androidDir, 'app', 'build', 'outputs', 'bundle',
    `${flavor}${capitalize(buildType)}`,
    aabFileName
  );

  // AAB destination path with versioned name
  const destFileName = `${APP_NAME}-${flavor}-${buildType}-v${version}-${timestamp}.aab`;
  const aabDestPath = join(OUTPUT_PATH, destFileName);

  // Setup cleanup handler
  const cleanup = () => {
    restoreConfigs();
    process.exit(1);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    // Step 1: Update Capacitor config
    writeCapConfig();

    // Step 2: Setup signing for release builds
    setupSigning();

    // Step 3: Build frontend
    const buildMode = flavorConfigs[flavor].buildMode;
    logStep('running', `Building frontend (mode: ${buildMode})...`);
    await runCommand('npm', ['run', 'build', '--', '--mode', buildMode]);
    logStep('success', 'Frontend build complete');

    // Step 4: Sync Capacitor
    logStep('running', 'Syncing Capacitor...');
    await runCommand('npx', ['cap', 'sync', 'android']);
    logStep('success', 'Capacitor sync complete');

    // Step 5: Run Gradle build
    logStep('running', `Running Gradle: ${gradleTask}...`);
    const gradleCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
    await runCommand(gradleCmd, [gradleTask], { cwd: androidDir });
    logStep('success', 'Gradle build complete');

    // Restore configs before copying
    restoreConfigs();

    // Step 6: Verify AAB exists
    if (!existsSync(aabSourcePath)) {
      throw new Error(`AAB not found at: ${aabSourcePath}`);
    }
    logStep('success', `AAB built: ${aabFileName}`);

    // Step 7: Ensure output directory exists
    if (!existsSync(OUTPUT_PATH)) {
      mkdirSync(OUTPUT_PATH, { recursive: true });
      logStep('success', `Created directory: ${OUTPUT_PATH}`);
    }

    // Step 8: Copy AAB to output directory
    logStep('running', 'Copying AAB to output directory...');
    copyFileSync(aabSourcePath, aabDestPath);
    logStep('success', `AAB copied to: ${destFileName}`);

    // Success message
    console.log('');
    console.log(`${colors.green}${colors.bright}========================================${colors.reset}`);
    console.log(`${colors.green}${colors.bright}  BUILD SUCCESSFUL!${colors.reset}`);
    console.log(`${colors.green}${colors.bright}========================================${colors.reset}`);
    console.log('');
    console.log(`  ${colors.bright}Source:${colors.reset}`);
    console.log(`    ${aabSourcePath}`);
    console.log('');
    console.log(`  ${colors.bright}Destination:${colors.reset}`);
    console.log(`    ${aabDestPath}`);
    console.log('');
    console.log(`  ${colors.bright}Next steps:${colors.reset}`);
    console.log(`    1. Go to https://play.google.com/console`);
    console.log(`    2. Select your app (${flavorConfigs[flavor].appName})`);
    console.log(`    3. Go to Testing > Internal testing`);
    console.log(`    4. Create new release and upload the AAB`);
    console.log('');

  } catch (error) {
    console.log('');
    logStep('error', `Build failed: ${error.message}`);
    restoreConfigs();
    process.exit(1);
  }
}

main();

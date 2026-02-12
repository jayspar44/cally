#!/usr/bin/env node

/**
 * Unified development server launcher with optional port and browser control
 *
 * Usage: npm run dev:local [-- [port] [--browser]]
 *
 * Examples:
 *   npm run dev:local                    # Default ports (3500/3501), no browser
 *   npm run dev:local -- 3510            # Custom ports (3510/3511), no browser
 *   npm run dev:local -- --browser       # Default ports, open browser
 *   npm run dev:local -- 3510 --browser  # Custom ports, open browser
 *
 * Arguments:
 *   port         Optional frontend port number (backend will be port+1)
 *   --browser    Open browser automatically (default: don't open)
 *   --open       Alias for --browser
 *   --help       Show this help message
 */

const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let frontendPort = '3500'; // Default port for Cally
let openBrowser = false;

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
    console.log(`\nUnified development server launcher with optional port and browser control

Usage: npm run dev:local [-- [port] [--browser]]

Examples:
  npm run dev:local                    # Default ports (3500/3501), no browser
  npm run dev:local -- 3510            # Custom ports (3510/3511), no browser
  npm run dev:local -- --browser       # Default ports, open browser
  npm run dev:local -- 3510 --browser  # Custom ports, open browser

Arguments:
  port         Optional frontend port number (backend will be port+1)
  --browser    Open browser automatically (default: don't open)
  --open       Alias for --browser
  --help       Show this help message
`);
    process.exit(0);
}

// Parse arguments
args.forEach(arg => {
    if (arg === '--browser' || arg === '--open') {
        openBrowser = true;
    } else if (!arg.startsWith('--')) {
        const portNum = parseInt(arg, 10);
        if (!isNaN(portNum)) {
            frontendPort = arg;
        }
    }
});

// Validate port (must be 3500+ to keep backend within range)
// Allowing a wider range, e.g., 3000-4000
const frontendPortNum = parseInt(frontendPort, 10);
if (isNaN(frontendPortNum) || frontendPortNum < 3000 || frontendPortNum > 4000) {
    console.error(`Error: Invalid port number "${frontendPort}"`);
    console.error('Port must be between 3000 and 4000');
    console.error('\nRun "npm run dev:local -- --help" for usage information');
    process.exit(1);
}

// Calculate backend port
const backendPort = frontendPortNum + 1;

console.log('='.repeat(60));
console.log('Starting Cally development servers:');
console.log(`  Frontend: http://localhost:${frontendPort}`);
console.log(`  Backend:  http://localhost:${backendPort}`);
console.log('='.repeat(60));
console.log();

const chalk = {
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

// Check for node_modules
const fs = require('fs');
const { execSync } = require('child_process');

const backendNodeModules = path.join(__dirname, '..', 'backend', 'node_modules');
const frontendNodeModules = path.join(__dirname, '..', 'frontend', 'node_modules');

const backendMissing = !fs.existsSync(backendNodeModules);
const frontendMissing = !fs.existsSync(frontendNodeModules);

if (backendMissing || frontendMissing) {
    console.log('Missing dependencies detected. Installing...\n');

    try {
        if (backendMissing) {
            console.log('Installing backend dependencies...');
            execSync('npm install', {
                cwd: path.join(__dirname, '..', 'backend'),
                stdio: 'inherit'
            });
            console.log('✓ Backend dependencies installed\n');
        }

        if (frontendMissing) {
            console.log('Installing frontend dependencies...');
            execSync('npm install', {
                cwd: path.join(__dirname, '..', 'frontend'),
                stdio: 'inherit'
            });
            console.log('✓ Frontend dependencies installed\n');
        }
    } catch (error) {
        console.error('Failed to install dependencies:', error.message);
        process.exit(1);
    }
}

// Spawn backend process
const backendEnv = {
    ...process.env,
    PORT: backendPort.toString(),
    FORCE_COLOR: '1'
};

const backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..', 'backend'),
    env: backendEnv,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
});

// Spawn frontend process
const frontendEnv = {
    ...process.env,
    PORT: frontendPort.toString(), // Vite uses VITE_PORT or --port flag, but we pass it as env too
    // Note: Vite config in Cally likely reads env vars or defaults. 
    // We will use the --port flag to be sure.
    // VITE_API_URL: `http://localhost:${backendPort}/api`, // OLD: Broken for mobile/remote
    VITE_API_URL: '/api', // NEW: Use relative path so Vite proxy handles it (works for localhost, LAN, Tailscale)
    FORCE_COLOR: '1'
};

// Use vite directly with --port and optional --open flag
const frontendArgs = openBrowser
    ? ['vite', '--port', frontendPort, '--open']
    : ['vite', '--port', frontendPort];
const frontendProcess = spawn('npx', frontendArgs, {
    cwd: path.join(__dirname, '..', 'frontend'),
    env: frontendEnv,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
});

// Prefix and forward backend output
backendProcess.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
        if (line.trim()) {
            console.log(`${chalk.blue('[backend]')} ${line}`);
        }
    });
});

backendProcess.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
        if (line.trim()) {
            console.log(`${chalk.blue('[backend]')} ${line}`);
        }
    });
});

// Prefix and forward frontend output
frontendProcess.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
        if (line.trim()) {
            console.log(`${chalk.green('[frontend]')} ${line}`);
        }
    });
});

frontendProcess.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
        if (line.trim()) {
            console.log(`${chalk.green('[frontend]')} ${line}`);
        }
    });
});

// Handle process exits
backendProcess.on('exit', (code) => {
    console.log(`${chalk.red('[backend]')} Process exited with code ${code}`);
    frontendProcess.kill();
    process.exit(code || 0);
});

frontendProcess.on('exit', (code) => {
    console.log(`${chalk.red('[frontend]')} Process exited with code ${code}`);
    backendProcess.kill();
    process.exit(code || 0);
});

// Handle errors
backendProcess.on('error', (error) => {
    console.error(`${chalk.red('[backend]')} Failed to start:`, error.message);
    frontendProcess.kill();
    process.exit(1);
});

frontendProcess.on('error', (error) => {
    console.error(`${chalk.red('[frontend]')} Failed to start:`, error.message);
    backendProcess.kill();
    process.exit(1);
});

// Handle termination signals
process.on('SIGINT', () => {
    console.log('\nShutting down development servers...');
    backendProcess.kill('SIGINT');
    frontendProcess.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    backendProcess.kill('SIGTERM');
    frontendProcess.kill('SIGTERM');
    process.exit(0);
});

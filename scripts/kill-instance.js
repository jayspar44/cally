#!/usr/bin/env node

const fkill = require('fkill').default || require('fkill');
const find = require('find-process').default || require('find-process');

/**
 * Kills a running dev instance by port (force kill)
 * Usage:
 *   npm run dev:local:kill              # Kill instance on 3500/3501
 *   npm run dev:local:kill -- 3504      # Kill instance on 3504/3505
 */

const VALID_FRONTEND_PORTS = [3500, 3502, 3504, 3506, 3508, 4000];

async function killInstance() {
    // Parse arguments
    const args = process.argv.slice(2);
    const portArg = args[0];
    const frontendPort = portArg ? parseInt(portArg, 10) : 3500;

    // Validate port
    if (isNaN(frontendPort)) {
        console.error(`Error: Invalid port "${portArg}". Must be a number.`);
        process.exit(1);
    }

    // Warn but don't strictly fail if outside list, just in case
    if (!VALID_FRONTEND_PORTS.includes(frontendPort)) {
        console.warn(`Warning: Port ${frontendPort} is not in standard list (${VALID_FRONTEND_PORTS.join(', ')}). Attempting anyway...`);
    }

    const backendPort = frontendPort + 1;

    console.log(`Killing instance on ports ${frontendPort} (frontend) and ${backendPort} (backend)...`);

    try {
        // Find processes on both ports
        const [frontendProcesses, backendProcesses] = await Promise.all([
            find('port', frontendPort),
            find('port', backendPort)
        ]);

        const pids = [];
        if (frontendProcesses.length > 0) {
            pids.push(...frontendProcesses.map(p => p.pid));
        }
        if (backendProcesses.length > 0) {
            pids.push(...backendProcesses.map(p => p.pid));
        }

        if (pids.length === 0) {
            console.log(`No processes found on ports ${frontendPort} or ${backendPort}`);
            return;
        }

        // Kill processes by PID (force kill for reliability)
        await fkill(pids, {
            force: true,
            silent: true
        });

        console.log(`✓ Successfully killed processes on ports ${frontendPort} and ${backendPort}`);
    } catch (error) {
        // fkill throws if no process found, but that's okay
        if (error.message.includes('Process doesn\'t exist') || error.message.includes('Killing process')) {
            console.log(`✓ Successfully killed processes on ports ${frontendPort} and ${backendPort}`);
        } else {
            console.error(`Error killing processes: ${error.message}`);
            process.exit(1);
        }
    }
}

killInstance().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});

---
description: Upload app to Google Play Store via GitHub Actions
allowed-tools: Bash(gh *), AskUserQuestion, Read
argument-hint: [--prod|--dev] [--internal|--alpha|--beta] [--draft|--completed] [--branch <name>] [-m "notes"]
---

# Upload to Play Store

Upload the app to Google Play Store by triggering the GitHub Actions workflow.

## Arguments (Optional)

All arguments are optional. Missing parameters will be prompted interactively.

| Flag | Description |
|------|-------------|
| `--prod` | Build production flavor (com.kalli.app) |
| `--dev` | Build development flavor (com.kalli.app.dev) |
| `--internal` | Upload to internal testing track |
| `--alpha` | Upload to alpha track |
| `--beta` | Upload to beta track |
| `--draft` | Keep release as draft (recommended for new apps) |
| `--completed` | Roll out immediately to users |
| `--branch <name>` | Git branch to build from (e.g., `develop`, `main`) |
| `-m "notes"` | Custom release notes |

## Parameters

| Parameter | Options | Default | Description |
|-----------|---------|---------|-------------|
| Flavor | `prod`, `dev` | `prod` | App variant to build and upload |
| Track | `internal`, `alpha`, `beta` | `internal` | Play Store release track |
| Status | `draft`, `completed` | `draft` | Whether to roll out immediately |
| Branch | Any git branch | current branch | Git branch to build from |
| Release Notes | Any text | "Bug fixes and improvements" | Notes shown in Play Store |

## Steps

1. **Parse CLI arguments** for any pre-specified options:
   - Check for `--prod` or `--dev` to set flavor
   - Check for `--internal`, `--alpha`, or `--beta` to set track
   - Check for `--draft` or `--completed` to set status
   - Check for `--branch <name>` to set the git branch to build from
   - Check for `-m "notes"` to set release notes

2. **Prompt for missing parameters** using AskUserQuestion:
   - If flavor not specified: Ask "Which app flavor?"
     - Production (Recommended) - For real releases to users (com.kalli.app)
     - Development - For testing with dev backend (com.kalli.app.dev)
   - If track not specified: Ask "Which Play Store track?"
     - Internal (Recommended) - Limited internal testing
     - Alpha - Wider alpha testing
     - Beta - Open beta testing
   - If status not specified: Ask "Release status?"
     - Draft (Recommended) - Keep in review, don't roll out yet
     - Completed - Roll out immediately to track users
   - If branch not specified: Ask "Which branch to build from?"
     - Current branch (Recommended) - Use the currently checked-out branch
     - develop - Build from develop branch
     - main - Build from main branch
   - If release notes not specified: Ask "Release notes?"
     - Use default - "Bug fixes and improvements"
     - Custom - Enter custom release notes

3. **Trigger the GitHub workflow**:
   ```bash
   gh workflow run upload-play-store.yml \
     --ref <branch> \
     -f flavor=<flavor> \
     -f track=<track> \
     -f status=<status> \
     -f release_notes="<notes>"
   ```

4. **Show initial confirmation**: Display all selected parameters and that the workflow was triggered

5. **Get the workflow run ID** (wait a few seconds for it to be created):
   ```bash
   sleep 3
   RUN_ID=$(gh run list --workflow=upload-play-store.yml -L 1 --json databaseId -q '.[0].databaseId')
   ```

6. **Monitor the workflow in background**: Use `run_in_background: true` to watch without blocking:
   ```bash
   gh run watch $RUN_ID
   ```
   Tell the user you're monitoring in the background and they can continue working.

7. **Report final result**: When the workflow completes, check the result and notify the user:
   ```bash
   CONCLUSION=$(gh run view $RUN_ID --json conclusion -q '.conclusion')
   ```
   - If `success`: Report success with link to Play Console
   - If `failure`: Report failure with link to workflow logs for debugging

## Example Usage

### Fully interactive (prompts for all):
```
/upload-play-store
```

### Production internal testing (draft):
```
/upload-play-store --prod --internal --draft --branch main
```

### Dev build from develop to alpha with custom notes:
```
/upload-play-store --dev --alpha --branch develop -m "New feature testing"
```

### Production release to beta:
```
/upload-play-store --prod --beta --completed --branch main -m "Version 1.0 beta release"
```

## What the Workflow Does

The GitHub Actions workflow (`upload-play-store.yml`):

1. Builds the React frontend with Vite
2. Syncs to Capacitor Android
3. Builds a signed AAB (Android App Bundle)
4. Uploads to the specified Play Store track
5. Creates a release with the specified status

## Prerequisites

The following must be configured in GitHub Secrets:
- `KEYSTORE_BASE64` - Release keystore for signing
- `KEYSTORE_PASSWORD` - Keystore password
- `KEY_ALIAS` - Signing key alias
- `KEY_PASSWORD` - Key password
- `FIREBASE_CLIENT_CONFIG` - Firebase client configuration
- `PLAY_SERVICE_ACCOUNT_JSON` - Play Store API service account

## Important Notes

- **Background monitoring**: The skill monitors the workflow in the background (typically 5-8 minutes) and notifies you when complete
- **Draft releases** require manual promotion in Play Console
- **Completed releases** roll out immediately to track users
- **Internal track** is limited to internal testers only
- **Branch matters for version**: The version name comes from `frontend/package.json` on the selected branch. Always ensure the branch has the latest release version.
- **Version code** auto-increments based on GitHub run number
- **Version name** comes from `frontend/package.json`
- Check Play Console for release status after workflow completes

## Success/Failure Reporting

When the workflow completes, the skill will report:

**On Success:**
- Confirmation message with version uploaded
- Link to Play Console to view the release
- Reminder about draft vs completed status

**On Failure:**
- Error summary from the workflow
- Link to GitHub Actions logs for debugging
- Common failure causes (signing issues, Play Store API errors)

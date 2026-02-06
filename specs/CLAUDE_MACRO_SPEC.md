# `/claude` Macro Specification

## Overview

The `/claude` macro allows users to delegate tasks from their journal entries directly to a Claude Code headless session. When invoked, the current line becomes instructions for Claude, which then autonomously works on a codebase. The application handles all git operations (branching, pushing, PR creation) deterministically via a Git SDK, while Claude focuses solely on code changes.

## User Flow

1. User writes instructions on a line in the editor (e.g., "Add dark mode toggle to settings page")
2. User navigates to the end of the line and types `/claude`
3. A modal appears with configuration options:
   - **Git Context Selector**: File picker to select a local directory containing a `.git` folder
   - **Instructions Mode Toggle**: Switch between:
     - **Inline Mode**: Textarea for writing additional instructions directly
     - **File Mode**: File picker for selecting a `.md` file with detailed instructions
4. User clicks "Delegate" to confirm
5. The `/claude` text is replaced with a `ClaudeStatus` component showing:
   - "Initializing headless session..."
   - "Claude is working..." (with optional progress indicators)
6. When complete, the component becomes a button: "Claude has finished. Click for PR" linking to the created PR

## Technical Architecture

### Git Operations (Rust-Managed)

All git operations are handled deterministically by the Rust backend using a Git SDK (e.g., `git2` crate). Claude does **not** perform any git operations.

**Rust responsibilities:**
1. Clone/copy repository to temp directory
2. Create feature branch
3. After Claude completes: stage changes, commit, push to remote
4. Create PR via GitHub API (or similar)
5. Clean up temp directory after PR submission

**Claude responsibilities:**
1. Read and understand the codebase
2. Edit files to implement the requested changes
3. Run whitelisted test commands
4. Signal completion

### Directory Structure

Temp checkouts are stored in a dedicated subdirectory:

```
~/.dreamal/
└── temp-checkouts/
    ├── session-<uuid>/
    │   └── <repo-contents>
    └── session-<uuid>/
        └── <repo-contents>
```

Cleanup occurs automatically after PR submission. On app startup, any orphaned temp directories are cleaned up.

### Frontend Components

#### 1. ClaudeDelegateModal
Location: `src/components/ClaudeDelegateModal.tsx`

Props:
- `instructions: string` - The line content to use as instructions
- `onConfirm: (config: ClaudeDelegateConfig) => void`
- `onCancel: () => void`

State:
- `gitDirectory: string | null`
- `instructionsMode: 'inline' | 'file'`
- `inlineInstructions: string`
- `instructionsFilePath: string | null`

Features:
- Directory picker (via Tauri file dialog) filtered to directories containing `.git`
- Toggle switch between inline instructions and file picker
- When in inline mode: textarea for additional instructions
- When in file mode: file picker for `.md` instruction files
- Validation: gitDirectory is required; if file mode, instructionsFilePath is required

#### 2. ClaudeStatusComponent
Location: `src/components/ClaudeStatusComponent.tsx`

Props:
- `sessionId: string`
- `status: 'initializing' | 'working' | 'completed' | 'error'`
- `prUrl?: string`
- `errorMessage?: string`

Renders:
- `initializing`: Spinner + "Initializing headless session..."
- `working`: Spinner + "Claude is working..."
- `completed`: Button "Claude has finished. Click for PR" → opens `prUrl`
- `error`: Error message with retry option

### Editor Integration

#### Macro Detection
Location: `src/editorActions.ts` or `src/macros.ts`

When the user types `/claude` at the end of a line:
1. Detect the macro trigger
2. Extract the line content (excluding `/claude`) as instructions
3. Open `ClaudeDelegateModal` with these instructions
4. On confirm, replace the line (including `/claude`) with a `ClaudeStatusComponent` placeholder

#### Block Type
Add a new block type or inline element to represent a Claude delegation in progress:

```typescript
interface ClaudeDelegationBlock {
  type: 'claude-delegation';
  sessionId: string;
  instructions: string;
  status: 'initializing' | 'working' | 'completed' | 'error';
  prUrl?: string;
  gitDirectory: string;
  createdAt: number;
}
```

### Backend (Tauri/Rust)

#### Commands

##### `spawn_claude_session`
```rust
#[tauri::command]
async fn spawn_claude_session(
    git_directory: String,
    instructions: String,
    additional_instructions: Option<String>,  // From inline mode
    instructions_file: Option<String>,        // From file mode (contents read by backend)
) -> Result<String, String> // Returns session_id
```

Responsibilities:
1. Create session directory in `~/.dreamal/temp-checkouts/session-<uuid>/`
2. Clone/copy the git repository to session directory
3. Create a feature branch (e.g., `claude/feature-<timestamp>`)
4. Compose instructions from all inputs
5. Spawn Claude Code headless session with working directory set to session directory
6. Return session ID for tracking

##### `get_session_status`
```rust
#[tauri::command]
async fn get_session_status(session_id: String) -> Result<SessionStatus, String>
```

Returns:
```rust
struct SessionStatus {
    status: String, // "initializing" | "working" | "completed" | "error"
    pr_url: Option<String>,
    error_message: Option<String>,
}
```

##### `cancel_session`
```rust
#[tauri::command]
async fn cancel_session(session_id: String) -> Result<(), String>
```

Responsibilities:
1. Kill Claude process if running
2. Clean up session directory
3. Remove session from store

#### Git Operations Module

Location: `src-tauri/src/git_ops/`

Using the `git2` crate for local operations and `octocrab` (or similar) for GitHub API:

##### `clone_to_temp`
```rust
fn clone_to_temp(source_path: &Path, session_id: &str) -> Result<PathBuf, GitError>
```
- Creates `~/.dreamal/temp-checkouts/session-<session_id>/`
- Copies repository (including `.git`) to temp location
- Returns path to temp checkout

##### `create_feature_branch`
```rust
fn create_feature_branch(repo_path: &Path, branch_name: &str) -> Result<(), GitError>
```
- Creates and checks out a new branch
- Branch naming: `claude/<short-description>-<timestamp>`

##### `commit_and_push`
```rust
async fn commit_and_push(
    repo_path: &Path,
    commit_message: &str,
) -> Result<(), GitError>
```
- Stages all changes
- Creates commit
- Pushes to remote origin
- Authentication: Uses system SSH agent for SSH remotes, credential helper for HTTPS

##### `create_pull_request`
```rust
async fn create_pull_request(
    repo_path: &Path,
    title: &str,
    body: &str,
    base_branch: &str,
) -> Result<String, GitError> // Returns PR URL
```
- Extracts remote URL from repo
- Uses GitHub API to create PR
- Returns the PR URL

##### `cleanup_session`
```rust
fn cleanup_session(session_id: &str) -> Result<(), std::io::Error>
```
- Removes `~/.dreamal/temp-checkouts/session-<session_id>/`
- Called after PR is successfully created

#### Session Lifecycle

```
spawn_claude_session called
       ↓
1. clone_to_temp (copy repo to temp checkout)
       ↓
2. create_feature_branch
       ↓
3. Spawn headless Claude in temp directory
       ↓
4. Claude works (edits files, runs tests)
       ↓
5. Claude signals completion
       ↓
6. commit_and_push (stage, commit, push changes)
       ↓
7. create_pull_request (via GitHub API)
       ↓
8. cleanup_session (remove temp directory)
       ↓
9. Return PR URL to frontend
```

#### Claude CLI Invocation

```bash
claude --headless \
  --allowedTools "Edit,Write,Read,Bash" \
  --permission-prompt-tool Bash \
  --allowedCommands "npm run test,npm run test:run,cargo test" \
  -p "<composed instructions>"
```

The instructions should include:
- The user's original line content
- Additional instructions (inline or from file)
- A system prompt suffix instructing Claude to:
  - Make the requested changes
  - Run tests to verify changes work
  - Do NOT perform any git operations (no commit, push, branch, etc.)
  - Signal completion when done

### State Persistence

Claude delegation blocks should persist in the journal entry file. When loading an entry:
- If status is `initializing` or `working`, poll `get_session_status` to update
- If the session no longer exists (app restart), mark as `error` with message "Session interrupted"

### Data Flow

```
User types /claude
       ↓
Macro detected → Extract line as instructions
       ↓
ClaudeDelegateModal opens
       ↓
User selects git directory
User toggles instruction mode (inline OR file)
User provides instructions
User clicks "Delegate"
       ↓
Frontend calls spawn_claude_session (Tauri command)
       ↓
Rust backend:
  1. Creates temp checkout directory
  2. Clones repo to temp
  3. Creates feature branch
  4. Spawns headless Claude
  5. Returns session_id
       ↓
Frontend:
  1. Replaces line with ClaudeStatusComponent
  2. Polls get_session_status periodically
       ↓
Headless Claude works (code changes only)
       ↓
Claude signals completion
       ↓
Rust backend:
  1. Commits all changes
  2. Pushes to remote
  3. Creates PR via GitHub API
  4. Cleans up temp directory
  5. Returns PR URL
       ↓
Frontend poll receives 'completed' status with PR URL
       ↓
ClaudeStatusComponent shows "Click for PR" button
```

## Incremental Implementation Plan

### Phase 1: Rust Git Infrastructure ✅

**Step 1.1: Set Up Git Operations Module** ✅
- Add `git2` crate dependency
- Create `src-tauri/src/git_ops/mod.rs` module structure
- Implement helper to get temp checkouts base directory (`~/.dreamal/temp-checkouts/`)
- Test: Directory is created if not exists

**Step 1.2: Implement clone_to_temp** ✅
- Copy repository contents (including .git) to temp session directory
- Verify the copy is a valid git repository
- Test: Can copy a local repo, new copy has correct branch and history

**Step 1.3: Implement create_feature_branch** ✅
- Create a new branch with naming convention `claude/<description>-<timestamp>`
- Check out the new branch
- Test: Branch is created and checked out

**Step 1.4: Implement commit_and_push** ✅
- Stage all changes in working directory
- Create commit with provided message
- Push to origin (uses system SSH agent or credential helper)
- Test: Changes are committed and pushed (use a test repo)

**Step 1.5: Implement create_pull_request** ✅
- Add `reqwest` for GitHub API
- Extract owner/repo from remote URL (supports custom SSH host aliases like `git@alias.github.com`)
- Create PR via GitHub API
- Handle authentication (`gh auth token` or `GITHUB_TOKEN` env var)
- Test: PR is created on GitHub, URL is returned

**Step 1.6: Implement cleanup_session** ✅
- Remove session directory
- Handle errors gracefully (directory already removed, etc.)
- Test: Directory is removed after call

**Step 1.7: Implement Startup Cleanup** ✅
- On app startup, scan temp-checkouts directory
- Remove any orphaned session directories
- Test: Old directories are cleaned up on startup

### Phase 2: Headless Claude Integration

**Step 2.1: Create Session Manager** ✅
- Implement in-memory session store (HashMap<String, Session>)
- Define Session struct with status, process handle, PR URL, etc.
- Implement session state machine
- Test: Can create, retrieve, update sessions

**Step 2.2: Implement Claude Process Spawning** ✅
- Compose instructions from inputs
- Build Claude CLI command with correct flags (`--allowedTools`, `--allowedCommands`)
- Spawn process with working directory set to temp checkout
- Store process handle in session
- Test: Claude process starts and runs

**Step 2.3: Implement Process Monitoring**
- Monitor Claude process stdout/stderr
- Detect completion signal from Claude
- Update session status accordingly
- Test: Completion is detected, status updates

**Step 2.4: Implement Post-Completion Git Flow**
- On Claude completion, trigger commit_and_push
- Then trigger create_pull_request
- Store PR URL in session
- Trigger cleanup_session
- Update status to 'completed'
- Test: Full flow from completion to PR URL

**Step 2.5: Implement Tauri Commands**
- `spawn_claude_session`: orchestrates clone → branch → spawn
- `get_session_status`: returns current session state
- `cancel_session`: kills process, cleans up
- Test: Commands are callable from frontend

### Phase 3: Frontend Components

**Step 3.1: Create ClaudeStatusComponent**
- Create component with all status states
- Add loading spinner for initializing/working states
- Add clickable button for completed state (opens PR URL)
- Add error display with retry button
- Test: Component renders correctly for each status

**Step 3.2: Create ClaudeDelegateModal**
- Create basic modal layout
- Add git directory picker (Tauri file dialog)
- Add toggle between inline/file instruction modes
- Add textarea for inline mode
- Add file picker for file mode
- Add validation logic
- Test: Modal functions correctly, validation works

**Step 3.3: Add Claude Delegation Block Type**
- Define the block type in editor's type system
- Add rendering logic (renders ClaudeStatusComponent)
- Ensure block persists when saving/loading entries
- Test: Block can be created, saved, and loaded

### Phase 4: Editor Integration

**Step 4.1: Implement /claude Macro Trigger**
- Detect when user types `/claude` at end of line
- Extract preceding line content as instructions
- Prevent `/claude` from being inserted as text
- Open ClaudeDelegateModal with extracted instructions
- Test: Typing /claude opens modal with correct instructions

**Step 4.2: Wire Modal to Backend**
- On confirm, call spawn_claude_session
- Handle success: create ClaudeDelegationBlock with session ID
- Replace current line with the block
- Handle error: show error in modal
- Test: Confirming modal triggers full flow

**Step 4.3: Implement Status Polling**
- Poll get_session_status every 2-5 seconds for active sessions
- Update ClaudeStatusComponent based on response
- Stop polling when completed or error
- Test: Status updates as session progresses

**Step 4.4: Handle App Restart**
- On load, check for existing delegation blocks
- For blocks with non-terminal status, attempt to reconnect or mark as error
- Test: App handles existing delegations on restart

### Phase 5: Polish and Edge Cases

**Step 5.1: Improve Error Handling**
- Categorize errors (git error, Claude error, auth error, network error)
- Provide actionable error messages
- Add retry functionality for recoverable errors

**Step 5.2: Add Progress Indicators**
- Parse Claude output for progress hints (optional)
- Display elapsed time in status component

**Step 5.3: Git Authentication Error Handling**
- Detect auth failures during push (SSH agent not running, credential helper failed)
- Detect missing GitHub token for PR creation
- Provide clear error messages with remediation steps (e.g., "Run `gh auth login` or set GITHUB_TOKEN")

**Step 5.4: Security and Validation**
- Validate git directory contains .git
- Validate .md file exists and is readable
- Sanitize instructions
- Limit concurrent sessions

## Configuration

### Whitelisted Commands

The headless Claude session should only be allowed to run specific commands:

```
npm run test
npm run test:run
npm test
cargo test
go test
pytest
jest
```

This list should be configurable, potentially via a config file in the git repository (e.g., `.dreamal/claude-commands.json`).

### Default Branch

The PR target branch defaults to `main`. This could be made configurable:
- Per-repository config file
- Modal option
- Application settings

### Git Authentication

The application relies on the user's existing git credentials:

**For git push (`git2` crate):**
- SSH remotes: Uses the system SSH agent (`SSH_AUTH_SOCK`)
- HTTPS remotes: Uses the system credential helper (same as `git push`)

**For GitHub API (PR creation):**
- First, check if `gh` CLI is authenticated (`gh auth status`) and use its token
- Fall back to `GITHUB_TOKEN` environment variable
- If neither available, show error with instructions to run `gh auth login` or set `GITHUB_TOKEN`

This approach requires no additional configuration for users who already have `git push` and `gh` working.

## Open Questions

1. **Session Persistence**: Should sessions survive app restart? Currently spec says mark as error, but could persist process info.

2. **Multiple Concurrent Sessions**: Should we allow multiple Claude sessions at once? Resource implications?

3. **PR Template**: Should there be a way to customize the PR description template?

4. **Non-GitHub Remotes**: Should we support GitLab, Bitbucket, etc.? Would require additional API integrations.

5. **Timeout**: Should sessions have a maximum runtime before auto-cancellation?

## File Structure After Implementation

```
src/
├── components/
│   ├── ClaudeDelegateModal.tsx
│   └── ClaudeStatusComponent.tsx
├── hooks/
│   └── useClaudeSession.ts
├── types/
│   └── claudeDelegation.ts
└── ...

src-tauri/
└── src/
    ├── git_ops/
    │   ├── mod.rs
    │   ├── clone.rs
    │   ├── branch.rs
    │   ├── commit.rs
    │   ├── pr.rs
    │   └── cleanup.rs
    ├── claude_session/
    │   ├── mod.rs
    │   ├── manager.rs
    │   ├── process.rs
    │   └── types.rs
    └── ...

~/.dreamal/
├── temp-checkouts/
│   └── session-<uuid>/
└── config.json
```

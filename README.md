# Dreamal

Dreamal is a desktop journaling application designed to help organize your thinking. It features a custom-built rich text editor with an extensible macro system, all wrapped in a native desktop experience powered by Tauri.

## Features

- **Custom Rich Text Editor** - Built from scratch with no third-party editor libraries. Supports Markdown-style headings, bullet lists with smart auto-formatting, and inline text selection.
- **Macro System** - Type slash commands to quickly insert dates, timers, task status badges, and more. An autocomplete dropdown appears as you type, and you can navigate it with arrow keys and select with Tab or Enter.
- **Inline Interactive Components** - Embed live React components directly in your journal entries via JSX blocks. Timers count down in real time, task badges track status, and components persist with your document.
- **Heading Collapse & Focus Mode** - Collapse heading sections to hide content beneath them. Hold Option to enter focus mode, which hides all sections except the one you're working in.
- **Undo/Redo** - Full history tracking with Cmd+Z / Cmd+Shift+Z.
- **Line & Section Reordering** - Move lines or entire heading sections up and down with Cmd+Shift+Up/Down.
- **Entry Navigation** - Navigate between journal entries with Cmd+Shift+[ and Cmd+Shift+].
- **File-Based Persistence** - Entries are stored as individual files on disk with automatic saving.
- **Claude AI Integration** - Delegate tasks to Claude directly from within a journal entry.

## Macros

Macros are text expansion shortcuts triggered by typing a `/` command in the editor. When you start typing a slash command, Dreamal shows an autocomplete dropdown with matching macros. Select one to replace the trigger text with the macro's expanded content - often an interactive component embedded directly in your entry.

### Available Macros

| Macro | Description |
|-------|-------------|
| `/date` | Inserts the current date in long format (e.g., "February 8, 2026") |
| `/timer` | Inserts a 5-minute countdown timer |
| `/timer1` | Inserts a 1-minute countdown timer |
| `/timer5` | Inserts a 5-minute countdown timer |
| `/timer10` | Inserts a 10-minute countdown timer |
| `/todo` | Inserts a "To Do" status badge |
| `/in-progress` | Inserts an "In Progress" status badge |
| `/done` | Inserts a "Done" status badge |
| `/claude` | Starts a Claude AI session - prompts for instructions, then inserts a live status indicator that tracks the session |

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Rust (via Tauri 2.x)
- **Testing**: Vitest + Testing Library

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/tools/install)
- Tauri 2.x prerequisites - see the [Tauri Getting Started guide](https://v2.tauri.app/start/prerequisites/)

## Getting Started

Install dependencies:

```bash
npm install
```

Run in development mode:

```bash
npm run tauri dev
```

## Building

Build the frontend:

```bash
npm run build
```

Build the full desktop application:

```bash
npm run tauri build
```

## Testing

Run tests:

```bash
npm run test:run
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Cmd+A | Select all |
| Cmd+Shift+Up/Down | Swap lines or heading sections |
| Cmd+Shift+[ / ] | Navigate between entries |
| Cmd+N | New entry |
| Tab / Shift+Tab | Indent / outdent bullets |
| Option (hold) | Focus mode |
| Escape | Clear block selection |

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

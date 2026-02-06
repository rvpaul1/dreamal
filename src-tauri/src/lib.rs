mod claude_session;
mod git_ops;

use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;

use claude_session::commands::{
    cancel_session, get_session_status, list_claude_sessions, spawn_claude_session, AppState,
};
use claude_session::SessionManager;

fn get_default_journal_dir() -> Result<PathBuf, String> {
    let home = dirs::document_dir()
        .or_else(|| dirs::home_dir())
        .ok_or("Could not determine home directory")?;
    Ok(home.join("Journal"))
}

#[tauri::command]
fn get_journal_path() -> Result<String, String> {
    let path = get_default_journal_dir()?;
    path.to_str()
        .map(|s| s.to_string())
        .ok_or("Invalid path encoding".to_string())
}

#[tauri::command]
fn write_entry(filepath: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(&filepath);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                format!("Permission denied: cannot create directory {}", parent.display())
            } else {
                format!("Failed to create directory {}: {}", parent.display(), e)
            }
        })?;
    }

    let tmp_path = PathBuf::from(format!("{}.tmp", filepath));

    {
        let mut file = fs::File::create(&tmp_path).map_err(|e| {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                format!("Permission denied: cannot write to {}", tmp_path.display())
            } else {
                format!("Failed to create temp file: {}", e)
            }
        })?;

        file.write_all(content.as_bytes()).map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            if e.raw_os_error() == Some(28) {
                "Disk full: not enough space to save the file".to_string()
            } else {
                format!("Failed to write content: {}", e)
            }
        })?;

        file.sync_all().map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            format!("Failed to sync file: {}", e)
        })?;
    }

    fs::rename(&tmp_path, &path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        format!("Failed to finalize save: {}", e)
    })?;

    Ok(())
}

#[tauri::command]
fn ensure_journal_dir() -> Result<String, String> {
    let path = get_default_journal_dir()?;

    fs::create_dir_all(&path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            format!("Permission denied: cannot create journal directory at {}", path.display())
        } else {
            format!("Failed to create journal directory: {}", e)
        }
    })?;

    path.to_str()
        .map(|s| s.to_string())
        .ok_or("Invalid path encoding".to_string())
}

#[tauri::command]
fn list_entries() -> Result<Vec<String>, String> {
    let journal_dir = get_default_journal_dir()?;

    if !journal_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries: Vec<String> = Vec::new();

    let years = fs::read_dir(&journal_dir).map_err(|e| format!("Failed to read journal: {}", e))?;

    for year_entry in years.flatten() {
        let year_path = year_entry.path();
        if !year_path.is_dir() {
            continue;
        }

        let months = match fs::read_dir(&year_path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        for month_entry in months.flatten() {
            let month_path = month_entry.path();
            if !month_path.is_dir() {
                continue;
            }

            let files = match fs::read_dir(&month_path) {
                Ok(f) => f,
                Err(_) => continue,
            };

            for file_entry in files.flatten() {
                let file_path = file_entry.path();
                if file_path.extension().is_some_and(|ext| ext == "md") {
                    if let Some(path_str) = file_path.to_str() {
                        entries.push(path_str.to_string());
                    }
                }
            }
        }
    }

    entries.sort();
    Ok(entries)
}

#[tauri::command]
fn read_entry(filepath: String) -> Result<String, String> {
    fs::read_to_string(&filepath).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            format!("Entry not found: {}", filepath)
        } else if e.kind() == std::io::ErrorKind::PermissionDenied {
            format!("Permission denied: cannot read {}", filepath)
        } else {
            format!("Failed to read entry: {}", e)
        }
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let session_manager = Arc::new(SessionManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            session_manager: session_manager.clone(),
        })
        .setup(|_app| {
            if let Err(e) = git_ops::cleanup::cleanup_orphaned_sessions() {
                eprintln!("Warning: Failed to cleanup orphaned sessions: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_journal_path,
            write_entry,
            ensure_journal_dir,
            list_entries,
            read_entry,
            spawn_claude_session,
            get_session_status,
            cancel_session,
            list_claude_sessions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

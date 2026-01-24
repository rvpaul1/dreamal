use std::fs;
use std::io::Write;
use std::path::PathBuf;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_journal_path,
            write_entry,
            ensure_journal_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

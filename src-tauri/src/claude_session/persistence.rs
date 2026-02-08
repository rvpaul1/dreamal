use std::fs;
use std::path::PathBuf;

use super::types::SessionInfo;
use crate::git_ops::get_dreamal_dir;

fn get_sessions_dir() -> Result<PathBuf, String> {
    let dir = get_dreamal_dir()
        .map_err(|e| e.to_string())?
        .join("sessions");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create sessions dir: {}", e))?;
    Ok(dir)
}

fn session_file_path(session_id: &str) -> Result<PathBuf, String> {
    Ok(get_sessions_dir()?.join(format!("{}.json", session_id)))
}

pub fn save_session_info(info: &SessionInfo) -> Result<(), String> {
    let path = session_file_path(&info.id)?;
    let json = serde_json::to_string(info).map_err(|e| format!("Failed to serialize session: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write session file: {}", e))?;
    Ok(())
}

pub fn load_session_info(session_id: &str) -> Result<Option<SessionInfo>, String> {
    let path = session_file_path(session_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("Failed to read session file: {}", e))?;
    let info: SessionInfo = serde_json::from_str(&json).map_err(|e| format!("Failed to parse session file: {}", e))?;
    Ok(Some(info))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::claude_session::types::SessionStatus;

    #[test]
    fn test_save_and_load_session_info() {
        let session_id = format!("test-persist-{}", uuid::Uuid::new_v4());
        let info = SessionInfo {
            id: session_id.clone(),
            status: SessionStatus::Completed,
            pr_url: Some("https://github.com/owner/repo/pull/42".to_string()),
            error_message: None,
            git_directory: "/path/to/repo".to_string(),
            instructions: "Add feature".to_string(),
            created_at: 1234567890,
        };

        save_session_info(&info).unwrap();

        let loaded = load_session_info(&session_id).unwrap();
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.id, session_id);
        assert_eq!(loaded.status, SessionStatus::Completed);
        assert_eq!(loaded.pr_url, Some("https://github.com/owner/repo/pull/42".to_string()));

        // Cleanup
        let path = session_file_path(&session_id).unwrap();
        let _ = fs::remove_file(path);
    }

    #[test]
    fn test_load_nonexistent_session() {
        let result = load_session_info("nonexistent-session-id").unwrap();
        assert!(result.is_none());
    }
}

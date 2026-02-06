use std::fs;
use std::path::Path;

use super::{get_session_dir, get_temp_checkouts_dir, GitOpsError};

pub fn cleanup_session(session_id: &str) -> Result<(), GitOpsError> {
    let session_dir = get_session_dir(session_id)?;

    if session_dir.exists() {
        fs::remove_dir_all(&session_dir)?;
    }

    Ok(())
}

pub fn cleanup_session_dir(session_dir: &Path) -> Result<(), GitOpsError> {
    if session_dir.exists() {
        fs::remove_dir_all(session_dir)?;
    }

    Ok(())
}

pub fn cleanup_orphaned_sessions() -> Result<usize, GitOpsError> {
    let checkouts_dir = get_temp_checkouts_dir()?;

    if !checkouts_dir.exists() {
        return Ok(0);
    }

    let mut cleaned = 0;

    for entry in fs::read_dir(&checkouts_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with("session-") {
                    fs::remove_dir_all(&path)?;
                    cleaned += 1;
                }
            }
        }
    }

    Ok(cleaned)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_cleanup_session() {
        let session_id = format!("test-cleanup-{}", uuid::Uuid::new_v4());
        let session_dir = get_session_dir(&session_id).unwrap();

        fs::create_dir_all(&session_dir).unwrap();
        fs::write(session_dir.join("test.txt"), "content").unwrap();

        assert!(session_dir.exists());

        let result = cleanup_session(&session_id);
        assert!(result.is_ok());
        assert!(!session_dir.exists());
    }

    #[test]
    fn test_cleanup_session_nonexistent() {
        let session_id = format!("nonexistent-{}", uuid::Uuid::new_v4());

        let result = cleanup_session(&session_id);
        assert!(result.is_ok());
    }

    #[test]
    fn test_cleanup_session_dir() {
        let temp_dir = tempfile::tempdir().unwrap();
        let session_dir = temp_dir.path().join("test-session");

        fs::create_dir_all(&session_dir).unwrap();
        fs::write(session_dir.join("file.txt"), "data").unwrap();

        assert!(session_dir.exists());

        let result = cleanup_session_dir(&session_dir);
        assert!(result.is_ok());
        assert!(!session_dir.exists());
    }

    #[test]
    fn test_cleanup_orphaned_sessions() {
        let temp_dir = tempfile::tempdir().unwrap();
        let checkouts_dir = temp_dir.path();

        let session1 = checkouts_dir.join("session-orphan-1");
        let session2 = checkouts_dir.join("session-orphan-2");
        let not_session = checkouts_dir.join("other-dir");

        fs::create_dir_all(&session1).unwrap();
        fs::create_dir_all(&session2).unwrap();
        fs::create_dir_all(&not_session).unwrap();

        let mut cleaned = 0;
        for entry in fs::read_dir(checkouts_dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("session-") {
                        fs::remove_dir_all(&path).unwrap();
                        cleaned += 1;
                    }
                }
            }
        }

        assert_eq!(cleaned, 2);
        assert!(!session1.exists());
        assert!(!session2.exists());
        assert!(not_session.exists());
    }
}

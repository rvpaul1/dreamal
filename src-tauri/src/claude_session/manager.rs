use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use super::types::{Session, SessionInfo, SessionStatus};

#[derive(Debug)]
pub enum SessionError {
    NotFound(String),
    AlreadyExists(String),
    LockError,
}

impl std::fmt::Display for SessionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionError::NotFound(id) => write!(f, "Session not found: {}", id),
            SessionError::AlreadyExists(id) => write!(f, "Session already exists: {}", id),
            SessionError::LockError => write!(f, "Failed to acquire session lock"),
        }
    }
}

#[derive(Clone)]
pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create_session(
        &self,
        id: String,
        git_directory: String,
        instructions: String,
        work_dir: PathBuf,
        branch_name: String,
    ) -> Result<SessionInfo, SessionError> {
        let mut sessions = self.sessions.lock().map_err(|_| SessionError::LockError)?;

        if sessions.contains_key(&id) {
            return Err(SessionError::AlreadyExists(id));
        }

        let session = Session::new(id.clone(), git_directory, instructions, work_dir, branch_name);
        let info = session.info.clone();
        sessions.insert(id, session);

        Ok(info)
    }

    pub fn get_session_info(&self, id: &str) -> Result<SessionInfo, SessionError> {
        let sessions = self.sessions.lock().map_err(|_| SessionError::LockError)?;

        sessions
            .get(id)
            .map(|s| s.info.clone())
            .ok_or_else(|| SessionError::NotFound(id.to_string()))
    }

    pub fn set_working(&self, id: &str, process_id: u32) -> Result<(), SessionError> {
        let mut sessions = self.sessions.lock().map_err(|_| SessionError::LockError)?;

        let session = sessions
            .get_mut(id)
            .ok_or_else(|| SessionError::NotFound(id.to_string()))?;

        session.set_working(process_id);
        Ok(())
    }

    pub fn set_completed(&self, id: &str, pr_url: String) -> Result<(), SessionError> {
        let mut sessions = self.sessions.lock().map_err(|_| SessionError::LockError)?;

        let session = sessions
            .get_mut(id)
            .ok_or_else(|| SessionError::NotFound(id.to_string()))?;

        session.set_completed(pr_url);
        Ok(())
    }

    pub fn set_error(&self, id: &str, message: String) -> Result<(), SessionError> {
        let mut sessions = self.sessions.lock().map_err(|_| SessionError::LockError)?;

        let session = sessions
            .get_mut(id)
            .ok_or_else(|| SessionError::NotFound(id.to_string()))?;

        session.set_error(message);
        Ok(())
    }

    pub fn get_process_id(&self, id: &str) -> Result<Option<u32>, SessionError> {
        let sessions = self.sessions.lock().map_err(|_| SessionError::LockError)?;

        let session = sessions
            .get(id)
            .ok_or_else(|| SessionError::NotFound(id.to_string()))?;

        Ok(session.process_id)
    }

    pub fn get_work_dir(&self, id: &str) -> Result<PathBuf, SessionError> {
        let sessions = self.sessions.lock().map_err(|_| SessionError::LockError)?;

        let session = sessions
            .get(id)
            .ok_or_else(|| SessionError::NotFound(id.to_string()))?;

        Ok(session.work_dir.clone())
    }

    pub fn get_branch_name(&self, id: &str) -> Result<String, SessionError> {
        let sessions = self.sessions.lock().map_err(|_| SessionError::LockError)?;

        let session = sessions
            .get(id)
            .ok_or_else(|| SessionError::NotFound(id.to_string()))?;

        Ok(session.branch_name.clone())
    }

    pub fn remove_session(&self, id: &str) -> Result<Session, SessionError> {
        let mut sessions = self.sessions.lock().map_err(|_| SessionError::LockError)?;

        sessions
            .remove(id)
            .ok_or_else(|| SessionError::NotFound(id.to_string()))
    }

    pub fn list_sessions(&self) -> Result<Vec<SessionInfo>, SessionError> {
        let sessions = self.sessions.lock().map_err(|_| SessionError::LockError)?;

        Ok(sessions.values().map(|s| s.info.clone()).collect())
    }

    pub fn get_active_sessions(&self) -> Result<Vec<SessionInfo>, SessionError> {
        let sessions = self.sessions.lock().map_err(|_| SessionError::LockError)?;

        Ok(sessions
            .values()
            .filter(|s| {
                s.info.status == SessionStatus::Initializing
                    || s.info.status == SessionStatus::Working
            })
            .map(|s| s.info.clone())
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_session() {
        let manager = SessionManager::new();

        let result = manager.create_session(
            "test-1".to_string(),
            "/path/to/repo".to_string(),
            "Add feature".to_string(),
            PathBuf::from("/tmp/session-test-1"),
            "claude/feature-123".to_string(),
        );

        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.id, "test-1");
        assert_eq!(info.status, SessionStatus::Initializing);
    }

    #[test]
    fn test_create_duplicate_session() {
        let manager = SessionManager::new();

        manager
            .create_session(
                "test-1".to_string(),
                "/path/to/repo".to_string(),
                "Add feature".to_string(),
                PathBuf::from("/tmp/session-test-1"),
                "claude/feature-123".to_string(),
            )
            .unwrap();

        let result = manager.create_session(
            "test-1".to_string(),
            "/path/to/repo".to_string(),
            "Add feature".to_string(),
            PathBuf::from("/tmp/session-test-1"),
            "claude/feature-123".to_string(),
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_get_session_info() {
        let manager = SessionManager::new();

        manager
            .create_session(
                "test-1".to_string(),
                "/path/to/repo".to_string(),
                "Add feature".to_string(),
                PathBuf::from("/tmp/session-test-1"),
                "claude/feature-123".to_string(),
            )
            .unwrap();

        let result = manager.get_session_info("test-1");
        assert!(result.is_ok());
        assert_eq!(result.unwrap().id, "test-1");
    }

    #[test]
    fn test_get_nonexistent_session() {
        let manager = SessionManager::new();

        let result = manager.get_session_info("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_set_working() {
        let manager = SessionManager::new();

        manager
            .create_session(
                "test-1".to_string(),
                "/path/to/repo".to_string(),
                "Add feature".to_string(),
                PathBuf::from("/tmp/session-test-1"),
                "claude/feature-123".to_string(),
            )
            .unwrap();

        manager.set_working("test-1", 12345).unwrap();

        let info = manager.get_session_info("test-1").unwrap();
        assert_eq!(info.status, SessionStatus::Working);

        let process_id = manager.get_process_id("test-1").unwrap();
        assert_eq!(process_id, Some(12345));
    }

    #[test]
    fn test_set_completed() {
        let manager = SessionManager::new();

        manager
            .create_session(
                "test-1".to_string(),
                "/path/to/repo".to_string(),
                "Add feature".to_string(),
                PathBuf::from("/tmp/session-test-1"),
                "claude/feature-123".to_string(),
            )
            .unwrap();

        manager
            .set_completed("test-1", "https://github.com/owner/repo/pull/1".to_string())
            .unwrap();

        let info = manager.get_session_info("test-1").unwrap();
        assert_eq!(info.status, SessionStatus::Completed);
        assert_eq!(
            info.pr_url,
            Some("https://github.com/owner/repo/pull/1".to_string())
        );
    }

    #[test]
    fn test_set_error() {
        let manager = SessionManager::new();

        manager
            .create_session(
                "test-1".to_string(),
                "/path/to/repo".to_string(),
                "Add feature".to_string(),
                PathBuf::from("/tmp/session-test-1"),
                "claude/feature-123".to_string(),
            )
            .unwrap();

        manager
            .set_error("test-1", "Something failed".to_string())
            .unwrap();

        let info = manager.get_session_info("test-1").unwrap();
        assert_eq!(info.status, SessionStatus::Error);
        assert_eq!(info.error_message, Some("Something failed".to_string()));
    }

    #[test]
    fn test_remove_session() {
        let manager = SessionManager::new();

        manager
            .create_session(
                "test-1".to_string(),
                "/path/to/repo".to_string(),
                "Add feature".to_string(),
                PathBuf::from("/tmp/session-test-1"),
                "claude/feature-123".to_string(),
            )
            .unwrap();

        let result = manager.remove_session("test-1");
        assert!(result.is_ok());

        let result = manager.get_session_info("test-1");
        assert!(result.is_err());
    }

    #[test]
    fn test_list_sessions() {
        let manager = SessionManager::new();

        manager
            .create_session(
                "test-1".to_string(),
                "/path/to/repo".to_string(),
                "Add feature".to_string(),
                PathBuf::from("/tmp/session-test-1"),
                "claude/feature-123".to_string(),
            )
            .unwrap();

        manager
            .create_session(
                "test-2".to_string(),
                "/path/to/repo".to_string(),
                "Fix bug".to_string(),
                PathBuf::from("/tmp/session-test-2"),
                "claude/bugfix-456".to_string(),
            )
            .unwrap();

        let sessions = manager.list_sessions().unwrap();
        assert_eq!(sessions.len(), 2);
    }

    #[test]
    fn test_get_active_sessions() {
        let manager = SessionManager::new();

        manager
            .create_session(
                "test-1".to_string(),
                "/path/to/repo".to_string(),
                "Add feature".to_string(),
                PathBuf::from("/tmp/session-test-1"),
                "claude/feature-123".to_string(),
            )
            .unwrap();

        manager
            .create_session(
                "test-2".to_string(),
                "/path/to/repo".to_string(),
                "Fix bug".to_string(),
                PathBuf::from("/tmp/session-test-2"),
                "claude/bugfix-456".to_string(),
            )
            .unwrap();

        manager.set_working("test-1", 12345).unwrap();
        manager
            .set_completed("test-2", "https://github.com/owner/repo/pull/1".to_string())
            .unwrap();

        let active = manager.get_active_sessions().unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, "test-1");
    }
}

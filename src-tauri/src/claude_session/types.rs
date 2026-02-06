use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Initializing,
    Working,
    Completed,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub status: SessionStatus,
    pub pr_url: Option<String>,
    pub error_message: Option<String>,
    pub git_directory: String,
    pub instructions: String,
    pub created_at: u64,
}

#[derive(Debug)]
pub struct Session {
    pub info: SessionInfo,
    pub work_dir: PathBuf,
    pub branch_name: String,
    pub process_id: Option<u32>,
}

impl Session {
    pub fn new(
        id: String,
        git_directory: String,
        instructions: String,
        work_dir: PathBuf,
        branch_name: String,
    ) -> Self {
        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            info: SessionInfo {
                id,
                status: SessionStatus::Initializing,
                pr_url: None,
                error_message: None,
                git_directory,
                instructions,
                created_at,
            },
            work_dir,
            branch_name,
            process_id: None,
        }
    }

    pub fn set_status(&mut self, status: SessionStatus) {
        self.info.status = status;
    }

    pub fn set_working(&mut self, process_id: u32) {
        self.info.status = SessionStatus::Working;
        self.process_id = Some(process_id);
    }

    pub fn set_completed(&mut self, pr_url: String) {
        self.info.status = SessionStatus::Completed;
        self.info.pr_url = Some(pr_url);
        self.process_id = None;
    }

    pub fn set_error(&mut self, message: String) {
        self.info.status = SessionStatus::Error;
        self.info.error_message = Some(message);
        self.process_id = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_new() {
        let session = Session::new(
            "test-id".to_string(),
            "/path/to/repo".to_string(),
            "Add feature X".to_string(),
            PathBuf::from("/tmp/session-test"),
            "claude/feature-123".to_string(),
        );

        assert_eq!(session.info.id, "test-id");
        assert_eq!(session.info.status, SessionStatus::Initializing);
        assert!(session.info.pr_url.is_none());
        assert!(session.info.error_message.is_none());
    }

    #[test]
    fn test_session_set_working() {
        let mut session = Session::new(
            "test-id".to_string(),
            "/path/to/repo".to_string(),
            "Add feature X".to_string(),
            PathBuf::from("/tmp/session-test"),
            "claude/feature-123".to_string(),
        );

        session.set_working(12345);

        assert_eq!(session.info.status, SessionStatus::Working);
        assert_eq!(session.process_id, Some(12345));
    }

    #[test]
    fn test_session_set_completed() {
        let mut session = Session::new(
            "test-id".to_string(),
            "/path/to/repo".to_string(),
            "Add feature X".to_string(),
            PathBuf::from("/tmp/session-test"),
            "claude/feature-123".to_string(),
        );

        session.set_completed("https://github.com/owner/repo/pull/123".to_string());

        assert_eq!(session.info.status, SessionStatus::Completed);
        assert_eq!(
            session.info.pr_url,
            Some("https://github.com/owner/repo/pull/123".to_string())
        );
    }

    #[test]
    fn test_session_set_error() {
        let mut session = Session::new(
            "test-id".to_string(),
            "/path/to/repo".to_string(),
            "Add feature X".to_string(),
            PathBuf::from("/tmp/session-test"),
            "claude/feature-123".to_string(),
        );

        session.set_error("Something went wrong".to_string());

        assert_eq!(session.info.status, SessionStatus::Error);
        assert_eq!(
            session.info.error_message,
            Some("Something went wrong".to_string())
        );
    }
}

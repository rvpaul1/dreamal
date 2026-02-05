pub mod clone;

use std::fs;
use std::path::PathBuf;

#[derive(Debug)]
pub enum GitOpsError {
    HomeNotFound,
    IoError(std::io::Error),
    GitError(String),
    SessionExists(String),
}

impl std::fmt::Display for GitOpsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GitOpsError::HomeNotFound => write!(f, "Could not determine home directory"),
            GitOpsError::IoError(e) => write!(f, "IO error: {}", e),
            GitOpsError::GitError(msg) => write!(f, "Git error: {}", msg),
            GitOpsError::SessionExists(id) => write!(f, "Session already exists: {}", id),
        }
    }
}

impl From<std::io::Error> for GitOpsError {
    fn from(e: std::io::Error) -> Self {
        GitOpsError::IoError(e)
    }
}

pub fn get_dreamal_dir() -> Result<PathBuf, GitOpsError> {
    dirs::home_dir()
        .map(|home| home.join(".dreamal"))
        .ok_or(GitOpsError::HomeNotFound)
}

pub fn get_temp_checkouts_dir() -> Result<PathBuf, GitOpsError> {
    Ok(get_dreamal_dir()?.join("temp-checkouts"))
}

pub fn ensure_temp_checkouts_dir() -> Result<PathBuf, GitOpsError> {
    let path = get_temp_checkouts_dir()?;
    fs::create_dir_all(&path)?;
    Ok(path)
}

pub fn get_session_dir(session_id: &str) -> Result<PathBuf, GitOpsError> {
    Ok(get_temp_checkouts_dir()?.join(format!("session-{}", session_id)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_dreamal_dir() {
        let result = get_dreamal_dir();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.ends_with(".dreamal"));
    }

    #[test]
    fn test_get_temp_checkouts_dir() {
        let result = get_temp_checkouts_dir();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.ends_with("temp-checkouts"));
    }

    #[test]
    fn test_ensure_temp_checkouts_dir() {
        let result = ensure_temp_checkouts_dir();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.exists());
    }

    #[test]
    fn test_get_session_dir() {
        let result = get_session_dir("test-123");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.ends_with("session-test-123"));
    }
}

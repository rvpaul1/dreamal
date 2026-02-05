use std::fs;
use std::path::{Path, PathBuf};

use super::{ensure_temp_checkouts_dir, get_session_dir, GitOpsError};

impl From<git2::Error> for GitOpsError {
    fn from(e: git2::Error) -> Self {
        GitOpsError::GitError(e.message().to_string())
    }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

pub fn clone_to_temp(source_path: &Path, session_id: &str) -> Result<PathBuf, GitOpsError> {
    ensure_temp_checkouts_dir()?;

    let session_dir = get_session_dir(session_id)?;

    if session_dir.exists() {
        return Err(GitOpsError::SessionExists(session_id.to_string()));
    }

    copy_dir_recursive(source_path, &session_dir)?;

    git2::Repository::open(&session_dir)?;

    Ok(session_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_test_repo() -> (tempfile::TempDir, PathBuf) {
        let temp_dir = tempfile::tempdir().unwrap();
        let repo_path = temp_dir.path().to_path_buf();

        let repo = git2::Repository::init(&repo_path).unwrap();

        let file_path = repo_path.join("test.txt");
        fs::write(&file_path, "hello world").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("test.txt")).unwrap();
        index.write().unwrap();

        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();

        let sig = git2::Signature::now("Test", "test@test.com").unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
            .unwrap();

        (temp_dir, repo_path)
    }

    #[test]
    fn test_clone_to_temp() {
        let (_temp_dir, source_path) = setup_test_repo();
        let session_id = format!("test-{}", uuid::Uuid::new_v4());

        let result = clone_to_temp(&source_path, &session_id);
        assert!(result.is_ok());

        let cloned_path = result.unwrap();
        assert!(cloned_path.exists());

        let repo = git2::Repository::open(&cloned_path);
        assert!(repo.is_ok());

        let test_file = cloned_path.join("test.txt");
        assert!(test_file.exists());
        assert_eq!(fs::read_to_string(&test_file).unwrap(), "hello world");

        fs::remove_dir_all(&cloned_path).unwrap();
    }

    #[test]
    fn test_clone_to_temp_preserves_history() {
        let (_temp_dir, source_path) = setup_test_repo();
        let session_id = format!("test-{}", uuid::Uuid::new_v4());

        let cloned_path = clone_to_temp(&source_path, &session_id).unwrap();

        let repo = git2::Repository::open(&cloned_path).unwrap();
        let head = repo.head().unwrap();
        let commit = head.peel_to_commit().unwrap();

        assert_eq!(commit.message().unwrap(), "Initial commit");

        fs::remove_dir_all(&cloned_path).unwrap();
    }

    #[test]
    fn test_clone_to_temp_session_exists() {
        let (_temp_dir, source_path) = setup_test_repo();
        let session_id = format!("test-{}", uuid::Uuid::new_v4());

        let cloned_path = clone_to_temp(&source_path, &session_id).unwrap();

        let result = clone_to_temp(&source_path, &session_id);
        assert!(result.is_err());

        fs::remove_dir_all(&cloned_path).unwrap();
    }
}

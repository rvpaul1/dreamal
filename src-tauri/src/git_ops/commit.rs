use std::path::Path;
use std::process::Command;

use super::GitOpsError;

pub fn stage_all_changes(repo_path: &Path) -> Result<(), GitOpsError> {
    let repo = git2::Repository::open(repo_path)?;
    let mut index = repo.index()?;

    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;

    Ok(())
}

pub fn create_commit(repo_path: &Path, message: &str) -> Result<git2::Oid, GitOpsError> {
    let repo = git2::Repository::open(repo_path)?;
    let mut index = repo.index()?;

    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    let sig = repo
        .signature()
        .or_else(|_| git2::Signature::now("Claude", "claude@dreamal.app"))?;

    let parent_commit = repo.head()?.peel_to_commit()?;

    let commit_id = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[&parent_commit])?;

    Ok(commit_id)
}

pub fn push_to_remote(repo_path: &Path, branch_name: &str) -> Result<(), GitOpsError> {
    let output = Command::new("git")
        .current_dir(repo_path)
        .args(["push", "-u", "origin", branch_name])
        .output()
        .map_err(|e| GitOpsError::GitError(format!("Failed to run git push: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(GitOpsError::GitError(format!("git push failed: {}", stderr)));
    }

    Ok(())
}

pub fn commit_and_push(repo_path: &Path, message: &str) -> Result<(), GitOpsError> {
    stage_all_changes(repo_path)?;
    create_commit(repo_path, message)?;

    let repo = git2::Repository::open(repo_path)?;
    let head = repo.head()?;
    let branch_name = head
        .shorthand()
        .ok_or_else(|| GitOpsError::GitError("Could not get branch name".to_string()))?;

    push_to_remote(repo_path, branch_name)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_test_repo() -> (tempfile::TempDir, std::path::PathBuf) {
        let temp_dir = tempfile::tempdir().unwrap();
        let repo_path = temp_dir.path().to_path_buf();

        let repo = git2::Repository::init(&repo_path).unwrap();

        repo.config()
            .unwrap()
            .set_str("user.name", "Test User")
            .unwrap();
        repo.config()
            .unwrap()
            .set_str("user.email", "test@test.com")
            .unwrap();

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
    fn test_stage_all_changes() {
        let (_temp_dir, repo_path) = setup_test_repo();

        fs::write(repo_path.join("new_file.txt"), "new content").unwrap();
        fs::write(repo_path.join("test.txt"), "modified content").unwrap();

        let result = stage_all_changes(&repo_path);
        assert!(result.is_ok());

        let repo = git2::Repository::open(&repo_path).unwrap();
        let index = repo.index().unwrap();

        let new_file_entry = index
            .iter()
            .find(|e| String::from_utf8_lossy(&e.path) == "new_file.txt");
        assert!(new_file_entry.is_some());
    }

    #[test]
    fn test_create_commit() {
        let (_temp_dir, repo_path) = setup_test_repo();

        fs::write(repo_path.join("new_file.txt"), "new content").unwrap();
        stage_all_changes(&repo_path).unwrap();

        let result = create_commit(&repo_path, "Add new file");
        assert!(result.is_ok());

        let repo = git2::Repository::open(&repo_path).unwrap();
        let head = repo.head().unwrap().peel_to_commit().unwrap();

        assert_eq!(head.message().unwrap(), "Add new file");
    }

    #[test]
    fn test_create_commit_uses_repo_signature() {
        let (_temp_dir, repo_path) = setup_test_repo();

        fs::write(repo_path.join("another.txt"), "content").unwrap();
        stage_all_changes(&repo_path).unwrap();
        create_commit(&repo_path, "Test commit").unwrap();

        let repo = git2::Repository::open(&repo_path).unwrap();
        let head = repo.head().unwrap().peel_to_commit().unwrap();

        assert_eq!(head.author().name().unwrap(), "Test User");
    }
}

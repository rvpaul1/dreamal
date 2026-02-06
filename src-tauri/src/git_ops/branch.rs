use std::path::Path;

use super::GitOpsError;

pub fn create_feature_branch(repo_path: &Path, branch_name: &str) -> Result<(), GitOpsError> {
    let repo = git2::Repository::open(repo_path)?;

    let head = repo.head()?;
    let head_commit = head.peel_to_commit()?;

    let branch = repo.branch(branch_name, &head_commit, false)?;

    let refname = branch
        .into_reference()
        .name()
        .ok_or_else(|| GitOpsError::GitError("Invalid branch reference".to_string()))?
        .to_string();

    repo.set_head(&refname)?;
    repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;

    Ok(())
}

pub fn generate_branch_name(description: &str) -> String {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let slug: String = description
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
        .chars()
        .take(30)
        .collect();

    format!("claude/{}-{}", slug, timestamp)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_test_repo() -> (tempfile::TempDir, std::path::PathBuf) {
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
    fn test_create_feature_branch() {
        let (_temp_dir, repo_path) = setup_test_repo();

        let result = create_feature_branch(&repo_path, "claude/test-feature-123");
        assert!(result.is_ok());

        let repo = git2::Repository::open(&repo_path).unwrap();
        let head = repo.head().unwrap();
        assert!(head.is_branch());
        assert_eq!(
            head.shorthand().unwrap(),
            "claude/test-feature-123"
        );
    }

    #[test]
    fn test_create_feature_branch_preserves_commit() {
        let (_temp_dir, repo_path) = setup_test_repo();

        let repo = git2::Repository::open(&repo_path).unwrap();
        let original_commit = repo.head().unwrap().peel_to_commit().unwrap().id();

        create_feature_branch(&repo_path, "claude/test-feature").unwrap();

        let repo = git2::Repository::open(&repo_path).unwrap();
        let new_commit = repo.head().unwrap().peel_to_commit().unwrap().id();

        assert_eq!(original_commit, new_commit);
    }

    #[test]
    fn test_generate_branch_name() {
        let name = generate_branch_name("Add dark mode toggle");
        assert!(name.starts_with("claude/add-dark-mode-toggle-"));
    }

    #[test]
    fn test_generate_branch_name_special_chars() {
        let name = generate_branch_name("Fix bug #123: user's profile");
        assert!(name.starts_with("claude/fix-bug-123-user-s-profile-"));
    }

    #[test]
    fn test_generate_branch_name_truncates_long_description() {
        let name = generate_branch_name("This is a very long description that should be truncated");
        let parts: Vec<&str> = name.rsplitn(2, '-').collect();
        let slug_part = parts[1].strip_prefix("claude/").unwrap();
        assert!(slug_part.len() <= 30);
    }
}

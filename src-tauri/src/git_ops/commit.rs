use std::path::Path;

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

fn get_credentials_callback(
) -> impl FnMut(&str, Option<&str>, git2::CredentialType) -> Result<git2::Cred, git2::Error> {
    let mut tried_ssh_agent = false;
    let mut tried_ssh_key = false;

    move |url: &str, username: Option<&str>, allowed_types: git2::CredentialType| {
        let username = username.unwrap_or("git");

        if allowed_types.contains(git2::CredentialType::SSH_KEY) && !tried_ssh_agent {
            tried_ssh_agent = true;
            if let Ok(cred) = git2::Cred::ssh_key_from_agent(username) {
                return Ok(cred);
            }
        }

        if allowed_types.contains(git2::CredentialType::SSH_KEY) && !tried_ssh_key {
            tried_ssh_key = true;
            let home = dirs::home_dir().ok_or_else(|| {
                git2::Error::from_str("Could not find home directory")
            })?;

            let key_paths = [
                home.join(".ssh/id_ed25519"),
                home.join(".ssh/id_rsa"),
            ];

            for key_path in &key_paths {
                if key_path.exists() {
                    if let Ok(cred) = git2::Cred::ssh_key(username, None, key_path, None) {
                        return Ok(cred);
                    }
                }
            }
        }

        if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            if let Ok(cred) = git2::Cred::credential_helper(
                &git2::Config::open_default()?,
                url,
                Some(username),
            ) {
                return Ok(cred);
            }
        }

        if allowed_types.contains(git2::CredentialType::DEFAULT) {
            return git2::Cred::default();
        }

        Err(git2::Error::from_str("No valid credentials found"))
    }
}

pub fn push_to_remote(repo_path: &Path, branch_name: &str) -> Result<(), GitOpsError> {
    let repo = git2::Repository::open(repo_path)?;

    let mut remote = repo
        .find_remote("origin")
        .map_err(|_| GitOpsError::GitError("Remote 'origin' not found".to_string()))?;

    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(get_credentials_callback());

    let mut push_options = git2::PushOptions::new();
    push_options.remote_callbacks(callbacks);

    remote.push(&[&refspec], Some(&mut push_options))?;

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

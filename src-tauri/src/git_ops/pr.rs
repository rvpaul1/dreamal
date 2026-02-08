use std::fs;
use std::path::Path;
use std::process::Command;

use super::{get_dreamal_dir, GitOpsError};

fn get_github_token() -> Result<String, GitOpsError> {
    if let Ok(dreamal_dir) = get_dreamal_dir() {
        let creds_path = dreamal_dir.join("credentials.json");
        if let Ok(content) = fs::read_to_string(&creds_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(token) = json.get("github_token").and_then(|v| v.as_str()) {
                    if !token.is_empty() {
                        return Ok(token.to_string());
                    }
                }
            }
        }
    }

    if let Ok(output) = Command::new("gh").args(["auth", "token"]).output() {
        if output.status.success() {
            let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !token.is_empty() {
                return Ok(token);
            }
        }
    }

    std::env::var("GITHUB_TOKEN").map_err(|_| {
        GitOpsError::AuthError(
            "No GitHub token found. Add github_token to ~/.dreamal/credentials.json".to_string(),
        )
    })
}

#[derive(Debug)]
pub struct RepoInfo {
    pub owner: String,
    pub repo: String,
}

pub fn parse_github_remote(remote_url: &str) -> Result<RepoInfo, GitOpsError> {
    let url = remote_url.trim();

    // SSH format: git@github.com:owner/repo.git or git@alias.github.com:owner/repo.git
    if url.starts_with("git@") && url.contains("github.com:") {
        if let Some(path_start) = url.find(':') {
            let path = &url[path_start + 1..];
            let path = path.strip_suffix(".git").unwrap_or(path);
            let parts: Vec<&str> = path.split('/').collect();
            if parts.len() == 2 {
                return Ok(RepoInfo {
                    owner: parts[0].to_string(),
                    repo: parts[1].to_string(),
                });
            }
        }
    }

    // HTTPS format: https://github.com/owner/repo.git
    if url.starts_with("https://github.com/") {
        let path = url.strip_prefix("https://github.com/").unwrap();
        let path = path.strip_suffix(".git").unwrap_or(path);
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() >= 2 {
            return Ok(RepoInfo {
                owner: parts[0].to_string(),
                repo: parts[1].to_string(),
            });
        }
    }

    Err(GitOpsError::GitError(format!(
        "Could not parse GitHub remote URL: {}",
        url
    )))
}

pub fn get_remote_url(repo_path: &Path) -> Result<String, GitOpsError> {
    let repo = git2::Repository::open(repo_path)?;
    let remote = repo.find_remote("origin")?;
    let url = remote
        .url()
        .ok_or_else(|| GitOpsError::GitError("Remote 'origin' has no URL".to_string()))?;
    Ok(url.to_string())
}

pub fn create_pull_request(
    repo_path: &Path,
    title: &str,
    body: &str,
    head_branch: &str,
    base_branch: &str,
) -> Result<String, GitOpsError> {
    let remote_url = get_remote_url(repo_path)?;
    let repo_info = parse_github_remote(&remote_url)?;
    let token = get_github_token()?;

    let client = reqwest::blocking::Client::new();

    let response = client
        .post(format!(
            "https://api.github.com/repos/{}/{}/pulls",
            repo_info.owner, repo_info.repo
        ))
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "dreamal-app")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&serde_json::json!({
            "title": title,
            "body": body,
            "head": head_branch,
            "base": base_branch
        }))
        .send()
        .map_err(|e| GitOpsError::NetworkError(e.to_string()))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().unwrap_or_default();
        return Err(GitOpsError::GitError(format!(
            "GitHub API error ({}): {}",
            status, error_body
        )));
    }

    let json: serde_json::Value = response
        .json()
        .map_err(|e| GitOpsError::NetworkError(e.to_string()))?;

    let pr_url = json["html_url"]
        .as_str()
        .ok_or_else(|| GitOpsError::GitError("No PR URL in response".to_string()))?;

    Ok(pr_url.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_github_remote_ssh() {
        let result = parse_github_remote("git@github.com:owner/repo.git");
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.owner, "owner");
        assert_eq!(info.repo, "repo");
    }

    #[test]
    fn test_parse_github_remote_ssh_no_git_suffix() {
        let result = parse_github_remote("git@github.com:owner/repo");
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.owner, "owner");
        assert_eq!(info.repo, "repo");
    }

    #[test]
    fn test_parse_github_remote_https() {
        let result = parse_github_remote("https://github.com/owner/repo.git");
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.owner, "owner");
        assert_eq!(info.repo, "repo");
    }

    #[test]
    fn test_parse_github_remote_https_no_git_suffix() {
        let result = parse_github_remote("https://github.com/owner/repo");
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.owner, "owner");
        assert_eq!(info.repo, "repo");
    }

    #[test]
    fn test_parse_github_remote_ssh_custom_host() {
        let result = parse_github_remote("git@personal.github.com:owner/repo.git");
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.owner, "owner");
        assert_eq!(info.repo, "repo");
    }

    #[test]
    fn test_parse_github_remote_ssh_custom_host_no_suffix() {
        let result = parse_github_remote("git@work.github.com:myorg/myrepo");
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.owner, "myorg");
        assert_eq!(info.repo, "myrepo");
    }

    #[test]
    fn test_parse_github_remote_invalid() {
        let result = parse_github_remote("https://gitlab.com/owner/repo");
        assert!(result.is_err());
    }
}

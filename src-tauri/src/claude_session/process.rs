use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Child, Command, ExitStatus, Stdio};

#[derive(Debug)]
pub enum ProcessError {
    SpawnFailed(String),
    IoError(std::io::Error),
    ProcessFailed { exit_code: Option<i32>, stderr: String },
}

impl std::fmt::Display for ProcessError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProcessError::SpawnFailed(msg) => write!(f, "Failed to spawn Claude: {}", msg),
            ProcessError::IoError(e) => write!(f, "IO error: {}", e),
            ProcessError::ProcessFailed { exit_code, stderr } => {
                write!(f, "Claude process failed (exit code: {:?}): {}", exit_code, stderr)
            }
        }
    }
}

impl From<std::io::Error> for ProcessError {
    fn from(e: std::io::Error) -> Self {
        ProcessError::IoError(e)
    }
}

// TODO: Make this configurable via .dreamal/allowed-commands.json in the target repo
const ALLOWED_COMMANDS: &[&str] = &[
    "npm run test",
    "npm run test:run",
    "npm test",
    "cargo test",
    "go test",
    "pytest",
    "jest",
];

// TODO: Make the system prompt suffix configurable via settings
pub fn compose_instructions(
    user_instructions: &str,
    additional_instructions: Option<&str>,
    instructions_file_content: Option<&str>,
) -> String {
    let mut full_instructions = String::new();

    full_instructions.push_str(user_instructions);

    if let Some(additional) = additional_instructions {
        if !additional.trim().is_empty() {
            full_instructions.push_str("\n\n## Additional Instructions\n");
            full_instructions.push_str(additional);
        }
    }

    if let Some(file_content) = instructions_file_content {
        if !file_content.trim().is_empty() {
            full_instructions.push_str("\n\n## Instructions from File\n");
            full_instructions.push_str(file_content);
        }
    }

    full_instructions.push_str("\n\n## Important Guidelines\n");
    full_instructions.push_str("- Make the requested changes to the codebase\n");
    full_instructions.push_str("- Run tests to verify your changes work correctly\n");
    full_instructions.push_str("- Do NOT perform any git operations (no git add, commit, push, branch, etc.)\n");
    full_instructions.push_str("- When you have completed all changes and tests pass, simply stop working\n");

    full_instructions
}

pub fn build_claude_command(work_dir: &Path, instructions: &str) -> Command {
    let mut cmd = Command::new("claude");

    let allowed_commands_str = ALLOWED_COMMANDS.join(",");

    cmd.current_dir(work_dir)
        .arg("--print")
        .arg("--allowedTools")
        .arg("Edit,Write,Read,Bash")
        .arg("--permission-prompt-tool")
        .arg("Bash")
        .arg("--allowedCommands")
        .arg(&allowed_commands_str)
        .arg("-p")
        .arg(instructions)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    cmd
}

pub fn spawn_claude_process(work_dir: &Path, instructions: &str) -> Result<Child, ProcessError> {
    let mut cmd = build_claude_command(work_dir, instructions);

    cmd.spawn().map_err(|e| {
        ProcessError::SpawnFailed(format!("Failed to spawn claude process: {}", e))
    })
}

pub fn kill_process(process_id: u32) -> Result<(), ProcessError> {
    #[cfg(unix)]
    {
        use std::process::Command;
        Command::new("kill")
            .arg("-9")
            .arg(process_id.to_string())
            .output()?;
    }

    #[cfg(windows)]
    {
        use std::process::Command;
        Command::new("taskkill")
            .args(["/F", "/PID", &process_id.to_string()])
            .output()?;
    }

    Ok(())
}

#[derive(Debug)]
pub struct ProcessResult {
    pub exit_status: ExitStatus,
    pub stdout: String,
    pub stderr: String,
}

pub fn wait_for_process(mut child: Child) -> Result<ProcessResult, ProcessError> {
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let stdout_content = if let Some(stdout) = stdout {
        let reader = BufReader::new(stdout);
        reader.lines().filter_map(|l| l.ok()).collect::<Vec<_>>().join("\n")
    } else {
        String::new()
    };

    let stderr_content = if let Some(stderr) = stderr {
        let reader = BufReader::new(stderr);
        reader.lines().filter_map(|l| l.ok()).collect::<Vec<_>>().join("\n")
    } else {
        String::new()
    };

    let exit_status = child.wait()?;

    Ok(ProcessResult {
        exit_status,
        stdout: stdout_content,
        stderr: stderr_content,
    })
}

pub fn run_claude_and_wait(
    work_dir: &Path,
    instructions: &str,
) -> Result<ProcessResult, ProcessError> {
    let child = spawn_claude_process(work_dir, instructions)?;
    let result = wait_for_process(child)?;

    if !result.exit_status.success() {
        return Err(ProcessError::ProcessFailed {
            exit_code: result.exit_status.code(),
            stderr: result.stderr.clone(),
        });
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compose_instructions_basic() {
        let instructions = compose_instructions("Add dark mode", None, None);

        assert!(instructions.contains("Add dark mode"));
        assert!(instructions.contains("Do NOT perform any git operations"));
    }

    #[test]
    fn test_compose_instructions_with_additional() {
        let instructions = compose_instructions(
            "Add dark mode",
            Some("Use CSS variables for theming"),
            None,
        );

        assert!(instructions.contains("Add dark mode"));
        assert!(instructions.contains("Use CSS variables for theming"));
        assert!(instructions.contains("Additional Instructions"));
    }

    #[test]
    fn test_compose_instructions_with_file_content() {
        let instructions = compose_instructions(
            "Add dark mode",
            None,
            Some("# Detailed Requirements\n- Support system preference"),
        );

        assert!(instructions.contains("Add dark mode"));
        assert!(instructions.contains("Detailed Requirements"));
        assert!(instructions.contains("Instructions from File"));
    }

    #[test]
    fn test_compose_instructions_full() {
        let instructions = compose_instructions(
            "Add dark mode",
            Some("Additional context here"),
            Some("File content here"),
        );

        assert!(instructions.contains("Add dark mode"));
        assert!(instructions.contains("Additional context here"));
        assert!(instructions.contains("File content here"));
    }

    #[test]
    fn test_build_claude_command() {
        let work_dir = std::path::PathBuf::from("/tmp/test");
        let cmd = build_claude_command(&work_dir, "Test instructions");

        let program = cmd.get_program();
        assert_eq!(program, "claude");

        let args: Vec<_> = cmd.get_args().collect();
        assert!(args.contains(&std::ffi::OsStr::new("--print")));
        assert!(args.contains(&std::ffi::OsStr::new("--allowedTools")));
        assert!(args.contains(&std::ffi::OsStr::new("--permission-prompt-tool")));
        assert!(args.contains(&std::ffi::OsStr::new("--allowedCommands")));
        assert!(args.contains(&std::ffi::OsStr::new("-p")));
    }

    #[test]
    fn test_allowed_commands() {
        assert!(ALLOWED_COMMANDS.contains(&"npm run test"));
        assert!(ALLOWED_COMMANDS.contains(&"cargo test"));
        assert!(!ALLOWED_COMMANDS.contains(&"rm -rf /"));
    }

    #[test]
    fn test_wait_for_process_success() {
        let child = Command::new("echo")
            .arg("hello")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();

        let result = wait_for_process(child).unwrap();
        assert!(result.exit_status.success());
        assert!(result.stdout.contains("hello"));
    }

    #[test]
    fn test_wait_for_process_failure() {
        let child = Command::new("sh")
            .arg("-c")
            .arg("exit 1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();

        let result = wait_for_process(child).unwrap();
        assert!(!result.exit_status.success());
    }

    #[test]
    fn test_process_result_struct() {
        let result = ProcessResult {
            exit_status: Command::new("true").status().unwrap(),
            stdout: "output".to_string(),
            stderr: "".to_string(),
        };

        assert!(result.exit_status.success());
        assert_eq!(result.stdout, "output");
    }
}

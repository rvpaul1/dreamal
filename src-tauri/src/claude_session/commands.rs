use std::sync::Arc;
use tauri::State;

use super::manager::SessionManager;
use super::orchestrator::{run_full_session, SessionConfig};
use super::process::kill_process;
use super::types::SessionInfo;
use crate::git_ops::cleanup::cleanup_session;

pub struct AppState {
    pub session_manager: Arc<SessionManager>,
}

#[tauri::command]
pub async fn spawn_claude_session(
    state: State<'_, AppState>,
    git_directory: String,
    instructions: String,
    additional_instructions: Option<String>,
    instructions_file_content: Option<String>,
    base_branch: Option<String>,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let base_branch = base_branch.unwrap_or_else(|| "main".to_string());

    let work_dir = crate::git_ops::get_session_dir(&session_id)
        .map_err(|e| e.to_string())?;

    state
        .session_manager
        .create_session(
            session_id.clone(),
            git_directory.clone(),
            instructions.clone(),
            work_dir,
            String::new(),
        )
        .map_err(|e| e.to_string())?;

    let session_manager = state.session_manager.clone();
    let session_id_clone = session_id.clone();

    std::thread::spawn(move || {
        let config = SessionConfig {
            session_id: session_id_clone.clone(),
            git_directory,
            user_instructions: instructions,
            additional_instructions,
            instructions_file_content,
            base_branch,
        };

        match run_full_session(config) {
            Ok(result) => {
                let _ = session_manager.set_completed(&session_id_clone, result.pr_url);
            }
            Err(e) => {
                let _ = session_manager.set_error(&session_id_clone, e.to_string());
                let _ = cleanup_session(&session_id_clone);
            }
        }
    });

    state
        .session_manager
        .set_working(&session_id, 0)
        .map_err(|e| e.to_string())?;

    Ok(session_id)
}

#[tauri::command]
pub fn get_session_status(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<SessionInfo, String> {
    state
        .session_manager
        .get_session_info(&session_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_session(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    let process_id = state
        .session_manager
        .get_process_id(&session_id)
        .map_err(|e| e.to_string())?;

    if let Some(pid) = process_id {
        kill_process(pid).map_err(|e| e.to_string())?;
    }

    cleanup_session(&session_id).map_err(|e| e.to_string())?;

    state
        .session_manager
        .set_error(&session_id, "Session cancelled by user".to_string())
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn list_claude_sessions(state: State<'_, AppState>) -> Result<Vec<SessionInfo>, String> {
    state
        .session_manager
        .list_sessions()
        .map_err(|e| e.to_string())
}

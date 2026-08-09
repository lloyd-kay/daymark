use std::fs;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::contracts::{ControlError, RuntimeMode};
use crate::elevation::{run_elevated_service_action, ServiceAction};

#[derive(Clone, Debug)]
pub struct RuntimePaths {
    pub install_dir: PathBuf,
    pub data_dir: PathBuf,
    pub settings_file: PathBuf,
    pub service_wrapper: PathBuf,
    pub runtime_launcher: PathBuf,
    pub node_executable: PathBuf,
    pub runtime_cli: PathBuf,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
struct ControlSettings {
    mode: RuntimeMode,
}

impl Default for ControlSettings {
    fn default() -> Self {
        Self {
            mode: RuntimeMode::Service,
        }
    }
}

pub struct ServiceController {
    paths: RuntimePaths,
    manual_child: Mutex<Option<Child>>,
}

impl ServiceController {
    pub fn new() -> Self {
        Self {
            paths: runtime_paths(),
            manual_child: Mutex::new(None),
        }
    }

    fn read_mode(&self) -> RuntimeMode {
        fs::read(&self.paths.settings_file)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<ControlSettings>(&bytes).ok())
            .map(|settings| settings.mode)
            .unwrap_or(RuntimeMode::Service)
    }

    fn write_mode(&self, mode: RuntimeMode) -> Result<(), ControlError> {
        let parent = self.paths.settings_file.parent().ok_or_else(|| {
            control_error(
                "settings_path_invalid",
                "Daymark settings could not be located",
            )
        })?;
        fs::create_dir_all(parent).map_err(|_| permission_error())?;

        let temporary = self.paths.settings_file.with_extension("json.new");
        let content = serde_json::to_vec_pretty(&ControlSettings { mode }).map_err(|_| {
            control_error(
                "settings_encode_failed",
                "Daymark settings could not be saved",
            )
        })?;
        fs::write(&temporary, content).map_err(|_| permission_error())?;
        fs::rename(&temporary, &self.paths.settings_file).map_err(|_| permission_error())?;
        Ok(())
    }

    fn start(&self, mode: RuntimeMode) -> Result<(), ControlError> {
        match mode {
            RuntimeMode::Service => self.run_service_action(ServiceAction::Start),
            RuntimeMode::Manual => self.start_manual(),
        }
    }

    fn stop(&self, mode: RuntimeMode) -> Result<(), ControlError> {
        match mode {
            RuntimeMode::Service => self.run_service_action(ServiceAction::Stop),
            RuntimeMode::Manual => self.stop_manual(),
        }
    }

    fn restart(&self, mode: RuntimeMode) -> Result<(), ControlError> {
        match mode {
            RuntimeMode::Service => self.run_service_action(ServiceAction::Restart),
            RuntimeMode::Manual => {
                self.stop_manual()?;
                self.start_manual()
            }
        }
    }

    fn run_service_action(&self, action: ServiceAction) -> Result<(), ControlError> {
        ensure_runtime_file(&self.paths.service_wrapper)?;
        run_elevated_service_action(&self.paths.service_wrapper, action)
    }

    fn start_manual(&self) -> Result<(), ControlError> {
        let mut child_slot = self.manual_child.lock().map_err(|_| {
            control_error(
                "runtime_state_unavailable",
                "Daymark runtime state is unavailable",
            )
        })?;

        if child_slot
            .as_mut()
            .is_some_and(|child| child.try_wait().ok().flatten().is_none())
        {
            return Ok(());
        }

        fs::create_dir_all(&self.paths.data_dir).map_err(|_| permission_error())?;
        ensure_runtime_file(&self.paths.runtime_launcher)?;

        let mut command = Command::new(&self.paths.runtime_launcher);
        command.current_dir(&self.paths.install_dir);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }

        let child = command.spawn().map_err(|_| {
            control_error(
                "manual_runtime_start_failed",
                "Daymark could not start in manual mode. Open Recovery tools for details.",
            )
        })?;
        *child_slot = Some(child);
        Ok(())
    }

    fn stop_manual(&self) -> Result<(), ControlError> {
        let mut child_slot = self.manual_child.lock().map_err(|_| {
            control_error(
                "runtime_state_unavailable",
                "Daymark runtime state is unavailable",
            )
        })?;
        if let Some(mut child) = child_slot.take() {
            child.kill().map_err(|_| {
                control_error(
                    "manual_runtime_stop_failed",
                    "Daymark could not be stopped. Restart Windows before changing application files.",
                )
            })?;
            let _ = child.wait();
        }
        Ok(())
    }
}

impl Drop for ServiceController {
    fn drop(&mut self) {
        if let Ok(slot) = self.manual_child.get_mut() {
            if let Some(child) = slot.as_mut() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

pub fn current_runtime_mode() -> RuntimeMode {
    let paths = runtime_paths();
    fs::read(paths.settings_file)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<ControlSettings>(&bytes).ok())
        .map(|settings| settings.mode)
        .unwrap_or(RuntimeMode::Service)
}

#[tauri::command]
pub fn start_runtime(controller: State<'_, ServiceController>) -> Result<(), ControlError> {
    controller.start(controller.read_mode())
}

#[tauri::command]
pub fn stop_runtime(controller: State<'_, ServiceController>) -> Result<(), ControlError> {
    controller.stop(controller.read_mode())
}

#[tauri::command]
pub fn restart_runtime(controller: State<'_, ServiceController>) -> Result<(), ControlError> {
    controller.restart(controller.read_mode())
}

#[tauri::command]
pub fn set_runtime_mode(
    mode: RuntimeMode,
    controller: State<'_, ServiceController>,
) -> Result<(), ControlError> {
    let previous_mode = controller.read_mode();
    if previous_mode == mode {
        return Ok(());
    }

    let was_running = runtime_is_reachable();
    if was_running {
        controller.stop(previous_mode)?;
    }
    controller.write_mode(mode)?;
    if was_running {
        controller.start(mode)?;
    }
    Ok(())
}

pub(crate) fn runtime_paths() -> RuntimePaths {
    let fallback_executable = std::env::var_os("ProgramFiles")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Program Files"))
        .join("Daymark Control")
        .join("Daymark Control.exe");
    let executable = std::env::current_exe().unwrap_or(fallback_executable);
    let program_data = std::env::var_os("ProgramData")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"));

    runtime_paths_from_executable(&executable, &program_data)
}

pub(crate) fn runtime_paths_from_executable(
    executable: &Path,
    program_data: &Path,
) -> RuntimePaths {
    let install_dir = executable
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from(r"C:\Program Files\Daymark Control"));
    let data_dir = program_data.join("Daymark");

    RuntimePaths {
        settings_file: data_dir.join("control.json"),
        service_wrapper: install_dir.join("DaymarkService.exe"),
        runtime_launcher: install_dir.join("DaymarkRuntime.exe"),
        node_executable: install_dir.join("node").join("node.exe"),
        runtime_cli: install_dir.join("runtime").join("local").join("cli.ts"),
        install_dir,
        data_dir,
    }
}

fn runtime_is_reachable() -> bool {
    TcpStream::connect_timeout(
        &SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 3210),
        Duration::from_millis(500),
    )
    .is_ok()
}

fn ensure_runtime_file(path: &Path) -> Result<(), ControlError> {
    if path.is_file() {
        Ok(())
    } else {
        Err(control_error(
            "runtime_files_missing",
            "Daymark runtime files are missing. Repair the Daymark installation and try again.",
        ))
    }
}

fn permission_error() -> ControlError {
    control_error(
        "settings_permission_denied",
        "Windows administrator approval is required to change Daymark settings.",
    )
}

fn control_error(code: &'static str, message: &'static str) -> ControlError {
    ControlError::new(code, message)
}

#[cfg(test)]
mod tests {
    use super::{restart_runtime, runtime_paths_from_executable};
    use std::path::{Path, PathBuf};

    #[test]
    fn runtime_paths_follow_the_control_executable_and_keep_business_data_separate() {
        let executable = Path::new(r"C:\Program Files\Daymark Control\Daymark Control.exe");
        let program_data = Path::new(r"C:\ProgramData");
        let paths = runtime_paths_from_executable(executable, program_data);

        assert_eq!(
            paths.install_dir,
            PathBuf::from(r"C:\Program Files\Daymark Control")
        );
        assert_eq!(paths.data_dir, PathBuf::from(r"C:\ProgramData\Daymark"));
        assert_eq!(
            paths.service_wrapper,
            paths.install_dir.join("DaymarkService.exe")
        );
        assert_eq!(
            paths.runtime_launcher,
            paths.install_dir.join("DaymarkRuntime.exe")
        );
        assert!(paths.settings_file.starts_with(&paths.data_dir));
    }

    #[test]
    fn exposes_a_parameterless_restart_command() {
        let _command = restart_runtime;
    }
}

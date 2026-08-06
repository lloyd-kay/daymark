use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

#[cfg(not(test))]
use std::process::Command;

#[cfg(not(test))]
use crate::contracts::ControlError;
#[cfg(not(test))]
use crate::secrets::read_setup_code;

#[derive(Debug)]
pub struct RuntimeInvocation {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub current_dir: PathBuf,
    pub environment: BTreeMap<String, String>,
}

pub fn build_runtime_invocation(
    install_dir: &Path,
    data_root: &Path,
    setup_code: &str,
) -> RuntimeInvocation {
    RuntimeInvocation {
        program: install_dir.join("node").join("node.exe"),
        args: vec![
            install_dir
                .join("runtime")
                .join("local")
                .join("cli.ts")
                .to_string_lossy()
                .into_owned(),
            "start".to_string(),
        ],
        current_dir: install_dir.to_path_buf(),
        environment: BTreeMap::from([
            ("DAYMARK_SETUP_CODE".to_string(), setup_code.to_string()),
            (
                "DAYMARK_APP_DIR".to_string(),
                install_dir.to_string_lossy().into_owned(),
            ),
            (
                "DAYMARK_DATA_DIR".to_string(),
                data_root.join("data").to_string_lossy().into_owned(),
            ),
            (
                "DAYMARK_BACKUP_DIR".to_string(),
                data_root.join("backups").to_string_lossy().into_owned(),
            ),
            (
                "DAYMARK_LOG_DIR".to_string(),
                data_root.join("logs").to_string_lossy().into_owned(),
            ),
        ]),
    }
}

#[cfg(not(test))]
pub fn run_runtime() -> Result<i32, ControlError> {
    let executable = std::env::current_exe().map_err(|_| launcher_error())?;
    let install_dir = executable.parent().ok_or_else(launcher_error)?;
    let data_root = std::env::var_os("ProgramData")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"))
        .join("Daymark");
    let mut setup_code = read_setup_code()?;
    let mut invocation = build_runtime_invocation(install_dir, &data_root, &setup_code);
    unsafe { setup_code.as_bytes_mut().fill(0) };

    if !invocation.program.is_file() || !Path::new(&invocation.args[0]).is_file() {
        clear_invocation_secret(&mut invocation);
        return Err(launcher_error());
    }

    let result = Command::new(&invocation.program)
        .args(&invocation.args)
        .current_dir(&invocation.current_dir)
        .envs(&invocation.environment)
        .status();
    clear_invocation_secret(&mut invocation);
    let status = result.map_err(|_| launcher_error())?;
    Ok(status.code().unwrap_or(1))
}

#[cfg(not(test))]
fn clear_invocation_secret(invocation: &mut RuntimeInvocation) {
    if let Some(value) = invocation.environment.get_mut("DAYMARK_SETUP_CODE") {
        unsafe { value.as_bytes_mut().fill(0) };
    }
}

#[cfg(not(test))]
fn launcher_error() -> ControlError {
    ControlError::new(
        "runtime_launcher_failed",
        "The Daymark runtime could not start. Open Daymark Control for recovery options.",
    )
}

#[cfg(test)]
mod tests {
    use super::build_runtime_invocation;
    use std::path::Path;

    #[test]
    fn service_launcher_puts_the_protected_code_only_in_the_child_environment() {
        let invocation = build_runtime_invocation(
            Path::new(r"C:\Program Files\Daymark"),
            Path::new(r"C:\ProgramData\Daymark"),
            "AAAAA-AAAAA-AAAAA-AAAAA",
        );

        assert!(invocation
            .args
            .iter()
            .all(|argument| !argument.contains("AAAAA")));
        assert_eq!(
            invocation
                .environment
                .get("DAYMARK_SETUP_CODE")
                .map(String::as_str),
            Some("AAAAA-AAAAA-AAAAA-AAAAA"),
        );
        assert_eq!(
            invocation.args,
            vec![r"C:\Program Files\Daymark\runtime\local\cli.ts", "start"],
        );
    }
}

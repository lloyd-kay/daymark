use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::contracts::ControlError;
use crate::secrets::read_setup_code;
use crate::service::runtime_paths;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BackupAction {
    Create,
    Verify,
    Restore,
}

impl BackupAction {
    fn cli_name(self) -> &'static str {
        match self {
            Self::Create => "backup",
            Self::Verify => "verify-backup",
            Self::Restore => "restore",
        }
    }
}

#[derive(Debug)]
pub struct RuntimeInvocation {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub current_dir: PathBuf,
    pub environment: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSummary {
    pub manifest_file: String,
    pub created_at: String,
    pub integrity: String,
}

pub fn parse_backup_summary(output: &str) -> Result<BackupSummary, ControlError> {
    let summary =
        serde_json::from_str::<BackupSummary>(output).map_err(|_| backup_output_error())?;
    let manifest = Path::new(&summary.manifest_file);
    if summary.integrity != "verified"
        || summary.created_at.len() < 20
        || !summary.created_at.contains('T')
        || !manifest.is_absolute()
        || manifest.extension().and_then(|value| value.to_str()) != Some("json")
    {
        return Err(backup_output_error());
    }
    Ok(summary)
}

pub fn build_runtime_invocation(
    action: BackupAction,
    manifest: Option<&Path>,
    setup_code: &str,
    install_dir: &Path,
    data_root: &Path,
) -> RuntimeInvocation {
    let runtime_cli = install_dir.join("runtime").join("local").join("cli.ts");
    let mut args = vec![
        runtime_cli.to_string_lossy().into_owned(),
        action.cli_name().to_string(),
    ];
    if let Some(manifest) = manifest {
        args.push("--manifest".to_string());
        args.push(manifest.to_string_lossy().into_owned());
    }

    let environment = BTreeMap::from([
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
    ]);

    RuntimeInvocation {
        program: install_dir.join("node").join("node.exe"),
        args,
        current_dir: install_dir.to_path_buf(),
        environment,
    }
}

#[tauri::command]
pub fn create_backup() -> Result<BackupSummary, ControlError> {
    let output = run_backup_action(BackupAction::Create, None)?;
    parse_backup_summary(&output)
}

#[tauri::command]
pub fn verify_backup(path: String) -> Result<BackupSummary, ControlError> {
    let manifest = validate_manifest_path(&path)?;
    let output = run_backup_action(BackupAction::Verify, Some(&manifest))?;
    parse_backup_summary(&output)
}

#[tauri::command]
pub fn restore_backup(path: String) -> Result<(), ControlError> {
    let manifest = validate_manifest_path(&path)?;
    let output = run_backup_action(BackupAction::Restore, Some(&manifest))?;
    let value =
        serde_json::from_str::<serde_json::Value>(&output).map_err(|_| backup_output_error())?;
    if value.get("status").and_then(serde_json::Value::as_str) == Some("restored") {
        Ok(())
    } else {
        Err(backup_output_error())
    }
}

fn run_backup_action(
    action: BackupAction,
    manifest: Option<&Path>,
) -> Result<String, ControlError> {
    let paths = runtime_paths();
    let mut setup_code = read_setup_code()?;
    let mut invocation = build_runtime_invocation(
        action,
        manifest,
        &setup_code,
        &paths.install_dir,
        &paths.data_dir,
    );
    unsafe { setup_code.as_bytes_mut().fill(0) };

    if !invocation.program.is_file() || !Path::new(&invocation.args[0]).is_file() {
        clear_invocation_secrets(&mut invocation);
        return Err(backup_error(
            "runtime_files_missing",
            "Daymark runtime files are missing. Repair Daymark and try again.",
        ));
    }

    let output = Command::new(&invocation.program)
        .args(&invocation.args)
        .current_dir(&invocation.current_dir)
        .envs(&invocation.environment)
        .output();
    clear_invocation_secrets(&mut invocation);

    let output = output.map_err(|_| {
        backup_error(
            "backup_command_failed",
            "Daymark could not run the requested backup operation.",
        )
    })?;
    if !output.status.success() || output.stdout.len() > 65_536 {
        return Err(backup_error(
            "backup_operation_failed",
            "The backup operation did not complete. Current Daymark data was left unchanged.",
        ));
    }

    String::from_utf8(output.stdout).map_err(|_| backup_output_error())
}

fn validate_manifest_path(value: &str) -> Result<PathBuf, ControlError> {
    let path = PathBuf::from(value.trim());
    if !path.is_absolute()
        || path.extension().and_then(|extension| extension.to_str()) != Some("json")
        || !path.is_file()
    {
        return Err(backup_error(
            "backup_manifest_invalid",
            "Choose an existing Daymark backup manifest ending in .json.",
        ));
    }
    Ok(path)
}

fn clear_invocation_secrets(invocation: &mut RuntimeInvocation) {
    if let Some(value) = invocation.environment.get_mut("DAYMARK_SETUP_CODE") {
        unsafe { value.as_bytes_mut().fill(0) };
    }
}

fn backup_output_error() -> ControlError {
    backup_error(
        "backup_output_invalid",
        "Daymark returned an invalid backup result. Current data was left unchanged.",
    )
}

fn backup_error(code: &'static str, message: &'static str) -> ControlError {
    ControlError::new(code, message)
}

#[cfg(test)]
mod tests {
    use super::{build_runtime_invocation, parse_backup_summary, BackupAction};
    use std::path::Path;

    #[test]
    fn verified_backup_output_becomes_a_safe_summary() {
        let summary = parse_backup_summary(
            r#"{
              "status":"backed_up",
              "manifestFile":"C:\\ProgramData\\Daymark\\backups\\daymark-verified.json",
              "createdAt":"2026-08-06T12:00:00.000Z",
              "integrity":"verified"
            }"#,
        )
        .expect("verified backup output should be accepted");

        assert_eq!(summary.integrity, "verified");
        assert_eq!(summary.created_at, "2026-08-06T12:00:00.000Z");
        assert!(summary.manifest_file.ends_with("daymark-verified.json"));
    }

    #[test]
    fn runtime_invocation_keeps_the_setup_code_out_of_arguments() {
        let invocation = build_runtime_invocation(
            BackupAction::Restore,
            Some(Path::new(
                r"C:\ProgramData\Daymark\backups\daymark-verified.json",
            )),
            "AAAAA-AAAAA-AAAAA-AAAAA",
            Path::new(r"C:\Program Files\Daymark"),
            Path::new(r"C:\ProgramData\Daymark"),
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
            vec![
                r"C:\Program Files\Daymark\runtime\local\cli.ts",
                "restore",
                "--manifest",
                r"C:\ProgramData\Daymark\backups\daymark-verified.json",
            ],
        );
    }
}

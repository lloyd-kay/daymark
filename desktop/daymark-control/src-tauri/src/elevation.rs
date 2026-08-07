use std::path::Path;

use crate::contracts::ControlError;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ServiceAction {
    Start,
    Stop,
    Restart,
}

impl ServiceAction {
    pub(crate) fn argument(self) -> &'static str {
        match self {
            Self::Start => "start",
            Self::Stop => "stop",
            Self::Restart => "restart",
        }
    }
}

fn service_exit_result(exit_code: u32) -> Result<(), ControlError> {
    if exit_code == 0 {
        Ok(())
    } else {
        Err(ControlError::new(
            "service_action_failed",
            "Windows could not change the Daymark service. Open Recovery tools for details.",
        ))
    }
}

fn shell_failure(error_code: u32) -> ControlError {
    #[cfg(target_os = "windows")]
    if error_code == windows_sys::Win32::Foundation::ERROR_CANCELLED {
        return ControlError::new(
            "service_action_cancelled",
            "Administrator approval was cancelled. Daymark was not changed.",
        );
    }

    ControlError::new(
        "service_elevation_failed",
        "Windows could not request administrator approval.",
    )
}

#[cfg(target_os = "windows")]
pub(crate) fn run_elevated_service_action(
    executable: &Path,
    action: ServiceAction,
) -> Result<(), ControlError> {
    use std::ffi::OsStr;
    use std::iter::once;
    use std::mem::{size_of, zeroed};
    use std::os::windows::ffi::OsStrExt;

    use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, WAIT_OBJECT_0};
    use windows_sys::Win32::System::Threading::{
        GetExitCodeProcess, WaitForSingleObject, INFINITE,
    };
    use windows_sys::Win32::UI::Shell::{
        ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_HIDE;

    fn wide(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(once(0)).collect()
    }

    let verb = wide(OsStr::new("runas"));
    let file = wide(executable.as_os_str());
    let parameters = wide(OsStr::new(action.argument()));
    let mut info: SHELLEXECUTEINFOW = unsafe { zeroed() };
    info.cbSize = size_of::<SHELLEXECUTEINFOW>() as u32;
    info.fMask = SEE_MASK_NOCLOSEPROCESS;
    info.lpVerb = verb.as_ptr();
    info.lpFile = file.as_ptr();
    info.lpParameters = parameters.as_ptr();
    info.nShow = SW_HIDE;

    if unsafe { ShellExecuteExW(&mut info) } == 0 {
        return Err(shell_failure(unsafe { GetLastError() }));
    }
    if info.hProcess.is_null() {
        return Err(shell_failure(0));
    }

    let wait_result = unsafe { WaitForSingleObject(info.hProcess, INFINITE) };
    let mut exit_code = 0;
    let exit_code_read = unsafe { GetExitCodeProcess(info.hProcess, &mut exit_code) };
    unsafe { CloseHandle(info.hProcess) };

    if wait_result != WAIT_OBJECT_0 || exit_code_read == 0 {
        return Err(ControlError::new(
            "service_action_failed",
            "Windows could not confirm the Daymark service action. Open Recovery tools for details.",
        ));
    }

    service_exit_result(exit_code)
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn run_elevated_service_action(
    _executable: &Path,
    _action: ServiceAction,
) -> Result<(), ControlError> {
    Err(ControlError::new(
        "service_action_unsupported",
        "Windows service controls are available only on Windows.",
    ))
}

#[cfg(test)]
mod tests {
    use super::{service_exit_result, shell_failure, ServiceAction};
    use windows_sys::Win32::Foundation::ERROR_CANCELLED;

    #[test]
    fn exposes_only_fixed_winsw_actions() {
        assert_eq!(ServiceAction::Start.argument(), "start");
        assert_eq!(ServiceAction::Stop.argument(), "stop");
        assert_eq!(ServiceAction::Restart.argument(), "restart");
    }

    #[test]
    fn distinguishes_cancelled_elevation_from_service_failure() {
        assert_eq!(
            shell_failure(ERROR_CANCELLED).code,
            "service_action_cancelled"
        );
        assert_eq!(shell_failure(5).code, "service_elevation_failed");
        assert_eq!(
            service_exit_result(5).unwrap_err().code,
            "service_action_failed"
        );
        assert!(service_exit_result(0).is_ok());
    }
}

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::State;
use url::Url;

use crate::contracts::{AccessState, ControlError};
use crate::secrets;

const LOCAL_DAYMARK_ORIGIN: &str = "http://127.0.0.1:3210";
const QUICK_TUNNEL_SUFFIX: &str = ".trycloudflare.com";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CloudflaredInvocation {
    pub program: PathBuf,
    pub args: Vec<&'static str>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessSnapshot {
    pub access: AccessState,
    pub public_url: Option<String>,
}

struct TunnelInner {
    child: Option<Child>,
    access: AccessState,
    public_url: Option<String>,
}

pub struct TunnelController {
    cloudflared: PathBuf,
    inner: Mutex<TunnelInner>,
}

impl TunnelController {
    pub fn new() -> Self {
        Self {
            cloudflared: cloudflared_path(),
            inner: Mutex::new(TunnelInner {
                child: None,
                access: AccessState::Local,
                public_url: None,
            }),
        }
    }

    pub fn snapshot(&self) -> AccessSnapshot {
        let Ok(mut inner) = self.inner.lock() else {
            return AccessSnapshot {
                access: AccessState::Error,
                public_url: None,
            };
        };

        let tunnel_exited = inner
            .child
            .as_mut()
            .is_some_and(|child| child.try_wait().ok().flatten().is_some());
        if tunnel_exited {
            inner.child = None;
            inner.access = AccessState::Error;
            inner.public_url = None;
        }

        AccessSnapshot {
            access: inner.access,
            public_url: inner.public_url.clone(),
        }
    }

    fn start_quick(&self) -> Result<(), ControlError> {
        if !self.cloudflared.is_file() {
            return self.fail_quick(
                "cloudflared_missing",
                "The public-link helper is missing. Repair Daymark and try again.",
            );
        }

        {
            let mut inner = self.lock_inner()?;
            if inner
                .child
                .as_mut()
                .is_some_and(|child| child.try_wait().ok().flatten().is_none())
            {
                return Ok(());
            }
            inner.child = None;
            inner.access = AccessState::TemporaryStarting;
            inner.public_url = None;
        }

        let invocation = quick_tunnel_invocation(&self.cloudflared);
        let mut command = Command::new(&invocation.program);
        command
            .args(&invocation.args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());
        hide_window(&mut command);

        let mut child = command.spawn().map_err(|_| {
            self.set_error_state();
            tunnel_error(
                "quick_tunnel_start_failed",
                "The temporary public link could not be started. Local Daymark is still available.",
            )
        })?;
        let stderr = child.stderr.take().ok_or_else(|| {
            let _ = child.kill();
            let _ = child.wait();
            self.set_error_state();
            tunnel_error(
                "quick_tunnel_output_unavailable",
                "The temporary public link did not return a secure address. Local Daymark is still available.",
            )
        })?;

        {
            let mut inner = self.lock_inner()?;
            inner.child = Some(child);
        }

        let (sender, receiver) = mpsc::channel::<String>();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                let _ = sender.send(line);
            }
        });

        let deadline = Instant::now() + Duration::from_secs(30);
        while Instant::now() < deadline {
            match receiver.recv_timeout(Duration::from_millis(250)) {
                Ok(line) => {
                    if let Some(public_url) = parse_quick_tunnel_url(&line) {
                        let public_url = assert_safe_public_url(&public_url)?.to_string();
                        let mut inner = self.lock_inner()?;
                        if inner.access != AccessState::TemporaryStarting || inner.child.is_none() {
                            return Err(tunnel_error(
                                "quick_tunnel_cancelled",
                                "The temporary public link was cancelled.",
                            ));
                        }
                        inner.access = AccessState::Temporary;
                        inner.public_url = Some(public_url);
                        return Ok(());
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }

            if self.child_has_exited()? {
                break;
            }
        }

        self.fail_quick(
            "quick_tunnel_address_unavailable",
            "The temporary public link did not return a secure address. Local Daymark is still available.",
        )
    }

    fn stop(&self) -> Result<(), ControlError> {
        let child = {
            let mut inner = self.lock_inner()?;
            inner.access = AccessState::Local;
            inner.public_url = None;
            inner.child.take()
        };
        stop_child(child)
    }

    fn begin_permanent_login(&self) -> Result<(), ControlError> {
        if !self.cloudflared.is_file() {
            return Err(tunnel_error(
                "cloudflared_missing",
                "The public-link helper is missing. Repair Daymark and try again.",
            ));
        }
        let mut command = Command::new(&self.cloudflared);
        command.arg("tunnel").arg("login");
        hide_window(&mut command);
        command.spawn().map(|_| ()).map_err(|_| {
            tunnel_error(
                "permanent_login_failed",
                "Cloudflare sign-in could not be opened. Local Daymark is still available.",
            )
        })
    }

    fn save_permanent_token(&self, mut token: String) -> Result<(), ControlError> {
        if !is_valid_tunnel_token(&token) {
            unsafe { token.as_bytes_mut().fill(0) };
            return Err(tunnel_error(
                "invalid_tunnel_token",
                "The scoped Cloudflare tunnel token is not valid.",
            ));
        }

        let result = secrets::store_tunnel_token(token.as_bytes());
        unsafe { token.as_bytes_mut().fill(0) };
        result?;

        let mut inner = self.lock_inner()?;
        inner.access = AccessState::Permanent;
        inner.public_url = None;
        Ok(())
    }

    fn child_has_exited(&self) -> Result<bool, ControlError> {
        let mut inner = self.lock_inner()?;
        Ok(inner
            .child
            .as_mut()
            .is_none_or(|child| child.try_wait().ok().flatten().is_some()))
    }

    fn fail_quick(&self, code: &'static str, message: &'static str) -> Result<(), ControlError> {
        let child = {
            let mut inner = self.lock_inner()?;
            inner.access = AccessState::Error;
            inner.public_url = None;
            inner.child.take()
        };
        let _ = stop_child(child);
        Err(tunnel_error(code, message))
    }

    fn set_error_state(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.access = AccessState::Error;
            inner.public_url = None;
            inner.child = None;
        }
    }

    fn lock_inner(&self) -> Result<std::sync::MutexGuard<'_, TunnelInner>, ControlError> {
        self.inner.lock().map_err(|_| {
            tunnel_error(
                "public_access_state_unavailable",
                "Public access state is unavailable. Local Daymark is still available.",
            )
        })
    }
}

impl Default for TunnelController {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for TunnelController {
    fn drop(&mut self) {
        if let Ok(inner) = self.inner.get_mut() {
            let _ = stop_child(inner.child.take());
        }
    }
}

pub fn quick_tunnel_invocation(cloudflared: &Path) -> CloudflaredInvocation {
    CloudflaredInvocation {
        program: cloudflared.to_path_buf(),
        args: vec!["tunnel", "--url", LOCAL_DAYMARK_ORIGIN, "--no-autoupdate"],
    }
}

pub fn parse_quick_tunnel_url(output: &str) -> Option<String> {
    output
        .split_whitespace()
        .filter_map(|candidate| {
            let candidate = candidate.trim_matches(|character: char| {
                matches!(character, '"' | '\'' | '(' | ')' | '[' | ']' | ',' | ';')
            });
            Url::parse(candidate).ok()
        })
        .find(|url| {
            url.scheme() == "https"
                && url.host_str().is_some_and(|host| {
                    host.ends_with(QUICK_TUNNEL_SUFFIX) && host.len() > QUICK_TUNNEL_SUFFIX.len()
                })
                && url.port().is_none()
                && url.username().is_empty()
                && url.password().is_none()
                && url.path() == "/"
                && url.query().is_none()
                && url.fragment().is_none()
        })
        .map(Into::into)
}

pub fn assert_safe_public_url(value: &str) -> Result<Url, ControlError> {
    let parsed = Url::parse(value).map_err(|_| unsafe_public_url_error())?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err(unsafe_public_url_error());
    }
    Ok(parsed)
}

pub fn is_valid_tunnel_token(token: &str) -> bool {
    (64..=4096).contains(&token.len())
        && token.starts_with("ey")
        && token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
}

fn unsafe_public_url_error() -> ControlError {
    ControlError::new(
        "unsafe_public_url",
        "Only a secure HTTPS booking address can be used for public access.",
    )
}

#[tauri::command]
pub fn start_quick_tunnel(controller: State<'_, TunnelController>) -> Result<(), ControlError> {
    controller.start_quick()
}

#[tauri::command]
pub fn stop_tunnel(controller: State<'_, TunnelController>) -> Result<(), ControlError> {
    controller.stop()
}

#[tauri::command]
pub fn begin_permanent_tunnel_login(
    controller: State<'_, TunnelController>,
) -> Result<(), ControlError> {
    controller.begin_permanent_login()
}

#[tauri::command]
pub fn save_permanent_tunnel_token(
    token: String,
    controller: State<'_, TunnelController>,
) -> Result<(), ControlError> {
    controller.save_permanent_token(token)
}

fn cloudflared_path() -> PathBuf {
    std::env::var_os("ProgramFiles")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Program Files"))
        .join("Daymark")
        .join("cloudflared.exe")
}

fn stop_child(child: Option<Child>) -> Result<(), ControlError> {
    if let Some(mut child) = child {
        child.kill().map_err(|_| {
            tunnel_error(
                "public_access_stop_failed",
                "The public-link helper could not be stopped. Local Daymark is still available.",
            )
        })?;
        let _ = child.wait();
    }
    Ok(())
}

fn hide_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
}

fn tunnel_error(code: &'static str, message: &'static str) -> ControlError {
    ControlError::new(code, message)
}

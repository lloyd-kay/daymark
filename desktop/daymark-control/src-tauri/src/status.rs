use std::io::{Read, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::process::Command;
use std::time::Duration;

use serde::Deserialize;
use url::Url;

use crate::contracts::{AccessState, ControlError, RuntimeMode, RuntimeState, RuntimeStatus};

const LOCAL_ORIGIN: &str = "http://127.0.0.1:3210";
const EXPECTED_MIGRATION: &str = "0002_daymark_company_workspaces.sql";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    status: String,
    app_version: String,
    latest_migration: Option<String>,
}

enum HealthCheck {
    Running(HealthResponse),
    Stopped,
    NeedsAttention(Option<HealthResponse>),
}

#[tauri::command]
pub fn get_runtime_status() -> Result<RuntimeStatus, ControlError> {
    let (state, health, message) = match check_health() {
        HealthCheck::Running(health) => (RuntimeState::Running, Some(health), None),
        HealthCheck::Stopped => (
            RuntimeState::Stopped,
            None,
            Some("Daymark is not currently running.".to_string()),
        ),
        HealthCheck::NeedsAttention(health) => (
            RuntimeState::NeedsAttention,
            health,
            Some("Daymark is running but needs attention before it can accept bookings.".to_string()),
        ),
    };

    Ok(RuntimeStatus {
        state,
        mode: RuntimeMode::Service,
        access: AccessState::Local,
        local_url: LOCAL_ORIGIN.to_string(),
        public_url: None,
        version: health
            .as_ref()
            .map(|value| value.app_version.clone())
            .unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string()),
        latest_migration: health
            .and_then(|value| value.latest_migration)
            .unwrap_or_else(|| EXPECTED_MIGRATION.to_string()),
        message,
    })
}

fn check_health() -> HealthCheck {
    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 3210);
    let timeout = Duration::from_secs(3);
    let mut stream = match TcpStream::connect_timeout(&address, timeout) {
        Ok(stream) => stream,
        Err(_) => return HealthCheck::Stopped,
    };

    if stream.set_read_timeout(Some(timeout)).is_err()
        || stream.set_write_timeout(Some(timeout)).is_err()
        || stream
            .write_all(
                b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:3210\r\nAccept: application/json\r\nConnection: close\r\n\r\n",
            )
            .is_err()
    {
        return HealthCheck::NeedsAttention(None);
    }

    let mut response = String::new();
    if stream.take(65_536).read_to_string(&mut response).is_err() {
        return HealthCheck::NeedsAttention(None);
    }

    let Some((headers, body)) = response.split_once("\r\n\r\n") else {
        return HealthCheck::NeedsAttention(None);
    };
    let health = serde_json::from_str::<HealthResponse>(body).ok();

    if headers.starts_with("HTTP/1.1 200")
        && health.as_ref().is_some_and(|value| value.status == "ok")
    {
        return HealthCheck::Running(health.expect("checked above"));
    }

    HealthCheck::NeedsAttention(health)
}

pub fn assert_safe_local_url(value: &str) -> Result<Url, ControlError> {
    let parsed = Url::parse(value).map_err(|_| unsafe_url_error())?;
    let safe_host = matches!(parsed.host_str(), Some("127.0.0.1" | "localhost"));
    if parsed.scheme() != "http"
        || !safe_host
        || parsed.port() != Some(3210)
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err(unsafe_url_error());
    }
    Ok(parsed)
}

fn unsafe_url_error() -> ControlError {
    ControlError::new(
        "unsafe_local_url",
        "Only the local Daymark address can be opened",
    )
}

#[tauri::command]
pub fn open_local_url(path: String) -> Result<(), ControlError> {
    let safe_url = assert_safe_local_url(&path)?;

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer.exe").arg(safe_url.as_str()).spawn();

    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(safe_url.as_str()).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let result = Command::new("xdg-open").arg(safe_url.as_str()).spawn();

    result
        .map(|_| ())
        .map_err(|_| ControlError::new("open_local_url_failed", "The local Daymark page could not be opened"))
}

#[cfg(test)]
mod tests {
    use super::assert_safe_local_url;

    #[test]
    fn accepts_only_the_daymark_loopback_origin() {
        assert!(assert_safe_local_url("http://127.0.0.1:3210/workspace/sign-in").is_ok());
        assert!(assert_safe_local_url("http://localhost:3210/api/health").is_ok());
        assert!(assert_safe_local_url("https://example.com/workspace").is_err());
        assert!(assert_safe_local_url("http://127.0.0.1:3210.evil.example/workspace").is_err());
        assert!(assert_safe_local_url("http://user@127.0.0.1:3210/workspace").is_err());
    }
}

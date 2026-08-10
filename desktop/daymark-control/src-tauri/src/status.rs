use std::io::{Read, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::process::Command;
use std::time::Duration;

use serde::Deserialize;
use tauri::State;
use url::Url;

use crate::contracts::{AccessState, ControlError, RuntimeState, RuntimeStatus};
use crate::service::current_runtime_mode;
use crate::tunnel::{AccessSnapshot, TunnelController};

const LOCAL_ORIGIN: &str = "http://127.0.0.1:3210";
const EXPECTED_MIGRATION: &str = "0004_daymark_service_catalog.sql";

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
pub fn get_runtime_status(
    tunnel_controller: State<'_, TunnelController>,
) -> Result<RuntimeStatus, ControlError> {
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
            Some(
                "Daymark is running but needs attention before it can accept bookings.".to_string(),
            ),
        ),
    };

    let local_status = RuntimeStatus {
        state,
        mode: current_runtime_mode(),
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
    };

    Ok(apply_access_snapshot(
        local_status,
        tunnel_controller.snapshot(),
    ))
}

pub fn apply_access_snapshot(
    mut status: RuntimeStatus,
    access_snapshot: AccessSnapshot,
) -> RuntimeStatus {
    status.access = access_snapshot.access;
    status.public_url = access_snapshot.public_url;
    if status.access == AccessState::Error && status.state == RuntimeState::Running {
        status.message =
            Some("Daymark is running locally, but public access needs attention.".to_string());
    }
    status
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

    let response = match read_http_response(&mut stream) {
        Ok(response) => response,
        Err(_) => return HealthCheck::NeedsAttention(None),
    };

    let Some((headers, body)) = response.split_once("\r\n\r\n") else {
        return HealthCheck::NeedsAttention(None);
    };
    let health = parse_health_response(body);

    if headers.starts_with("HTTP/1.1 200") && health.as_ref().is_some_and(health_is_ready) {
        return HealthCheck::Running(health.expect("checked above"));
    }

    HealthCheck::NeedsAttention(health)
}

pub(crate) fn runtime_is_ready() -> bool {
    matches!(check_health(), HealthCheck::Running(_))
}

fn read_http_response(reader: &mut impl Read) -> std::io::Result<String> {
    let mut response = Vec::new();
    let mut limited = reader.take(65_536);
    let mut buffer = [0_u8; 4_096];

    loop {
        let count = limited.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        response.extend_from_slice(&buffer[..count]);
        if complete_http_response_length(&response)
            .is_some_and(|expected| response.len() >= expected)
        {
            break;
        }
    }

    String::from_utf8(response)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))
}

fn complete_http_response_length(response: &[u8]) -> Option<usize> {
    let header_end = response.windows(4).position(|window| window == b"\r\n\r\n")? + 4;
    let headers = std::str::from_utf8(&response[..header_end]).ok()?;
    let content_length = headers.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.eq_ignore_ascii_case("content-length")
            .then(|| value.trim().parse::<usize>().ok())
            .flatten()
    })?;
    header_end.checked_add(content_length)
}

fn parse_health_response(body: &str) -> Option<HealthResponse> {
    serde_json::from_str::<HealthResponse>(body).ok()
}

fn health_is_ready(health: &HealthResponse) -> bool {
    health.status == "ok" && health.latest_migration.as_deref() == Some(EXPECTED_MIGRATION)
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

    result.map(|_| ()).map_err(|_| {
        ControlError::new(
            "open_local_url_failed",
            "The local Daymark page could not be opened",
        )
    })
}

#[cfg(test)]
mod tests {
    use std::io::{self, Cursor, Read};

    use super::{
        assert_safe_local_url, health_is_ready, parse_health_response, read_http_response,
    };

    struct CompleteResponseThenTimeout {
        response: Cursor<Vec<u8>>,
    }

    impl Read for CompleteResponseThenTimeout {
        fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
            if self.response.position() < self.response.get_ref().len() as u64 {
                self.response.read(buffer)
            } else {
                Err(io::Error::new(io::ErrorKind::WouldBlock, "connection kept alive"))
            }
        }
    }

    #[test]
    fn decodes_the_runtime_camel_case_health_contract() {
        let health = parse_health_response(
            r#"{"status":"ok","appVersion":"0.1.0","latestMigration":"0004_daymark_service_catalog.sql"}"#,
        )
        .expect("valid Daymark health must decode");
        assert_eq!(health.app_version, "0.1.0");
        assert_eq!(
            health.latest_migration.as_deref(),
            Some("0004_daymark_service_catalog.sql")
        );
        assert!(health_is_ready(&health));

        let incomplete =
            parse_health_response(r#"{"status":"ok","appVersion":"0.1.0","latestMigration":null}"#)
                .expect("syntactically valid incomplete health must decode");
        assert!(!health_is_ready(&incomplete));
    }

    #[test]
    fn completes_a_content_length_response_without_waiting_for_connection_close() {
        let response = b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}".to_vec();
        let mut reader = CompleteResponseThenTimeout {
            response: Cursor::new(response),
        };

        let result = read_http_response(&mut reader)
            .expect("a complete response must not wait for a keep-alive connection to close");

        assert!(result.ends_with("{}"));
    }

    #[test]
    fn accepts_only_the_daymark_loopback_origin() {
        assert!(assert_safe_local_url("http://127.0.0.1:3210/workspace/sign-in").is_ok());
        assert!(assert_safe_local_url("http://localhost:3210/api/health").is_ok());
        assert!(assert_safe_local_url("https://example.com/workspace").is_err());
        assert!(assert_safe_local_url("http://127.0.0.1:3210.evil.example/workspace").is_err());
        assert!(assert_safe_local_url("http://user@127.0.0.1:3210/workspace").is_err());
    }
}

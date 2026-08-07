use std::path::Path;

use daymark_control::contracts::{AccessState, RuntimeMode, RuntimeState, RuntimeStatus};
use daymark_control::status::apply_access_snapshot;
use daymark_control::tunnel::{
    assert_safe_public_url, is_valid_tunnel_token, parse_quick_tunnel_url, quick_tunnel_invocation,
    AccessSnapshot,
};

#[test]
fn quick_tunnel_targets_only_the_loopback_daymark_service() {
    let invocation =
        quick_tunnel_invocation(Path::new(r"C:\Program Files\Daymark\cloudflared.exe"));

    assert_eq!(
        invocation.program,
        Path::new(r"C:\Program Files\Daymark\cloudflared.exe"),
    );
    assert_eq!(
        invocation.args,
        [
            "tunnel",
            "--url",
            "http://127.0.0.1:3210",
            "--no-autoupdate",
        ],
    );
}

#[test]
fn public_access_failure_does_not_change_local_runtime_health() {
    let local_status = RuntimeStatus {
        state: RuntimeState::Running,
        mode: RuntimeMode::Service,
        access: AccessState::Local,
        local_url: "http://127.0.0.1:3210".to_string(),
        public_url: None,
        version: "0.1.0".to_string(),
        latest_migration: "0002_daymark_company_workspaces.sql".to_string(),
        message: None,
    };

    let status = apply_access_snapshot(
        local_status,
        AccessSnapshot {
            access: AccessState::Error,
            public_url: None,
        },
    );

    assert_eq!(status.state, RuntimeState::Running);
    assert_eq!(status.access, AccessState::Error);
    assert_eq!(status.local_url, "http://127.0.0.1:3210");
}

#[test]
fn permanent_access_rejects_insecure_urls_and_malformed_tokens() {
    assert!(assert_safe_public_url("https://book.example.com").is_ok());
    assert!(assert_safe_public_url("http://book.example.com").is_err());
    assert!(assert_safe_public_url("https://user@book.example.com").is_err());

    assert!(is_valid_tunnel_token(
        "eyJhIjoiMTIzNDU2Nzg5MCIsInQiOiJhYmNkZWYxMjM0NTY3ODkwIn0.eyJzIjoiYWJjZGVmIn0.signature"
    ));
    assert!(!is_valid_tunnel_token("short"));
    assert!(!is_valid_tunnel_token("token with spaces and a secret"));
}

#[test]
fn quick_tunnel_accepts_only_cloudflare_https_assignments() {
    let output =
        "INF Requesting new quick Tunnel\nINF https://careful-leaf-7.trycloudflare.com is ready\n";
    assert_eq!(
        parse_quick_tunnel_url(output).as_deref(),
        Some("https://careful-leaf-7.trycloudflare.com/"),
    );

    assert_eq!(
        parse_quick_tunnel_url("http://careful-leaf-7.trycloudflare.com"),
        None
    );
    assert_eq!(
        parse_quick_tunnel_url("https://trycloudflare.com.evil.example"),
        None
    );
    assert_eq!(
        parse_quick_tunnel_url("https://user@careful-leaf-7.trycloudflare.com"),
        None
    );
    assert_eq!(
        parse_quick_tunnel_url("https://careful-leaf-7.trycloudflare.com:444"),
        None
    );
}

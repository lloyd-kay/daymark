use tauri::State;
use url::Url;

use crate::contracts::ControlError;
use crate::service::{ensure_runtime_ready, ServiceController};
use crate::status;

const MAX_URI_LENGTH: usize = 256;
const URI_PREFIX: &str = "daymark://import-setup?code=";
const LOCAL_IMPORT_BASE: &str = "http://127.0.0.1:3210/setup-profile/import";
const CHECKSUM_ALPHABET: &[u8; 32] = b"23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

#[derive(Debug, Eq, PartialEq)]
pub struct SetupProfileImport {
    pub code: String,
    pub local_url: String,
}

pub fn parse_setup_profile_uri(uri: &str) -> Result<SetupProfileImport, ControlError> {
    if uri.len() > MAX_URI_LENGTH || !uri.is_ascii() || !uri.starts_with(URI_PREFIX) {
        return Err(invalid_setup_link());
    }

    let code = validate_setup_profile_code(&uri[URI_PREFIX.len()..])?;
    let parsed = Url::parse(uri).map_err(|_| invalid_setup_link())?;
    let expected_query = format!("code={code}");
    if parsed.scheme() != "daymark"
        || parsed.host_str() != Some("import-setup")
        || !parsed.path().is_empty()
        || parsed.port().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.fragment().is_some()
        || parsed.query() != Some(expected_query.as_str())
        || parsed.query_pairs().count() != 1
    {
        return Err(invalid_setup_link());
    }

    let mut local_url = Url::parse(LOCAL_IMPORT_BASE).map_err(|_| invalid_setup_link())?;
    local_url.query_pairs_mut().append_pair("code", &code);
    status::assert_safe_local_url(local_url.as_str()).map_err(|_| invalid_setup_link())?;

    Ok(SetupProfileImport {
        code,
        local_url: local_url.to_string(),
    })
}

pub fn validate_setup_profile_code(code: &str) -> Result<String, ControlError> {
    let bytes = code.as_bytes();
    if bytes.len() != 12
        || &bytes[0..3] != b"DM1"
        || bytes[3] != b'-'
        || bytes[4] != b'C'
        || bytes[5] != b'-'
        || !matches!(bytes[6], b'F' | b'I')
        || bytes[7] != b'-'
        || !bytes[8..]
            .iter()
            .all(|byte| CHECKSUM_ALPHABET.contains(byte))
    {
        return Err(invalid_setup_link());
    }

    let expected = checksum(&bytes[..7]);
    if bytes[8..] != expected {
        return Err(invalid_setup_link());
    }
    Ok(code.to_string())
}

fn checksum(body: &[u8]) -> [u8; 4] {
    let mut crc: u16 = 0xffff;
    for byte in body {
        crc ^= u16::from(*byte) << 8;
        for _ in 0..8 {
            crc = if crc & 0x8000 != 0 {
                (crc << 1) ^ 0x1021
            } else {
                crc << 1
            };
        }
    }

    let mut value = u32::from(crc);
    let mut encoded = [0_u8; 4];
    for index in (0..4).rev() {
        encoded[index] = CHECKSUM_ALPHABET[(value & 31) as usize];
        value >>= 5;
    }
    encoded
}

#[tauri::command]
pub fn open_setup_profile_import(
    uri: String,
    controller: State<'_, ServiceController>,
) -> Result<(), ControlError> {
    let import = parse_setup_profile_uri(&uri)?;
    ensure_runtime_ready(&controller).map_err(|_| setup_link_open_failed())?;
    status::assert_safe_local_url(&import.local_url).map_err(|_| setup_link_open_failed())?;
    status::open_local_url(import.local_url).map_err(|_| setup_link_open_failed())
}

fn invalid_setup_link() -> ControlError {
    ControlError::new(
        "invalid_setup_profile_link",
        "That Daymark setup link could not be opened",
    )
}

fn setup_link_open_failed() -> ControlError {
    ControlError::new(
        "setup_profile_open_failed",
        "The Daymark setup page could not be opened",
    )
}

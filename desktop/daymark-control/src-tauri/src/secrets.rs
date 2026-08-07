use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::ptr::{copy_nonoverlapping, null, null_mut};

use serde::Serialize;
use windows_sys::Win32::Foundation::{GlobalFree, LocalFree, HANDLE};
use windows_sys::Win32::Security::Cryptography::{
    BCryptGenRandom, CryptProtectData, CryptUnprotectData, BCRYPT_USE_SYSTEM_PREFERRED_RNG,
    CRYPTPROTECT_LOCAL_MACHINE, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};
use windows_sys::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
};
use windows_sys::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
use windows_sys::Win32::System::Ole::CF_UNICODETEXT;

use crate::contracts::ControlError;

const CROCKFORD_BASE32: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PROTECTION_FLAGS: u32 = CRYPTPROTECT_LOCAL_MACHINE | CRYPTPROTECT_UI_FORBIDDEN;

#[derive(Debug, Serialize)]
pub struct SetupState {
    pub configured: bool,
}

pub fn generate_setup_code() -> Result<String, ControlError> {
    let mut random = [0_u8; 20];
    let status = unsafe {
        BCryptGenRandom(
            null_mut(),
            random.as_mut_ptr(),
            random.len() as u32,
            BCRYPT_USE_SYSTEM_PREFERRED_RNG,
        )
    };
    if status < 0 {
        return Err(secret_error(
            "secure_random_failed",
            "Windows could not generate a protected setup code.",
        ));
    }

    let mut code = String::with_capacity(23);
    for (index, byte) in random.into_iter().enumerate() {
        if index > 0 && index % 5 == 0 {
            code.push('-');
        }
        code.push(CROCKFORD_BASE32[(byte & 31) as usize] as char);
    }
    Ok(code)
}

pub fn protect_for_local_machine(plaintext: &[u8]) -> Result<Vec<u8>, ControlError> {
    crypt_protect(plaintext)
}

pub fn unprotect_for_local_machine(ciphertext: &[u8]) -> Result<Vec<u8>, ControlError> {
    crypt_unprotect(ciphertext)
}

pub fn ensure_setup_code() -> Result<(), ControlError> {
    let secret_file = setup_secret_file();
    if secret_file.is_file() {
        return Ok(());
    }

    let secret_dir = secret_file.parent().ok_or_else(|| {
        secret_error(
            "secret_path_invalid",
            "The protected setup-code location is invalid.",
        )
    })?;
    fs::create_dir_all(secret_dir).map_err(|_| permission_error())?;

    let setup_code = generate_setup_code()?;
    let mut plaintext = setup_code.into_bytes();
    let protected = protect_for_local_machine(&plaintext)?;
    plaintext.fill(0);

    let temporary = secret_file.with_extension("dpapi.new");
    fs::write(&temporary, protected).map_err(|_| permission_error())?;
    fs::rename(&temporary, &secret_file).map_err(|_| permission_error())?;
    if restrict_to_system_and_administrators(&secret_file).is_err() {
        let _ = fs::remove_file(&secret_file);
        return Err(permission_error());
    }
    restrict_to_system_and_administrators(secret_dir)?;
    Ok(())
}

pub fn prepare_data_directories() -> Result<(), ControlError> {
    let data_root = daymark_data_root();
    let directories = [
        data_root.clone(),
        data_root.join("data"),
        data_root.join("backups"),
        data_root.join("logs"),
        data_root.join("secrets"),
    ];

    for directory in &directories {
        fs::create_dir_all(directory).map_err(|_| permission_error())?;
    }
    for directory in directories.iter().rev() {
        restrict_to_system_and_administrators(directory)?;
    }
    ensure_setup_code()
}

pub fn store_tunnel_token(token: &[u8]) -> Result<(), ControlError> {
    let secret_file = secret_directory().join("tunnel-token.dpapi");
    let secret_dir = secret_file.parent().ok_or_else(|| {
        secret_error(
            "secret_path_invalid",
            "The protected tunnel-token location is invalid.",
        )
    })?;
    fs::create_dir_all(secret_dir).map_err(|_| permission_error())?;

    let protected = protect_for_local_machine(token)?;
    let temporary = secret_file.with_extension("dpapi.new");
    fs::write(&temporary, protected).map_err(|_| permission_error())?;
    fs::rename(&temporary, &secret_file).map_err(|_| permission_error())?;
    if restrict_to_system_and_administrators(&secret_file).is_err() {
        let _ = fs::remove_file(&secret_file);
        return Err(permission_error());
    }
    restrict_to_system_and_administrators(secret_dir)?;
    Ok(())
}

#[tauri::command]
pub fn get_setup_state() -> Result<SetupState, ControlError> {
    ensure_setup_code()?;
    Ok(SetupState { configured: true })
}

#[tauri::command]
pub fn reveal_setup_code() -> Result<String, ControlError> {
    read_setup_code()
}

#[tauri::command]
pub fn copy_setup_code() -> Result<(), ControlError> {
    let mut setup_code = read_setup_code()?;
    copy_text_to_clipboard(&setup_code)?;
    unsafe { setup_code.as_bytes_mut().fill(0) };
    Ok(())
}

pub fn read_setup_code() -> Result<String, ControlError> {
    let protected = fs::read(setup_secret_file()).map_err(|_| {
        secret_error(
            "setup_code_missing",
            "The protected setup code is missing. Repair Daymark to create a new one.",
        )
    })?;
    let plaintext = unprotect_for_local_machine(&protected)?;
    let code = match String::from_utf8(plaintext) {
        Ok(code) => code,
        Err(error) => {
            let mut invalid = error.into_bytes();
            invalid.fill(0);
            return Err(secret_error(
                "setup_code_invalid",
                "The protected setup code could not be read.",
            ));
        }
    };
    if !is_valid_setup_code(&code) {
        return Err(secret_error(
            "setup_code_invalid",
            "The protected setup code could not be read.",
        ));
    }
    Ok(code)
}

fn setup_secret_file() -> PathBuf {
    secret_directory().join("setup-code.dpapi")
}

fn secret_directory() -> PathBuf {
    daymark_data_root().join("secrets")
}

fn daymark_data_root() -> PathBuf {
    let program_data = std::env::var_os("ProgramData")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"));
    program_data.join("Daymark")
}

fn is_valid_setup_code(value: &str) -> bool {
    let groups: Vec<&str> = value.split('-').collect();
    groups.len() == 4
        && groups.iter().all(|group| {
            group.len() == 5
                && group
                    .bytes()
                    .all(|character| CROCKFORD_BASE32.contains(&character))
        })
}

fn crypt_protect(plaintext: &[u8]) -> Result<Vec<u8>, ControlError> {
    let input = CRYPT_INTEGER_BLOB {
        cbData: plaintext.len() as u32,
        pbData: plaintext.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };
    let success = unsafe {
        CryptProtectData(
            &input,
            null(),
            null(),
            null_mut(),
            null(),
            PROTECTION_FLAGS,
            &mut output,
        )
    };
    if success == 0 || output.pbData.is_null() {
        return Err(secret_error(
            "secret_protection_failed",
            "Windows could not protect the Daymark secret.",
        ));
    }

    let protected =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
    unsafe { LocalFree(output.pbData as _) };
    Ok(protected)
}

fn crypt_unprotect(ciphertext: &[u8]) -> Result<Vec<u8>, ControlError> {
    let input = CRYPT_INTEGER_BLOB {
        cbData: ciphertext.len() as u32,
        pbData: ciphertext.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };
    let success = unsafe {
        CryptUnprotectData(
            &input,
            null_mut(),
            null(),
            null_mut(),
            null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if success == 0 || output.pbData.is_null() {
        return Err(secret_error(
            "secret_unprotect_failed",
            "Windows could not unlock the protected Daymark secret.",
        ));
    }

    let clear_output =
        unsafe { std::slice::from_raw_parts_mut(output.pbData, output.cbData as usize) };
    let plaintext = clear_output.to_vec();
    clear_output.fill(0);
    unsafe { LocalFree(output.pbData as _) };
    Ok(plaintext)
}

fn restrict_to_system_and_administrators(path: &std::path::Path) -> Result<(), ControlError> {
    let current_user = format!("*{}:(F)", current_user_sid()?);
    let status = Command::new("icacls.exe")
        .arg(path)
        .args(["/inheritance:r", "/grant:r"])
        .arg("*S-1-5-18:(F)")
        .arg("*S-1-5-32-544:(F)")
        .arg(current_user)
        .status()
        .map_err(|_| permission_error())?;
    if status.success() {
        Ok(())
    } else {
        Err(permission_error())
    }
}

fn current_user_sid() -> Result<String, ControlError> {
    let output = Command::new("whoami.exe")
        .args(["/user", "/fo", "csv", "/nh"])
        .output()
        .map_err(|_| permission_error())?;
    if !output.status.success() {
        return Err(permission_error());
    }
    let output = String::from_utf8(output.stdout).map_err(|_| permission_error())?;
    parse_current_user_sid(&output).ok_or_else(permission_error)
}

fn parse_current_user_sid(output: &str) -> Option<String> {
    let sid = output
        .lines()
        .next()?
        .split(',')
        .nth(1)?
        .trim()
        .trim_matches('"');
    if sid.starts_with("S-1-5-")
        && sid
            .chars()
            .all(|character| character.is_ascii_digit() || character == '-' || character == 'S')
    {
        Some(sid.to_string())
    } else {
        None
    }
}

fn copy_text_to_clipboard(value: &str) -> Result<(), ControlError> {
    let mut wide: Vec<u16> = value.encode_utf16().chain(std::iter::once(0)).collect();
    let byte_count = wide.len() * std::mem::size_of::<u16>();

    unsafe {
        if OpenClipboard(null_mut()) == 0 {
            wide.fill(0);
            return Err(clipboard_error());
        }
        if EmptyClipboard() == 0 {
            wide.fill(0);
            CloseClipboard();
            return Err(clipboard_error());
        }

        let memory = GlobalAlloc(GMEM_MOVEABLE, byte_count);
        if memory.is_null() {
            wide.fill(0);
            CloseClipboard();
            return Err(clipboard_error());
        }
        let destination = GlobalLock(memory) as *mut u16;
        if destination.is_null() {
            wide.fill(0);
            GlobalFree(memory);
            CloseClipboard();
            return Err(clipboard_error());
        }
        copy_nonoverlapping(wide.as_ptr(), destination, wide.len());
        GlobalUnlock(memory);

        let clipboard_handle = SetClipboardData(CF_UNICODETEXT as u32, memory as HANDLE);
        if clipboard_handle.is_null() {
            wide.fill(0);
            GlobalFree(memory);
            CloseClipboard();
            return Err(clipboard_error());
        }
        wide.fill(0);
        CloseClipboard();
    }
    Ok(())
}

fn clipboard_error() -> ControlError {
    secret_error(
        "clipboard_unavailable",
        "The setup code could not be copied. Close other clipboard tools and try again.",
    )
}

fn permission_error() -> ControlError {
    secret_error(
        "administrator_required",
        "Windows administrator approval is required to protect the Daymark setup code.",
    )
}

fn secret_error(code: &'static str, message: &'static str) -> ControlError {
    ControlError::new(code, message)
}

#[cfg(test)]
mod tests {
    use super::{
        generate_setup_code, parse_current_user_sid, protect_for_local_machine,
        unprotect_for_local_machine,
    };

    #[test]
    fn generated_setup_codes_use_the_expected_private_format() {
        let code = generate_setup_code().expect("Windows CNG should generate a setup code");
        let groups: Vec<&str> = code.split('-').collect();

        assert_eq!(groups.len(), 4);
        assert!(groups.iter().all(|group| group.len() == 5));
        assert!(code
            .chars()
            .filter(|character| *character != '-')
            .all(|character| "0123456789ABCDEFGHJKMNPQRSTVWXYZ".contains(character)));
    }

    #[test]
    fn machine_protection_round_trips_without_storing_plaintext() {
        let plaintext = b"AAAAA-AAAAA-AAAAA-AAAAA";
        let protected = protect_for_local_machine(plaintext)
            .expect("Windows DPAPI should protect the setup code");

        assert!(!protected
            .windows(plaintext.len())
            .any(|window| window == plaintext));
        assert_eq!(
            unprotect_for_local_machine(&protected)
                .expect("Windows DPAPI should recover the setup code"),
            plaintext,
        );
    }

    #[test]
    fn installer_identity_sid_is_parsed_without_using_the_localised_account_name() {
        assert_eq!(
            parse_current_user_sid("\"DESKTOP\\Lloyd\",\"S-1-5-21-100-200-300-1001\"\r\n"),
            Some("S-1-5-21-100-200-300-1001".to_string()),
        );
        assert_eq!(parse_current_user_sid("unexpected output"), None);
    }
}

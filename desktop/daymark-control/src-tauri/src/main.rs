#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use daymark_control::{backups, secrets, service, setup_profile, status, tunnel};
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .manage(service::ServiceController::new())
        .manage(tunnel::TunnelController::new())
        .invoke_handler(tauri::generate_handler![
            status::get_runtime_status,
            status::open_local_url,
            setup_profile::open_setup_profile_import,
            service::start_runtime,
            service::stop_runtime,
            service::restart_runtime,
            service::set_runtime_mode,
            secrets::get_setup_state,
            secrets::reveal_setup_code,
            secrets::copy_setup_code,
            backups::create_backup,
            backups::verify_backup,
            backups::restore_backup,
            tunnel::start_quick_tunnel,
            tunnel::stop_tunnel,
            tunnel::begin_permanent_tunnel_login,
            tunnel::save_permanent_tunnel_token
        ])
        .run(tauri::generate_context!())
        .expect("unable to start Daymark Control");
}

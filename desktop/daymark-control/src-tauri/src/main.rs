#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use daymark_control::{backups, secrets, service, status, tunnel};

fn main() {
    tauri::Builder::default()
        .manage(service::ServiceController::new())
        .manage(tunnel::TunnelController::new())
        .invoke_handler(tauri::generate_handler![
            status::get_runtime_status,
            status::open_local_url,
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

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod contracts;
mod service;
mod status;

fn main() {
    tauri::Builder::default()
        .manage(service::ServiceController::new())
        .invoke_handler(tauri::generate_handler![
            status::get_runtime_status,
            status::open_local_url,
            service::start_runtime,
            service::stop_runtime,
            service::set_runtime_mode
        ])
        .run(tauri::generate_context!())
        .expect("unable to start Daymark Control");
}

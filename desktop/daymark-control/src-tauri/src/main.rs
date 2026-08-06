#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod contracts;
mod status;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            status::get_runtime_status,
            status::open_local_url
        ])
        .run(tauri::generate_context!())
        .expect("unable to start Daymark Control");
}

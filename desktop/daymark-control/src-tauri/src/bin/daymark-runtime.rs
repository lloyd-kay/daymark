fn main() {
    let result = if std::env::args().nth(1).as_deref() == Some("--ensure-setup") {
        daymark_control::secrets::ensure_setup_code().map(|_| 0)
    } else {
        daymark_control::runtime_launcher::run_runtime()
    };

    match result {
        Ok(code) => std::process::exit(code),
        Err(_) => {
            eprintln!(
                "Daymark runtime could not start. Open Daymark Control for recovery options."
            );
            std::process::exit(1);
        }
    }
}

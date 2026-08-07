fn main() {
    let result = match std::env::args().nth(1).as_deref() {
        Some("--prepare-install") => {
            daymark_control::secrets::prepare_data_directories().map(|_| 0)
        }
        Some("--ensure-setup") | Some("--ensure-setup-code") => {
            daymark_control::secrets::ensure_setup_code().map(|_| 0)
        }
        Some("--migrate") => daymark_control::runtime_launcher::run_runtime_command("migrate"),
        Some("--backup") => daymark_control::runtime_launcher::run_runtime_command("backup"),
        Some("--health") => daymark_control::runtime_launcher::run_runtime_command("health"),
        Some("--wait-for-health") => wait_for_health(),
        None => daymark_control::runtime_launcher::run_runtime(),
        Some(_) => Err(daymark_control::contracts::ControlError::new(
            "unknown_runtime_action",
            "Daymark received an unsupported installer action.",
        )),
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

fn wait_for_health() -> Result<i32, daymark_control::contracts::ControlError> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(60);
    while std::time::Instant::now() < deadline {
        if matches!(
            daymark_control::runtime_launcher::run_runtime_command("health"),
            Ok(0)
        ) {
            return Ok(0);
        }
        std::thread::sleep(std::time::Duration::from_secs(2));
    }
    Err(daymark_control::contracts::ControlError::new(
        "runtime_health_timeout",
        "Daymark did not become ready within 60 seconds. Open Daymark Control for recovery options.",
    ))
}

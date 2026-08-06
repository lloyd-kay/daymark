use std::fs;
use std::path::PathBuf;

fn repository_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
}

#[test]
fn winsw_service_is_automatic_recoverable_and_bounded() {
    let xml_path = repository_root().join("packaging/windows/DaymarkService.xml");
    let xml = fs::read_to_string(xml_path).expect("DaymarkService.xml must exist");

    assert!(xml.contains("<id>Daymark</id>"));
    assert!(xml.contains("<startmode>Automatic</startmode>"));
    assert!(xml.contains("<onfailure action=\"restart\""));
    assert!(xml.contains("<stoptimeout>30 sec</stoptimeout>"));
    assert!(xml.contains("<log mode=\"roll-by-size\">"));
    assert!(xml.contains("%ProgramData%\\Daymark\\logs"));
    assert!(xml.contains("runtime\\local\\cli.ts&quot; start"));
    assert!(!xml.contains("DAYMARK_SETUP_CODE"));
}

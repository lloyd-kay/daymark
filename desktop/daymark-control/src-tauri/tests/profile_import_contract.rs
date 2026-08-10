// The neutral test-binary name avoids Windows installer-detection heuristics.
use std::fs;
use std::path::PathBuf;

use daymark_control::setup_profile::{parse_setup_profile_uri, validate_setup_profile_code};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct SetupProfileVectors {
    valid: Vec<ValidVector>,
    invalid: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ValidVector {
    code: String,
    version: u8,
    journey: String,
    layout: String,
}

#[test]
fn setup_profile_vectors_match_the_shared_typescript_contract() {
    let vector_path =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../lib/setup-profile-vectors.json");
    let vectors: SetupProfileVectors = serde_json::from_str(
        &fs::read_to_string(vector_path).expect("shared setup-profile vectors must be readable"),
    )
    .expect("shared setup-profile vectors must decode");

    for vector in vectors.valid {
        assert!(matches!(vector.version, 1 | 2));
        assert!(matches!(
            vector.journey.as_str(),
            "catalogue" | "page-service"
        ));
        if vector.version == 1 {
            assert_eq!(vector.journey, "catalogue");
        }
        assert!(matches!(vector.layout.as_str(), "floating" | "inline"));
        assert_eq!(
            validate_setup_profile_code(&vector.code).expect("valid shared vector"),
            vector.code
        );
        let uri = format!("daymark://import-setup?code={}", vector.code);
        let parsed = parse_setup_profile_uri(&uri).expect("valid shared URI vector");
        assert_eq!(parsed.code, vector.code);
        assert_eq!(
            parsed.local_url,
            format!(
                "http://127.0.0.1:3210/setup-profile/import?code={}",
                vector.code
            )
        );
    }

    for code in vectors.invalid {
        assert!(
            validate_setup_profile_code(&code).is_err(),
            "accepted {code}"
        );
        assert!(
            parse_setup_profile_uri(&format!("daymark://import-setup?code={code}")).is_err(),
            "accepted URI for {code}"
        );
    }
}

#[test]
fn accepts_all_canonical_v1_and_v2_daymark_setup_uris() {
    for (uri, code) in [
        ("daymark://import-setup?code=DM1-C-F-2ZE7", "DM1-C-F-2ZE7"),
        ("daymark://import-setup?code=DM1-C-I-355C", "DM1-C-I-355C"),
        ("daymark://import-setup?code=DM2-C-F-36UR", "DM2-C-F-36UR"),
        ("daymark://import-setup?code=DM2-C-I-2SPS", "DM2-C-I-2SPS"),
        ("daymark://import-setup?code=DM2-P-F-34D6", "DM2-P-F-34D6"),
        ("daymark://import-setup?code=DM2-P-I-2Y6D", "DM2-P-I-2Y6D"),
    ] {
        let parsed = parse_setup_profile_uri(uri).expect("canonical URI must be accepted");
        assert_eq!(parsed.code, code);
        assert_eq!(
            parsed.local_url,
            format!("http://127.0.0.1:3210/setup-profile/import?code={code}")
        );
    }
}

#[test]
fn rejects_every_ambiguous_or_extended_uri_boundary() {
    let invalid = [
        "Daymark://import-setup?code=DM1-C-F-2ZE7",
        "daymark://Import-setup?code=DM1-C-F-2ZE7",
        "daymark://import-setup/extra?code=DM1-C-F-2ZE7",
        "daymark://user@import-setup?code=DM1-C-F-2ZE7",
        "daymark://import-setup:80?code=DM1-C-F-2ZE7",
        "daymark://import-setup?code=DM1-C-F-2ZE7#fragment",
        "daymark://import-setup",
        "daymark://import-setup?",
        "daymark://import-setup?code=DM1-C-F-2ZE7&code=DM1-C-I-355C",
        "daymark://import-setup?code=DM1-C-F-2ZE7&extra=1",
        "daymark://import-setup?extra=1&code=DM1-C-F-2ZE7",
        "daymark://import-setup?code=DM1-C-F-2ZE7&",
        "daymark://import-setup?code=%20DM1-C-F-2ZE7",
        "daymark://import-setup?code=DM1-C-F-2ZE7%20",
        "daymark://import-setup?code=DM1%2DC%2DF%2D2ZE7",
        "daymark://import-setup?code=dm1-c-f-2ze7",
        "daymark://import-setup?code=DM1-C-F-2ZE8",
        "daymark://import-setup?code=DM2-C-F-2ZE7",
        "daymark://import-setup?code=DM1-X-F-2ZE7",
        "daymark://import-setup?code=DM1-C-X-2ZE7",
        "daymark://import-setup?code=DM1-C-F-2ZE7-EXTRA",
        "daymark://import-setup?code=DM1-C-F-2ZÉ7",
        " daymark://import-setup?code=DM1-C-F-2ZE7",
        "daymark://import-setup?code=DM1-C-F-2ZE7 ",
    ];

    for uri in invalid {
        let error = parse_setup_profile_uri(uri).expect_err(uri);
        assert!(!error.message.contains(uri));
        assert!(!error.message.contains("DM1-C-F-2ZE7"));
    }

    let oversized = format!("daymark://import-setup?code={}", "A".repeat(257));
    assert!(oversized.len() > 256);
    assert!(parse_setup_profile_uri(&oversized).is_err());
}

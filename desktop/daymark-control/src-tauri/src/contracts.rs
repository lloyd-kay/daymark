use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum RuntimeState {
    Running,
    Stopped,
    Starting,
    NeedsAttention,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum RuntimeMode {
    Service,
    Manual,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum AccessState {
    Local,
    Temporary,
    Permanent,
    Error,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    pub state: RuntimeState,
    pub mode: RuntimeMode,
    pub access: AccessState,
    pub local_url: String,
    pub public_url: Option<String>,
    pub version: String,
    pub latest_migration: String,
    pub message: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct ControlError {
    pub code: &'static str,
    pub message: String,
}

impl ControlError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

use axum::{
    body::Bytes,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::bundle::Query as BundleQuery;
use crate::db::Database;

pub struct AppState {
    pub db: Arc<dyn Database>,
    pub cache: Mutex<lru::LruCache<String, Vec<u8>>>,
}

#[derive(Deserialize, Serialize, Debug, Default)]
pub struct QueryParams {
    #[serde(rename = "type")]
    pub query_type: String,
    pub persist: Option<bool>,
    pub sql: Option<String>,
    pub name: Option<String>,
    pub queries: Option<Vec<BundleQuery>>,
}

pub enum QueryResponse {
    Json(String),
    Arrow(Vec<u8>),
    WebSocket(Response),
    BadRequest,
    Empty,
}

impl IntoResponse for QueryResponse {
    fn into_response(self) -> Response {
        match self {
            QueryResponse::Json(value) => (
                StatusCode::OK,
                [("Content-Type", mime::APPLICATION_JSON.as_ref())],
                value,
            )
                .into_response(),
            QueryResponse::Arrow(bytes) => (
                StatusCode::OK,
                [("Content-Type", mime::APPLICATION_OCTET_STREAM.as_ref())],
                Bytes::from(bytes),
            )
                .into_response(),
            QueryResponse::WebSocket(response) => response,
            QueryResponse::BadRequest => StatusCode::BAD_REQUEST.into_response(),
            QueryResponse::Empty => StatusCode::OK.into_response(),
        }
    }
}

pub struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        tracing::error!("Error: {:?}", self.0);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Something went wrong: {}", self.0),
        )
            .into_response()
    }
}

impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}

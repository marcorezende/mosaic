use crate::{
    interfaces::{AppError, QueryResponse},
    AppState,
};
use axum::extract::ws::{Message, WebSocket};
use serde_json::json;
use std::sync::Arc;

pub async fn handle(mut socket: WebSocket, state: Arc<AppState>) {
    while let Some(msg) = socket.recv().await {
        if let Ok(msg) = msg {
            match msg {
                Message::Text(text) => {
                    let response = handle_message(text, state.clone()).await;
                    if match response {
                        Err(error) => match error {
                            AppError::BadRequest => {
                                socket
                                    .send(Message::Text(
                                        json!({"error": "Bad request"}).to_string(),
                                    ))
                                    .await
                            }
                            AppError::Error(error) => {
                                socket
                                    .send(Message::Text(
                                        json!({"error": format!("{}", error)}).to_string(),
                                    ))
                                    .await
                            }
                        },
                        Ok(result) => match result {
                            QueryResponse::Arrow(arrow) => {
                                socket.send(Message::Binary(arrow)).await
                            }
                            QueryResponse::Json(json) => socket.send(Message::Text(json)).await,
                            QueryResponse::Empty => {
                                socket.send(Message::Text("{}".to_string())).await
                            }
                            QueryResponse::Response(_) => {
                                socket
                                    .send(Message::Text(
                                        json!({"error": "Unknown response Type"}).to_string(),
                                    ))
                                    .await
                            }
                        },
                    }
                    .is_err()
                    {
                        break;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        } else {
            break;
        }
    }
}

async fn handle_message(message: String, state: Arc<AppState>) -> Result<QueryResponse, AppError> {
    let params = serde_json::from_str(&message)?;
    crate::query::handle(state, params).await
}

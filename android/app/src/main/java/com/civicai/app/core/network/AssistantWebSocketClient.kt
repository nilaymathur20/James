package com.civicai.app.core.network

import com.civicai.app.data.model.CitationDto
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

@Serializable
data class WsEvent(
    val type: String,
    val request_id: String? = null,
    val message: String? = null,
    val text: String? = null,
    val delta: String? = null,
    val thought: String? = null,
    val step: Int? = null,
    val tool: String? = null,
    val status: String? = null,
    val citations: List<CitationDto>? = null
)

class AssistantWebSocketClient(
    private val client: OkHttpClient,
    private val json: Json = Json { ignoreUnknownKeys = true; isLenient = true }
) {
    fun connectAndStream(wsUrl: String, prompt: String): Flow<WsEvent> = callbackFlow {
        val request = Request.Builder().url(wsUrl).build()

        val listener = object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                // Protocol handshake ping / assistant request
                val payload = """
                    {
                        "type": "request",
                        "request_id": "req_${System.currentTimeMillis()}",
                        "input": {
                            "text": ${json.encodeToString(kotlinx.serialization.serializer(), prompt)},
                            "source": "typed",
                            "use_history": true
                        }
                    }
                """.trimIndent()
                webSocket.send(payload)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val event = json.decodeFromString<WsEvent>(text)
                    trySend(event)
                    if (event.type == "assistant_result" || event.type == "error") {
                        webSocket.close(1000, "Done")
                    }
                } catch (_: Exception) {}
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                trySend(WsEvent(type = "error", message = t.localizedMessage ?: "WebSocket connection failed"))
                close()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                close()
            }
        }

        val webSocket = client.newWebSocket(request, listener)

        awaitClose {
            webSocket.close(1000, "Client cancelled")
        }
    }
}

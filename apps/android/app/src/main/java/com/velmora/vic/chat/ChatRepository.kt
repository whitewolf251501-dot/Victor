package com.velmora.vic.chat

import android.content.Context
import com.velmora.vic.core.VicConfig
import com.velmora.vic.core.VicSessionManager
import com.velmora.vic.core.VicSupabase
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

class ChatRepository(private val context: Context) {
    private val httpClient = HttpClient(Android) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                prettyPrint = false
            })
        }
    }

    suspend fun sendMessage(message: String, conversationId: String?): Result<ChatResponsePayload> = withContext(Dispatchers.IO) {
        try {
            val session = VicSupabase.get().auth.currentSessionOrNull()
            val token = session?.accessToken ?: VicSessionManager.getAccessToken(context)
                ?: throw IllegalStateException("Active authentication token not found. Please log in.")

            val url = "${VicConfig.webApiUrl}/api/victor/chat"
            val response: HttpResponse = httpClient.post(url) {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Authorization, "Bearer $token")
                setBody(ChatRequestBody(
                    message = message,
                    conversationId = conversationId,
                    deviceType = "android"
                ))
            }

            if (response.status.isSuccess()) {
                val payload = response.body<ChatResponsePayload>()
                Result.success(payload)
            } else {
                val errBody = response.bodyAsText()
                Result.failure(Exception("Victor Web API error (${response.status.value}): $errBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getConversations(): Result<List<ConversationRecord>> = withContext(Dispatchers.IO) {
        try {
            val conversations = VicSupabase.get().postgrest["conversations"]
                .select {
                    order("updated_at", Order.DESCENDING)
                }
                .decodeList<ConversationRecord>()
            Result.success(conversations)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getMessages(conversationId: String): Result<List<MessageRecord>> = withContext(Dispatchers.IO) {
        try {
            val messages = VicSupabase.get().postgrest["messages"]
                .select {
                    filter {
                        eq("conversation_id", conversationId)
                    }
                    order("created_at", Order.ASCENDING)
                }
                .decodeList<MessageRecord>()
            Result.success(messages)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

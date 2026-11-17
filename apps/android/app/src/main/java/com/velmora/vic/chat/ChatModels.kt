package com.velmora.vic.chat

import kotlinx.serialization.Serializable

@Serializable
data class ConversationRecord(
    val id: String,
    val owner_id: String,
    val device_id: String? = null,
    val title: String? = null,
    val created_at: String,
    val updated_at: String
)

@Serializable
data class MessageRecord(
    val id: String,
    val conversation_id: String,
    val owner_id: String,
    val role: String,
    val content: String,
    val device_id: String? = null,
    val created_at: String
)

@Serializable
data class ChatRequestBody(
    val message: String,
    val conversationId: String? = null,
    val deviceType: String = "android"
)

@Serializable
data class ChatResponsePayload(
    val response: String,
    val conversationId: String,
    val messageId: String? = null,
    val approvalToken: String? = null
)

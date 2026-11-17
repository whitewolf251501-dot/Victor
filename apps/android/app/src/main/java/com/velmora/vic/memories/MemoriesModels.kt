package com.velmora.vic.memories

import kotlinx.serialization.Serializable

@Serializable
data class MemoryRecord(
    val id: String,
    val owner_id: String,
    val category: String,
    val content: String,
    val importance: String = "medium",
    val source: String? = null,
    val created_at: String,
    val updated_at: String
)

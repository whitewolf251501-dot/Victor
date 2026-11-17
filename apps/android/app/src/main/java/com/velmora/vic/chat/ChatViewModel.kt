package com.velmora.vic.chat

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.velmora.vic.voice.VoiceOutputManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

data class ChatUiState(
    val currentConversationId: String? = null,
    val messages: List<MessageRecord> = emptyList(),
    val isThinking: Boolean = false,
    val error: String? = null,
    val activeApprovalToken: String? = null
)

class ChatViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = ChatRepository(application)

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    init {
        initializeConversation()
    }

    fun initializeConversation() {
        viewModelScope.launch {
            _uiState.update { it.copy(isThinking = true, error = null) }
            val convResult = repository.getConversations()
            convResult.fold(
                onSuccess = { conversations ->
                    if (conversations.isNotEmpty()) {
                        val activeConv = conversations.first()
                        _uiState.update { it.copy(currentConversationId = activeConv.id) }
                        loadMessages(activeConv.id)
                    } else {
                        _uiState.update { it.copy(isThinking = false) }
                    }
                },
                onFailure = { err ->
                    _uiState.update { it.copy(isThinking = false, error = err.message) }
                }
            )
        }
    }

    fun loadMessages(conversationId: String) {
        viewModelScope.launch {
            val msgResult = repository.getMessages(conversationId)
            msgResult.fold(
                onSuccess = { msgs ->
                    _uiState.update { it.copy(messages = msgs, isThinking = false, error = null) }
                },
                onFailure = { err ->
                    _uiState.update { it.copy(isThinking = false, error = err.message) }
                }
            )
        }
    }

    fun sendMessage(text: String) {
        val trimmed = text.trim()
        if (trimmed.isBlank() || _uiState.value.isThinking) return

        // Stop any active speech on new input
        VoiceOutputManager.stop()

        val convId = _uiState.value.currentConversationId

        // Optimistically add user message to list
        val tempUserMsg = MessageRecord(
            id = UUID.randomUUID().toString(),
            conversation_id = convId ?: "pending",
            owner_id = "current",
            role = "user",
            content = trimmed,
            created_at = Instant.now().toString()
        )

        _uiState.update {
            it.copy(
                messages = it.messages + tempUserMsg,
                isThinking = true,
                error = null
            )
        }

        viewModelScope.launch {
            val result = repository.sendMessage(trimmed, convId)
            result.fold(
                onSuccess = { payload ->
                    val resolvedConvId = payload.conversationId
                    _uiState.update {
                        it.copy(
                            currentConversationId = resolvedConvId,
                            isThinking = false,
                            activeApprovalToken = payload.approvalToken,
                            error = null
                        )
                    }
                    // Refresh canonical message list from Supabase
                    loadMessages(resolvedConvId)

                    // Vocalize response if TTS enabled
                    if (VoiceOutputManager.isTtsEnabled(getApplication())) {
                        VoiceOutputManager.speak(payload.response)
                    }
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isThinking = false,
                            error = err.message ?: "Failed to transmit directive to Victor."
                        )
                    }
                }
            )
        }
    }

    fun startNewConversation() {
        _uiState.update {
            it.copy(
                currentConversationId = null,
                messages = emptyList(),
                error = null,
                activeApprovalToken = null
            )
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

package com.velmora.vic.memories

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.velmora.vic.core.VicSupabase
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class MemoriesUiState(
    val memories: List<MemoryRecord> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

class MemoriesViewModel(application: Application) : AndroidViewModel(application) {
    private val _uiState = MutableStateFlow(MemoriesUiState())
    val uiState: StateFlow<MemoriesUiState> = _uiState.asStateFlow()

    init {
        loadMemories()
    }

    fun loadMemories() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val list = withContext(Dispatchers.IO) {
                    VicSupabase.get().postgrest["memories"]
                        .select {
                            order("created_at", Order.DESCENDING)
                        }
                        .decodeList<MemoryRecord>()
                }
                _uiState.update { it.copy(memories = list, isLoading = false, error = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Failed to load memory store.") }
            }
        }
    }
}

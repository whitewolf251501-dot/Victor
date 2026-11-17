package com.velmora.vic.auth

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.velmora.vic.device.DeviceManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
    val isLoading: Boolean = false,
    val isAuthenticated: Boolean = false,
    val error: String? = null,
    val magicLinkSent: Boolean = false
)

class AuthViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = AuthRepository(application)
    private val deviceManager = DeviceManager(application)

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        checkAuthStatus()
    }

    fun checkAuthStatus() {
        viewModelScope.launch {
            val loggedIn = repository.isUserLoggedIn()
            _uiState.update { it.copy(isAuthenticated = loggedIn) }
            if (loggedIn) {
                // Ensure device is registered and online
                deviceManager.onAppStart()
            }
        }
    }

    fun signInWithPassword(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.update { it.copy(error = "Please provide both email and password.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val result = repository.signInWithPassword(email.trim(), password)
            result.fold(
                onSuccess = { user ->
                    _uiState.update { it.copy(isLoading = false, isAuthenticated = true, error = null) }
                    // Register device on first login / update status
                    deviceManager.onFirstLogin(user.id)
                    deviceManager.onAppStart()
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = err.message ?: "Authentication failed. Check credentials."
                        )
                    }
                }
            )
        }
    }

    fun signInWithMagicLink(email: String) {
        if (email.isBlank()) {
            _uiState.update { it.copy(error = "Please enter your email address.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null, magicLinkSent = false) }
            val result = repository.signInWithMagicLink(email.trim())
            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isLoading = false, magicLinkSent = true, error = null) }
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = err.message ?: "Failed to transmit magic link."
                        )
                    }
                }
            )
        }
    }

    fun signOut() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            deviceManager.onAppBackground()
            repository.signOut()
            _uiState.update { AuthUiState(isAuthenticated = false) }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

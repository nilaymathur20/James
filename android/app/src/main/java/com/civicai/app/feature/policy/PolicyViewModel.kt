package com.civicai.app.feature.policy

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.civicai.app.core.network.NetworkModule
import com.civicai.app.core.network.NetworkResult
import com.civicai.app.data.model.FAQQueryRequest
import com.civicai.app.data.model.GroundedAnswerResponseDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class PolicyViewModel : ViewModel() {
    private val apiService = NetworkModule.createApiService()

    private val _uiState = MutableStateFlow<NetworkResult<GroundedAnswerResponseDto>?>(null)
    val uiState: StateFlow<NetworkResult<GroundedAnswerResponseDto>?> = _uiState.asStateFlow()

    fun askQuestion(query: String) {
        if (query.isBlank()) return

        _uiState.value = NetworkResult.Loading
        viewModelScope.launch {
            try {
                val response = apiService.queryFAQ(FAQQueryRequest(query))
                if (response.isSuccessful && response.body() != null) {
                    _uiState.value = NetworkResult.Success(response.body()!!)
                } else {
                    _uiState.value = NetworkResult.Error("Backend error: ${response.code()} ${response.message()}")
                }
            } catch (e: Exception) {
                _uiState.value = NetworkResult.Error("Network error: ${e.localizedMessage}")
            }
        }
    }
}

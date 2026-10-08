package com.civicai.app.feature.notice

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.civicai.app.core.network.NetworkModule
import com.civicai.app.core.network.NetworkResult
import com.civicai.app.data.model.AnalyzeNoticeRequest
import com.civicai.app.data.model.NoticeAnalysisResponseDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class NoticeViewModel : ViewModel() {
    private val apiService = NetworkModule.createApiService()

    private val _analysisState = MutableStateFlow<NetworkResult<NoticeAnalysisResponseDto>?>(null)
    val analysisState: StateFlow<NetworkResult<NoticeAnalysisResponseDto>?> = _analysisState.asStateFlow()

    fun analyzeNoticeText(text: String, targetLanguage: String) {
        if (text.isBlank()) return

        _analysisState.value = NetworkResult.Loading
        viewModelScope.launch {
            try {
                val response = apiService.analyzeNotice(AnalyzeNoticeRequest(text, targetLanguage))
                if (response.isSuccessful && response.body() != null) {
                    _analysisState.value = NetworkResult.Success(response.body()!!)
                } else {
                    _analysisState.value = NetworkResult.Error("Notice analysis failed: ${response.code()} ${response.message()}")
                }
            } catch (e: Exception) {
                _analysisState.value = NetworkResult.Error("Network error: ${e.localizedMessage}")
            }
        }
    }
}

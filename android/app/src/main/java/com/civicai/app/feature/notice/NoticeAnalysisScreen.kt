package com.civicai.app.feature.notice

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.civicai.app.core.components.WarningCard
import com.civicai.app.core.network.NetworkResult
import com.civicai.app.core.theme.CivicBluePrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoticeAnalysisScreen(
    onNavigateBack: () -> Unit,
    viewModel: NoticeViewModel = viewModel()
) {
    var rawText by remember { mutableStateOf("सार्वजनिक सूचना: नगर निगम के समस्त नागरिकों को सूचित किया जाता है कि वर्ष 2026 के जल कर एवं गृह कर का भुगतान 15 नवंबर 2026 से पूर्व जमा करें।") }
    var selectedLanguage by remember { mutableStateOf("English") }
    var expanded by remember { mutableStateOf(false) }
    val languages = listOf("English", "Hindi", "Marathi", "Gujarati", "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam", "Urdu")

    val analysisState by viewModel.analysisState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notice AI Translation & Analysis", color = MaterialTheme.colorScheme.onPrimary) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.onPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CivicBluePrimary)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp)
        ) {
            OutlinedTextField(
                value = rawText,
                onValueChange = { rawText = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp),
                label = { Text("Government Notice / Circular Text (OCR Output)") }
            )

            Spacer(modifier = Modifier.height(12.dp))

            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = !expanded }
            ) {
                OutlinedTextField(
                    value = selectedLanguage,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Target Language") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth()
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    languages.forEach { lang ->
                        DropdownMenuItem(
                            text = { Text(lang) },
                            onClick = {
                                selectedLanguage = lang
                                expanded = false
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = { viewModel.analyzeNoticeText(rawText, selectedLanguage) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Translate, contentDescription = null)
                Spacer(modifier = Modifier.padding(start = 8.dp))
                Text("Analyze & Translate Notice")
            }

            Spacer(modifier = Modifier.height(16.dp))

            when (val state = analysisState) {
                is NetworkResult.Loading -> {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator(color = CivicBluePrimary)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Translating notice, extracting jargon & running fraud check...")
                    }
                }
                is NetworkResult.Error -> {
                    WarningCard(warningText = state.message)
                }
                is NetworkResult.Success -> {
                    val res = state.data
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        item {
                            Text(
                                text = "Faithful Translation ($selectedLanguage)",
                                style = MaterialTheme.typography.titleMedium,
                                color = CivicBluePrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = res.translation,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                        }

                        res.fraudCheck?.let { warning ->
                            item {
                                WarningCard(warningText = warning)
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        if (res.summary.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Executive 3-Bullet Summary",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                res.summary.forEach { bullet ->
                                    Text(text = bullet, style = MaterialTheme.typography.bodySmall)
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        if (res.jargon.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Government Jargon Explanations",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                            }
                            items(res.jargon) { item ->
                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        Text(text = item.term, style = MaterialTheme.typography.titleSmall, color = CivicBluePrimary)
                                        Text(text = item.explanation, style = MaterialTheme.typography.bodySmall)
                                    }
                                }
                            }
                        }
                    }
                }
                null -> {}
            }
        }
    }
}

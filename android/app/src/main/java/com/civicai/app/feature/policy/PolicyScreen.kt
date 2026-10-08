package com.civicai.app.feature.policy

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import com.civicai.app.core.components.CitationCard
import com.civicai.app.core.components.WarningCard
import com.civicai.app.core.network.NetworkResult
import com.civicai.app.core.theme.CivicBluePrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PolicyScreen(
    onNavigateBack: () -> Unit,
    viewModel: PolicyViewModel = viewModel()
) {
    var queryText by remember { mutableStateOf("") }
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Municipal Policy Q&A", color = MaterialTheme.colorScheme.onPrimary) },
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = queryText,
                    onValueChange = { queryText = it },
                    modifier = Modifier.weight(1f),
                    label = { Text("Ask a municipal policy question") },
                    placeholder = { Text("e.g. What are the housing scheme rules?") },
                    singleLine = true
                )
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = { viewModel.askQuestion(queryText) },
                    modifier = Modifier.height(56.dp)
                ) {
                    Icon(Icons.Default.Send, contentDescription = "Submit")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            when (val state = uiState) {
                is NetworkResult.Loading -> {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator(color = CivicBluePrimary)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Searching official municipal database & grounding citations...")
                    }
                }
                is NetworkResult.Error -> {
                    WarningCard(warningText = state.message)
                }
                is NetworkResult.Success -> {
                    val data = state.data
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        item {
                            Text(
                                text = "Grounded Answer",
                                style = MaterialTheme.typography.titleMedium,
                                color = CivicBluePrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = data.answer,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                        }

                        data.fraudWarning?.let { warning ->
                            item {
                                WarningCard(warningText = warning)
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        if (data.citations.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Source Document Citations (${data.citations.size})",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                            }
                            items(data.citations) { citation ->
                                CitationCard(citation = citation)
                            }
                        }
                    }
                }
                null -> {
                    Text(
                        text = "Enter a question above to retrieve source-grounded policy information with exact document page citations.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

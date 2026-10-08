package com.civicai.app.core.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.civicai.app.core.theme.CivicBluePrimary
import com.civicai.app.core.theme.CivicWarningBg
import com.civicai.app.core.theme.CivicWarningBorder
import com.civicai.app.data.model.CitationDto

@Composable
fun CitationCard(
    citation: CitationDto,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            Icon(
                imageVector = Icons.Default.Description,
                contentDescription = "Source Citation",
                tint = CivicBluePrimary
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(
                    text = citation.documentId ?: citation.source ?: "Municipal Policy Circular",
                    style = MaterialTheme.typography.titleSmall,
                    color = CivicBluePrimary
                )
                Text(
                    text = "Page ${citation.page ?: 1} | Grounding Score: ${(citation.score ?: 0.8) * 100}%",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                citation.snippet?.let { snippet ->
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = snippet,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 3
                    )
                }
            }
        }
    }
}

@Composable
fun WarningCard(
    warningText: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(CivicWarningBg)
            .border(1.dp, CivicWarningBorder, RoundedCornerShape(8.dp))
            .padding(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = "Warning Indicator",
                tint = CivicWarningBorder
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Fraud / Security Alert",
                style = MaterialTheme.typography.titleSmall,
                color = CivicWarningBorder
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = warningText,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

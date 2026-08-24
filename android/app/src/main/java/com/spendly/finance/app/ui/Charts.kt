package com.spendly.finance.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spendly.finance.app.data.CategorySpend
import com.spendly.finance.app.data.MonthlyCashFlow
import com.spendly.finance.app.ui.theme.ExpenseRed
import com.spendly.finance.app.ui.theme.SpendlyTeal

@Composable
fun CashFlowLineChart(items: List<MonthlyCashFlow>, modifier: Modifier = Modifier) {
    val grid = MaterialTheme.colorScheme.outline.copy(alpha = .34f)
    Column(modifier) {
        Canvas(Modifier.fillMaxWidth().height(190.dp)) {
            repeat(4) { index ->
                val y = size.height * index / 3f
                drawLine(grid, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
            }
            val max = items.maxOfOrNull { maxOf(it.income, it.expense) }?.coerceAtLeast(1.0) ?: 1.0
            fun point(index: Int, value: Double): Offset {
                val x = if (items.size <= 1) size.width / 2 else size.width * index / (items.size - 1f)
                return Offset(x, size.height - (value / max).toFloat() * size.height * .88f)
            }
            val incomePath = Path()
            val expensePath = Path()
            val incomeArea = Path()
            items.forEachIndexed { index, item ->
                val income = point(index, item.income)
                val expense = point(index, item.expense)
                if (index == 0) {
                    incomePath.moveTo(income.x, income.y)
                    expensePath.moveTo(expense.x, expense.y)
                    incomeArea.moveTo(income.x, size.height)
                    incomeArea.lineTo(income.x, income.y)
                } else {
                    incomePath.lineTo(income.x, income.y)
                    expensePath.lineTo(expense.x, expense.y)
                    incomeArea.lineTo(income.x, income.y)
                }
            }
            if (items.isNotEmpty()) { incomeArea.lineTo(size.width, size.height); incomeArea.close() }
            drawPath(incomeArea, SpendlyTeal.copy(alpha = .18f))
            drawPath(incomePath, SpendlyTeal, style = Stroke(7f, cap = StrokeCap.Round))
            drawPath(expensePath, ExpenseRed, style = Stroke(5f, cap = StrokeCap.Round))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            items.forEach { Text(it.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center) }
        }
    }
}

@Composable
fun CategoryDonut(items: List<CategorySpend>, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val total = items.sumOf(CategorySpend::amount).coerceAtLeast(1.0)
        val diameter = size.minDimension * .72f
        val origin = Offset((size.width - diameter) / 2f, (size.height - diameter) / 2f)
        var start = -90f
        items.forEach { item ->
            val sweep = (item.amount / total * 360).toFloat()
            drawArc(
                color = spendlyColor(item.color), startAngle = start, sweepAngle = (sweep - 2f).coerceAtLeast(1f),
                useCenter = false, topLeft = origin,
                size = Size(diameter, diameter), style = Stroke(diameter * .18f, cap = StrokeCap.Round),
            )
            start += sweep
        }
    }
}

@Composable
fun CashFlowBarChart(items: List<MonthlyCashFlow>, modifier: Modifier = Modifier) {
    val grid = MaterialTheme.colorScheme.outline.copy(alpha = .28f)
    Canvas(modifier) {
        val max = items.maxOfOrNull { maxOf(it.income, it.expense) }?.coerceAtLeast(1.0) ?: 1.0
        repeat(4) { index ->
            val y = size.height * index / 3f
            drawLine(grid, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
        }
        val group = size.width / items.size.coerceAtLeast(1)
        val bar = group * .28f
        items.forEachIndexed { index, item ->
            val center = group * index + group / 2
            val incomeHeight = (item.income / max).toFloat() * size.height * .9f
            val expenseHeight = (item.expense / max).toFloat() * size.height * .9f
            drawRect(SpendlyTeal, Offset(center - bar - 1f, size.height - incomeHeight), Size(bar, incomeHeight))
            drawRect(ExpenseRed, Offset(center + 1f, size.height - expenseHeight), Size(bar, expenseHeight))
        }
    }
}

fun spendlyColor(hex: String): Color = runCatching {
    Color(android.graphics.Color.parseColor(hex))
}.getOrDefault(SpendlyTeal)

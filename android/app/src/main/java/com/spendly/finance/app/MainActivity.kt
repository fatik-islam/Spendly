package com.spendly.finance.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.spendly.finance.app.ui.SpendlyRoot
import com.spendly.finance.app.ui.SpendlyViewModel
import com.spendly.finance.app.ui.SpendlyViewModelFactory

class MainActivity : ComponentActivity() {
    private val viewModel by viewModels<SpendlyViewModel> {
        SpendlyViewModelFactory((application as SpendlyApplication).repository, application)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        viewModel.start(intent.getBooleanExtra("spendly_demo_ui", false))
        setContent { SpendlyRoot(viewModel) }
    }

    override fun onResume() {
        super.onResume()
        viewModel.onAppResumed()
    }
}

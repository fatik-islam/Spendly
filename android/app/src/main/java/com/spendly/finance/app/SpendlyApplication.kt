package com.spendly.finance.app

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.spendly.finance.app.data.SecureSessionStore
import com.spendly.finance.app.data.SpendlyApi
import com.spendly.finance.app.data.SpendlyRepository
import com.spendly.finance.app.notifications.NotificationHelper

class SpendlyApplication : Application() {
    lateinit var repository: SpendlyRepository
        private set

    override fun onCreate() {
        super.onCreate()
        val sessionStore = SecureSessionStore(this, kotlinx.serialization.json.Json { ignoreUnknownKeys = true })
        repository = SpendlyRepository(SpendlyApi(sessionStore))
        NotificationHelper.createChannels(this)
        initializeFirebaseIfConfigured()
    }

    private fun initializeFirebaseIfConfigured() {
        if (BuildConfig.FIREBASE_APP_ID.isBlank() || BuildConfig.FIREBASE_API_KEY.isBlank() ||
            BuildConfig.FIREBASE_PROJECT_ID.isBlank() || BuildConfig.FIREBASE_SENDER_ID.isBlank()
        ) return
        if (FirebaseApp.getApps(this).isNotEmpty()) return
        val options = FirebaseOptions.Builder()
            .setApplicationId(BuildConfig.FIREBASE_APP_ID)
            .setApiKey(BuildConfig.FIREBASE_API_KEY)
            .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
            .build()
        FirebaseApp.initializeApp(this, options)
    }
}

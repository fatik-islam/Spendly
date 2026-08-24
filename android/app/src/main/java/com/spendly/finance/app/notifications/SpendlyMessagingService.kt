package com.spendly.finance.app.notifications

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class SpendlyMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        getSharedPreferences("spendly_push", MODE_PRIVATE).edit().putString("pending_token", token).apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: message.data["title"] ?: "Spendly"
        val body = message.notification?.body ?: message.data["body"] ?: "You have a new finance reminder."
        NotificationHelper.show(this, title, body, message.data["reminder_id"])
        sendBroadcast(android.content.Intent(ACTION_REFRESH).setPackage(packageName))
    }

    companion object { const val ACTION_REFRESH = "com.spendly.finance.app.REFRESH" }
}

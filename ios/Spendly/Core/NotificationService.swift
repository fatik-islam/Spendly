import Foundation
import UIKit
import UserNotifications

enum SpendlyNotificationStatus: Equatable {
    case notDetermined
    case enabled
    case denied

    var description: String {
        switch self {
        case .notDetermined: "Permission has not been requested yet."
        case .enabled: "Push notifications, sounds, and badges are enabled."
        case .denied: "Notifications are off in iOS Settings."
        }
    }
}

@MainActor
final class NotificationService {
    static let shared = NotificationService()

    private let center = UNUserNotificationCenter.current()
    private let legacyIdentifierPrefix = "spendly.notification."

    private(set) var currentDeviceToken: String?
    private(set) var registrationError: String?
    var onDeviceTokenReceived: ((String, String) -> Void)?

    #if DEBUG
    let environment = "sandbox"
    #else
    let environment = "production"
    #endif

    private init() { }

    func authorizationStatus() async -> SpendlyNotificationStatus {
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral: return .enabled
        case .denied: return .denied
        case .notDetermined: return .notDetermined
        @unknown default: return .notDetermined
        }
    }

    @discardableResult
    func requestAuthorization() async -> SpendlyNotificationStatus {
        if ProcessInfo.processInfo.arguments.contains("-SPENDLY_DEMO_UI") {
            return await authorizationStatus()
        }

        let current = await authorizationStatus()
        if current == .notDetermined {
            do {
                _ = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            } catch {
                registrationError = error.localizedDescription
                return .denied
            }
        }

        let updated = await authorizationStatus()
        if updated == .enabled {
            UIApplication.shared.registerForRemoteNotifications()
        }
        return updated
    }

    func registerForRemoteNotificationsIfAuthorized() async {
        guard await authorizationStatus() == .enabled else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }

    func didRegisterForRemoteNotifications(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        currentDeviceToken = token
        registrationError = nil
        onDeviceTokenReceived?(token, environment)
    }

    func didFailToRegisterForRemoteNotifications(error: Error) {
        registrationError = error.localizedDescription
    }

    func sync(
        reminders: [RecurringReminder],
        recurringTransactions: [RecurringTransaction],
        reminderDaysBefore: Int,
        enabled: Bool,
        requestPermission: Bool = true
    ) async {
        guard !ProcessInfo.processInfo.arguments.contains("-SPENDLY_DEMO_UI") else { return }

        // Build 1 scheduled reminders locally. Remove those requests so build 2
        // receives each reminder exactly once from the shared APNs provider.
        await clearLegacyLocalNotifications()

        guard enabled else {
            try? await center.setBadgeCount(0)
            return
        }

        let status = requestPermission ? await requestAuthorization() : await authorizationStatus()
        guard status == .enabled else { return }

        UIApplication.shared.registerForRemoteNotifications()
        let unreadCount = reminders.filter { $0.dismissedAt == nil && $0.readAt == nil }.count
        try? await center.setBadgeCount(unreadCount)

        // These values remain in the signature because the shared store owns the
        // reminder refresh. Delivery timing is now generated on the backend.
        _ = recurringTransactions
        _ = reminderDaysBefore
    }

    func clearAll() async {
        await clearLegacyLocalNotifications()
        center.removeAllDeliveredNotifications()
        try? await center.setBadgeCount(0)
    }

    func openSystemSettings() {
        guard let url = URL(string: UIApplication.openNotificationSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private func clearLegacyLocalNotifications() async {
        let pending = await center.pendingNotificationRequests()
        let identifiers = pending.map(\.identifier).filter { $0.hasPrefix(legacyIdentifierPrefix) }
        guard !identifiers.isEmpty else { return }
        center.removePendingNotificationRequests(withIdentifiers: identifiers)
        center.removeDeliveredNotifications(withIdentifiers: identifiers)
    }
}

extension Notification.Name {
    static let spendlyRemoteNotificationReceived = Notification.Name("spendly.remote-notification-received")
}

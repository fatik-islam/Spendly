import SwiftUI

@main
struct SpendlyApp: App {
    @UIApplicationDelegateAdaptor(SpendlyAppDelegate.self) private var appDelegate
    @State private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environment(store)
                .tint(SpendlyTheme.teal)
        }
    }
}

struct AppRootView: View {
    @Environment(AppStore.self) private var store
    @AppStorage("spendly.appearance") private var appearance = "system"
    @State private var minimumLaunchAnimationCompleted = false

    var body: some View {
        ZStack {
            switch store.sessionState {
            case .launching:
                SpendlyBackground()
            case .signedOut:
                AuthFlowView()
            case .signedIn:
                MainTabView()
            }

            if store.isLoading && !showsLaunchExperience { LoadingOverlay() }

            if showsLaunchExperience {
                AnimatedLaunchView()
                    .zIndex(10)
                    .transition(.opacity.combined(with: .scale(scale: 1.025)))
            }
        }
        .animation(.easeInOut(duration: 0.45), value: showsLaunchExperience)
        .animation(.easeInOut(duration: 0.2), value: store.sessionState)
        .animation(.easeInOut(duration: 0.2), value: store.isLoading)
        .preferredColorScheme(appearance == "dark" ? .dark : appearance == "light" ? .light : nil)
        .task { await store.start() }
        .task {
            try? await Task.sleep(for: .seconds(1.65))
            withAnimation(.easeInOut(duration: 0.45)) {
                minimumLaunchAnimationCompleted = true
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .spendlyRemoteNotificationReceived)) { _ in
            Task { await store.refreshAll() }
        }
        .alert(
            "Spendly",
            isPresented: Binding(
                get: { store.errorMessage != nil },
                set: { if !$0 { store.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "Something went wrong.")
        }
        .overlay(alignment: .top) {
            if let message = store.noticeMessage {
                Text(message)
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .background(.regularMaterial, in: Capsule())
                    .overlay { Capsule().stroke(SpendlyTheme.teal.opacity(0.25)) }
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .task(id: message) {
                        try? await Task.sleep(for: .seconds(2.4))
                        if store.noticeMessage == message { store.noticeMessage = nil }
                    }
            }
        }
    }

    private var showsLaunchExperience: Bool {
        !minimumLaunchAnimationCompleted || store.sessionState == .launching
    }
}

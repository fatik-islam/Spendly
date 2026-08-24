import SwiftUI
import UniformTypeIdentifiers
import UIKit

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("spendly.appearance") private var appearance = "system"
    @State private var fullName = ""
    @State private var currency: CurrencyCode = .usd
    @State private var reminderDays = 3
    @State private var inAppReminders = true
    @State private var emailReminders = false
    @State private var categoryEditor: CategoryDraft?
    @State private var deletingCategory: Category?
    @State private var exportURL: URL?
    @State private var showsImporter = false
    @State private var importSummary: CSVImportSummary?
    @State private var confirmsDemo = false
    @State private var confirmsSignOut = false
    @State private var showsDeleteAccount = false
    @State private var notificationStatus: SpendlyNotificationStatus = .notDetermined

    var body: some View {
        List {
            profileSection
            appearanceSection
            reminderSection
            dataSection
            categorySection
            securitySection
        }
        .navigationTitle("Settings")
        .spendlyPage()
        .onAppear(perform: hydrate)
        .sheet(item: $categoryEditor) { CategoryEditor(draft: $0) }
        .sheet(item: $exportURL) { url in ActivityView(items: [url]) }
        .sheet(isPresented: $showsDeleteAccount) { DeleteSpendlyAccountView() }
        .fileImporter(isPresented: $showsImporter, allowedContentTypes: [.commaSeparatedText, .plainText], allowsMultipleSelection: false) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                Task { importSummary = await store.importTransactions(from: url) }
            case .failure(let error): store.errorMessage = error.localizedDescription
            }
        }
        .alert("Import summary", isPresented: Binding(get: { importSummary != nil }, set: { if !$0 { importSummary = nil } })) {
            Button("Done", role: .cancel) { importSummary = nil }
        } message: {
            if let summary = importSummary {
                Text("\(summary.message) Processed \(summary.processed) rows. Created \(summary.createdAccounts.count) accounts and \(summary.createdCategories.count) categories.")
            }
        }
        .confirmationDialog("Load demo workspace?", isPresented: $confirmsDemo, titleVisibility: .visible) {
            Button("Load demo workspace") { Task { _ = await store.loadDemoWorkspace() } }
            Button("Cancel", role: .cancel) { }
        } message: { Text("Demo data can only be loaded while the workspace is empty.") }
        .confirmationDialog("Sign out of Spendly?", isPresented: $confirmsSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await store.signOut() } }
            Button("Cancel", role: .cancel) { }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await refreshNotificationStatus() } }
        }
    }

    private var profileSection: some View {
        Section("Profile") {
            TextField("Full name", text: $fullName)
            LabeledContent("Email", value: store.currentUser?.email ?? "")
            Picker("Currency", selection: $currency) { ForEach(CurrencyCode.allCases) { Text($0.rawValue).tag($0) } }
            Button("Save profile") { Task { _ = await store.updateProfile(name: fullName, currency: currency) } }
                .fontWeight(.semibold)
        }
    }

    private var appearanceSection: some View {
        Section("Appearance") {
            Picker("Theme", selection: $appearance) {
                Label("System", systemImage: "circle.lefthalf.filled").tag("system")
                Label("Light", systemImage: "sun.max").tag("light")
                Label("Dark", systemImage: "moon").tag("dark")
            }
        }
    }

    private var reminderSection: some View {
        Section("Recurring reminders") {
            Stepper("Lead time: \(reminderDays) day\(reminderDays == 1 ? "" : "s")", value: $reminderDays, in: 0...30)
            Toggle("App notifications", isOn: $inAppReminders)
                .onChange(of: inAppReminders) { _, enabled in if !enabled { emailReminders = false } }
            Toggle("Email alerts", isOn: $emailReminders).disabled(!inAppReminders)
            Label(notificationStatus.description, systemImage: notificationStatus == .enabled ? "bell.badge.fill" : "bell.slash")
                .font(.caption)
                .foregroundStyle(.secondary)
            if notificationStatus == .denied {
                Button("Open iOS notification settings") { NotificationService.shared.openSystemSettings() }
            }
            Button("Save reminders") {
                Task {
                    _ = await store.updateReminderPreferences(days: reminderDays, inApp: inAppReminders, email: emailReminders)
                    await refreshNotificationStatus()
                }
            }
            .fontWeight(.semibold)
        }
    }

    private var dataSection: some View {
        Section("Workspace data") {
            Menu {
                ForEach(ExportDataset.allCases) { dataset in
                    Button(dataset.title) {
                        do { exportURL = try CSVService.export(dataset, from: store) }
                        catch { store.errorMessage = error.localizedDescription }
                    }
                }
            } label: { Label("Export CSV", systemImage: "square.and.arrow.up") }

            Button { showsImporter = true } label: { Label("Import transactions CSV", systemImage: "square.and.arrow.down") }
            Text("Imports up to 5,000 rows, skips duplicates, and creates missing accounts and categories when safe.")
                .font(.caption).foregroundStyle(.secondary)

            Button { confirmsDemo = true } label: { Label("Load demo workspace", systemImage: "flask") }
                .disabled(!store.canLoadDemoData)
            Text(store.canLoadDemoData ? "Available while the workspace is empty." : "Locked because this workspace already contains finance data.")
                .font(.caption).foregroundStyle(.secondary)
        }
    }

    private var categorySection: some View {
        Section {
            let custom = store.categories.filter { !$0.isDefault }
            if custom.isEmpty {
                Text("Default categories are ready. Add custom labels when you need more detail.").font(.subheadline).foregroundStyle(.secondary)
            } else {
                ForEach(custom) { category in
                    HStack(spacing: 12) {
                        Image(systemName: CategorySymbol.systemName(for: category.icon))
                            .foregroundStyle(SpendlyTheme.color(hex: category.color))
                            .frame(width: 34, height: 34)
                            .background(SpendlyTheme.color(hex: category.color).opacity(0.12), in: RoundedRectangle(cornerRadius: 11))
                        VStack(alignment: .leading) { Text(category.name); Text(category.type.title).font(.caption).foregroundStyle(.secondary) }
                        Spacer()
                        Menu {
                            Button { categoryEditor = CategoryDraft(id: category.id, name: category.name, type: category.type, color: category.color, icon: category.icon) } label: { Label("Edit", systemImage: "pencil") }
                            Button(role: .destructive) { deletingCategory = category } label: { Label("Delete", systemImage: "trash") }
                        } label: { Image(systemName: "ellipsis.circle") }
                    }
                }
                .onDelete { offsets in
                    let items = custom
                    deletingCategory = offsets.compactMap { items.indices.contains($0) ? items[$0] : nil }.first
                }
            }
            Button { categoryEditor = CategoryDraft() } label: { Label("Add custom category", systemImage: "plus.circle") }
        } header: { Text("Custom categories") }
        .confirmationDialog("Delete category?", isPresented: Binding(get: { deletingCategory != nil }, set: { if !$0 { deletingCategory = nil } }), titleVisibility: .visible) {
            Button("Delete category", role: .destructive) { if let deletingCategory { Task { if await store.deleteCategory(deletingCategory) { self.deletingCategory = nil } } } }
        }
    }

    private var securitySection: some View {
        Section("Account") {
            Text("Password changes use the secure reset-code flow from the sign-in screen.").font(.caption).foregroundStyle(.secondary)
            Link(destination: AppConfiguration.current.appBaseURL.appendingPathComponent("privacy")) {
                Label("Privacy policy", systemImage: "hand.raised")
            }
            Link(destination: AppConfiguration.current.appBaseURL.appendingPathComponent("support")) {
                Label("Support", systemImage: "questionmark.circle")
            }
            Button(role: .destructive) { confirmsSignOut = true } label: { Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right") }
            Button(role: .destructive) { showsDeleteAccount = true } label: {
                Label("Delete account and data", systemImage: "person.crop.circle.badge.minus")
            }
        }
    }

    private func hydrate() {
        fullName = store.profile?.fullName ?? ""
        currency = store.currency
        reminderDays = store.profile?.reminderDaysBefore ?? 3
        inAppReminders = store.profile?.reminderInAppEnabled ?? true
        emailReminders = store.profile?.reminderEmailEnabled ?? false
        Task { await refreshNotificationStatus() }
    }

    private func refreshNotificationStatus() async {
        notificationStatus = await NotificationService.shared.authorizationStatus()
    }
}

private struct DeleteSpendlyAccountView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var confirmation = ""
    @State private var confirmsPermanentDeletion = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label("This cannot be undone", systemImage: "exclamationmark.triangle.fill")
                        .font(.headline)
                        .foregroundStyle(.red)
                    Text("Your Spendly login and all associated profiles, accounts, transactions, budgets, goals, categories, recurring items, and reminders will be permanently deleted.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Section("Confirm deletion") {
                    Text("Type DELETE to continue.")
                    TextField("DELETE", text: $confirmation)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    Button("Continue", role: .destructive) { confirmsPermanentDeletion = true }
                        .disabled(confirmation.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() != "DELETE" || store.isLoading)
                }
            }
            .navigationTitle("Delete account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .alert("Permanently delete your account?", isPresented: $confirmsPermanentDeletion) {
                Button("Delete forever", role: .destructive) {
                    Task {
                        if await store.deleteCurrentUserAccount() { dismiss() }
                    }
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("This immediately deletes your Spendly login and every item of financial data connected to it.")
            }
        }
        .presentationDetents([.medium, .large])
        .interactiveDismissDisabled(store.isLoading)
    }
}

private struct CategoryEditor: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State var draft: CategoryDraft
    init(draft: CategoryDraft) { _draft = State(initialValue: draft) }

    private let colors = ["#14B8A6", "#22C55E", "#0EA5E9", "#F97316", "#F43F5E", "#A855F7", "#EAB308", "#06B6D4", "#8B5CF6", "#FB7185"]
    private let icons = ["piggy-bank", "utensils-crossed", "house", "car-taxi-front", "shopping-bag", "heart-pulse", "receipt", "briefcase-business", "wallet-cards", "plane"]

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $draft.name)
                Picker("Type", selection: $draft.type) { ForEach(CategoryType.allCases) { Text($0.title).tag($0) } }
                Picker("Color", selection: $draft.color) {
                    ForEach(colors, id: \.self) { color in Label(color, systemImage: "circle.fill").foregroundStyle(SpendlyTheme.color(hex: color)).tag(color) }
                }
                Picker("Icon", selection: $draft.icon) {
                    ForEach(icons, id: \.self) { icon in Label(icon.replacingOccurrences(of: "-", with: " ").capitalized, systemImage: CategorySymbol.systemName(for: icon)).tag(icon) }
                }
            }
            .navigationTitle(draft.id == nil ? "Add category" : "Edit category")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { if await store.saveCategory(draft) { dismiss() } } } }
            }
        }
    }
}

private struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) { }
}

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

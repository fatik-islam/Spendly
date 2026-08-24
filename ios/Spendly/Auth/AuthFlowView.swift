import SwiftUI

struct AuthFlowView: View {
    enum Mode: Equatable {
        case signIn
        case signUp
        case verify(email: String)
        case forgot
        case reset(email: String)
    }

    @Environment(AppStore.self) private var store
    @Environment(\.colorScheme) private var colorScheme
    @State private var mode: Mode = .signIn
    @State private var fullName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var code = ""
    @State private var visiblePasswords: Set<Field> = []
    @AppStorage("spendly.rememberMe") private var rememberMe = true
    @FocusState private var focused: Field?

    enum Field: Hashable { case name, email, password, confirm, code }

    var body: some View {
        NavigationStack {
            ZStack {
                SpendlyBackground()
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 26) {
                            BrandView()
                                .padding(.top, 18)

                            SurfaceCard {
                                VStack(alignment: .leading, spacing: 22) {
                                    header
                                    form
                                }
                            }

                        }
                        .id("auth-top")
                        .frame(maxWidth: 560)
                        .padding(20)
                        .frame(maxWidth: .infinity)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: mode) { _, _ in
                        focused = nil
                        proxy.scrollTo("auth-top", anchor: .top)
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    @ViewBuilder
    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.largeTitle.bold())
            Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var form: some View {
        switch mode {
        case .signIn: signInForm
        case .signUp: signUpForm
        case .verify(let address): verificationForm(email: address)
        case .forgot: forgotForm
        case .reset(let address): resetForm(email: address)
        }
    }

    private var signInForm: some View {
        VStack(spacing: 16) {
            emailField
            passwordField(label: "Password", value: $password, focus: .password)
            HStack {
                Toggle("Remember me", isOn: $rememberMe)
                    .font(.subheadline.weight(.medium))
                    .fixedSize()
                Spacer()
                Button("Forgot password?") { mode = .forgot }
                    .font(.subheadline.weight(.semibold))
            }
            Button("Sign in") {
                focused = nil
                Task { _ = await store.signIn(email: email, password: password, rememberMe: rememberMe) }
            }
            .buttonStyle(PrimaryActionButtonStyle())
            .disabled(email.isEmpty || password.isEmpty || store.isLoading)

            alternatePrompt("New to Spendly?", action: "Create an account") {
                clearSecrets()
                mode = .signUp
            }
        }
    }

    private var signUpForm: some View {
        VStack(spacing: 16) {
            inputLabel("Full name", symbol: "person.fill", focus: .name) {
                ZStack(alignment: .leading) {
                    neutralPrompt("Alex Morgan", isVisible: fullName.isEmpty)
                    TextField("", text: $fullName)
                        .textContentType(.name)
                        .tint(authFieldAccent)
                        .focused($focused, equals: .name)
                }
            }
            emailField
            passwordField(
                label: "Password",
                value: $password,
                focus: .password,
                prompt: "At least \(store.authConfig.passwordMinLength) characters"
            )
            passwordField(label: "Confirm password", value: $confirmPassword, focus: .confirm)
            Button("Create account") {
                focused = nil
                Task {
                    guard password == confirmPassword else {
                        store.errorMessage = "Passwords do not match."
                        return
                    }
                    do {
                        let outcome = try await store.signUp(name: fullName, email: email, password: password)
                        if case .verificationRequired(let address) = outcome {
                            code = ""
                            mode = .verify(email: address)
                        }
                    } catch {
                        store.errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                    }
                }
            }
            .buttonStyle(PrimaryActionButtonStyle())
            .disabled(fullName.isEmpty || email.isEmpty || password.isEmpty || confirmPassword.isEmpty || store.isLoading)

            alternatePrompt("Already have an account?", action: "Sign in") {
                clearSecrets()
                mode = .signIn
            }
        }
    }

    private func verificationForm(email address: String) -> some View {
        VStack(spacing: 16) {
            inputLabel("Verification code", symbol: "number.square.fill", focus: .code) {
                ZStack(alignment: .leading) {
                    neutralPrompt("123456", isVisible: code.isEmpty)
                    TextField("", text: $code)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .tint(authFieldAccent)
                        .focused($focused, equals: .code)
                        .onChange(of: code) { _, value in code = String(value.filter(\.isNumber).prefix(6)) }
                }
            }
            Button("Verify email") {
                Task { _ = await store.verifyEmail(email: address, code: code) }
            }
            .buttonStyle(PrimaryActionButtonStyle())
            .disabled(code.count != 6 || store.isLoading)

            Button("Resend code") { Task { _ = await store.resendVerification(email: address) } }
                .buttonStyle(.bordered)
            Button("Back to sign in") { clearSecrets(); mode = .signIn }
                .font(.subheadline.weight(.semibold))
        }
    }

    private var forgotForm: some View {
        VStack(spacing: 16) {
            emailField
            Button("Send reset code") {
                Task {
                    if await store.sendPasswordReset(email: email) {
                        code = ""
                        password = ""
                        confirmPassword = ""
                        mode = .reset(email: email)
                    }
                }
            }
            .buttonStyle(PrimaryActionButtonStyle())
            .disabled(email.isEmpty || store.isLoading)
            Button("Back to sign in") { clearSecrets(); mode = .signIn }
                .font(.subheadline.weight(.semibold))
        }
    }

    private func resetForm(email address: String) -> some View {
        VStack(spacing: 16) {
            inputLabel("Reset code", symbol: "number.square.fill", focus: .code) {
                ZStack(alignment: .leading) {
                    neutralPrompt("123456", isVisible: code.isEmpty)
                    TextField("", text: $code)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .tint(authFieldAccent)
                        .focused($focused, equals: .code)
                        .onChange(of: code) { _, value in code = String(value.filter(\.isNumber).prefix(6)) }
                }
            }
            passwordField(label: "New password", value: $password, focus: .password)
            passwordField(label: "Confirm new password", value: $confirmPassword, focus: .confirm)
            Button("Update password") {
                guard password == confirmPassword else {
                    store.errorMessage = "Passwords do not match."
                    return
                }
                Task {
                    if await store.resetPassword(email: address, code: code, newPassword: password) {
                        clearSecrets()
                        mode = .signIn
                    }
                }
            }
            .buttonStyle(PrimaryActionButtonStyle())
            .disabled(code.count != 6 || password.isEmpty || confirmPassword.isEmpty || store.isLoading)
            Button("Send another code") { Task { _ = await store.sendPasswordReset(email: address) } }
                .buttonStyle(.bordered)
        }
    }

    private var emailField: some View {
        inputLabel("Email", symbol: "envelope.fill", focus: .email) {
            ZStack(alignment: .leading) {
                neutralPrompt("you@example.com", isVisible: email.isEmpty)
                TextField("", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .tint(authFieldAccent)
                    .focused($focused, equals: .email)
            }
        }
    }

    private func passwordField(label: String, value: Binding<String>, focus: Field, prompt: String = "••••••••") -> some View {
        inputLabel(label, symbol: "lock.fill", focus: focus) {
            HStack(spacing: 10) {
                ZStack(alignment: .leading) {
                    neutralPrompt(prompt, isVisible: value.wrappedValue.isEmpty, opacity: 0.62)
                    if visiblePasswords.contains(focus) {
                        TextField("", text: value)
                    } else {
                        SecureField("", text: value)
                    }
                }
                .textContentType(label.contains("New") || label.contains("Confirm") ? .newPassword : .password)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .tint(authFieldAccent)
                .focused($focused, equals: focus)

                Button {
                    if visiblePasswords.contains(focus) {
                        visiblePasswords.remove(focus)
                    } else {
                        visiblePasswords.insert(focus)
                    }
                    focused = focus
                } label: {
                    Image(systemName: visiblePasswords.contains(focus) ? "eye.slash" : "eye")
                        .foregroundStyle(.secondary)
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(visiblePasswords.contains(focus) ? "Hide \(label.lowercased())" : "Show \(label.lowercased())")
            }
        }
    }

    private func inputLabel<Content: View>(
        _ label: String,
        symbol: String,
        focus: Field,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label).font(.subheadline.weight(.semibold))
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 20)
                content()
                    .foregroundStyle(.primary)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 54)
            .background(
                Color(.secondarySystemGroupedBackground),
                in: RoundedRectangle(cornerRadius: 16, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(
                        focused == focus ? authFieldAccent.opacity(0.58) : Color.primary.opacity(0.08),
                        lineWidth: focused == focus ? 1.5 : 1
                    )
            }
            .animation(.easeOut(duration: 0.16), value: focused)
        }
    }

    private var authFieldAccent: Color {
        colorScheme == .dark ? Color.white.opacity(0.78) : SpendlyTheme.navy.opacity(0.72)
    }

    @ViewBuilder
    private func neutralPrompt(_ text: String, isVisible: Bool, opacity: Double = 0.72) -> some View {
        if isVisible {
            Text(text)
                .foregroundStyle(Color.secondary.opacity(opacity))
                .allowsHitTesting(false)
        }
    }

    private func alternatePrompt(_ prefix: String, action: String, perform: @escaping () -> Void) -> some View {
        HStack(spacing: 5) {
            Text(prefix).foregroundStyle(.secondary)
            Button(action, action: perform).fontWeight(.semibold)
        }
        .font(.subheadline)
    }

    private var title: String {
        switch mode {
        case .signIn: "Welcome back"
        case .signUp: "Create your workspace"
        case .verify: "Verify your email"
        case .forgot: "Reset your password"
        case .reset: "Choose a new password"
        }
    }

    private var subtitle: String {
        switch mode {
        case .signIn: "Sign in to your Spendly workspace."
        case .signUp: "Use the same account on web and iPhone."
        case .verify(let address): "Enter the 6-digit code sent to \(address)."
        case .forgot: "We’ll email you a secure 6-digit reset code."
        case .reset(let address): "Enter the code sent to \(address), then set a new password."
        }
    }

    private func clearSecrets() {
        password = ""
        confirmPassword = ""
        code = ""
        visiblePasswords.removeAll()
    }
}

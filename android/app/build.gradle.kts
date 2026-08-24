import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

fun quoted(value: String) = "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use(::load)
}

val iosLocalConfig = rootProject.file("../ios/Config/Local.xcconfig")
val iosAnonKey = if (iosLocalConfig.exists()) {
    iosLocalConfig.readLines()
        .firstOrNull { it.trim().startsWith("INSFORGE_ANON_KEY") }
        ?.substringAfter('=')?.trim().orEmpty()
} else ""

val insforgeAnonKey = localProperties.getProperty("SPENDLY_INSFORGE_ANON_KEY", iosAnonKey)

android {
    namespace = "com.spendly.finance.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.spendly.finance.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        buildConfigField("String", "INSFORGE_BASE_URL", quoted("https://8893aiqk.us-east.insforge.app"))
        buildConfigField("String", "SPENDLY_APP_BASE_URL", quoted("https://spendly.syedfatikislam.com"))
        buildConfigField("String", "INSFORGE_ANON_KEY", quoted(insforgeAnonKey))
        buildConfigField("String", "FIREBASE_PROJECT_ID", quoted(localProperties.getProperty("SPENDLY_FIREBASE_PROJECT_ID", "")))
        buildConfigField("String", "FIREBASE_APP_ID", quoted(localProperties.getProperty("SPENDLY_FIREBASE_APP_ID", "")))
        buildConfigField("String", "FIREBASE_API_KEY", quoted(localProperties.getProperty("SPENDLY_FIREBASE_API_KEY", "")))
        buildConfigField("String", "FIREBASE_SENDER_ID", quoted(localProperties.getProperty("SPENDLY_FIREBASE_SENDER_ID", "")))
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging.resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"

    sourceSets["main"].assets.srcDir("../../public/brand")
}

kotlin { jvmToolchain(17) }

dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.12.00"))
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.navigation:navigation-compose:2.9.6")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    implementation("com.squareup.okhttp3:okhttp:5.3.2")
    implementation("com.google.firebase:firebase-messaging:25.0.1")
    testImplementation("junit:junit:4.13.2")
    debugImplementation("androidx.compose.ui:ui-tooling")
}

# CivicAI Native Android Application - Migration Documentation

## 1. Executive Summary & Existing Architecture
CivicAI is a municipal intelligence and document AI processing system. It features:
- Source-grounded municipal policy FAQ (Retrieval via SQLite FTS5 BM25 index + LLM grounding).
- Multilingual document processing pipeline: OCR (Pytesseract/PyMuPDF) -> Reading-order reconstruction -> Entity & identifier preservation (GSTIN, PAN, dates, currency) -> regional Indian language translation (Hindi, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, etc.) -> Jargon explanation & Fraud/scam warning detection.
- Bring Your Own Key (BYOK) for LLM providers (Gemini, Groq, OpenRouter, Local Llama.cpp, Ollama).
- JWT-based authentication session management & device trust store.

The native Android app serves as a high-performance client communicating with the existing FastAPI backend over REST/HTTP, preserving all backend intelligence, document AI pipelines, and key-based mechanisms.

---

## 2. Existing API Inventory
| Endpoint | Method | Purpose | Payload / Params | Response |
|---|---|---|---|---|
| `/api/health` | GET | System health & LLM status | None | `{"status": "ok", "provider": "..."}` |
| `/api/auth/token` | POST | Anonymous or user session JWT creation | Form / Json | `{"access_token": "...", "token_type": "bearer"}` |
| `/api/municipal/faq/query` | POST | Source-grounded Policy Q&A | `{"query": "..."}` | `{"answer": "...", "grounded": true, "confidence": "high", "citations": [...]}` |
| `/api/municipal/notices/ocr` | POST | Document OCR & structure parsing | File Upload (multipart/form-data) | `{"ocr_text": "...", "detected_language": "...", "blocks": [...]}` |
| `/api/municipal/notices/analyze` | POST | Notice translation, summary, jargon & fraud detection | `{"text": "...", "target_language": "Hindi"}` | `{"translation": "...", "jargon": [...], "summary": [...], "deadline": "...", "fraud_check": "..."}` |
| `/api/municipal/documents/upload` | POST | Upload municipal PDF/doc for indexing | File Upload | `{"filename": "...", "status": "uploaded"}` |
| `/api/municipal/demo-data` | GET | Load sample municipal policy files | None | `{"message": "...", "files": [...]}` |
| `/api/settings` | GET/POST | Read/write AI provider & BYOK settings | `{"provider": "groq", "api_key": "..."}` | Settings status |
| `/api/chat/history` | GET | Session history & conversations | User Auth Header | `{"history": [...]}` |

---

## 3. Native Android Architecture
- **Language**: Kotlin 2.x
- **UI Framework**: Jetpack Compose + Material 3 Design System
- **Architecture**: Clean Architecture + MVVM + Single Activity Navigation
- **Asynchronous / Reactive**: Kotlin Coroutines + StateFlow / SharedFlow
- **Networking**: Retrofit 2 + OkHttp 4 (with logging interceptor & auth token injection)
- **Serialization**: Kotlinx Serialization (kotlinx-serialization-json)
- **Local Storage & State**: DataStore (Preferences & Keystore-encrypted values)
- **Media & Document Capture**: CameraX + Storage Access Framework (ACTION_OPEN_DOCUMENT)

---

## 4. Package Structure (`android/app/src/main/java/com/civicai/app/`)
```
com.civicai.app/
├── MainActivity.kt
├── CivicApplication.kt
├── core/
│   ├── network/ (Retrofit client, ApiService, NetworkResult, AuthInterceptor)
│   ├── security/ (KeystoreManager, TokenManager)
│   ├── datastore/ (UserPreferencesRepository)
│   ├── theme/ (Color, Type, Theme, Shape)
│   └── components/ (CivicTopBar, CitationCard, WarningCard, JargonBadge, ProcessingTimeline)
├── data/
│   ├── api/ (CivicApiService.kt)
│   ├── model/ (DTOs & API Request/Response schemas)
│   └── repository/ (PolicyRepositoryImpl, NoticeRepositoryImpl, SettingsRepositoryImpl)
├── domain/
│   ├── model/ (PolicyAnswer, NoticeAnalysis, Citation, JargonItem)
│   └── repository/ (Interfaces for clean boundary)
└── feature/
    ├── home/ (HomeScreen, HomeViewModel)
    ├── policy/ (PolicyScreen, PolicyViewModel)
    ├── scanner/ (ScannerScreen, ScannerViewModel, CameraPreview)
    ├── notice/ (NoticeAnalysisScreen, NoticeViewModel)
    ├── history/ (HistoryScreen, HistoryViewModel)
    └── settings/ (SettingsScreen, SettingsViewModel)
```

---

## 5. Security & BYOK Strategy
- Tokens & API Keys stored using EncryptedSharedPreferences backed by Android Keystore (AES-256 GCM).
- Credentials never logged to Logcat in production builds.
- Cleartext HTTP allowed for emulator loopback (10.0.2.2:8000) in Debug builds via network_security_config.xml.

---

## 6. Build Environment Setup (Windows)

### Prerequisites
| Tool | Version | Notes |
|---|---|---|
| JDK | 17.0.10.7 (Eclipse Adoptium Temurin) | Install from https://adoptium.net/. Set JAVA_HOME. |
| Android SDK | Platform 35, Build-Tools 35.0.0 | See SDK setup below |
| Gradle | 8.11.1 | Managed via wrapper (gradle/wrapper/) |
| Android Gradle Plugin | 8.7.3 | Defined in libs.versions.toml |
| Kotlin | 2.0.21 | Compose Compiler plugin required separately |

### Android SDK Setup (no Android Studio required)
```powershell
# 1. Download command-line tools from https://developer.android.com/studio#command-tools
# 2. Unzip to C:\Users\<user>\android-sdk\cmdline-tools\latest\

# 3. Accept licenses
C:\Users\Aditya\android-sdk\cmdline-tools\latest\bin\sdkmanager.bat --licenses

# 4. Install required SDK components
C:\Users\Aditya\android-sdk\cmdline-tools\latest\bin\sdkmanager.bat "platforms;android-35" "build-tools;35.0.0"
```

### `local.properties` (NOT committed to VCS - gitignored)
```properties
sdk.dir=C:\\Users\\Aditya\\android-sdk
```

### `gradle.properties`
```properties
android.useAndroidX=true
android.enableJetifier=true
org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8
```

### Setting JAVA_HOME per PowerShell session
```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.10.7-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
```

---

## 7. Build Commands

```powershell
# From the android/ directory:

# Build debug APK
.\gradlew.bat assembleDebug --no-daemon

# Build release APK (requires signing config)
.\gradlew.bat assembleRelease --no-daemon

# Stop all Gradle daemons (fixes file-lock issues on Windows)
.\gradlew.bat --stop
# Then if needed:
Remove-Item -Recurse -Force app\build
```

---

## 8. APK Output Location

After a successful assembleDebug:

```
android/app/build/outputs/apk/debug/app-debug.apk   (~20 MB)
```

To install on a connected device or running emulator:
```powershell
adb install app\build\outputs\apk\debug\app-debug.apk
```

The debug build points to http://10.0.2.2:8000/api/ (Android emulator loopback to host).
For a physical device on LAN, update BASE_URL in NetworkModule.kt to your machine's IP.

---

## 9. Configuration Changes Made During Migration

| File | Change |
|---|---|
| `gradle/wrapper/gradle-wrapper.properties` | Pointed wrapper to local gradle-8.11.1-bin.zip to bypass network timeout |
| `gradle/libs.versions.toml` | Added kotlin-compose-compiler plugin entry |
| `build.gradle.kts` (root) | Applied Compose compiler plugin to all subprojects |
| `app/build.gradle.kts` | Integrated Compose compiler plugin |
| `local.properties` | Set sdk.dir to local Android SDK path |
| `gradle.properties` | Added AndroidX flags + 4 GB JVM heap |
| `app/src/main/AndroidManifest.xml` | Removed references to missing mipmap icon resources |
| `app/.../CivicApiService.kt` | Fixed stray async keyword syntax error |
| `app/.../NetworkModule.kt` | Fixed converter factory imports |
| `app/.../ScannerScreen.kt` | Removed duplicate/invalid suspendCancellableCoroutine import from non-existent kotlin.coroutines package |
| `app/.../MainActivity.kt` | Corrected onCreate signature and package declaration |

---

## 10. Known Warnings (Non-Breaking)

These deprecation warnings appear at compile time but do not break the build:

| Warning | Affected Files | Recommended Fix |
|---|---|---|
| Icons.Filled.ArrowBack deprecated | HistoryScreen, NoticeAnalysisScreen, PolicyScreen, ScannerScreen, SettingsScreen | Replace with Icons.AutoMirrored.Filled.ArrowBack |
| Icons.Filled.Send deprecated | PolicyScreen | Replace with Icons.AutoMirrored.Filled.Send |
| Modifier.menuAnchor() deprecated | NoticeAnalysisScreen, SettingsScreen | Use overload with MenuAnchorType and enabled parameters |
| LocalLifecycleOwner deprecated | ScannerScreen | Migrate to androidx.lifecycle.compose.LocalLifecycleOwner |

---

## 11. Build Status
- **Android Gradle Plugin**: 8.7.3 + Gradle 8.11.1
- **Build Variants**: debug (10.0.2.2:8000) and release
- **Build Status**: BUILD SUCCESSFUL (45s, 37 tasks: 9 executed, 28 up-to-date)

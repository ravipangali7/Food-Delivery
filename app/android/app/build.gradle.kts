import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

/** Play upload keystore lives next to `pubspec.yaml`: `app/upload-keystore.jks` */
val uploadKeystoreFile = rootProject.file("../upload-keystore.jks")

fun envOrProp(props: Properties, propName: String, envName: String): String? =
    props.getProperty(propName)?.trim()?.takeIf { it.isNotEmpty() }
        ?: System.getenv(envName)?.trim()?.takeIf { it.isNotEmpty() }

val releaseKeyAlias = envOrProp(keystoreProperties, "keyAlias", "UPLOAD_KEY_ALIAS")
val releaseKeyPassword = envOrProp(keystoreProperties, "keyPassword", "UPLOAD_KEY_PASSWORD")
val releaseStorePassword = envOrProp(keystoreProperties, "storePassword", "UPLOAD_STORE_PASSWORD")

val useUploadKeystore =
    uploadKeystoreFile.isFile &&
        releaseKeyAlias != null &&
        releaseKeyPassword != null &&
        releaseStorePassword != null

if (uploadKeystoreFile.isFile && !useUploadKeystore) {
    logger.warn(
        "upload-keystore.jks found but no signing credentials: release AAB will use the debug keystore. " +
            "Add android/key.properties (keyAlias, keyPassword, storePassword) or set " +
            "UPLOAD_KEY_ALIAS, UPLOAD_KEY_PASSWORD, UPLOAD_STORE_PASSWORD to sign with the upload key.",
    )
}

android {
    namespace = "com.shyamsweets.venusion"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.shyamsweets.venusion"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = 2
        versionName = "2.0.0"
    }

    signingConfigs {
        create("release") {
            if (useUploadKeystore) {
                storeFile = uploadKeystoreFile
                keyAlias = releaseKeyAlias!!
                keyPassword = releaseKeyPassword!!
                storePassword = releaseStorePassword!!
            }
        }
    }

    buildTypes {
        release {
            signingConfig =
                if (useUploadKeystore) {
                    signingConfigs.getByName("release")
                } else {
                    signingConfigs.getByName("debug")
                }
        }
    }
}

flutter {
    source = "../.."
}

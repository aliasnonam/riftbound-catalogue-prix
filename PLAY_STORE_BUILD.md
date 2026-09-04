# Préparer une release Google Play

Cette application utilise l'identifiant Android `com.aliasnonam.riftboundcatalogue`.
La version Play actuelle est définie dans `android/app/build.gradle` :

- `versionCode 13` : nombre entier qui doit augmenter à chaque envoi sur Google Play ;
- `versionName "1.12"` : numéro visible par les utilisateurs.

L'application cible Android 16 (API 36), avec un minimum Android 6.0 (API 23).

## Prérequis Windows

Installe Android Studio Meerkat (ou plus récent), puis dans **SDK Manager** installe :

- Android SDK Platform 36 ;
- Android SDK Build-Tools 36.x ;
- Android SDK Command-line Tools.

Après l'installation, Android Studio crée normalement le SDK dans `C:\Users\tourd\AppData\Local\Android\Sdk`. Le fichier local `android/local.properties` peut alors contenir :

```properties
sdk.dir=C\:\\Users\\tourd\\AppData\\Local\\Android\\Sdk
```

Ce fichier est déjà ignoré par Git.

## Signature locale

La clé `.jks` est une clé d'importation (upload key) : conserve-la hors du dépôt, avec une copie de sauvegarde chiffrée. Ne la place jamais dans le projet, Git, GitHub, une conversation ou un e-mail.

1. Copie `android/keystore.properties.example` vers `android/keystore.properties`.
2. Remplace les quatre valeurs par le chemin, l'alias et les mots de passe de ta clé locale.
3. Vérifie que `android/keystore.properties` et les fichiers `.jks` restent ignorés par Git.

Exemple de chemin Windows valide : `E:/Secrets/Riftbound/riftbound-upload-key.jks`.

## Construire le fichier AAB sous Windows

Utilise le JDK local installé sur ton PC. Depuis PowerShell à la racine du dépôt :

```powershell
$env:JAVA_HOME = 'E:\Users\tourd\Documents\Adoptium\OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1\jdk-21.0.12.1+1'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
Set-Location .\android
.\gradlew.bat clean
.\gradlew.bat bundleRelease
```

Le fichier à envoyer dans Play Console est :

`android/app/build/outputs/bundle/release/app-release.aab`

Pour contrôler sa signature sans afficher de secret :

```powershell
jarsigner -verify -verbose -certs .\app\build\outputs\bundle\release\app-release.aab
keytool -list -v -keystore E:/Secrets/Riftbound/riftbound-upload-key.jks -alias riftbound-upload
```

Seules les informations publiques du certificat (alias, algorithme et empreinte) doivent être communiquées.

## Tester avant publication

L'AAB ne s'installe pas directement sur le téléphone. Dans Play Console, crée une piste de **test interne** et ajoute ton adresse Google comme testeur. Téléverse l'AAB, publie la version de test, puis installe l'application depuis le lien Play reçu avec ce compte.

Le certificat de la version Play sera différent de celui de l'APK debug installé actuellement. Avant de remplacer l'APK debug, exporte la collection depuis l'application ; il pourra être nécessaire de désinstaller l'APK debug puis d'importer la sauvegarde dans la version Play.

## Google Play App Signing

À la première création de l'application dans Play Console, active **Play App Signing**. La clé locale configurée ici reste ta clé d'importation : Google conserve et utilise la clé de signature de distribution. Ne génère pas une seconde clé pour cette étape.

## Mise à jour ultérieure

Pour chaque mise à jour : augmente `versionCode`, ajuste `versionName`, reconstruis l'AAB signé, puis téléverse-le dans la même piste Play. L'identifiant d'application ne doit pas changer.

## CI GitHub (plus tard)

Le dépôt ne contient aucun secret de signature. Si un workflow signé est ajouté ultérieurement, configure au minimum ces Secrets GitHub :

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

N'ajoute pas ces valeurs dans les fichiers versionnés ni dans les logs de CI.

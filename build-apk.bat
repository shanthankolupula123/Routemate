@echo off
echo ==============================================
echo   Routemate - Android Debug APK Builder
echo ==============================================
echo 1. Syncing web assets to Android...
node prepare-www.js
call npx.cmd cap sync android

echo.
echo 2. Compiling Android Debug APK with Gradle...
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd android
call gradlew.bat assembleDebug

echo.
echo ==============================================
echo [SUCCESS] APK Generated Successfully!
echo Location: android\app\build\outputs\apk\debug\app-debug.apk
echo ==============================================
pause

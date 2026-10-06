@echo off
echo ==============================================
echo   Routemate - Android Debug APK Builder
echo ==============================================

echo 1. Cleaning old build artifacts...
if exist "Routemate.apk" del /q /f "Routemate.apk"
if exist "android\app\build\outputs\apk\debug\app-debug.apk" del /q /f "android\app\build\outputs\apk\debug\app-debug.apk"
if exist "android\app\build\outputs\apk\debug\app-debug.apk.idsig" del /q /f "android\app\build\outputs\apk\debug\app-debug.apk.idsig"
if exist "android\app\build\outputs\apk\debug\output-metadata.json" del /q /f "android\app\build\outputs\apk\debug\output-metadata.json"

echo.
echo 2. Syncing web assets to Android...
node prepare-www.js
call npx.cmd cap sync android

echo.
echo 3. Compiling Android Debug APK with Gradle...
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd android
call gradlew.bat assembleDebug
cd ..

if exist "android\app\build\outputs\apk\debug\app-debug.apk.idsig" del /q /f "android\app\build\outputs\apk\debug\app-debug.apk.idsig"

if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "Routemate.apk" >nul
    echo.
    echo ==============================================
    echo [SUCCESS] APK Generated & Cleaned!
    echo Pick this file to install on phone:
    echo --^> Routemate.apk (located right in this main folder)
    echo ==============================================
) else (
    echo.
    echo ==============================================
    echo [ERROR] Build failed! Check log above.
    echo ==============================================
)
pause


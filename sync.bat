@echo off
echo Syncing Routemate web assets to Android...
node prepare-www.js
call npx.cmd cap sync android
echo Sync complete!
pause

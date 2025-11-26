@echo off
chcp 65001 >nul
echo ========================================
echo    EchoLoop 回译练习应用
echo ========================================
echo.
echo 正在启动开发服务器...
echo.

cd /d "%~dp0"
pnpm --filter @flow/reader dev

pause


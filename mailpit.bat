@echo off
title Mailpit - HanapBuhay Email Catcher
echo.
echo ============================================
echo   HanapBuhay Mailpit Email Catcher
echo   SMTP listening on : localhost:1025
echo   Web inbox at      : http://localhost:8025
echo ============================================
echo.
echo   Keep this window open to receive emails.
echo   Close it to stop the mail service.
echo.
"C:\laragon\bin\mailpit\1.22.3\mailpit.exe" -s 0.0.0.0:1025 -l 0.0.0.0:8025 --smtp-auth-accept-any --smtp-auth-allow-insecure

@echo off
set "PHP_BIN=C:\laragon\bin\php\php-8.3.33-Win32-vs16-x64\php.exe"
if exist "%PHP_BIN%" (
    "%PHP_BIN%" "%~dp0lava" serve %*
) else (
    php "%~dp0lava" serve %*
)

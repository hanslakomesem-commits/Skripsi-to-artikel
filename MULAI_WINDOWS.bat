@echo off
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 serve.py
) else (
    where python >nul 2>&1
    if errorlevel 1 (
        echo Python 3 belum ditemukan. Pasang Python 3 atau gunakan GitHub Pages.
        pause
        exit /b 1
    )
    python serve.py
)
pause

@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-shiftai.ps1"
if errorlevel 1 (
  echo ShiftAI launcher failed.
  pause
)

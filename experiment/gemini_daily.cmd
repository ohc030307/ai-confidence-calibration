@echo off
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" experiment\gemini_daily.mjs >> results\gemini_daily.log 2>&1

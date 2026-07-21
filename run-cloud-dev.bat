@echo off
set "PATH=C:\Users\Dayvid\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.18.0-win-x64;%PATH%"
cd /d "C:\Claude\Pessoal\minhas-financas"
npx --yes wrangler pages dev . --port 8788

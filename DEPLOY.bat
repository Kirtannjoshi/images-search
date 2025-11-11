@echo off
echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║                                                        ║
echo ║     📤 DEPLOYING TO GITHUB PAGES 📤                   ║
echo ║                                                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.

echo [Step 1] Setting up Git user...
git config user.email "kirtanjoshi@example.com"
git config user.name "Kirtan Joshi"

echo.
echo [Step 2] Adding all files...
git add .

echo.
echo [Step 3] Committing changes...
git commit -m "Image search app with Google and Reddit - ready for GitHub Pages"

echo.
echo [Step 4] Pushing to GitHub...
echo.
echo Please make sure you have set up the remote:
echo   git remote add origin https://github.com/Kirtannjoshi/images-search.git
echo.
echo Then run:
echo   git push -u origin master
echo.

pause

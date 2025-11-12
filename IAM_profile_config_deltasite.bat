@echo off

echo Changing path...
cd %USERPROFILE%

REM Check for existing .ssh directory
if not exist "%USERPROFILE%\.ssh" (
    echo Creating .ssh folder...
    mkdir "%USERPROFILE%\.ssh"
)

REM Check for existing SSH keys
if not exist "%USERPROFILE%\.ssh\id_ecdsa" (
    echo Generating SSH keys...
    call ssh-keygen -t ecdsa -f "%USERPROFILE%\.ssh\id_ecdsa" -N ""
    if errorlevel 1 (
        echo Failed to generate SSH keys
        goto ERROR_EXIT
    )
)

REM Set permissions
echo Setting SSH folder permissions...
icacls "%USERPROFILE%\.ssh" /inheritance:r
icacls "%USERPROFILE%\.ssh" /grant:r "%USERNAME%":(F)
icacls "%USERPROFILE%\.ssh\*" /inheritance:r
icacls "%USERPROFILE%\.ssh\*" /grant:r "%USERNAME%":(F)

REM Make private key read-only
attrib +r "%USERPROFILE%\.ssh\id_ecdsa"


REM Check if both Toolbox and Ada exist in the expected location
if exist "%LOCALAPPDATA%\Toolbox\bin\toolbox.exe" (
    if exist "%LOCALAPPDATA%\Toolbox\bin\ada.exe" goto TOOLS_INSTALLED
)

:TOOLS_NOT_INSTALLED
echo Tools not found. Installing...

REM Authenticate through Midway
echo Starting Midway authentication...
call mwinit -o -s
if errorlevel 1 (
    echo Midway authentication failed
    pause
    exit /b 1
)

echo Downloading Builder Toolbox install script...
set scriptPath="%~dp0download_bootstrap.ps1"
if not exist "%scriptPath%" (
    echo Error: Cannot find script at %scriptPath%
    exit /b 1
)
powershell -ExecutionPolicy Bypass -File "%scriptPath%"


if exist toolbox-bootstrap.cmd (
    call toolbox-bootstrap.cmd
    del toolbox-bootstrap.cmd
)

echo Updating PATH...
setx PATH "%PATH%;%LOCALAPPDATA%\Toolbox\bin"
set PATH=%PATH%;%LOCALAPPDATA%\Toolbox\bin

REM Verify toolbox installation
echo Verifying toolbox installation...
call toolbox list

REM Install the Ada CLI
echo Installing Ada CLI...
call "%LOCALAPPDATA%\Toolbox\bin\toolbox" install ada

REM Refresh PATH to include newly installed tools
set PATH=%PATH%;%LOCALAPPDATA%\Toolbox\bin

goto CONTINUE_SCRIPT

:TOOLS_INSTALLED
echo Toolbox and ada are already installed.

REM Authenticate through Midway
echo Starting Midway authentication...
call mwinit -o

:CONTINUE_SCRIPT
REM Check if the profile exists and store result in variable
echo Checking if deltasite profile exists...
set "PROFILE_EXISTS=0"
call "%LOCALAPPDATA%\Toolbox\bin\ada" profile list | findstr "deltasite-prod" > nul && set "PROFILE_EXISTS=1"
REM Add profile if it doesn't exist
if "%PROFILE_EXISTS%"=="0" (
    echo Profile not found. Adding deltasite profile...
    call "%LOCALAPPDATA%\Toolbox\bin\ada" profile add --account 058264547985 --profile deltasiteprod --provider conduit --role Redshift-SDO-Access-Role-us-east-1
call copy %USERPROFILE%\.aws\config %USERPROFILE%\.aws\credentials
if errorlevel 1 (
        echo Failed to add profile
        pause
        exit /b 1
    )
)
if "%PROFILE_EXISTS%"=="1" (
    echo Profile already exists
    call "%LOCALAPPDATA%\Toolbox\bin\ada" profile delete --profile deltasiteprod
    call "%LOCALAPPDATA%\Toolbox\bin\ada" profile add --account 058264547985 --profile deltasiteprod --provider conduit --role Redshift-SDO-Access-Role-us-east-1
call copy %USERPROFILE%\.aws\config %USERPROFILE%\.aws\credentials)

REM Print credentials
echo Printing credentials...
call "%LOCALAPPDATA%\Toolbox\bin\ada" credentials print --profile=deltasiteprod

pause

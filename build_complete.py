import os
import subprocess

def build():
    # Clean previous build
    if os.path.exists('dist'):
        print("Cleaning previous build...")
        os.system("rmdir /s /q dist")

    # Build with PyInstaller
    print("Building with PyInstaller...")
    subprocess.run(['pyinstaller', '--clean', 'Appointment.Scheduler.spec'])

    # # Copy node_modules (needed for JavaScript)
    # print("Copying node_modules...")
    # if os.path.exists('node_modules'):
    #     os.system("xcopy /E /I node_modules dist\\node_modules")

    print("Build complete! Check the 'dist' folder.")

if __name__ == "__main__":
    build()

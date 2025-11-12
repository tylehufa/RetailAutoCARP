# -*- mode: python ; coding: utf-8 -*-
import os
import boto3
import botocore
import redshift_connector
import sys

block_cipher = None

# Use a more dynamic way to handle user directory
def get_home_dir():
    if sys.platform == 'win32':
        return '%USERPROFILE%'  # Will be expanded at runtime
    return '~'  # For Unix-like systems


# Define paths using variables that will be resolved at runtime
home_dir = get_home_dir()

# Get package paths
boto3_path = os.path.dirname(boto3.__file__)
botocore_path = os.path.dirname(botocore.__file__)
redshift_path = os.path.dirname(redshift_connector.__file__)
js_file = os.path.join(os.getcwd(), 'Appointment.Scheduler.js')
if not os.path.exists(js_file):
    raise FileNotFoundError(f"JavaScript file not found at: {js_file}")

batch_file = os.path.join(os.getcwd(),'IAM_profile_config_deltasite.bat' )
if not os.path.exists(batch_file):
    raise FileNotFoundError(f"batch file not found at: {batch_file}")
ps1_file = os.path.join(os.getcwd(),'download_bootstrap.ps1' )
if not os.path.exists(ps1_file):
    raise FileNotFoundError(f"Powershell file not found at: {batch_file}")
msplaywright_path = os.path.join(os.environ['USERPROFILE'],'AppData', 'Local', 'ms-playwright')

# Path to Node.js installation
node_dir = r"C:\Program Files\nodejs"  # Where your Node.js is installed

# Check if directory exists
if not os.path.exists(node_dir):
    raise FileNotFoundError(f"Node.js directory not found at: {node_dir}")
added_files = [
    (js_file, '.'),
    (batch_file,'.'),
    (ps1_file,'.'),
    ('node_modules', 'node_modules'),
    (msplaywright_path,'ms-playwright'),
    (node_dir,'node'),
    ('package.json', '.'),
    (boto3_path, 'boto3'),
    (botocore_path, 'botocore'),
    (redshift_path, 'redshift_connector')
]

# Verify each file exists before adding to build
added_files = [(src, dst) for src, dst in added_files if os.path.exists(src)]

# Add Playwright browsers if they exist
playwright_browsers = os.path.join('node_modules', 'playwright-core', 'browsers')
if os.path.exists(playwright_browsers):
    added_files.append((playwright_browsers, 'playwright-browsers'))

a = Analysis(
    ['appointment_prep.py'],
    pathex=[],  # Add user directory to path
    binaries=[],
    datas=added_files,
    --hidden-import=[
        'pandas',
        'numpy',
        'boto3',
        'botocore',
        'openpyxl',
        'redshift_connector',
        'redshift_connector.plugin',
        'redshift_connector.core',
        'redshift_connector.auth',
        'pywin32',
        'subprocess',
        'awswrangler',
        'configparser',
        'traceback',
        'ssl',
        'cryptography',
        'concurrent.futures'
    ],
    hookspath=['hooks'],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='XAV3AutoCARP',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True
)

# Print confirmation of paths used
print("\nBuild configuration:")
print(f"User directory: {home_dir}")
print(f"Number of added files: {len(added_files)}")
for src, dst in added_files:
    print(f"Source: {src}")
    print(f"Destination: {dst}")
    print("-" * 50)
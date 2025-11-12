
from PyInstaller.utils.hooks import collect_data_files, collect_submodules
import os
import sys

hiddenimports = collect_submodules('playwright')
hiddenimports += [
    'playwright.async_api',
    'playwright.sync_api',
    'playwright.browser_type',
    'playwright.browser',
    'playwright.page',
]

datas = collect_data_files('playwright')

if getattr(sys, 'frozen', False):
    browser_path = os.path.join(sys._MEIPASS, 'playwright-browsers')
else:
    browser_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'playwright-browsers')

datas += [(browser_path, 'playwright-browsers')]


import os
import sys

def get_package_path(package):
    """Get the installation path of a package"""
    return os.path.dirname(package.__file__)

def runtime_init():
    if getattr(sys, 'frozen', False):
        # If running as exe, ensure AWS config directory exists
        aws_config_dir = os.path.join(os.path.expanduser('~'), '.aws')
        if not os.path.exists(aws_config_dir):
            os.makedirs(aws_config_dir)

runtime_init()
def runtime_init2():
    if getattr(sys, 'frozen', False):
        # If running as exe, ensure AWS config directory exists
        ada_config_dir = os.path.join(os.path.expanduser('~'), '.ada')
        if not os.path.exists(ada_config_dir):
            os.makedirs(ada_config_dir)

runtime_init2()

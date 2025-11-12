
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

hiddenimports = collect_submodules('boto3')
hiddenimports += collect_submodules('botocore')

datas = collect_data_files('boto3')
datas += collect_data_files('botocore')



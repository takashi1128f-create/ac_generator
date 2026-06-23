import subprocess
import os

# 1. 画像から判明しているパス
sdk_exe = r"C:\Program Files (x86)\KunosSDK\kunossdk.exe"
kn5_path = r"D:\デスクトップ\wdts_nissan_silvia_s13\nissan_silvia_s13.kn5"

# 2. 実行コマンド
# 右クリックメニューの挙動を再現するため shell=True で実行します
cmd = f'"{sdk_exe}" extract_fbx "{kn5_path}"'

print(f"🚀 実行開始: {cmd}")

try:
    # 💡 Pythonの subprocess.run は環境の引き継ぎがNodeより強力です
    # cwd（作業ディレクトリ）を .kn5 の場所に設定
    result = subprocess.run(
        cmd, 
        shell=True, 
        cwd=os.path.dirname(kn5_path),
        capture_output=True,
        text=True
    )
    
    print("\n--- 実行結果 ---")
    print(f"終了コード: {result.returncode}")
    print(f"標準出力 (Stdout): {result.stdout or '(空)'}")
    print(f"標準エラー (Stderr): {result.stderr or '(空)'}")
    
    # フォルダができたか確認
    folder_name = os.path.splitext(os.path.basename(kn5_path))
    if os.path.exists(os.path.join(os.path.dirname(kn5_path), folder_name)):
        print(f"✅ 成功！ フォルダを確認しました。")
    else:
        print(f"❌ 失敗。フォルダが生成されていません。")

except Exception as e:
    print(f"🔥 例外発生: {e}")

input("\nEnterキーで閉じます...")
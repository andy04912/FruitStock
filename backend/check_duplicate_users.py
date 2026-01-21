"""
檢查資料庫中是否有重複的使用者
"""
from sqlmodel import Session, select, func
from database import engine
from models import User

def check_duplicate_users():
    with Session(engine) as session:
        # 檢查重複的 username
        print("檢查重複的 username...")
        duplicate_usernames = session.exec(
            select(User.username, func.count(User.id).label('count'))
            .group_by(User.username)
            .having(func.count(User.id) > 1)
        ).all()

        if duplicate_usernames:
            print(f"\n❌ 發現 {len(duplicate_usernames)} 個重複的 username:")
            for username, count in duplicate_usernames:
                print(f"  - {username}: {count} 個帳號")

                # 列出所有重複的用戶
                users = session.exec(
                    select(User).where(User.username == username)
                ).all()

                for user in users:
                    print(f"    ID: {user.id}, 暱稱: {user.nickname}, 建立時間: {user.created_at}")
        else:
            print("✅ 沒有發現重複的 username")

        # 檢查 nickname 是否有問題
        print("\n檢查暱稱狀態...")
        users = session.exec(select(User)).all()

        users_with_same_username_nickname = []
        users_without_nickname = []

        for user in users:
            if user.nickname is None or user.nickname == "":
                users_without_nickname.append(user)
            elif user.nickname == user.username:
                users_with_same_username_nickname.append(user)

        if users_without_nickname:
            print(f"\n⚠️  {len(users_without_nickname)} 個用戶沒有設定暱稱:")
            for user in users_without_nickname[:10]:  # 只顯示前10個
                print(f"  - ID: {user.id}, username: {user.username}")
        else:
            print("✅ 所有用戶都有暱稱")

        if users_with_same_username_nickname:
            print(f"\n📊 {len(users_with_same_username_nickname)} 個用戶的暱稱與 username 相同")

        # 統計總用戶數
        total_users = len(users)
        print(f"\n📈 總用戶數: {total_users}")

if __name__ == "__main__":
    check_duplicate_users()

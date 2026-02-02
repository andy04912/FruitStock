from sqlmodel import Session, select, or_
from database import engine
from models import User, Friendship
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def create_or_get_user(session, username):
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        print(f"Creating user {username}...")
        user = User(username=username, hashed_password=get_password_hash("testpass"))
        session.add(user)
        session.commit()
        session.refresh(user)
    return user

def cleanup_friendship(session, u1_id, u2_id):
    print(f"Cleaning up friendship between {u1_id} and {u2_id}...")
    statement = select(Friendship).where(
        or_(
            (Friendship.user_id == u1_id) & (Friendship.friend_id == u2_id),
            (Friendship.user_id == u2_id) & (Friendship.friend_id == u1_id)
        )
    )
    results = session.exec(statement).all()
    for res in results:
        session.delete(res)
    session.commit()

def run_verification():
    print("Starting Friend System Verification...")
    with Session(engine) as session:
        # 1. Setup Users
        user_a = create_or_get_user(session, "VerifyUserA")
        user_b = create_or_get_user(session, "VerifyUserB")
        
        print(f"User A ID: {user_a.id}")
        print(f"User B ID: {user_b.id}")

        # 2. Cleanup
        cleanup_friendship(session, user_a.id, user_b.id)

        # 3. Step 1: A sends request to B
        print("\n[Step 1] A sending request to B...")
        # (Logic copied from api.py send_friend_request)
        friendship = Friendship(
            user_id=user_a.id,
            friend_id=user_b.id,
            status="PENDING"
        )
        session.add(friendship)
        session.commit()
        session.refresh(friendship)
        print(f"Request sent. Friendship ID: {friendship.id}, Status: {friendship.status}")

        # 4. Step 2: B checks pending requests
        print("\n[Step 2] B checking pending requests...")
        # (Logic copied from api.py get_pending_requests)
        requests = session.exec(
            select(Friendship).where(
                Friendship.friend_id == user_b.id,
                Friendship.status == "PENDING"
            )
        ).all()
        
        found = False
        for req in requests:
            if req.user_id == user_a.id:
                print(f"Found pending request from A (ID: {req.user_id})")
                found = True
                break
        
        if not found:
            print("ERROR: B did not see the pending request!")
            return

        # 5. Step 3: B accepts request
        print("\n[Step 3] B accepting request...")
        # (Logic copied from api.py accept_friend_request)
        req_to_accept = session.get(Friendship, friendship.id)
        req_to_accept.status = "ACCEPTED"
        session.add(req_to_accept)
        session.commit()
        session.refresh(req_to_accept)
        print(f"Request accepted. Status: {req_to_accept.status}")

        # 6. Step 4: Verify Friends List
        print("\n[Step 4] Verifying Friends List...")
        
        # Check A's friends
        friends_a = session.exec(
            select(Friendship).where(
                ((Friendship.user_id == user_a.id) | (Friendship.friend_id == user_a.id)),
                Friendship.status == "ACCEPTED"
            )
        ).all()
        is_b_friend_of_a = any(
            (f.friend_id == user_b.id if f.user_id == user_a.id else f.user_id == user_b.id) 
            for f in friends_a
        )
        print(f"Is B in A's friend list? {is_b_friend_of_a}")

        # Check B's friends
        friends_b = session.exec(
            select(Friendship).where(
                ((Friendship.user_id == user_b.id) | (Friendship.friend_id == user_b.id)),
                Friendship.status == "ACCEPTED"
            )
        ).all()
        is_a_friend_of_b = any(
            (f.friend_id == user_a.id if f.user_id == user_b.id else f.user_id == user_a.id) 
            for f in friends_b
        )
        print(f"Is A in B's friend list? {is_a_friend_of_b}")

        if is_b_friend_of_a and is_a_friend_of_b:
            print("\nSUCCESS: Friend system backend logic verified!")
        else:
            print("\nFAILURE: Friends list verification failed.")

if __name__ == "__main__":
    run_verification()

import React, { useState } from "react";
import { toast } from "sonner";
import { sounds } from "../utils/sound";
import { useAuth } from "../context/AuthContext";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "../components/ui/components";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        if (isRegister) {
            const res = await register(username, password);
            if (res && res.status === 'exists') {
                toast.warning("此帳號已存在，請直接登入！");
                setIsRegister(false);
            } else {
                toast.success("註冊成功，請登入！");
                setIsRegister(false);
            }
        } else {
            const res = await login(username, password);
            if (res && res.status === 'unregistered') {
                toast.info("此帳號尚未註冊，請先註冊！");
                setIsRegister(true);
            } else if (res && res.status === 'failed') {
                toast.error(res.message || "帳號或密碼錯誤");
                sounds.playError();
            } else {
                toast.success("登入成功！");
                sounds.playBuy();
                navigate("/");
            }
        }
    } catch (err) {
        toast.error("操作失敗: " + err.message);
        sounds.playError();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-[350px]">
        <CardHeader className="justify-center items-center text-center">
          <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Logo" className="h-16 w-16 mb-2 object-contain drop-shadow-lg" />
          <CardTitle>{isRegister ? "註冊帳戶" : "登入系統"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input 
                placeholder="使用者名稱" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Input 
                type="password" 
                placeholder="密碼" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              {isRegister ? "註冊" : "登入"}
            </Button>
            <div className="text-center text-sm">
                <span 
                    className="cursor-pointer text-blue-500 hover:underline"
                    onClick={() => setIsRegister(!isRegister)}
                >
                    {isRegister ? "已有帳號？登入" : "沒有帳號？註冊"}
                </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

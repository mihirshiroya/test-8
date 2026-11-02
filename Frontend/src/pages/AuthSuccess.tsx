import { useEffect } from "react";
import { API_BASE_URL } from "../lib/api-origin";

export default function AuthSuccess() {

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/profile`, {
          credentials: "include",
        });

        if (!res.ok) throw new Error("Failed to fetch user profile");

        const data = await res.json();

        console.log("✅ OAuth success, sending user to parent:", data.data.user);

        const channel = new BroadcastChannel("oauth_channel");
        channel.postMessage({
          type: "OAUTH_SUCCESS",
          user: data.data.user,
        });

        channel.close();
          window.close();

      } catch (err) {
        console.error("OAuth success page error:", err);
        const channel = new BroadcastChannel("oauth_channel");
        channel.postMessage({ type: "OAUTH_ERROR", error: err.message } as any);
        channel.close();
          window.close();
      }
    }

    fetchUser();
  }, []);

  return <p>Loading...</p>;
}

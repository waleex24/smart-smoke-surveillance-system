import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import "./Profile.css"; // optional styling

const Profile = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("access_token");

      // 🔐 Redirect if not logged in
      if (!token) {
         navigate("/login");
        return;
      }

      try {
        const response = await API.get("profile/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(response.data);
      } catch (err) {
        console.error("Profile fetch failed:", err);
        alert("Session expired. Please login again.");
        localStorage.removeItem("access_token");
         navigate("/login");
      }
    };

    fetchProfile();
  }, [navigate]);

  if (!user) return <div>Loading profile...</div>;

  return (
    <div className="profile-container">
      <div className="profile-card">
        <h1 className="profile-title">Your Profile</h1>
        <p><strong>Username:</strong> {user.username}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Full Name:</strong> {user.full_name || "-"}</p>
        <p><strong>Reg No:</strong> {user.reg_no || "-"}</p>

        <button
          className="btn-logout"
          onClick={() => {
            localStorage.removeItem("access_token");
             navigate("/login");
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Profile;

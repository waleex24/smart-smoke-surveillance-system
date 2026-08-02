import React, { useEffect, useState } from "react";
import axios from "axios";

const StudentAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          setError("No token found. Please log in again.");
          setLoading(false);
          return;
        }

        const res = await axios.get(
          "http://127.0.0.1:5000/api/attendance/student",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setAttendance(res.data.attendance || []);
      } catch (err) {
        console.error("Error fetching attendance:", err);
        setError("Failed to load attendance data.");
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  if (loading) return <p>Loading attendance...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">My Attendance Record</h2>
      {attendance.length === 0 ? (
        <p>No attendance records found.</p>
      ) : (
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2">Date</th>
              <th className="border border-gray-300 p-2">RegNo</th>
              <th className="border border-gray-300 p-2">Name</th>
              <th className="border border-gray-300 p-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((row, index) => (
              <tr key={index} className="text-center">
                <td className="border border-gray-300 p-2">{row.Date}</td>
                <td className="border border-gray-300 p-2">{row.RegNo}</td>
                <td className="border border-gray-300 p-2">{row.Name}</td>
                <td className="border border-gray-300 p-2">{row.Time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default StudentAttendance;

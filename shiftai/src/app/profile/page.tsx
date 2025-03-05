"use client";

import { useState } from "react";
import Image from "next/image";

export default function ProfilePage() {
  const [name, setName] = useState("John Doe");
  const [role, setRole] = useState("Bartender");
  const [experience, setExperience] = useState("2 years");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Handle profile picture upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle profile save (Simulated - Replace with backend logic)
  const handleSaveProfile = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    alert("✅ Profile saved! (Replace with backend logic)");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background text-text">
      {/* 🔹 Page Title */}
      <h1 className="text-3xl md:text-4xl font-extrabold text-primary mb-4">
        My Profile
      </h1>
      <p className="text-lg text-secondary">Manage your personal details</p>

      {/* 🔹 Profile Picture */}
      <div className="mt-6 relative flex flex-col items-center">
        {profilePic ? (
          <Image
            src={profilePic}
            alt="Profile Picture"
            width={120}
            height={120}
            className="rounded-full border-4 border-primary shadow-lg transition-transform hover:scale-105"
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 border border-gray-500">
            No Image
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="mt-2 text-sm text-gray-400 cursor-pointer"
          onChange={handleImageUpload}
        />
      </div>

      {/* 🔹 Profile Form */}
      <div className="mt-6 w-full md:w-2/3 bg-card p-6 rounded-lg shadow-lg">
        <label className="block text-sm text-secondary">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 mt-1 bg-gray-700 text-white rounded-md focus:ring focus:ring-primary"
        />

        <label className="block mt-4 text-sm text-secondary">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full p-2 mt-1 bg-gray-700 text-white rounded-md focus:ring focus:ring-primary"
        >
          <option>Bartender</option>
          <option>Server</option>
          <option>Chef</option>
          <option>Manager</option>
        </select>

        <label className="block mt-4 text-sm text-secondary">Experience</label>
        <input
          type="text"
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          className="w-full p-2 mt-1 bg-gray-700 text-white rounded-md focus:ring focus:ring-primary"
        />
      </div>

      {/* 🔹 Save Button */}
      <button
        className={`mt-6 px-6 py-3 rounded-lg text-lg font-semibold transition 
          ${saved ? "bg-green-500 hover:bg-green-600" : "bg-primary hover:bg-opacity-80"}`}
        onClick={handleSaveProfile}
      >
        {saved ? "✅ Saved!" : "Save Changes"}
      </button>
    </div>
  );
}

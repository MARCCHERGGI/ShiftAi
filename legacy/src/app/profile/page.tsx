"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, Save, Check } from "lucide-react";

import { trackEvent } from "@/src/lib/track";

export default function ProfilePage() {
  const [name, setName] = useState("John Doe");
  const [role, setRole] = useState("Bartender");
  const [experience, setExperience] = useState("2 years");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePic(reader.result as string);
      reader.readAsDataURL(file);
      trackEvent("profile_photo_upload", { size: file.size, type: file.type });
    }
  };

  const handleSaveProfile = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    trackEvent("profile_save", {
      has_name: Boolean(name && name !== "John Doe"),
      role,
      has_experience: Boolean(experience),
      has_photo: Boolean(profilePic),
    });
  };

  return (
    <div className="page-enter px-5 max-w-lg mx-auto">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Profile
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--secondary)" }}>
          Manage your details
        </p>
      </div>

      {/* Profile Picture */}
      <div className="flex justify-center py-4">
        <label className="relative cursor-pointer group">
          {profilePic ? (
            <Image
              src={profilePic}
              alt="Profile"
              width={100}
              height={100}
              className="w-24 h-24 rounded-full object-cover"
              style={{ border: "3px solid var(--primary)" }}
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
              style={{ background: "var(--input-bg)", color: "var(--secondary)" }}
            >
              {name.charAt(0)}
            </div>
          )}
          <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center bg-indigo-500 text-white shadow-lg">
            <Camera className="w-4 h-4" />
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </label>
      </div>

      {/* Form */}
      <div className="space-y-4 mt-4">
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--secondary)" }}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--secondary)" }}>Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="input-field"
          >
            <option>Bartender</option>
            <option>Server</option>
            <option>Chef</option>
            <option>Manager</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--secondary)" }}>Experience</label>
          <input
            type="text"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSaveProfile}
        className="w-full mt-6 py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        style={{ background: saved ? "#10b981" : "var(--primary)" }}
      >
        {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
      </button>
    </div>
  );
}

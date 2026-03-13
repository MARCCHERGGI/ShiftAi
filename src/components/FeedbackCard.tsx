"use client";

import React from "react";

type FeedbackCardProps = {
  title: string;
  items: string[];
  variant?: "success" | "warning";
};

export default function FeedbackCard({ title, items, variant = "success" }: FeedbackCardProps) {
  const cardStyles = `w-full md:w-2/3 p-6 rounded-md shadow-lg transition duration-200`;
  const variantStyles = {
    success: "bg-gray-800 text-green-400 border border-green-500",
    warning: "bg-gray-800 text-red-400 border border-red-500",
  };

  return (
    <div className={`${cardStyles} ${variantStyles[variant]}`}>
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="list-disc list-inside text-gray-300 mt-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            {variant === "success" ? "✅" : "⚠️"} {item}
          </li>
        ))}
      </ul>
    </div>
  );
}


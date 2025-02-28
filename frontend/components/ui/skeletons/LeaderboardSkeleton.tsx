"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgentListView } from "@/components/AgentListView";
import { TEXT_COPIES } from "@/constants";

export default function LeaderboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTabFromUrl = searchParams.get("active") || "attackers";
  const [activeTab, setActiveTab] = useState(activeTabFromUrl);

  // Update URL when tab changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("active", activeTab);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [activeTab]);

  return (
    <div className="mt-16 md:mt-0 min-h-screen bg-cover bg-center bg-no-repeat text-white flex-col items-end md:items-center justify-center md:px-4">
      <div className="flex space-x-4 mb-4">
        <button
          className={`px-4 py-2 ${activeTab === "attackers" ? "bg-blue-500" : "bg-gray-700"}`}
          onClick={() => setActiveTab("attackers")}
        >
          Top Attackers
        </button>
        <button
          className={`px-4 py-2 ${activeTab === "defenders" ? "bg-blue-500" : "bg-gray-700"}`}
          onClick={() => setActiveTab("defenders")}
        >
          Top Defenders
        </button>
      </div>

      <AgentListView
        heading={TEXT_COPIES.leaderboard.heading}
        subheading={TEXT_COPIES.leaderboard.subheading}
      />
    </div>
  );
}

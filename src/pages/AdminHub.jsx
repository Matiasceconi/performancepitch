import React, { useState } from "react";
import { ShieldCheck, GitMerge, Fingerprint, Users, UserCog } from "lucide-react";
import PlayerAdmin from "@/pages/PlayerAdmin";
import DataCrossing from "@/pages/DataCrossing";
import PlayerIdentity from "@/pages/PlayerIdentity";
import StaffManager from "@/pages/StaffManager";
import UsersAccess from "@/pages/UsersAccess";

const TABS = [
  { id: "users", label: "Usuarios y Accesos", icon: UserCog },
  { id: "players", label: "Admin Plantel", icon: ShieldCheck },
  { id: "crossing", label: "Cruce de datos", icon: GitMerge },
  { id: "identity", label: "Identity Manager", icon: Fingerprint },
  { id: "staff", label: "Cuerpo Técnico y Staff", icon: Users },
];

export default function AdminHub() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Administración</h1>
        <p className="text-zinc-500 text-sm mt-1">Gestión del plantel, cruce de datos e identidades</p>
      </div>

      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === "users"    && <UsersAccess />}
        {activeTab === "players"  && <PlayerAdmin />}
        {activeTab === "crossing" && <DataCrossing />}
        {activeTab === "identity" && <PlayerIdentity />}
        {activeTab === "staff"    && <StaffManager />}
      </div>
    </div>
  );
}
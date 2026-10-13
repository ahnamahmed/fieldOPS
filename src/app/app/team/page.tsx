"use client";

import * as React from "react";
import {
  UserCheck,
  Plus,
  Phone,
  Mail,
  Shield,
  Briefcase,
  Wrench,
  X,
  MessageSquare,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { useToast } from "@/components/ui/toast";
import { formatBDPhoneDisplay } from "@/lib/formatters";
import {
  DEMO_TEAM,
  type DemoTeamMember,
} from "@/lib/demo-data";

export default function TeamPage() {
  const { toast } = useToast();
  const [team, setTeam] = React.useState<DemoTeamMember[]>(DEMO_TEAM);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");
  const [newRole, setNewRole] = React.useState<"technician" | "dispatcher" | "finance" | "admin">("technician");

  const filteredTeam = team.filter((member) => {
    const matchesSearch =
      !searchQuery ||
      member.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery);

    const matchesRole = !roleFilter || member.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // Calculate Metrics
  const totalMembers = team.length;
  const techniciansCount = team.filter((m) => m.role === "technician").length;
  const dispatchStaffCount = team.filter((m) => m.role === "dispatcher" || m.role === "admin").length;
  const totalActiveJobsAssigned = team.reduce((acc, m) => acc + m.activeJobsCount, 0);

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      toast({
        title: "Validation Error",
        description: "Full name and Bangladeshi mobile number are required.",
        type: "error",
      });
      return;
    }

    const initials = newName
      .trim()
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const newMember: DemoTeamMember = {
      id: `member-${Date.now()}`,
      fullName: newName.trim(),
      role: newRole,
      email: newEmail.trim() || `${newName.toLowerCase().replace(/\s+/g, ".")}@cooltechbd.com`,
      phone: newPhone.trim(),
      activeJobsCount: 0,
      status: "invited",
      avatarInitials: initials || "TM",
    };

    setTeam([...team, newMember]);
    setIsInviteModalOpen(false);
    setNewName("");
    setNewEmail("");
    setNewPhone("");

    toast({
      title: "Invitation Dispatched",
      description: `Sent login invite SMS & email to ${newMember.fullName} (${newRole.toUpperCase()}).`,
      type: "success",
    });
  };

  const handleCallTechnician = (member: DemoTeamMember) => {
    toast({
      title: "Dialing Technician",
      description: `Initiating call to ${member.fullName} at ${formatBDPhoneDisplay(member.phone)}...`,
      type: "info",
    });
  };

  const handleWhatsApp = (member: DemoTeamMember) => {
    toast({
      title: "Opening WhatsApp",
      description: `Direct message ready for ${member.fullName} (${member.phone}).`,
      type: "info",
    });
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "admin":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "dispatcher":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "technician":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "finance":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & Technicians"
        description="Manage service technicians, dispatch controllers, finance personnel, and field workloads across Dhaka."
        actions={
          <Button
            size="sm"
            onClick={() => setIsInviteModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Invite Member
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Personnel"
          value={totalMembers}
          subtitle="Staff across all roles"
          icon={<Users className="h-5 w-5 text-blue-600" />}
        />
        <MetricCard
          title="Field Technicians"
          value={techniciansCount}
          subtitle="On-site AC & HVAC specialists"
          icon={<Wrench className="h-5 w-5 text-amber-600" />}
        />
        <MetricCard
          title="Dispatch & Management"
          value={dispatchStaffCount}
          subtitle="Operations and control"
          icon={<Shield className="h-5 w-5 text-indigo-600" />}
        />
        <MetricCard
          title="Active Field Tasks"
          value={totalActiveJobsAssigned}
          subtitle="Assigned work orders underway"
          icon={<Briefcase className="h-5 w-5 text-emerald-600" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search team member by name, phone, or email..."
        filterValue={roleFilter}
        onFilterChange={setRoleFilter}
        filterLabel="All Roles"
        filterOptions={[
          { label: "Technician", value: "technician" },
          { label: "Dispatcher", value: "dispatcher" },
          { label: "Finance", value: "finance" },
          { label: "Admin", value: "admin" },
          { label: "Owner", value: "owner" },
        ]}
        resultsCount={filteredTeam.length}
      />

      {/* Team Cards Grid */}
      {filteredTeam.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members found"
          description={
            searchQuery || roleFilter
              ? "No staff members match the selected filters."
              : "No team members added yet."
          }
          action={
            <Button
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Invite First Member
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeam.map((member) => (
            <Card
              key={member.id}
              className="p-5 flex flex-col justify-between border-slate-200 hover:border-slate-300 transition-all shadow-xs hover:shadow-sm"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-sm shadow-xs">
                      {member.avatarInitials}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">
                        {member.fullName}
                      </h3>
                      <span
                        className={`inline-block px-2 py-0.5 mt-1 rounded text-[11px] font-semibold border capitalize ${getRoleBadgeStyle(
                          member.role
                        )}`}
                      >
                        {member.role}
                      </span>
                    </div>
                  </div>
                  {member.status === "invited" && (
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Invited
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700">
                      {formatBDPhoneDisplay(member.phone)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-500 truncate">{member.email}</span>
                  </div>
                </div>

                {member.role === "technician" && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                      Current Workload:
                    </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-xs ${
                        member.activeJobsCount > 0
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {member.activeJobsCount} Active Jobs
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCallTechnician(member)}
                  className="flex-1 text-xs"
                >
                  <Phone className="h-3.5 w-3.5 mr-1 text-slate-500" />
                  Call
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleWhatsApp(member)}
                  className="flex-1 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                  WhatsApp
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900 text-base">
                  Invite Team Member
                </h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mahfuzur Rahman"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  System Role *
                </label>
                <select
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(
                      e.target.value as
                        | "technician"
                        | "dispatcher"
                        | "finance"
                        | "admin"
                    )
                  }
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white text-slate-900"
                >
                  <option value="technician">Technician (Mobile Job App Access)</option>
                  <option value="dispatcher">Dispatcher (Jobs & Scheduling)</option>
                  <option value="finance">Finance (Invoices, Quotes, Payments)</option>
                  <option value="admin">Administrator (Company Management)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Mobile Phone (Bangladesh) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="01712-XXXXXX"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="mahfuz@cooltechbd.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsInviteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Send Invitation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* eslint-disable react-refresh/only-export-components */
import { getCurrentRoles } from "../api/client.js";


export const isGuestRole = (role) => role === "Guest" || role === "Guest User";
// Resolve permissions for a user dynamically using roles hierarchy level.

// Resolve permissions for a user dynamically using roles hierarchy level.
export const getPerms = (user) => {
  if (!user) return { canEditMeetings: false, canCreateProjects: false, canEditActions: false, canViewDashboard: false, canManageEscalations: false };
  
  // Resolve level from roles (fresh from API via module-level state) or fallback
  let level = 1;
  if (user.role === "Admin") level = 8;
  else {
    const rObj = (getCurrentRoles() || []).find(r => r.name === user.role);
    if (rObj && rObj.level !== undefined) level = Number(rObj.level);
    else {
      const fallbacks = { "Guest": 1, "Guest User": 1, "Supervisor": 3, "Shift Engineer": 4, "HOD": 5, "Plant Head": 6, "MD": 7, "Admin": 8 };
      level = fallbacks[user.role] ?? 1;
    }
  }

  // Base level-based permissions (reversed hierarchy: higher level = more access)
  return {
    canEditMeetings:     level >= 5,
    canCreateProjects:   level >= 5,
    canEditActions:      level >= 2,
    canViewDashboard:    level >= 2,
    canManageEscalations: level >= 7,
  };
};

export const isUserAdmin = (user) => {
  if (!user) return false;
  if (user.role === "Admin") return true;
  return false;
};

export const canAccessMasterSetup = (user) => {
  if (!user) return false;
  const isMasterExplicit = user.masterAccess === true || user.master_access === true;
  const isAllPlants = !user.plant || user.plant === "All";
  return isUserAdmin(user) || (isMasterExplicit && isAllPlants);
};

// Plant-scoping helpers: non-admin users only see data from their own plant.
// user.plant may be a plant ID ("P2") or a plant name ("Adroit Driveshaft").

// Plant-scoping helpers: non-admin users only see data from their own plant.
// user.plant may be a plant ID ("P2") or a plant name ("Adroit Driveshaft").
export const scopedPlants = (user, plants) => {
  if (isUserAdmin(user) || !user?.plant || user.plant === "All") return plants;
  const up = user.plant;
  return (plants || []).filter(p => p.name === up || p.id === up);
};

export const scopedDepts = (user, depts) => {
  if (isUserAdmin(user) || !user?.plant || user.plant === "All") return depts;
  const up = user.plant;
  return (depts || []).filter(d => !d.plant || d.plant === "All Plants" || d.plant === up || d.plantId === up);
};

export const scopedUsers = (user, users) => {
  if (isUserAdmin(user) || !user?.plant || user.plant === "All") return users;
  const up = user.plant;
  return (users || []).filter(u => !u.plant || u.plant === "All" || u.plant === up || u.plant_id === up);
};

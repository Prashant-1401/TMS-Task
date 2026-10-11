/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useRef, useState } from "react";
import { apiCreate, apiRemove, apiUpdate } from "../api/autosave.js";
import { apiPost } from "../api/client.js";
import { EscMatrixTab } from "../components/EscMatrixTab.jsx";
import { Avatar, Empty, HR, Lbl, PageHeader, SectionSaveButton } from "../components/ui.jsx";
import { useEscClose } from "../hooks/useEscClose.js";
import { TeamPage } from "../pages/TeamPage.jsx";
import { MEETING_TYPES } from "../utils/constants.js";
import { ensureArray } from "../utils/data.js";
import { normKeys } from "../utils/keys.js";
import { isGuestRole, isUserAdmin } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

export function MasterPage({ user, plants, setPlants, depts, setDepts, users, setUsers, escMatrix, setEscMatrix, mtgPresets, setMtgPresets, machines, setMachines, _refreshMaster, roles = [], setRoles, actions, setActions }) {
  const isAdmin = isUserAdmin(user);
  const isMasterOnly = !isAdmin && (user?.masterAccess === true || user?.master_access === true);
  const myPlant = user?.plant;

  const mPlants = isMasterOnly ? plants.filter(p => p.name === myPlant) : plants;
  const mDepts = isMasterOnly ? depts.filter(d => d.plant === myPlant || d.plant === "All Plants") : depts;
  const mUsers = isMasterOnly ? users.filter(u => u.plant === myPlant) : users;
  const mMachines = isMasterOnly ? (machines || []).filter(m => m.plant === myPlant) : machines;
  const mEscMatrix = isMasterOnly ? (escMatrix || []).filter(e => !e.plant || e.plant === myPlant) : escMatrix;
  const [tab, setTab] = useState("users");
  const [userFilterPlant, setUserFilterPlant] = useState(() => { try { return localStorage.getItem("mcs_master_userFilterPlant") || "All"; } catch { return "All"; } });
  const [userFilterRole, setUserFilterRole] = useState(() => { try { return localStorage.getItem("mcs_master_userFilterRole") || "All"; } catch { return "All"; } });
  const [userFilterDept, setUserFilterDept] = useState(() => { try { return localStorage.getItem("mcs_master_userFilterDept") || "All"; } catch { return "All"; } });
  const [userSearch, setUserSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [mcSaveStatus, setMcSaveStatus] = useState(null);
  const [plantSaveStatus, setPlantSaveStatus] = useState(null);
  const [deptSaveStatus, setDeptSaveStatus] = useState(null);
  const COLORS = ["#272262", "#5B56A6", "#E69903", "#7C80B0", "#1E8449", "#C0392B"];
  useEffect(() => { try { localStorage.setItem("mcs_master_userFilterPlant", userFilterPlant); } catch {} }, [userFilterPlant]);
  useEffect(() => { try { localStorage.setItem("mcs_master_userFilterRole", userFilterRole); } catch {} }, [userFilterRole]);
  useEffect(() => { try { localStorage.setItem("mcs_master_userFilterDept", userFilterDept); } catch {} }, [userFilterDept]);
  
  const initialIds = useRef(null);
  if (!initialIds.current && users.length > 0) {
    initialIds.current = {
      users: new Set(users.map(x => x.id)),
      plants: new Set(plants.map(x => x.id)),
      depts: new Set(depts.map(x => x.id)),
      machines: new Set((machines || []).map(x => x.id)),
      roles: new Set(roles.map(x => x.id)),
      escMatrix: new Set((escMatrix || []).map(x => x.id)),
    };
  }

  const canModify = (tabKey, rowId) => {
    if (isAdmin) return true;
    if (isMasterOnly) return true;
    if (!initialIds.current || !initialIds.current[tabKey]) return false;
    return !initialIds.current[tabKey].has(rowId);
  };

  const openAdd = t => {
    setModal({ type: t, mode: "add" });
    setForm({});
    setMcSaveStatus(null); setPlantSaveStatus(null); setDeptSaveStatus(null);
  };
  const openEdit = (t, d) => { setModal({ type: t, mode: "edit" }); setForm({ ...d, masterAccess: d.master_access || d.masterAccess || false }); setMcSaveStatus(null); setPlantSaveStatus(null); setDeptSaveStatus(null); };
  const close = () => { setModal(null); setForm({}); setMcSaveStatus(null); setPlantSaveStatus(null); setDeptSaveStatus(null); };
  useEscClose(close);
  const saveUser = () => {
    if (!form.name || !form.role || !form.plant) return;
    if (modal.mode !== "edit" && !isGuestRole(form.role) && (!form.username || !form.password)) return;
    const { _showPw, ...cleanForm } = form;
    const pMap = {}; plants.forEach(p => { pMap[p.name] = p.id; });
    const dMap = {}; depts.forEach(d => { dMap[d.name] = d.id; });
    const u = {
      ...cleanForm,
      username: isGuestRole(form.role) ? (form.username || "guest") : form.username,
      password: isGuestRole(form.role) ? (form.password || "") : form.password,
      id: cleanForm.id || "U" + String(Date.now()).slice(-6),
      initials: cleanForm.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      color: cleanForm.color || COLORS[users.length % 6],
      plantId: pMap[cleanForm.plant] || cleanForm.plantId || null,
      deptId: dMap[cleanForm.dept] || cleanForm.deptId || null,
      master_access: cleanForm.masterAccess === true,
    };
    if (modal.mode === "edit") { setUsers(p => p.map(x => x.id === u.id ? u : x)); apiUpdate("users", u.id, u); } else { setUsers(p => [...p, u]); apiCreate("users", u); } close();
  };
  const ALL_TABS = [["users", "👥 Users"], ["plants", "🏭 Plants"], ["depts", "🗂 Depts"], ["machines", "⚙ Machines"], ["roles", "🎭 Roles"], ["team", "🧑‍🤝‍🧑 Team"], ["escmatrix", "🚨 Escalation"], ["presets", "🎙 Presets"]];
  const TABS = isMasterOnly ? ALL_TABS.filter(([id]) => ["users", "machines", "escmatrix", "presets", "depts"].includes(id)) : ALL_TABS;

  const BULK_ENDPOINTS = {
    "Users": "/api/users/bulk",
    "Plants": "/api/plants/bulk",
    "Departments": "/api/departments/bulk",
    "Machines": "/api/machines/bulk",
    "Roles": "/api/roles/bulk",
    "EscalationMatrix": "/api/escalation/matrix/bulk",
    "MeetingPresets": "/api/meetings/presets/bulk",
  };
  const saveToAPI = async (tab, rows) => {
    const cleaned = (Array.isArray(rows) ? rows : []).filter(r => Object.keys(r).length > 0);
    if (cleaned.length === 0) throw new Error("Nothing to save — add at least one entry first");
    const endpoint = BULK_ENDPOINTS[tab];
    if (!endpoint) throw new Error(`No bulk endpoint for ${tab}`);
    // Build name → ID maps for plant/dept
    const pInv = {}; plants.forEach(p => { pInv[p.name] = p.id; });
    const dInv = {}; depts.forEach(d => { dInv[d.name] = d.id; });
    const mapped = cleaned.map(r => {
      const out = normKeys(r);
      if (r.plant && pInv[r.plant] && !out.plant_id) out.plant_id = pInv[r.plant];
      if (r.dept && dInv[r.dept] && !out.dept_id) out.dept_id = dInv[r.dept];
      if (out.plant_id === "") out.plant_id = null;
      if (out.dept_id === "") out.dept_id = null;
      return out;
    });
    console.log("saveToAPI", tab, endpoint, "rows:", rows.length, "mapped:", mapped.length);
    await apiPost(endpoint, mapped);
    const keyMap = {
      "Users": "users", "Plants": "plants", "Departments": "depts",
      "Machines": "machines", "Roles": "roles", "EscalationMatrix": "escMatrix"
    };
    const key = keyMap[tab];
    if (key && initialIds.current && initialIds.current[key]) {
      rows.forEach(r => { if (r.id) initialIds.current[key].add(r.id); });
    }
  };


  /* ── Section header with Save button ── */
  const SectionHeader = ({ title, sub, onSave, addLabel, onAdd }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap", overflowX: "auto", gap: 10, marginBottom: 16 }}>

      <div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, color: T.navy }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto" }}>
        {onAdd && <button className="btn btn-amber btn-sm" onClick={onAdd}>{addLabel || "+ Add"}</button>}
        {onSave && <SectionSaveButton onSave={onSave} />}
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      <PageHeader title="Master Setup" sub={isMasterOnly ? `Manage ${myPlant} — plant-scoped access` : "Admin only — manage organisation structure"} />

      {/* Scrollable tab bar */}
      <div style={{ borderBottom: `2px solid ${T.border}`, marginBottom: 20, overflowX: "auto", display: "flex", gap: 0, WebkitOverflowScrolling: "touch" }}>
        {TABS.map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: "9px 14px", border: "none", cursor: "pointer", background: "transparent", fontSize: 12, fontWeight: tab === id ? 700 : 400, color: tab === id ? T.navy : T.text2, borderBottom: tab === id ? `3px solid ${T.navy}` : "3px solid transparent", marginBottom: -2, transition: "all .2s", whiteSpace: "nowrap", flexShrink: 0 }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── USERS ── */}
      {tab === "users" && <>
        <SectionHeader
          title="Users"
          sub={isMasterOnly ? `Users in ${myPlant}` : "All system users and their login credentials"}
          onAdd={() => openAdd("users")}
          onSave={() => saveToAPI("Users", mUsers)}
        />
        {(() => {
          const uPlants = Array.from(new Set(mUsers.map(u => u.plant).filter(Boolean))).sort();
          const uRoles = Array.from(new Set(mUsers.map(u => u.role).filter(Boolean))).sort();
          const uDepts = Array.from(new Set(mUsers.map(u => u.dept).filter(Boolean))).sort();
          const filteredUsers = mUsers.filter(u =>
            (userFilterPlant === "All" || u.plant === userFilterPlant) &&
            (userFilterRole === "All" || u.role === userFilterRole) &&
            (userFilterDept === "All" || u.dept === userFilterDept) &&
            (!userSearch || (u.name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
             (u.username || "").toLowerCase().includes(userSearch.toLowerCase()) ||
             (u.dept || "").toLowerCase().includes(userSearch.toLowerCase()) ||
             (u.plant || "").toLowerCase().includes(userSearch.toLowerCase()) ||
             (u.role || "").toLowerCase().includes(userSearch.toLowerCase()))
          );
          return (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap", overflowX: "auto", marginBottom: 14 }}>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  style={{ fontSize: 12, padding: "6px 10px", flex: 1, minWidth: 180 }}
                />
                <select value={userFilterPlant} onChange={e => setUserFilterPlant(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", minWidth: 140 }}>
                  <option value="All">All Plants</option>
                  {uPlants.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={userFilterRole} onChange={e => setUserFilterRole(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", minWidth: 140 }}>
                  <option value="All">All Roles</option>
                  {uRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={userFilterDept} onChange={e => setUserFilterDept(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", minWidth: 140 }}>
                  <option value="All">All Depts</option>
                  {uDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {(userFilterPlant !== "All" || userFilterRole !== "All" || userFilterDept !== "All" || userSearch) &&
                  <button className="btn btn-ghost btn-sm" onClick={() => { setUserFilterPlant("All"); setUserFilterRole("All"); setUserFilterDept("All"); setUserSearch(""); }}>Clear</button>}
                <span style={{ fontSize: 11, color: T.text2, marginLeft: "auto" }}>{filteredUsers.length} of {users.length} users</span>
              </div>
              {/* Mobile card list */}
              <div style={{ display: "none" }} className="master-mobile-cards">
                {filteredUsers.map(u => (
                  <div key={u.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <Avatar name={u.name} size={38} users={users} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: T.text2 }}>{u.role} · {u.plant}</div>
                      </div>
                      {canModify("users", u.id) && <button className="btn btn-ghost btn-sm" onClick={() => openEdit("users", u)}>Edit</button>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                      <div><span style={{ color: T.text2 }}>Dept: </span>{u.dept || "—"}</div>
                      <div><span style={{ color: T.text2 }}>Superior: </span>{u.superior || "Top"}</div>
                      <div><span style={{ color: T.text2 }}>Phone: </span>{u.phone || "—"}</div>
                    </div>
                    {canModify("users", u.id) && <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                      <button className="btn btn-ghost btn-sm" style={{ color: T.red }} onClick={() => { if (window.confirm(`Remove "${u.name}"?`)) { setUsers(p => p.filter(x => x.id !== u.id)); apiRemove("users", u.id); } }}>✕ Remove</button>
                    </div>}
                  </div>
                ))}
                {filteredUsers.length === 0 && <Empty icon="👥" title="No users" sub={users.length === 0 ? "Click + Add to create the first user." : "No users match these filters."} />}
              </div>
              {/* Desktop table */}
              <div className="card master-desktop-table" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ minWidth: 700 }}><thead><tr><th>User</th><th>Role</th><th>Plant</th><th>Dept</th><th>Master</th><th>Superior</th><th>Phone</th><th></th></tr></thead>
                    <tbody>{filteredUsers.map(u => <tr key={u.id}>
                      <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar name={u.name} size={32} users={users} /><div style={{ fontWeight: 600 }}>{u.name}</div></div></td>
                      <td><span style={{ padding: "3px 9px", borderRadius: 20, background: T.navy + "15", color: T.navy, fontSize: 11, fontWeight: 600 }}>{u.role}</span></td>
                      <td style={{ fontSize: 12 }}>{u.plant}</td>
                      <td style={{ fontSize: 12 }}>{u.dept || "—"}</td>
                      <td style={{ fontSize: 12 }}>{u.master_access ? "✅" : "—"}</td>
                      <td style={{ fontSize: 12, color: T.text2 }}>{u.superior || "—"}</td>
                      <td style={{ fontSize: 12, color: T.text2 }}>{u.phone || "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {canModify("users", u.id) && <button className="btn btn-ghost btn-sm" onClick={() => openEdit("users", u)}>Edit</button>}
                        {canModify("users", u.id) && <button className="btn btn-ghost btn-sm" style={{ color: T.red, marginLeft: 4 }} onClick={() => { if (window.confirm(`Remove "${u.name}" from the system?`)) { setUsers(p => p.filter(x => x.id !== u.id)); apiRemove("users", u.id); } }}>✕</button>}
                      </td>
                    </tr>)}
                    {filteredUsers.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: T.text2, fontSize: 12 }}>No users match these filters.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          );
        })()}
      </>}

      {/* ── PLANTS ── */}
      {tab === "plants" && <>
        <SectionHeader title="Plants" sub="Manufacturing plant locations" onAdd={isMasterOnly ? null : () => openAdd("plants")} onSave={isMasterOnly ? null : () => saveToAPI("Plants", plants)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
          {mPlants.map(p => <div key={p.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 26 }}>🏭</span>{canModify("plants", p.id) && <div><button className="btn btn-ghost btn-sm" onClick={() => openEdit("plants", p)}>Edit</button><button className="btn btn-ghost btn-sm" style={{ color: T.red, marginLeft: 4 }} onClick={() => { if (window.confirm(`Remove plant "${p.name}"?`)) { setPlants(prev => prev.filter(x => x.id !== p.id)); apiRemove("plants", p.id); } }}>✕</button></div>}</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14, color: T.navy }}>{p.name}</div>
            <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{p.location}</div>
            {p.head && <><HR /><div style={{ fontSize: 12 }}>Head: <b>{p.head}</b></div></>}
          </div>)}
          {mPlants.length === 0 && <Empty icon="🏭" title="No plants" sub="Click + Add to register a plant." />}
        </div>
      </>}

      {/* ── DEPARTMENTS ── */}
      {tab === "depts" && <>
        <SectionHeader title="Departments" sub={isMasterOnly ? `Departments in ${myPlant}` : "Sections within each plant"} onAdd={() => openAdd("depts")} onSave={() => saveToAPI("Departments", mDepts)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>
          {(mDepts || []).map(d => <div key={d.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 26 }}>{d.icon || "🗂"}</span>{canModify("depts", d.id) && <div><button className="btn btn-ghost btn-sm" onClick={() => openEdit("depts", d)}>Edit</button><button className="btn btn-ghost btn-sm" style={{ color: T.red, marginLeft: 4 }} onClick={() => { if (window.confirm(`Remove department "${d.name}"?`)) { setDepts(prev => prev.filter(x => x.id !== d.id)); apiRemove("departments", d.id); } }}>✕</button></div>}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</div>
            {d.head && <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>HOD: {d.head}</div>}
            {d.plant && <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>Plant: {d.plant}</div>}
          </div>)}
          {mDepts.length === 0 && <Empty icon="🗂" title="No departments" sub="Click + Add to create a department." />}
        </div>
      </>}

      {/* ── MACHINES ── */}
      {tab === "machines" && <>
        <SectionHeader title="Machines" sub={isMasterOnly ? `Machines in ${myPlant}` : "Registered equipment across all plants"} onAdd={() => openAdd("machines")} onSave={() => saveToAPI("Machines", (mMachines || []))} />
        {/* Mobile cards */}
        <div style={{ display: "none" }} className="master-mobile-cards">
          {(mMachines || []).map(m => (
            <div key={m.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: T.text2, marginTop: 3 }}>{m.type || "—"} · {m.plant || "—"}</div>
                  <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>Dept: {m.dept || "—"} · Asset: {m.assetNo || "—"}</div>
                </div>
                {canModify("machines", m.id) && <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit("machines", m)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: T.red }} onClick={() => { setMachines(p => p.filter(x => x.id !== m.id)); apiRemove("machines", m.id); }}>✕</button>
                </div>}
              </div>
            </div>
          ))}
          {(!mMachines || mMachines.length === 0) && <Empty icon="⚙" title="No machines" sub="Click + Add to register a machine." />}
        </div>
        {/* Desktop table */}
        <div className="card master-desktop-table" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 560 }}><thead><tr><th>Machine</th><th>Plant</th><th>Dept</th><th>Type</th><th>Asset No.</th><th></th></tr></thead>
              <tbody>
                {(mMachines || []).map(m => <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td style={{ fontSize: 12 }}>{m.plant || "—"}</td>
                  <td style={{ fontSize: 12 }}>{m.dept || "—"}</td>
                  <td style={{ fontSize: 12, color: T.text2 }}>{m.type || "—"}</td>
                  <td style={{ fontSize: 12, color: T.text2 }}>{m.assetNo || "—"}</td>
                  <td>
                    {canModify("machines", m.id) && <button className="btn btn-ghost btn-sm" onClick={() => openEdit("machines", m)}>Edit</button>}
                    {canModify("machines", m.id) && <button className="btn btn-ghost btn-sm" style={{ color: T.red, marginLeft: 4 }} onClick={() => { setMachines(p => p.filter(x => x.id !== m.id)); apiRemove("machines", m.id); }}>✕</button>}
                  </td>
                </tr>)}
                {(!mMachines || mMachines.length === 0) && <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: T.text2, fontSize: 12 }}>No machines added yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>}

      {/* ── ROLES ── */}
      {tab === "roles" && <>
        <SectionHeader title="Roles" sub="System roles and access levels" onAdd={isAdmin ? () => openAdd("roles") : null} onSave={isAdmin ? () => saveToAPI("Roles", roles) : null} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
          {roles.map(r => <div key={r.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 26 }}>🎭</span>
              {canModify("roles", r.id) && <div>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit("roles", r)}>Edit</button>
                <button className="btn btn-ghost btn-sm" style={{ color: T.red, marginLeft: 4 }} onClick={() => { if (window.confirm(`Remove role "${r.name}"?`)) { setRoles(prev => prev.filter(x => x.id !== r.id)); apiRemove("roles", r.id); } }}>✕</button>
              </div>}
            </div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14, color: T.navy }}>{r.name}</div>
            <div style={{ fontSize: 12, color: T.text2, marginTop: 4 }}>Level: <b>{r.level ?? "—"}</b></div>
          </div>)}
          {roles.length === 0 && <Empty icon="🎭" title="No roles" sub="Click + Add to register a role." />}
        </div>
      </>}

      {/* ── TEAM ── */}
      {tab === "team" && <TeamPage users={users} actions={actions} escMatrix={escMatrix} plants={plants} depts={depts} user={user} isAdmin={isAdmin} setActions={setActions} />}

      {/* ── ESCALATION MATRIX ── */}
      {tab === "escmatrix" && <EscMatrixTab escMatrix={mEscMatrix || []} setEscMatrix={setEscMatrix} onSave={() => saveToAPI("EscalationMatrix", mEscMatrix || [])} isAdmin={isAdmin} canModify={canModify} users={mUsers} roles={roles} />}

      {/* ── MEETING PRESETS ── */}
      {tab === "presets" && <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "nowrap", overflowX: "auto", gap: 10, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, color: T.navy }}>Meeting Presets</div>
          <SectionSaveButton onSave={() => {
            const allTypes = Array.from(new Set([...Object.keys(mtgPresets.attendeeMap || {}), ...Object.keys(mtgPresets.instructions || {})]));
            const rows = allTypes.map(t => ({ type: t, attendees: ensureArray((mtgPresets.attendeeMap || {})[t]), instructions: ensureArray((mtgPresets.instructions || {})[t]) }));
            return saveToAPI("MeetingPresets", rows);
          }} />
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          {MEETING_TYPES.map(type => (
            <div key={type} className="card" style={{ padding: 16, background: T.bg }}>
              <div style={{ fontWeight: 700, color: T.navy, marginBottom: 10, fontSize: 14 }}>{type}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
                <div>
                  <Lbl t="Default Attendees" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 180, overflowY: "auto", padding: "8px 10px", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8 }}>
                    {mUsers.length === 0 && <div style={{ fontSize: 12, color: T.text2, fontStyle: "italic", padding: "4px 0" }}>No users added yet.</div>}
                    {mUsers.map(u => (
                      <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, cursor: "pointer", padding: "5px 4px", borderRadius: 5, transition: "background .1s" }}
                        onMouseEnter={e => e.currentTarget.style.background = T.bg}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <input type="checkbox"
                          checked={ensureArray(mtgPresets?.attendeeMap?.[type]).includes(u.name)}
                          onChange={e => {
                            const cur = ensureArray(mtgPresets?.attendeeMap?.[type]);
                            const next = e.target.checked ? [...cur, u.name] : cur.filter(n => n !== u.name);
                            setMtgPresets(prev => ({ ...prev, attendeeMap: { ...prev.attendeeMap, [type]: next } }));
                          }}
                          style={{ width: 15, height: 15, flexShrink: 0, cursor: "pointer", accentColor: T.navy }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: u.color || T.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{u.initials || (u.name || "?").slice(0, 2).toUpperCase()}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                            <div style={{ fontSize: 10, color: T.text2 }}>{u.role}</div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: T.text2, marginTop: 5 }}>{ensureArray(mtgPresets?.attendeeMap?.[type]).length} selected</div>
                </div>
                <div>
                  <Lbl t="Guidelines / Instructions (one per line)" />
                  <textarea value={ensureArray(mtgPresets?.instructions?.[type]).join("\n")}
                    disabled={!isAdmin}
                    onChange={e => { const next = e.target.value.split("\n").filter(l => l.trim() !== ""); setMtgPresets(prev => ({ ...prev, instructions: { ...prev.instructions, [type]: next } })); }}
                    style={{ fontSize: 12, height: 160, resize: "vertical", cursor: isAdmin ? "auto" : "not-allowed" }} />
                  <div style={{ fontSize: 11, color: T.text2, marginTop: 5 }}>{ensureArray(mtgPresets?.instructions?.[type]).length} guideline{ensureArray(mtgPresets?.instructions?.[type]).length !== 1 ? "s" : ""}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>}

      {/* ── MODALS (responsive width) ── */}
      {modal && (
        <div className="overlay" onClick={close}>
          <div className="modal" style={{ width: "min(520px, calc(100vw - 32px))", padding: "24px 20px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: T.navy }}>
                {modal.mode === "add" ? "Add" : "Edit"} {modal.type === "users" ? "User" : modal.type === "plants" ? "Plant" : modal.type === "machines" ? "Machine" : modal.type === "roles" ? "Role" : "Department"}
              </h2>
              <button onClick={close} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, color: T.text2, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            {modal.type === "users" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}><Lbl t="Full Name" req /><input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div style={{ gridColumn: "1/-1" }}><Lbl t="Username" req={!isGuestRole(form.role)} /><input value={form.username || ""} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Login username" /></div>
              <div><Lbl t="Role" req /><select value={form.role || ""} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}><option value="">Select</option>{roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</select></div>
              <div><Lbl t="Plant" req /><select value={form.plant || ""} onChange={e => setForm(f => ({ ...f, plant: e.target.value, dept: "" }))}><option value="">Select</option>{plants.map(p => <option key={p.id}>{p.name}</option>)}</select></div>
              <div><Lbl t="Dept" /><select value={form.dept || ""} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))}><option value="">Select</option>{depts.filter(d => !form.plant || !d.plant || d.plant === "All Plants" || d.plant === form.plant).map(d => <option key={d.id}>{d.name}</option>)}</select></div>
              <div><Lbl t="Superior (Reports To)" /><select value={form.superior || ""} onChange={e => setForm(f => ({ ...f, superior: e.target.value }))}><option value="">None (Top level)</option>{users.filter(u => u.id !== form.id).map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}</select></div>
              <div style={{ gridColumn: "1/-1" }}><Lbl t="Phone Number" /><input value={form.phone || ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91-98000-00000" /></div>
              <div style={{ gridColumn: "1/-1" }}><Lbl t="Email Address" /><input type="email" value={form.email || ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@company.com" /></div>
              {isAdmin && <label style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 10, fontSize: 12, cursor: "pointer", padding: "6px 0" }}>
                <input type="checkbox" checked={form.masterAccess === true} onChange={e => setForm(f => ({ ...f, masterAccess: e.target.checked }))} style={{ width: 16, height: 16, accentColor: T.navy }} />
                <span>Allow Master Setup access (plant-scoped)</span>
              </label>}
              {modal.mode !== "edit" && (
                <div style={{ gridColumn: "1/-1" }}>
                  <Lbl t="Password" req={!isGuestRole(form.role)} />
                  <div style={{ position: "relative" }}>
                    <input type={form._showPw ? "text" : "password"} value={form.password || ""} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Set login password" style={{ paddingRight: 44 }} />
                    <button type="button" onClick={() => setForm(f => ({ ...f, _showPw: !f._showPw }))} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: T.text2, lineHeight: 1, padding: 0, display: "flex", alignItems: "center" }}>{form._showPw ? "🙈" : "👁"}</button>
                  </div>
                </div>
              )}
              <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, justifyContent: "flex-end" }}><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-navy" onClick={saveUser}>Save</button></div>
            </div>}
            {modal.type === "roles" && <div style={{ display: "grid", gap: 12 }}>
              <div><Lbl t="Role Name" req /><input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter role name" /></div>
              <div><Lbl t="Hierarchy Level" req /><input type="number" min={1} value={form.level || ""} onChange={e => setForm(f => ({ ...f, level: e.target.value === "" ? "" : parseInt(e.target.value, 10) }))} placeholder="e.g. 1 (Highest) to 8 (Lowest)" /></div>
              <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={close}>Cancel</button>
                  <button className="btn btn-navy" onClick={() => {
                  if (!form.name || form.level === undefined || form.level === "") return;
                  const r = { ...form, id: form.id || "R" + String(Date.now()).slice(-6) };
                  if (modal.mode === "edit") {
                    setRoles(prev => prev.map(x => x.id === r.id ? r : x));
                    apiUpdate("roles", r.id, r);
                  } else {
                    setRoles(prev => [...prev, r]);
                    apiCreate("roles", r);
                  }
                  close();
                }}>Save</button>
              </div>
            </div>}
            {modal.type === "plants" && <div style={{ display: "grid", gap: 12 }}>
              <div><Lbl t="Plant Name" req /><input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Lbl t="Location" /><input value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
              {plantSaveStatus && plantSaveStatus !== "saving" && plantSaveStatus !== "ok" && (
                <div style={{ padding: "8px 12px", background: "#FEF3CD", border: "1px solid #F5C842", borderRadius: 8, fontSize: 12, color: "#7D4E00" }}>
                  ⚠ Save failed: {plantSaveStatus}. Data kept locally — use "Save to Server" to retry.
                </div>
              )}
              {plantSaveStatus === "ok" && (
                <div style={{ padding: "8px 12px", background: "#D4EDDA", border: "1px solid #28A745", borderRadius: 8, fontSize: 12, color: "#155724" }}>
                  ✓ Saved successfully.
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-navy" disabled={plantSaveStatus === "saving"} onClick={async () => { if (!form.name) return; setPlantSaveStatus("saving"); try { const p = { ...form, id: form.id || "P" + String(Date.now()).slice(-6) }; const updated = modal.mode === "edit" ? plants.map(x => x.id === p.id ? p : x) : [...plants, p]; setPlants(updated); await saveToAPI("Plants", updated); setPlantSaveStatus("ok"); setTimeout(() => { setPlantSaveStatus(null); close(); }, 800); } catch (err) { setPlantSaveStatus(err.message || "Unknown error"); } }}>{plantSaveStatus === "saving" ? "Saving…" : "Save"}</button></div>
            </div>}
            {modal.type === "depts" && <div style={{ display: "grid", gap: 12 }}>
              <div><Lbl t="Dept Name" req /><input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Lbl t="Plant" /><select value={form.plant || ""} onChange={e => setForm(f => ({ ...f, plant: e.target.value }))}><option value="">All Plants</option>{plants.map(p => <option key={p.id}>{p.name}</option>)}</select></div>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10 }}>
                <div><Lbl t="Icon" /><input value={form.icon || ""} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} /></div>
              </div>
              {deptSaveStatus && deptSaveStatus !== "saving" && deptSaveStatus !== "ok" && (
                <div style={{ padding: "8px 12px", background: "#FEF3CD", border: "1px solid #F5C842", borderRadius: 8, fontSize: 12, color: "#7D4E00" }}>
                  ⚠ Save failed: {deptSaveStatus}. Data kept locally — use "Save to Server" to retry.
                </div>
              )}
              {deptSaveStatus === "ok" && (
                <div style={{ padding: "8px 12px", background: "#D4EDDA", border: "1px solid #28A745", borderRadius: 8, fontSize: 12, color: "#155724" }}>
                  ✓ Saved successfully.
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-navy" disabled={deptSaveStatus === "saving"} onClick={async () => { if (!form.name) return; setDeptSaveStatus("saving"); try { const pMap = {}; plants.forEach(p => { pMap[p.name] = p.id; }); const d = { ...form, id: form.id || "D" + String(Date.now()).slice(-6), icon: form.icon || "🔹", plantId: pMap[form.plant] || form.plantId || null }; const updated = modal.mode === "edit" ? depts.map(x => x.id === d.id ? d : x) : [...depts, d]; setDepts(updated); await saveToAPI("Departments", updated); setDeptSaveStatus("ok"); setTimeout(() => { setDeptSaveStatus(null); close(); }, 800); } catch (err) { setDeptSaveStatus(err.message || "Unknown error"); } }}>{deptSaveStatus === "saving" ? "Saving…" : "Save"}</button></div>
            </div>}
            {modal.type === "machines" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}><Lbl t="Machine Name" req /><input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Furnace Line 1" /></div>
              <div><Lbl t="Plant" /><select value={form.plant || ""} onChange={e => setForm(f => ({ ...f, plant: e.target.value, dept: "" }))}><option value="">Select plant…</option>{plants.map(p => <option key={p.id}>{p.name}</option>)}</select></div>
              <div><Lbl t="Department" /><select value={form.dept || ""} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))}><option value="">Select dept…</option>{depts.filter(d => !form.plant || form.plant === "All Plants" || !d.plant || d.plant === "All Plants" || d.plant === form.plant).map(d => <option key={d.id}>{d.name}</option>)}</select></div>
              <div><Lbl t="Machine Type" /><input value={form.type || ""} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} placeholder="e.g. Furnace, Crane, Press" /></div>
              <div><Lbl t="Asset No." /><input value={form.assetNo || ""} onChange={e => setForm(f => ({ ...f, assetNo: e.target.value }))} placeholder="e.g. AST-001" /></div>
              {mcSaveStatus && mcSaveStatus !== "saving" && mcSaveStatus !== "ok" && (
                <div style={{ gridColumn: "1/-1", padding: "8px 12px", background: "#FEF3CD", border: "1px solid #F5C842", borderRadius: 8, fontSize: 12, color: "#7D4E00" }}>
                  ⚠ Save failed: {mcSaveStatus}. Machine saved locally — use "Save to Server" button to retry.
                </div>
              )}
              {mcSaveStatus === "ok" && (
                <div style={{ gridColumn: "1/-1", padding: "8px 12px", background: "#D4EDDA", border: "1px solid #28A745", borderRadius: 8, fontSize: 12, color: "#155724" }}>
                  ✓ Saved successfully.
                </div>
              )}
              <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={close}>Cancel</button>
                <button className="btn btn-navy" disabled={mcSaveStatus === "saving"} onClick={async () => {
                  if (!form.name) return;
                  const mc = { ...form, id: form.id || "MC" + String(Date.now()).slice(-6) };
                  const pMap = {}; plants.forEach(p => { pMap[p.name] = p.id; });
                  const dMap = {}; depts.forEach(d => { dMap[d.name] = d.id; });
                  mc.plantId = pMap[form.plant] || form.plantId || null;
                  mc.deptId = dMap[form.dept] || form.deptId || null;
                  const updated = modal.mode === "edit"
                    ? (machines || []).map(x => x.id === mc.id ? mc : x)
                    : [...(machines || []), mc];
                  setMachines(updated);
                  setMcSaveStatus("saving");
                  try {
                    await saveToAPI("Machines", updated);
                    setMcSaveStatus("ok");
                    setTimeout(() => { setMcSaveStatus(null); close(); }, 800);
                  } catch (err) {
                    console.error("Machine save failed:", err);
                    setMcSaveStatus(err.message || "Unknown error");
                  }
                }}>{mcSaveStatus === "saving" ? "Saving…" : "Save"}</button>
              </div>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== API BRIDGE ===================== */
/* Minimal REST-like API bridge — exposes actions data via a global object
   that external apps can read/write via postMessage or window.TMS_API (legacy window.MCS_API kept).
   Usage:
     window.TMS_API.getActions()         → all current actions
     window.TMS_API.getAction(id)        → specific action
     window.TMS_API.updateAction(id, patch) → update an action
     window.TMS_API.addAction(action)    → add a new action
    
    Via postMessage (iframe integration):
      window.postMessage({type:"TMS_GET_ACTIONS"},"*")  // legacy MCS_GET_ACTIONS also supported
      → response: {type:"TMS_ACTIONS_RESULT",data:[...]}
    
    This satisfies requirement #6 — API/MCP integration option.
*/

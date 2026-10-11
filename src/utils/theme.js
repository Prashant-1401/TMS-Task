/* eslint-disable react-refresh/only-export-components */


/* ===================== DESIGN TOKENS & CSS ===================== */
export const T = { navy: "#272262", navyD: "#1A1653", amber: "#E69903", amberL: "#FEF3CD", green: "#1E8449", greenL: "#D5F5E3", red: "#C0392B", redL: "#FADBD8", slate: "#7F8C8D", border: "#E8E8F0", bg: "#F5F5FB", white: "#FFFFFF", text: "#1A1532", text2: "#636E72" };

export const SC = { "IN PROCESS": { bg: "#FFF3CD", text: "#856404", dot: "#E69903" }, "NOT STARTED": { bg: "#EAE7F8", text: "#4A3F8C", dot: "#7C80B0" }, "COMPLETED": { bg: "#D5F5E3", text: "#1E6B3C", dot: "#27AE60" }, "DROPPED": { bg: "#F2F3F4", text: "#7F8C8D", dot: "#BDC3C7" }, "PENDING CONFIRM": { bg: "#FEF9E7", text: "#784212", dot: "#F39C12" } };

export const PC = { "CRITICAL": { bg: "#FADBD8", text: "#922B21" }, "WARNING": { bg: "#FEF9E7", text: "#784212" }, "NORMAL": { bg: "#EBF5FB", text: "#1A5276" } };

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Sora:wght@700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#F5F5FB;color:#1A1532;font-family:'Inter',sans-serif;font-size:14px;}
input,select,textarea{font-family:'Inter',sans-serif;font-size:13px;background:#fff;border:1.5px solid #E8E8F0;border-radius:8px;padding:8px 12px;color:#1A1532;outline:none;width:100%;transition:border-color .18s;direction:ltr;unicode-bidi:normal;color-scheme:light;}
input:focus,select:focus,textarea:focus{border-color:#272262;box-shadow:0 0 0 3px rgba(39,34,98,.08);}
input::placeholder,textarea::placeholder{color:#B2BEC3;}
input[type=date]{min-width:145px;appearance:auto;-moz-appearance:auto;-webkit-appearance:auto;}
input[type=date]::-webkit-calendar-picker-indicator{opacity:1;cursor:pointer;padding:4px;border-radius:4px;background:#fff;border:1px solid #E8E8F0;}
input[type=date]::-webkit-calendar-picker-indicator:hover{background:#F5F5FB;}
::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-thumb{background:#CBD5E0;border-radius:3px;}
.card{background:#fff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(39,34,98,.05);}
.card-hover{transition:transform .18s,box-shadow .18s;cursor:pointer;}
.card-hover:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(39,34,98,.13);}
.btn{border:none;border-radius:8px;cursor:pointer;font-family:'Inter',sans-serif;font-weight:600;font-size:13px;padding:9px 18px;display:inline-flex;align-items:center;gap:6px;transition:all .18s;white-space:nowrap;}
.btn-navy{background:#272262;color:#fff;}.btn-navy:hover{background:#1A1653;}
.btn-amber{background:#E69903;color:#fff;}.btn-amber:hover{background:#CA8500;}
.btn-green{background:#1E8449;color:#fff;}.btn-green:hover{background:#176339;}
.btn-ghost{background:transparent;color:#636E72;border:1.5px solid #E8E8F0;}.btn-ghost:hover{background:#F5F5FB;color:#1A1532;}
.btn-red{background:#C0392B;color:#fff;}.btn-red:hover{background:#A93226;}
.btn-sm{padding:6px 13px;font-size:12px;}.btn:disabled{opacity:.45;cursor:not-allowed;}
table{width:100%;border-collapse:collapse;}thead tr{background:#FAFAFE;}
th{padding:10px 14px;font-size:11px;font-weight:700;color:#636E72;letter-spacing:.5px;text-transform:uppercase;border-bottom:2px solid #E8E8F0;text-align:left;white-space:nowrap;}
td{padding:11px 14px;border-bottom:1px solid #F0F0F8;vertical-align:middle;font-size:13px;}
td.action-text{min-width:260px;max-width:420px;white-space:normal;word-break:break-word;line-height:1.4;}
tbody tr:hover td{background:#FAFAFE;}tbody tr:last-child td{border-bottom:none;}
table thead th{position:sticky;top:0;background:#fff;z-index:2;}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
@keyframes slideUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:none;}}
@keyframes slideInR{from{opacity:0;transform:translateX(60px);}to{opacity:1;transform:none;}}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:.2;}}
@keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.04);}}
.fade-in{animation:fadeIn .3s ease;}
.overlay{position:fixed;inset:0;background:rgba(26,21,50,.5);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto;animation:slideUp .3s ease;}
.side-panel{position:fixed;top:0;right:0;height:100vh;height:100dvh;background:#fff;box-shadow:-8px 0 40px rgba(0,0,0,.12);z-index:350;overflow-y:auto;-webkit-overflow-scrolling:touch;animation:slideInR .25s ease;}
.fab{position:fixed;bottom:28px;right:28px;width:52px;height:52px;border-radius:50%;background:#272262;color:#fff;border:none;font-size:26px;cursor:pointer;box-shadow:0 6px 24px rgba(39,34,98,.35);display:flex;align-items:center;justify-content:center;z-index:200;transition:all .2s;}
.fab:hover{background:#1A1653;transform:scale(1.08);}
.drag-over{background:#EAE7F8!important;border:2px dashed #272262!important;}
@media(max-width:640px){
  .master-mobile-cards{display:block!important;}
  .master-desktop-table{display:none!important;}
}
@media(min-width:641px){
  .master-mobile-cards{display:none!important;}
  .master-desktop-table{display:block!important;}
}
.org-node-card{width:clamp(96px,26vw,140px)!important;padding:8px 10px!important;}
@media(max-width:640px){
  .org-node-card{padding:6px 8px!important;}
  .org-node-card .org-avatar{width:28px!important;height:28px!important;font-size:11px!important;}
  .org-node-card .org-name{font-size:10px!important;}
  .org-node-card .org-role{font-size:9px!important;}
}
.kanban-card{transition:transform .15s,box-shadow .15s,opacity .15s;}
.kanban-card:active{cursor:grabbing!important;}
.kanban-card.is-dragging{opacity:.45;transform:scale(.97);box-shadow:none!important;}
.kanban-card.is-lifted{transform:rotate(2deg) scale(1.04);box-shadow:0 16px 40px rgba(39,34,98,.22)!important;cursor:grabbing!important;z-index:10;}
.confirm-banner{background:linear-gradient(90deg,#FEF9E7,#FFFDE0);border:1.5px solid #E69903;border-radius:10px;padding:12px 16px;animation:pulse 2s ease-in-out infinite;}

/* ─── MOBILE HAMBURGER MENU ─── */
.mbl-menu-btn{display:none;background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px;z-index:400;}
.mbl-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:399;}
@media(max-width:768px){
  .mbl-menu-btn{display:flex;align-items:center;justify-content:center;}
  .mbl-overlay.show{display:block;}
  .app-sidebar{position:fixed!important;left:-260px;top:0;height:100vh;height:100dvh;width:240px!important;z-index:401;transition:left .3s ease!important;}
  .app-sidebar.open{left:0!important;}
  .app-main{margin-left:0!important;}
  .app-content{padding:16px 12px!important;}
  .page-header-flex{flex-direction:column!important;gap:10px!important;}
  .page-header-actions{width:100%!important;justify-content:flex-start!important;flex-wrap:wrap;}
  .fab{bottom:20px;right:20px;width:48px;height:48px;font-size:22px;}
}
/* Hide Board/Kanban/Timeline view buttons on phones */
@media(max-width:768px){.hide-mobile{display:none!important;}}
@media(max-height:500px) and (orientation:landscape){.hide-mobile{display:none!important;}}
/* Landscape phones: viewport width > 768px but height is small — hide sidebar */
@media(max-height:500px) and (orientation:landscape){
  .mbl-menu-btn{display:flex;align-items:center;justify-content:center;}
  .mbl-overlay.show{display:block;}
  .app-sidebar{position:fixed!important;left:-260px;top:0;height:100vh;height:100dvh;width:240px!important;z-index:401;transition:left .3s ease!important;}
  .app-sidebar.open{left:0!important;}
  .app-main{margin-left:0!important;}
  .app-content{padding:16px 12px!important;}
}

/* ─── RESPONSIVE GRIDS ─── */
.grid-kpi-5{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;}
.grid-kpi-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
.grid-2col{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.grid-3col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;}
.grid-team-buckets{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
.filter-bar{display:flex;gap:12px;flex-wrap:nowrap;overflow-x:auto;align-items:center;}
@media(max-width:768px){
  .grid-kpi-5{grid-template-columns:repeat(2,1fr)!important;gap:10px!important;}
  .grid-kpi-4{grid-template-columns:repeat(2,1fr)!important;gap:10px!important;}
  .grid-2col{grid-template-columns:1fr!important;gap:14px!important;}
  .grid-3col{grid-template-columns:1fr!important;gap:14px!important;}
  .grid-team-buckets{grid-template-columns:repeat(4,1fr)!important;gap:4px!important;}
  .filter-bar{flex-wrap:wrap!important;overflow-x:visible!important;}
  .filter-bar select{width:100%!important;min-width:0!important;}
  .filter-bar input[type=text]{min-width:0!important;}
}
@media(min-width:769px) and (max-width:1024px){
  .grid-kpi-5{grid-template-columns:repeat(3,1fr)!important;}
  .grid-kpi-4{grid-template-columns:repeat(2,1fr)!important;}
}

/* ─── RESPONSIVE MODALS & PANELS ─── */
@media(max-width:768px){
  .modal{width:calc(100vw - 24px)!important;max-width:none!important;margin:12px!important;max-height:calc(100dvh - 24px)!important;border-radius:14px!important;}
  .side-panel{width:100vw!important;height:100dvh!important;border-radius:0!important;-webkit-overflow-scrolling:touch!important;}
  .overlay{padding:0!important;align-items:flex-end!important;}
}

/* ─── RESPONSIVE TABLES ─── */
.table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
@media(max-width:768px){
  .table-scroll table{min-width:600px;}
  td.action-text{min-width:180px!important;max-width:240px!important;font-size:12px!important;}
  th{font-size:10px!important;padding:8px 10px!important;}
  td{padding:8px 10px!important;font-size:12px!important;}
}

/* ─── LOGIN RESPONSIVE ─── */
@media(max-width:768px){
  .login-card{width:calc(100vw - 32px)!important;padding:24px 20px!important;}
}

/* ─── DASHBOARD STATUS BAR RESPONSIVE ─── */
.status-bar{display:flex;gap:0;align-items:center;}
@media(max-width:768px){
  .status-bar{flex-wrap:wrap;}
  .status-bar>div{min-width:45%;flex:1 1 45%;padding:10px 14px!important;}
}
`;
/* ===================== MICRO COMPONENTS ===================== */

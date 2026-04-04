const rolePermissions = {
  physician: ['encounter:write','encounter:sign','prescription:write','prescription:override','audit:self','patient:read','patient:write'],
  pharmacist: ['prescription:review','prescription:approve','prescription:dispense','prescription:void','inventory:write'],
  billing: ['billing:write','invoice:payment','patient:read'],
  inventory: ['inventory:write','inventory:count','product:configure'],
  admin: ['*','admin:unlock','patient:read','patient:write','patient:delete','overview:read'],
  auditor: ['audit:read','audit:export','patient:read','overview:read'],
  guest: []
};
function can(role, permission) { const perms = rolePermissions[role] || []; return perms.includes('*') || perms.includes(permission); }
module.exports = { can };

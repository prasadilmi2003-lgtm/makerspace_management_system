// Static demo data shared by the public site, dashboards and admin screens.
// Mirrors docs/makerspace_demo.html (the original product demo).

/** Eight workbench zones (A–H) on a 4×2 grid. status: available | occupied | reserved | maintenance */
const grid = (col, row) => [col * 3.6, row * 5.5, 3.2, 4.5];
export const ZONES = [
  { id: 'a', letter: 'A', name: 'Zone A — Welding Bay', short: 'Welding Bay', color: '#ff5a1f', rect: grid(0, 0), used: 0, cap: 4, status: 'available', icon: 'Flame',
    machines: ['MIG Welder — Lincoln 180', 'Angle Grinders', 'PPE Welding Masks'] },
  { id: 'b', letter: 'B', name: 'Zone B — PCB Station', short: 'PCB Station', color: '#3b82f6', rect: grid(1, 0), used: 3, cap: 4, status: 'occupied', icon: 'CircuitBoard',
    machines: ['Etch Tank', 'Soldering Stations', 'Bench PSU', 'Oscilloscopes'] },
  { id: 'c', letter: 'C', name: 'Zone C — 3D Printing', short: '3D Printing', color: '#22c55e', rect: grid(2, 0), used: 0, cap: 4, status: 'available', icon: 'Box',
    machines: ['Ender 3 Pro ×3', 'Elegoo Mars Resin', 'PLA Filament Store'] },
  { id: 'd', letter: 'D', name: 'Zone D — CNC Bay', short: 'CNC Bay', color: '#eab308', rect: grid(3, 0), used: 0, cap: 4, status: 'reserved', icon: 'Cpu',
    machines: ['3-Axis CNC Router', 'Pillar Drill', 'Bench Vises'] },
  { id: 'e', letter: 'E', name: 'Zone E — Assembly', short: 'Assembly', color: '#8b5cf6', rect: grid(0, 1), used: 3, cap: 4, status: 'occupied', icon: 'Wrench',
    machines: ['Assembly Benches', 'Hand Tool Wall', 'Composite Layup Table'] },
  { id: 'f', letter: 'F', name: 'Zone F — Laser Cutter', short: 'Laser Cutter', color: '#ec4899', rect: grid(1, 1), used: 0, cap: 4, status: 'available', icon: 'Zap',
    machines: ['60W CO₂ Laser Cutter', 'Extraction Fan'] },
  { id: 'g', letter: 'G', name: 'Zone G — Open Bench', short: 'Open Bench', color: '#14b8a6', rect: grid(2, 1), used: 0, cap: 4, status: 'available', icon: 'Armchair',
    machines: ['Open workbenches', 'Multimeters', 'Hand tools'] },
  { id: 'h', letter: 'H', name: 'Zone H — Open Bench', short: 'Open Bench', color: '#f97316', rect: grid(3, 1), used: 0, cap: 4, status: 'available', icon: 'Armchair',
    machines: ['Open workbenches', 'Multimeters', 'Hand tools'] },
];

export const ZONE_STATUS_LABEL = { available: 'Available', occupied: 'In Use', reserved: 'Reserved', maintenance: 'Maintenance' };
export const ZONE_STATUS_CHIP = { available: 'chip-ok', occupied: 'chip-brand', reserved: 'chip-info', maintenance: 'chip-warn' };

/** Opening hours, indexed by Date#getDay() (0 = Sunday). null = closed. [openHour, closeHour] */
export const HOURS = [
  { day: 'Sunday', range: null },
  { day: 'Monday', range: null },
  { day: 'Tuesday', range: [9, 17] },
  { day: 'Wednesday', range: [9, 17] },
  { day: 'Thursday', range: [9, 20] },
  { day: 'Friday', range: [9, 17] },
  { day: 'Saturday', range: [10, 14] },
];
export const fmtRange = (r) => (r ? `${String(r[0]).padStart(2, '0')}:00–${String(r[1]).padStart(2, '0')}:00` : 'Closed');

export const PROJECT_CATS = ['Formula Student', 'Robotics', 'Energy Systems', 'Fabrication', 'Fluid Mechanics', 'Machine Design', 'Electronics'];
export const PROJECT_YEARS = ['2026', '2025', '2024'];

export const PROJECTS = [
  { id: 1, title: 'Project Panther — Electric Race Car', cat: 'Formula Student', team: 'FS Team (14 members)', year: '2026', status: 'Active', icon: 'Car', hue: 195,
    desc: 'Full electric Formula Student vehicle for Formula Bharat. Custom BMS, CFRP monocoque chassis, in-wheel motors, regen braking system.' },
  { id: 2, title: '3-DOF Robotic Arm — PLC Controlled', cat: 'Robotics', team: 'Tharaka D., Ruwan W.', year: '2026', status: 'Completed', icon: 'Bot', hue: 18,
    desc: 'Servo-actuated 3-axis arm with Siemens S7 PLC sequencing and custom aluminium extrusion frame. Demonstrated pick-and-place automation.' },
  { id: 3, title: 'Solar MPPT Charge Controller', cat: 'Energy Systems', team: 'Shaminda P., Dilini W.', year: '2026', status: 'Active', icon: 'SunMedium', hue: 140,
    desc: 'Custom MPPT controller for 150W solar array. Buck converter topology, STM32 MCU, PCB designed in KiCad and fabricated in-house.' },
  { id: 4, title: 'FDM Printer Farm Enclosure', cat: 'Fabrication', team: 'Chamal B.', year: '2025', status: 'Completed', icon: 'Printer', hue: 270,
    desc: 'Temperature-controlled, fire-suppressed enclosure for 4-printer cluster. Remote monitoring via ESP32. Reduces warping by ~60%.' },
  { id: 5, title: 'Autonomous Water Sampling Drone', cat: 'Fluid Mechanics', team: 'Nadeesha F., 3 others', year: '2025', status: 'Completed', icon: 'Waves', hue: 45,
    desc: 'Multi-rotor aquatic UAV for water quality sampling. Onboard sensors for pH, TDS, temperature. GPS-guided mission planning via Mission Planner.' },
  { id: 6, title: 'Wire Shower Cleaning Robot', cat: 'Machine Design', team: 'Shaminda P.', year: '2025', status: 'Completed', icon: 'Wrench', hue: 205,
    desc: 'Sensor-guided linear carriage for paper mill wire cleaning. Replaces manual intervention. Designed for KASPA Papermills Pvt Ltd.' },
  { id: 7, title: 'Formula SAE Suspension Jig', cat: 'Formula Student', team: 'FS Mechanical Sub-team', year: '2025', status: 'Completed', icon: 'Settings', hue: 195,
    desc: 'Precision welding and alignment jig for double-wishbone suspension assembly. Reduced assembly time from 8h to 2.5h per corner.' },
  { id: 8, title: 'PLC-Controlled Conveyor Prototype', cat: 'Machine Design', team: 'Kasun J., 2 others', year: '2025', status: 'Completed', icon: 'Cog', hue: 12,
    desc: 'Industrial conveyor teaching model with variable speed, sensors, and HMI. Used in undergraduate automation lab demonstrations.' },
  { id: 9, title: 'Li-ion Battery Spot Welder', cat: 'Electronics', team: 'Sachini S.', year: '2024', status: 'Completed', icon: 'BatteryCharging', hue: 135,
    desc: 'High-current pulse welder for 18650 cell assembly. 555 timer control, MOSFET switching, adjustable pulse width. Built for FS battery pack.' },
  { id: 10, title: 'Wind Turbine Blade Profile Study', cat: 'Fluid Mechanics', team: 'Nadeesha F.', year: '2024', status: 'Completed', icon: 'Wind', hue: 50,
    desc: 'Comparative study of NACA profiles for small-scale HAWT blades. FDM-printed test profiles, wind tunnel validation, power coefficient analysis.' },
  { id: 11, title: 'Composite Bicycle Frame', cat: 'Fabrication', team: 'Final Year Group — 2024', year: '2024', status: 'Completed', icon: 'Bike', hue: 280,
    desc: 'Wet layup CFRP bicycle frame — final year project. Ply orientation optimised via FEA. 2.1 kg finished weight, 120 kg load tested.' },
  { id: 12, title: 'Servo Motor Test Bench', cat: 'Robotics', team: 'Tharaka D.', year: '2024', status: 'Completed', icon: 'Ruler', hue: 22,
    desc: 'Multi-axis servo characterisation bench with load cells, encoder feedback, and LabVIEW data acquisition. Used by three research groups.' },
];

export const MY_REQUESTS_SEED = [
  { id: 'req-001', title: 'Formula Student Chassis Welding — Session 3', date: 'Thu 12 Jun', keyholder: 'Kasun Jayawardena', zone: 'Zone A — Welding Bay', estEnd: 'Est. end 18:00 today', stage: 'active' },
  { id: 'req-002', title: 'PCB Etching — MPPT Controller Rev 2', date: 'Thu 12 Jun', keyholder: 'Awaiting Keyholder', zone: 'Zone B — PCB Station', estEnd: '~3 hours', stage: 'pending' },
  { id: 'req-003', title: 'Robotic Arm — Final Assembly & Test', date: 'Mon 9 Jun', keyholder: 'Sachini Senanayake', zone: 'Zone E — Assembly', estEnd: 'Completed in 4.5h', stage: 'completed' },
];

export const STAGES = ['pending', 'claimed', 'key_retrieved', 'active', 'completed'];
export const STAGE_LABEL = { pending: 'Pending', claimed: 'Claimed', key_retrieved: 'Key Out', active: 'Active', completed: 'Completed' };
export const STAGE_CHIP = { pending: 'chip-warn', claimed: 'chip-info', key_retrieved: 'chip-info', active: 'chip-ok', completed: 'chip-mute' };

export const DURATIONS = ['1 hour', '2 hours', '3 hours', '4 hours', 'Half day', 'Full day'];

export const INVENTORY_SEED = [
  ['MIG Welder — Lincoln 180', 'Welding', 1, 'Good', 'Available', '10 Jun'], ['Angle Grinder — Bosch 115mm', 'Welding', 2, 'Good', 'Available', '10 Jun'],
  ['CNC Router — 3-Axis', 'Machining', 1, 'Good', 'Checked Out', '12 Jun'], ['Drill Press — Pillar', 'Machining', 1, 'Needs Maintenance', 'Available', '08 Jun'],
  ['FDM Printer — Ender 3 Pro', '3D Printing', 3, 'Good', 'Available', '11 Jun'], ['Resin Printer — Elegoo Mars', '3D Printing', 1, 'Good', 'Available', '09 Jun'],
  ['Laser Cutter — 60W CO₂', 'Laser', 1, 'Good', 'Checked Out', '12 Jun'], ['Oscilloscope — Rigol DS1054Z', 'Electronics', 2, 'Good', 'Available', '11 Jun'],
  ['Soldering Station — Hakko', 'Electronics', 4, 'Good', 'Available', '10 Jun'], ['PCB Etch Tank', 'Electronics', 1, 'Damaged', 'Available', '07 Jun'],
  ['Bench PSU — 30V/5A', 'Electronics', 3, 'Good', 'Available', '11 Jun'], ['Multimeter — Fluke 117', 'Electronics', 5, 'Good', 'Available', '10 Jun'],
  ['Hand Tool Set (complete)', 'Hand Tools', 6, 'Good', 'Available', '12 Jun'], ['Torque Wrench Set', 'Hand Tools', 2, 'Good', 'Available', '08 Jun'],
  ['PPE Kit — Safety Glasses', 'Safety', 12, 'Good', 'Available', '12 Jun'], ['PPE Kit — Welding Mask', 'Safety', 4, 'Good', 'Available', '10 Jun'],
  ['Fire Extinguisher — CO₂', 'Safety', 3, 'Good', 'Available', '01 Jun'], ['Bench Vise — 150mm', 'Fixtures', 4, 'Good', 'Available', '09 Jun'],
  ['Aluminium Stock — 6061 T6', 'Consumables', 8, 'Good', 'Available', '12 Jun'], ['PLA Filament — 1kg Spools', 'Consumables', 6, 'Good', 'Available', '12 Jun'],
  ['PCB Etchant — Ferric Chloride', 'Consumables', 3, 'Good', 'Available', '07 Jun'], ['Epoxy Resin Kit', 'Consumables', 2, 'Good', 'Available', '09 Jun'],
  ['MIG Welding Wire — 0.8mm', 'Consumables', 5, 'Good', 'Available', '10 Jun'], ['Cutting Discs — 115mm', 'Consumables', 20, 'Damaged', 'Available', '06 Jun'],
].map(([name, cat, qty, cond, status, checked]) => ({ name, cat, qty, cond, status, checked }));

export const PROCEDURE_SEED = [
  { v: '2.4', date: '10 Jun 2026', sigs: 142, current: true },
  { v: '2.3', date: '15 Jan 2026', sigs: 98, current: false },
  { v: '2.2', date: '8 Aug 2025', sigs: 76, current: false },
];

export const PEOPLE = {};

/** Browser-side CSV download (used by the Export buttons). */
export const downloadCsv = (filename, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

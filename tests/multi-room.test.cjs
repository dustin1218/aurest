const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const ctx = { nightsBetween: (a, b) => (new Date(b) - new Date(a)) / 864e5 };
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync("js/data.js", "utf8") +
    "\n" +
    fs.readFileSync("js/finance.js", "utf8") +
    `
let reservations=[];
function getRooms(){return rooms;}
function getAllRooms(){return rooms;}
function allBookings(){return reservations;}
const mixed={id:'test',roomId:'R001',roomItems:[{roomId:'R001',quantity:1},{roomId:'R018',quantity:1}],rooms:2,checkin:'2099-01-01',checkout:'2099-01-03',status:'Pending'};
const selectedRoom=selectionRoom(mixed);
if(rooms.length!==18 || new Set(rooms.map(r=>r.id)).size!==18) throw Error('Catalog IDs');
if(selectedRoom.price*2!==50800 || selectedRoom.guests*2!==10) throw Error('Mixed totals and capacity');
const charges=roomChargeLines(mixed);
if(charges.length!==2 || charges.reduce((sum,i)=>sum+i.subtotal,0)!==101600) throw Error('Itemized prices');
const saved={...mixed,total:101600,roomItems:charges};
const original=rooms[0].price; rooms[0].price=999999;
if(roomChargeLines(saved)[0].subtotal!==5600) throw Error('Saved rate changed with catalog');
rooms[0].price=original;
if(rooms.some(r=>r.units!==1) || new Set(rooms.map(r=>r.roomNumber)).size!==18) throw Error('Individual rooms');
reservations.push(mixed);
if(roomsFree('R001','2099-01-01','2099-01-03')!==0) throw Error('Classic inventory');
if(roomsFree('R018','2099-01-01','2099-01-03')!==0) throw Error('Royal inventory');
if(roomsFree('R018','2099-01-03','2099-01-04')!==1) throw Error('Adjacent stays');
if(roomsFree('R018','2099-01-01','2099-01-03','test')!==1) throw Error('Reschedule exclusion');
reservations.push({...mixed,id:'second'});
if(selectionFree(mixed,'2099-01-01','2099-01-03')) throw Error('Overbooking allowed');
reservations.forEach(b=>b.status='Cancelled');
if(!selectionFree(mixed,'2099-01-01','2099-01-03')) throw Error('Cancellation inventory');
reservations=[{id:'legacy',roomId:'R001',rooms:3,checkin:'2099-01-01',checkout:'2099-01-03',status:'Pending'}];
if(roomsFree('R001','2099-01-01','2099-01-03')!==0) throw Error('Legacy inventory');
`,
  ctx,
);
console.log(
  "PASS: mixed-room pricing, capacity, availability, cancellation, rescheduling and legacy bookings",
);
